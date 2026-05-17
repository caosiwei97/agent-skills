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
  const app = new Hono();

  // CORS
  app.use('*', async (c, next) => {
    await next();
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  });

  // Vendor JS routes — try to serve from server's node_modules or skill assets
  const vendorDir = join(ASSETS_DIR, 'vendor');
  const vendorFiles = {
    '/vendor/marked.js': ['marked', 'lib/marked.umd.js'],
    '/vendor/mermaid.js': ['mermaid', 'dist/mermaid.min.js'],
    '/vendor/d3.js': ['d3', 'dist/d3.min.js'],
    '/vendor/markmap-view.js': ['markmap-view', 'dist/browser/index.js'],
    '/vendor/markmap-lib.js': ['markmap-lib', 'dist/browser/index.iife.js'],
  };

  for (const [route, [pkg, subpath]] of Object.entries(vendorFiles)) {
    app.get(route, (c) => {
      // Try assets/vendor first, then node_modules
      const assetPath = join(vendorDir, subpath.split('/').pop());
      const modulePath = join(__dirname, 'node_modules', pkg, subpath);

      for (const p of [assetPath, modulePath]) {
        if (existsSync(p)) {
          const content = readFileSync(p);
          return c.body(content, 200, { 'Content-Type': 'application/javascript' });
        }
      }
      return c.json({ error: `Vendor file not found: ${pkg}/${subpath}` }, 404);
    });
  }

  // Serve pre-built frontend
  app.get('*', async (c, next) => {
    const urlPath = c.req.path;

    // API routes pass through
    if (urlPath.startsWith('/api/')) return next();

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

  // ── Flexible lib path: check rootDir/lib/ and rootDir/cases/lib/ ──
  function resolveLibDir() {
    const primary = join(rootDir, 'lib');
    if (existsSync(primary) && statSync(primary).isDirectory()) return primary;
    const secondary = join(rootDir, 'cases', 'lib');
    if (existsSync(secondary) && statSync(secondary).isDirectory()) return secondary;
    return null;
  }

  // ── Flexible excalidraw fallback: check multiple locations ──
  function findExcalidrawGlobal() {
    const searchPaths = [
      join(rootDir, 'content', 'overview.excalidraw'),
      join(rootDir, 'assets', 'overview.excalidraw'),
      join(rootDir, 'source', 'assets', 'overview.excalidraw'),
    ];
    // Also scan for any .excalidraw in assets/ and content/
    for (const dir of [join(rootDir, 'assets'), join(rootDir, 'content'), join(rootDir, 'source', 'assets')]) {
      if (existsSync(dir) && statSync(dir).isDirectory()) {
        const files = readdirSync(dir).filter(f => f.endsWith('.excalidraw'));
        for (const f of files) {
          const p = join(dir, f);
          if (!searchPaths.includes(p)) searchPaths.push(p);
        }
      }
    }
    for (const p of searchPaths) {
      if (existsSync(p)) return p;
    }
    return null;
  }

  // GET /api/cases
  app.get('/api/cases', (c) => {
    try {
      const casesDir = rootDir;
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
        let title = caseId, group = '', description = '';
        if (existsSync(indexPath)) {
          const content = readFileSync(indexPath, 'utf-8');
          title = (content.match(/@title\s+(.+)/) || [])[1]?.trim() || caseId;
          group = (content.match(/@group\s+(.+)/) || [])[1]?.trim() || '';
          description = (content.match(/@description\s+(.+)/) || [])[1]?.trim() || '';
        }

        const files = readdirSync(caseDir).filter(f => !f.startsWith('_')).sort();
        const hasOwnExcalidraw = readdirSync(caseDir).some(f => f.endsWith('.excalidraw'));

        const content = {
          knowledge: existsSync(join(caseDir, 'knowledge.md')),
          diagram: existsSync(join(caseDir, 'diagram.mmd')),
          interactive: existsSync(join(caseDir, 'interactive.html')),
          mindmap: existsSync(join(caseDir, 'mindmap.md')),
          excalidraw: hasOwnExcalidraw,
        };

        return { id: caseId, title, group, description, entryFile: 'index.mjs', files, content };
      });

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
    const caseDir = join(rootDir, caseId);

    // Case-level excalidraw
    const excalidrawFiles = existsSync(caseDir) ? readdirSync(caseDir).filter(f => f.endsWith('.excalidraw')) : [];
    if (excalidrawFiles.length > 0) {
      try { return c.json(JSON.parse(readFileSync(join(caseDir, excalidrawFiles[0]), 'utf-8'))); }
      catch (err) { return c.json({ error: err.message }, 500); }
    }

    // Global fallback (flexible paths)
    const globalPath = findExcalidrawGlobal();
    if (globalPath) {
      try { return c.json(JSON.parse(readFileSync(globalPath, 'utf-8'))); }
      catch (err) { return c.json({ error: err.message }, 500); }
    }

    return c.json({ error: 'not found' }, 404);
  });

  // GET /api/file/cases/:caseId/:file
  app.get('/api/file/cases/:caseId/:file', (c) => {
    const caseId = c.req.param('caseId');
    const file = c.req.param('file');
    const filepath = join(rootDir, caseId, file);

    if (!isPathSafe(join(caseId, file), rootDir)) return c.json({ error: 'forbidden' }, 403);
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
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
