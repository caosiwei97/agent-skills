#!/usr/bin/env node

/**
 * scan.mjs — Scans a directory and detects its content mode (raw or pre-built).
 *
 * Usage: node scan.mjs <directory-path>
 * Output: JSON to stdout
 *
 * Modes:
 *   raw      — .md files found in directory root → need splitting into cases
 *   prebuilt — subdirectories with knowledge.md found → serve as-is
 *
 * Raw mode output:
 * {
 *   "mode": "raw",
 *   "root": "/path/to/input",
 *   "markdownFiles": ["article.md"],
 *   "assets": { "excalidraw": ["overview.excalidraw"], "images": [] },
 *   "suggestedCases": [
 *     { "id": "01-topic-name", "sourceHeading": "## Topic Name", "sourceFile": "article.md" }
 *   ]
 * }
 *
 * Pre-built mode output:
 * {
 *   "mode": "prebuilt",
 *   "root": "/path/to/content",
 *   "cases": [...],
 *   "sharedFiles": { "globalExcalidraw": false, "libFiles": [] },
 *   "missingGeneration": { "mindmapNeeded": [], "diagramNeeded": [] }
 * }
 */

import { readdirSync, existsSync, statSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const dirArg = process.argv[2];
if (!dirArg) {
  console.error('Usage: node scan.mjs <directory-path>');
  process.exit(1);
}

const rootDir = resolve(dirArg);

if (!existsSync(rootDir)) {
  console.error(`Directory does not exist: ${rootDir}`);
  process.exit(1);
}

if (!statSync(rootDir).isDirectory()) {
  console.error(`Not a directory: ${rootDir}`);
  process.exit(1);
}

// ── Helpers ──

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s\u4e00-\u9fff-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

function extractH2Sections(content) {
  const lines = content.split('\n');
  const sections = [];
  let current = null;

  for (const line of lines) {
    const match = line.match(/^## (.+)$/);
    if (match) {
      if (current) sections.push(current);
      current = { heading: match[1], line: line };
    }
  }
  if (current) sections.push(current);

  return sections;
}

// ── Mode Detection ──

const rootEntries = readdirSync(rootDir, { withFileTypes: true });

// Check for raw mode: .md files in root
const markdownFiles = rootEntries
  .filter(d => d.isFile() && d.name.endsWith('.md'))
  .map(d => d.name)
  .sort();

// Check for assets
const EXCALIDRAW_EXTENSIONS = ['.excalidraw'];
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];

function findAssets(dir) {
  const excalidraw = [];
  const images = [];
  if (!existsSync(dir)) return { excalidraw, images };

  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile()) {
      const ext = entry.name.substring(entry.name.lastIndexOf('.')).toLowerCase();
      if (EXCALIDRAW_EXTENSIONS.includes(ext)) excalidraw.push(entry.name);
      else if (IMAGE_EXTENSIONS.includes(ext)) images.push(entry.name);
    }
  }
  return { excalidraw, images };
}

// Check for pre-built mode: subdirs with knowledge.md
const EXCLUDED_DIRS = new Set([
  'content', 'lib', 'apps', 'source', 'assets',
  'node_modules', 'dist', '.git', '.playwright-mcp',
]);

const subdirs = rootEntries
  .filter(d => d.isDirectory() && !d.name.startsWith('_') && !d.name.startsWith('.') && !EXCLUDED_DIRS.has(d.name))
  .map(d => d.name);

const prebuiltCases = subdirs.filter(caseId => {
  return existsSync(join(rootDir, caseId, 'knowledge.md'));
});

// ── Decision: raw takes priority if .md files exist in root ──

if (markdownFiles.length > 0) {
  // RAW MODE
  const rootAssets = findAssets(rootDir);
  const subAssetsDir = join(rootDir, 'assets');
  const subAssets = findAssets(subAssetsDir);

  // Merge assets: root + assets/ subdirectory
  const excalidraw = [...new Set([...rootAssets.excalidraw, ...subAssets.excalidraw])];
  const images = [...new Set([...rootAssets.images, ...subAssets.images])];

  // Parse headings from each markdown file to suggest cases
  const suggestedCases = [];
  let caseCounter = 1;

  for (const mdFile of markdownFiles) {
    const content = readFileSync(join(rootDir, mdFile), 'utf-8');
    const sections = extractH2Sections(content);

    if (sections.length === 0) {
      // No ## headings — treat entire file as one case
      const num = String(caseCounter).padStart(2, '0');
      const h1Match = content.match(/^# (.+)$/m);
      const title = h1Match ? h1Match[1] : mdFile.replace(/\.md$/, '');
      suggestedCases.push({
        id: `${num}-${slugify(title)}`,
        sourceHeading: `# ${title}`,
        sourceFile: mdFile,
      });
      caseCounter++;
    } else {
      for (const section of sections) {
        const num = String(caseCounter).padStart(2, '0');
        suggestedCases.push({
          id: `${num}-${slugify(section.heading)}`,
          sourceHeading: section.line,
          sourceFile: mdFile,
        });
        caseCounter++;
      }
    }
  }

  const result = {
    mode: 'raw',
    root: rootDir,
    markdownFiles,
    assets: { excalidraw, images },
    suggestedCases,
  };

  console.log(JSON.stringify(result, null, 2));
} else if (prebuiltCases.length > 0) {
  // PRE-BUILT MODE
  const cases = prebuiltCases.sort().map(caseId => {
    const caseDir = join(rootDir, caseId);

    const knowledge = existsSync(join(caseDir, 'knowledge.md'));
    const code = existsSync(join(caseDir, 'index.mjs'));
    const diagram = existsSync(join(caseDir, 'diagram.mmd'));
    const mindmap = existsSync(join(caseDir, 'mindmap.md'));
    const interactive = existsSync(join(caseDir, 'interactive.html'));

    const excalidraw = readdirSync(caseDir).some(f => f.endsWith('.excalidraw'));

    return {
      id: caseId,
      path: caseDir,
      files: { knowledge, code, diagram, mindmap, interactive, excalidraw },
      hasKnowledge: knowledge,
    };
  });

  // Shared files
  const globalExcalidraw = existsSync(join(rootDir, 'content', 'overview.excalidraw'));
  const libDir = join(rootDir, 'lib');
  const libFiles = existsSync(libDir) && statSync(libDir).isDirectory()
    ? readdirSync(libDir).filter(f => f.endsWith('.mjs') || f.endsWith('.js'))
    : [];

  const mindmapNeeded = cases.filter(c => c.hasKnowledge && !c.files.mindmap).map(c => c.id);
  const diagramNeeded = cases.filter(c => c.hasKnowledge && !c.files.diagram).map(c => c.id);

  const result = {
    mode: 'prebuilt',
    root: rootDir,
    cases,
    sharedFiles: { globalExcalidraw, libFiles },
    missingGeneration: { mindmapNeeded, diagramNeeded },
  };

  console.log(JSON.stringify(result, null, 2));
} else {
  // NEITHER — error
  console.error(`No content found in: ${rootDir}`);
  console.error('Expected either:');
  console.error('  - Markdown files (.md) in the directory root (raw mode)');
  console.error('  - Subdirectories containing knowledge.md (pre-built mode)');
  process.exit(1);
}
