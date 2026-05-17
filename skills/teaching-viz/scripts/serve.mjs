#!/usr/bin/env node

/**
 * serve.mjs — Starts the teaching visualization server.
 *
 * Usage:
 *   node serve.mjs --dir <content-dir> [--port 38888]
 *   node serve.mjs --stop [--port 38888]
 *
 * Requires the skill's assets/ directory to contain the pre-built server bundle.
 */

import { readdirSync, readFileSync, existsSync, statSync, writeFileSync, unlinkSync } from 'node:fs';
import { join, dirname, normalize, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync, spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);

// Parse arguments
function parseArgs(args) {
  const parsed = { dir: null, port: 38888, stop: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dir' && args[i + 1]) { parsed.dir = resolve(args[++i]); }
    else if (args[i] === '--port' && args[i + 1]) { parsed.port = parseInt(args[++i], 10); }
    else if (args[i] === '--stop') { parsed.stop = true; }
  }
  return parsed;
}

const opts = parseArgs(args);

// ── Stop mode ──
if (opts.stop) {
  try {
    const result = execSync(`lsof -ti :${opts.port} 2>/dev/null`).toString().trim();
    if (result) {
      const pids = result.split('\n').filter(Boolean);
      for (const pid of pids) {
        try { process.kill(parseInt(pid, 10), 'SIGTERM'); } catch {}
      }
      console.log(`Stopped server(s) on port ${opts.port} (PIDs: ${pids.join(', ')})`);
    } else {
      console.log(`No server running on port ${opts.port}`);
    }
  } catch {
    console.log(`No server running on port ${opts.port}`);
  }
  process.exit(0);
}

// ── Start mode ──
if (!opts.dir) {
  console.error('Error: --dir is required. Usage: node serve.mjs --dir <content-dir> [--port 38888]');
  process.exit(1);
}

if (!existsSync(opts.dir)) {
  console.error(`Error: Directory does not exist: ${opts.dir}`);
  process.exit(1);
}

// Check port availability
try {
  const existing = execSync(`lsof -ti :${opts.port} 2>/dev/null`).toString().trim();
  if (existing) {
    console.error(`Error: Port ${opts.port} is already in use (PID: ${existing.trim()}). Use --stop first or choose a different port.`);
    process.exit(1);
  }
} catch {}

// ── Inline Hono server ──
// We use a dynamic import approach to check for hono availability
const SKILL_DIR = join(__dirname, '..');
const ASSETS_DIR = join(SKILL_DIR, 'assets');
const WEB_DIST_DIR = join(ASSETS_DIR, 'web-dist');

// Directories to exclude when listing cases
const EXCLUDED_CASE_DIRS = new Set([
  'lib', 'content', 'source', 'assets', 'apps',
  'node_modules', 'dist', '.git', '.playwright-mcp',
]);

/**
 * Auto-detect where cases live.
 * If rootDir has a `cases/` subdirectory with case-like subdirs (containing
 * index.mjs or knowledge.md), use rootDir/cases/ as the cases directory.
 * Otherwise, treat rootDir itself as the cases directory.
 * Returns { casesDir, projectRoot }.
 */
function detectLayout(rootDir) {
  const candidate = join(rootDir, 'cases');
  if (!existsSync(candidate) || !statSync(candidate).isDirectory()) {
    // rootDir has no cases/ subdir → rootDir IS the cases dir
    // project root is likely the parent
    return { casesDir: rootDir, projectRoot: dirname(rootDir) };
  }

  const entries = readdirSync(candidate, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('_') && !d.name.startsWith('.') && !EXCLUDED_CASE_DIRS.has(d.name));

  // If at least one subdir looks like a case (has index.mjs or knowledge.md), use it
  const hasCases = entries.some(d => {
    const dir = join(candidate, d.name);
    return existsSync(join(dir, 'index.mjs')) || existsSync(join(dir, 'knowledge.md'));
  });

  if (hasCases) {
    return { casesDir: candidate, projectRoot: rootDir };
  }
  return { casesDir: rootDir, projectRoot: dirname(rootDir) };
}

