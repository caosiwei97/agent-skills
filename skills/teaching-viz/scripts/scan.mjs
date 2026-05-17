#!/usr/bin/env node

/**
 * scan.mjs — Scans a teaching content directory and reports existing/missing files per case.
 *
 * Usage: node scan.mjs <directory-path>
 * Output: JSON to stdout
 *
 * Example output:
 * {
 *   "root": "/path/to/content",
 *   "cases": [
 *     {
 *       "id": "01-sse-streaming",
 *       "path": "/path/to/content/01-sse-streaming",
 *       "files": {
 *         "knowledge": true,
 *         "code": true,
 *         "diagram": true,
 *         "mindmap": true,
 *         "interactive": true,
 *         "excalidraw": false
 *       },
 *       "hasKnowledge": true
 *     }
 *   ],
 *   "sharedFiles": {
 *     "globalExcalidraw": false,
 *     "libFiles": []
 *   },
 *   "missingGeneration": {
 *     "mindmapNeeded": ["02-some-case"],
 *     "diagramNeeded": ["02-some-case"]
 *   }
 * }
 */

import { readdirSync, existsSync, statSync } from 'node:fs';
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

// Scan for case subdirectories
const EXCLUDED_DIRS = new Set(['content', 'lib', 'apps', 'node_modules', 'dist', '.git', '.playwright-mcp']);
const entries = readdirSync(rootDir, { withFileTypes: true })
  .filter(d => d.isDirectory() && !d.name.startsWith('_') && !d.name.startsWith('.') && !EXCLUDED_DIRS.has(d.name))
  .map(d => d.name)
  .sort();

const cases = entries.map(caseId => {
  const caseDir = join(rootDir, caseId);

  const knowledge = existsSync(join(caseDir, 'knowledge.md'));
  const code = existsSync(join(caseDir, 'index.mjs'));
  const diagram = existsSync(join(caseDir, 'diagram.mmd'));
  const mindmap = existsSync(join(caseDir, 'mindmap.md'));
  const interactive = existsSync(join(caseDir, 'interactive.html'));

  // Check for any .excalidraw file
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

// Cases needing generation
const mindmapNeeded = cases.filter(c => c.hasKnowledge && !c.files.mindmap).map(c => c.id);
const diagramNeeded = cases.filter(c => c.hasKnowledge && !c.files.diagram).map(c => c.id);

const result = {
  root: rootDir,
  cases,
  sharedFiles: { globalExcalidraw, libFiles },
  missingGeneration: { mindmapNeeded, diagramNeeded },
};

console.log(JSON.stringify(result, null, 2));