/**
 * Walk up the directory tree to find a node_modules directory containing a given package.
 */
function findNodeModulesFile(pkg, subpath, startDir) {
  let dir = startDir;
  for (let i = 0; i < 10; i++) {
    const p = join(dir, 'node_modules', pkg, subpath);
    if (existsSync(p)) return p;
    const parent = dirname(dir);
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }
  return null;
}

/**
 * Search for a vendor package file across multiple search roots.
 * Checks: skill assets → skill node_modules → each search root's node_modules tree → deep scan.
 */
function findVendorFile(pkg, subpath, searchRoots) {
  // Skill-level searches
  const assetPath = join(ASSETS_DIR, 'vendor', subpath.split('/').pop());
  if (existsSync(assetPath)) return assetPath;
  const skillPath = join(__dirname, 'node_modules', pkg, subpath);
  if (existsSync(skillPath)) return skillPath;

  // Walk up from each search root
  for (const root of searchRoots) {
    const found = findNodeModulesFile(pkg, subpath, root);
    if (found) return found;
  }

  // Deep scan: look in subdirectories' node_modules (handles pnpm monorepos where
  // deps are in apps/*/node_modules/ rather than root node_modules/)
  for (const root of searchRoots) {
    const found = scanForPackage(root, pkg, subpath, 3);
    if (found) return found;
  }
  return null;
}

/**
 * Scan directory tree (up to maxDepth) for node_modules/<pkg>/<subpath>.
 */
function scanForPackage(baseDir, pkg, subpath, maxDepth) {
  if (maxDepth <= 0) return null;
  try {
    const entries = readdirSync(baseDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === 'node_modules') {
        const p = join(baseDir, 'node_modules', pkg, subpath);
        if (existsSync(p)) return p;
      } else if (!entry.name.startsWith('.') && entry.name !== 'dist' && entry.name !== '.git') {
        const found = scanForPackage(join(baseDir, entry.name), pkg, subpath, maxDepth - 1);
        if (found) return found;
      }
    }
  } catch {}
  return null;
}

async function startServer() {
  let Hono, serve, streamSSE;
  try {
    const honoModule = await import('hono');
    Hono = honoModule.Hono;
    const nodeServer = await import('@hono/node-server');
    serve = nodeServer.serve;
    streamSSE = (await import('hono/streaming')).streamSSE;
  } catch (e) {
    console.error('Error: Missing dependencies. Install hono and @hono/node-server:');
    console.error('  npm install hono @hono/node-server');
    process.exit(1);
  }

  const rootDir = opts.dir;
  const { casesDir, projectRoot } = detectLayout(rootDir);
  // Search roots for vendor/excalidraw lookups: projectRoot + rootDir + parent of rootDir
  const searchRoots = [rootDir, projectRoot, dirname(rootDir)];

  const app = new Hono();

  // CORS
  app.use('*', async (c, next) => {
    await next();
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  });

  // Vendor JS routes — search multiple locations for packages
  const vendorFiles = {
    '/vendor/marked.js': ['marked', 'lib/marked.umd.js'],
    '/vendor/mermaid.js': ['mermaid', 'dist/mermaid.min.js'],
    '/vendor/d3.js': ['d3', 'dist/d3.min.js'],
    '/vendor/markmap-view.js': ['markmap-view', 'dist/browser/index.js'],
    '/vendor/markmap-lib.js': ['markmap-lib', 'dist/browser/index.iife.js'],
  };

  for (const [route, [pkg, subpath]] of Object.entries(vendorFiles)) {
    app.get(route, (c) => {
      const found = findVendorFile(pkg, subpath, searchRoots);
      if (found) {
        const content = readFileSync(found);
        return c.body(content, 200, { 'Content-Type': 'application/javascript' });
      }
      return c.json({ error: `Vendor file not found: ${pkg}/${subpath}` }, 404);
    });
  }

  // Serve pre-built frontend
  app.get('*', async (c, next) => {
    const urlPath = c.req.path;

    // API routes and vendor routes pass through
    if (urlPath.startsWith('/api/') || urlPath.startsWith('/vendor/')) return next();

    // Serve static files from web-dist
    let filePath = urlPath === '/' ? '/index.html' : urlPath;
    const fullPath = join(WEB_DIST_DIR, filePath);

    if (existsSync(fullPath) && statSync(fullPath).isFile()) {
      const ext = extname(fullPath);
      const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
      const content = readFileSync(fullPath);
      return c.body(content, 200, { 'Content-Type': types[ext] || 'application/octet-stream' });
    }

    // SPA fallback
    const indexPath = join(WEB_DIST_DIR, 'index.html');
    if (existsSync(indexPath)) {
      const content = readFileSync(indexPath);
      return c.body(content, 200, { 'Content-Type': 'text/html' });
    }

    return next();
  });

  // Safety check
  function isPathSafe(requestedPath, allowedBase) {
    const resolved = normalize(join(allowedBase, requestedPath));
    return resolved.startsWith(normalize(allowedBase));
  }

  // ── Flexible lib path: check casesDir/lib/ and rootDir/cases/lib/ ──
  function resolveLibDir() {
    const primary = join(casesDir, 'lib');
    if (existsSync(primary) && statSync(primary).isDirectory()) return primary;
    const secondary = join(rootDir, 'lib');
    if (existsSync(secondary) && statSync(secondary).isDirectory()) return secondary;
    return null;
  }

  // ── Find excalidraw files in project ──
  // Search both projectRoot and rootDir (and parent dirs) for excalidraw assets
  function findExcalidrawDir() {
    const allSearchDirs = [
      join(projectRoot, 'source', 'assets'),
      join(projectRoot, 'assets'),
      join(projectRoot, 'content'),
      join(rootDir, 'source', 'assets'),
      join(rootDir, 'assets'),
      join(rootDir, 'content'),
      join(casesDir, 'source', 'assets'),
      join(casesDir, 'assets'),
      join(casesDir, 'content'),
      // Also check parent of rootDir in case --dir points to a subdirectory
      join(dirname(rootDir), 'source', 'assets'),
      join(dirname(rootDir), 'assets'),
      join(dirname(rootDir), 'content'),
    ];
    // Deduplicate
    const seen = new Set();
    const searchDirs = allSearchDirs.filter(d => {
      if (seen.has(d)) return false;
      seen.add(d);
      return true;
    });
    for (const d of searchDirs) {
      if (existsSync(d) && statSync(d).isDirectory()) {
        const files = readdirSync(d).filter(f => f.endsWith('.excalidraw'));
        if (files.length > 0) return d;
      }
    }
    return null;
  }

  function findExcalidrawGlobal() {
    // Try well-known locations across projectRoot, rootDir, and parent
    const allSearchPaths = [
      join(projectRoot, 'source', 'assets', 'overview.excalidraw'),
      join(projectRoot, 'assets', 'overview.excalidraw'),
      join(projectRoot, 'content', 'overview.excalidraw'),
      join(rootDir, 'source', 'assets', 'overview.excalidraw'),
      join(rootDir, 'assets', 'overview.excalidraw'),
      join(rootDir, 'content', 'overview.excalidraw'),
      join(casesDir, 'source', 'assets', 'overview.excalidraw'),
      join(casesDir, 'assets', 'overview.excalidraw'),
      join(casesDir, 'content', 'overview.excalidraw'),
      join(dirname(rootDir), 'source', 'assets', 'overview.excalidraw'),
      join(dirname(rootDir), 'assets', 'overview.excalidraw'),
      join(dirname(rootDir), 'content', 'overview.excalidraw'),
    ];
    // Deduplicate
    const seen = new Set();
    const searchPaths = allSearchPaths.filter(p => {
      if (seen.has(p)) return false;
      seen.add(p);
      return true;
    });
    for (const p of searchPaths) {
      if (existsSync(p)) return p;
    }

    // Scan excalidraw directories for overview
    const excalidrawDir = findExcalidrawDir();
    if (excalidrawDir) {
      const overview = join(excalidrawDir, 'overview.excalidraw');
      if (existsSync(overview)) return overview;
      // Return first .excalidraw found
      const files = readdirSync(excalidrawDir).filter(f => f.endsWith('.excalidraw')).sort();
      if (files.length > 0) return join(excalidrawDir, files[0]);
    }
    return null;
  }

  /**
   * Find section-level excalidraw fallback for a case based on its group.
   * Matches the reference server's behavior: cases in certain groups get a
   * section-level diagram instead of the global overview.
   */
  function findExcalidrawForGroup(group) {
    const excalidrawDir = findExcalidrawDir();
    if (!excalidrawDir) return null;

    // Look for section-level files that might match the group
    // Reference uses: 运行时安全 → section-3-fuses.excalidraw
    const groupToPatterns = {
      '运行时安全': ['section-3', 'fuses', 'safety', 'fuse'],
      '容错机制': ['section-2', 'fault', 'tolerance', 'retry'],
      '流式响应': ['section-1', 'streaming', 'stream', 'sse'],
    };

    const patterns = groupToPatterns[group] || [];
    const allFiles = readdirSync(excalidrawDir).filter(f => f.endsWith('.excalidraw')).sort();

    for (const pattern of patterns) {
      const match = allFiles.find(f => f.toLowerCase().includes(pattern.toLowerCase()));
      if (match) return join(excalidrawDir, match);
    }
    return null;
  }

  // GET /api/cases
  app.get('/api/cases', (c) => {
    try {
      const entries = readdirSync(casesDir, { withFileTypes: true })
        .filter(d =>
          d.isDirectory() &&
          !d.name.startsWith('_') &&
          !d.name.startsWith('.') &&
          !EXCLUDED_CASE_DIRS.has(d.name)
        )
        .map(d => d.name)
        .sort();

      const cases = entries.map(caseId => {
        const caseDir = join(casesDir, caseId);

        // Try to parse metadata from index.mjs
        const indexPath = join(caseDir, 'index.mjs');
        let title = caseId, group = '未分组', description = '';
        if (existsSync(indexPath)) {
          const content = readFileSync(indexPath, 'utf-8');
          title = (content.match(/@title\s+(.+)/) || [])[1]?.trim() || caseId;
          group = (content.match(/@group\s+(.+)/) || [])[1]?.trim() || '未分组';
          description = (content.match(/@description\s+(.+)/) || [])[1]?.trim() || '';
        }

        const files = readdirSync(caseDir).filter(f => !f.startsWith('_')).sort();
        const hasOwnExcalidraw = existsSync(join(caseDir, 'overview.excalidraw'));

        const content = {
          knowledge: existsSync(join(caseDir, 'knowledge.md')),
          diagram: existsSync(join(caseDir, 'diagram.mmd')),
          interactive: existsSync(join(caseDir, 'interactive.html')),
          mindmap: existsSync(join(caseDir, 'mindmap.md')),
          excalidraw: hasOwnExcalidraw,
        };

        return { id: caseId, title, group, description, entryFile: 'index.mjs', files, content };
      });

      // Compute section numbers from group ordering (match reference server behavior)
      const groupCounters = {};
      for (const c of cases) {
        groupCounters[c.group] = (groupCounters[c.group] || 0) + 1;
      }
      // Assign section numbers based on order of first appearance
      const groupOrder = [];
      for (const c of cases) {
        if (!groupOrder.includes(c.group)) groupOrder.push(c.group);
      }
      const groupIndex = {};
      const groupSubCounters = {};
      for (const c of cases) {
        const gIdx = groupOrder.indexOf(c.group) + 1;
        groupSubCounters[c.group] = (groupSubCounters[c.group] || 0) + 1;
        c.section = `${gIdx}.${groupSubCounters[c.group]}`;
      }

      return c.json(cases);
    } catch (err) {
      return c.json({ error: err.message }, 500);
    }
  });

  // GET /api/excalidraw/overview
  app.get('/api/excalidraw/overview', (c) => {
    const filepath = findExcalidrawGlobal();
    if (!filepath) return c.json({ error: 'not found' }, 404);
    try { return c.json(JSON.parse(readFileSync(filepath, 'utf-8'))); }
    catch (err) { return c.json({ error: err.message }, 500); }
  });

  // GET /api/excalidraw/cases/:caseId
  app.get('/api/excalidraw/cases/:caseId', (c) => {
    const caseId = c.req.param('caseId');
    const caseDir = join(casesDir, caseId);

    // Case-level excalidraw (prefer overview.excalidraw like reference server)
    const overviewPath = join(caseDir, 'overview.excalidraw');
    if (existsSync(overviewPath)) {
      try { return c.json(JSON.parse(readFileSync(overviewPath, 'utf-8'))); }
      catch (err) { return c.json({ error: err.message }, 500); }
    }

    // Section-level fallback: check if the case's group has a section excalidraw
    const indexPath = join(caseDir, 'index.mjs');
    if (existsSync(indexPath)) {
      const content = readFileSync(indexPath, 'utf-8');
      const group = (content.match(/@group\s+(.+)/) || [])[1]?.trim() || '';
      const sectionPath = findExcalidrawForGroup(group);
      if (sectionPath) {
        try { return c.json(JSON.parse(readFileSync(sectionPath, 'utf-8'))); }
        catch (err) { return c.json({ error: err.message }, 500); }
      }
    }

    // No own excalidraw and no section fallback → 404 (matches reference server behavior)

    return c.json({ error: 'not found' }, 404);
  });

  // GET /api/excalidraw/section/:name
  app.get('/api/excalidraw/section/:name', (c) => {
    const name = c.req.param('name');
    const excalidrawDir = findExcalidrawDir();
    if (!excalidrawDir) return c.json({ error: 'not found' }, 404);

    const filepath = join(excalidrawDir, `${name}.excalidraw`);
    if (!existsSync(filepath)) return c.json({ error: 'not found' }, 404);
    try { return c.json(JSON.parse(readFileSync(filepath, 'utf-8'))); }
    catch (err) { return c.json({ error: err.message }, 500); }
  });

  // GET /api/file/cases/:caseId/:file
  app.get('/api/file/cases/:caseId/:file', (c) => {
    const caseId = c.req.param('caseId');
    const file = c.req.param('file');
    const filepath = join(casesDir, caseId, file);

    if (!isPathSafe(join(caseId, file), casesDir)) return c.json({ error: 'forbidden' }, 403);
    if (!existsSync(filepath)) return c.json({ error: 'not found' }, 404);

    try { return c.text(readFileSync(filepath, 'utf-8')); }
    catch (err) { return c.json({ error: err.message }, 500); }
  });

  // GET /api/file/lib/:file
  app.get('/api/file/lib/:file', (c) => {
    const file = c.req.param('file');
    const libDir = resolveLibDir();
    if (!libDir) return c.json({ error: 'lib directory not found' }, 404);

    const filepath = join(libDir, file);
    if (!isPathSafe(file, libDir)) return c.json({ error: 'forbidden' }, 403);
    if (!existsSync(filepath)) return c.json({ error: 'not found' }, 404);

    try { return c.text(readFileSync(filepath, 'utf-8')); }
    catch (err) { return c.json({ error: err.message }, 500); }
  });

  // Start
  serve({ fetch: app.fetch, port: opts.port }, () => {
    console.log(`Teaching Viz -> http://localhost:${opts.port}`);
    console.log(`Content dir: ${rootDir}`);
    if (casesDir !== rootDir) console.log(`Cases dir:  ${casesDir}`);
    if (projectRoot !== rootDir) console.log(`Project root: ${projectRoot}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
