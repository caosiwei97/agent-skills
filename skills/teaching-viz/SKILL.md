---
name: teaching-viz
description: "Visualize markdown-based teaching content as an interactive web page with multiple tabs: code viewer, markdown rendering, mermaid diagrams, markmap mindmaps, excalidraw scenes, and interactive demos. Accepts raw markdown directories (splits into cases automatically) or pre-built case directories. Scan, validate, generate missing visualizations, launch a local server, and return a localhost URL. Triggers: 'visualize teaching content', 'render teaching notes', 'start teaching server', 'teaching demo', 'interactive teaching page', 'launch teaching page', 'generate mermaid from markdown', 'create mindmap from headings', '教学演示', '可视化教学内容'. Actions: visualize, render, launch, start, generate, scan, serve. Objects: teaching content, markdown, mermaid diagram, mindmap, markmap, excalidraw, interactive page, knowledge base, course materials."
---

# Teaching Viz

IRON LAW: NEVER START THE SERVER WITHOUT VALIDATING THE CONTENT DIRECTORY FIRST. A broken directory = a broken page = wasted user time. Always scan, validate, and confirm before launching.

## Workflow

```
Teaching Viz Progress:

- [ ] Step 1: Parse Arguments ⚠️ REQUIRED
  - [ ] 1.1 Extract directory path from $ARGUMENTS
  - [ ] 1.2 Handle flags: --port, --stop, --dry-run
  - [ ] 1.3 If --stop: run stop command, exit
- [ ] Step 2: Scan Directory & Detect Mode ⚠️ REQUIRED
  - [ ] 2.1 Run: node scripts/scan.mjs <directory>
  - [ ] 2.2 Check mode: "raw" (markdown files in root) or "prebuilt" (subdirs with knowledge.md)
  - [ ] 2.3 Report: mode detected, files found, cases found/suggested
- [ ] Step 3: Split Raw Content (raw mode only)
  - [ ] 3.1 For each .md file: split by ## headings into sections
  - [ ] 3.2 Create case directories: 01-<slug>/, 02-<slug>/, etc.
  - [ ] 3.3 Write knowledge.md for each case (section content with ## promoted to #)
  - [ ] 3.4 Generate mindmap.md and diagram.mmd for each case
  - [ ] 3.5 Copy/link any excalidraw assets to accessible location
  - [ ] 3.6 Present splitting plan, ask user to confirm before writing
- [ ] Step 4: Confirm Plan ⚠️ REQUIRED
  - [ ] Present: mode, scan results, files to generate
  - [ ] For raw mode: show suggested case breakdown
  - [ ] For pre-built mode: show missing files
  - [ ] Wait for user confirmation before proceeding
- [ ] Step 5: Check Dependencies ⛔ BLOCKING
  - [ ] 5.1 Verify node is available
  - [ ] 5.2 Verify hono + @hono/node-server installed (or installable)
  - [ ] 5.3 Check assets/web-dist/ exists (frontend build)
- [ ] Step 6: Launch Server ⚠️ REQUIRED (skip if --dry-run)
  - [ ] 6.1 Run: node scripts/serve.mjs --dir <directory> --port <port>
  - [ ] 6.2 Verify server started (check output for URL)
  - [ ] 6.3 Return the localhost URL to user
- [ ] Step 7: Manage (conditional)
  - [ ] --stop: kill server on specified port
  - [ ] --dry-run: report only, no server launch
```

## Parameters

- `$ARGUMENTS` — directory path (required for launch, optional for --stop)
- `--port <number>` — server port (default: 38888)
- `--stop` — stop running server on the port
- `--dry-run` — scan and report only, don't start server

## Step 1: Parse Arguments

Ask: Did the user provide a directory path? If not, ask for one (unless --stop).

If `$ARGUMENTS` contains `--stop`:
- Extract port (default 38888)
- Run: `node <skill-dir>/scripts/serve.mjs --stop --port <port>`
- Report result and exit

If `$ARGUMENTS` contains a path:
- Resolve to absolute path
- Proceed to Step 2

## Step 2: Scan Directory & Detect Mode

Run the scan script:
```bash
node <skill-dir>/scripts/scan.mjs <directory>
```

The script outputs JSON with a `mode` field:
- `"raw"` — Markdown files found in root. Skill must split them into cases.
- `"prebuilt"` — Subdirectories with knowledge.md found. Serve as-is.

**Raw mode output includes:**
- `markdownFiles` — list of .md files found
- `assets` — excalidraw and image files found (root + assets/)
- `suggestedCases` — proposed case breakdown (id, sourceHeading, sourceFile)

**Pre-built mode output includes:**
- `cases` — list of case directories with file status
- `sharedFiles` — global excalidraw, lib files
- `missingGeneration` — cases needing mindmap.md or diagram.mmd

If neither mode detected: report the problem, suggest expected directory structures from `references/content-spec.md`.

## Step 3: Split Raw Content (Raw Mode Only)

This step is ONLY for raw mode. Skip entirely for pre-built mode.

### 3.1 Split markdown into sections

For each .md file in the root:
1. Read the full content
2. Find all `## ` headings (h2 level)
3. Split into sections: everything from one `##` to the next (or end of file)
4. Content before the first `##` is the preamble (global context, not a case)
5. If no `##` headings exist, treat the entire file as one case (use `#` title)

### 3.2 Create case directories

For each section:
1. Generate case ID: `01-<slug>`, `02-<slug>`, etc.
2. Create the directory: `<input-dir>/NN-<slug>/`
3. Write `knowledge.md`: promote `## Title` to `# Title`, include all body content

### 3.3 Generate mindmap.md (mechanical)

For each new case:
1. Read the generated knowledge.md
2. Extract all headings
3. Write as heading hierarchy

### 3.4 Generate diagram.mmd (LLM-assisted)

For each new case:
1. Analyze knowledge.md content
2. Choose appropriate mermaid diagram type
3. Generate and write diagram.mmd

### 3.5 Asset handling

Any `.excalidraw` files found in root or `assets/` subdirectory are preserved in place. The serve.mjs will find them via its flexible fallback chain.

### 3.6 Present plan BEFORE writing

Show the user:
```
Raw markdown detected: 1 file
  Agent-Loop-深度分享.md → 12 cases suggested

Cases to create:
  01-sse-streaming (from "## SSE 流式响应基础")
  02-tool-call-parsing (from "## Tool Call 解析")
  ...

Assets found: overview.excalidraw, section-*.excalidraw

This will create directories and files in: /path/to/input
Proceed? [y/n]
```

Wait for confirmation before creating any files.

### 3.7 Files NEVER auto-generated

- `overview.excalidraw` — too fragile, quality unpredictable
- `interactive.html` — too complex to auto-generate reliably
- `index.mjs` — user's executable code

## Step 4: Confirm Plan

### Raw mode summary:
```
Content Directory: /path/to/input
Mode: RAW (markdown splitting)
Markdown files: 1
Cases to create: 12
  Will generate: knowledge.md (12), mindmap.md (12), diagram.mmd (12)
  Will NOT generate: excalidraw, interactive.html, index.mjs
Assets found: 3 excalidraw files

Server port: 38888
URL: http://localhost:38888

Proceed? [y/n]
```

### Pre-built mode summary:
```
Content Directory: /path/to/cases
Mode: PRE-BUILT (serve as-is)
Cases found: 12
  Complete (all files): 5
  Missing mindmap.md: 3  → will generate
  Missing diagram.mmd: 4 → will generate
  Missing excalidraw: 8  → skip (user must provide)
  Missing interactive: 6 → skip (user must provide)

Server port: 38888
URL: http://localhost:38888

Proceed? [y/n]
```

Wait for user confirmation. If declined, adjust based on feedback.

## Step 5: Check Dependencies

Check these in order:
1. `node --version` — Node.js 18+ required
2. `npm ls hono` in skill directory — needed for server
3. `assets/web-dist/index.html` exists — pre-built frontend

If dependencies missing:
- For node: tell user to install Node.js
- For hono: offer to run `npm install hono @hono/node-server` in the scripts directory
- For web-dist: tell user the frontend needs to be built first

## Step 6: Launch Server

```bash
node <skill-dir>/scripts/serve.mjs --dir <content-dir> --port <port>
```

The script outputs the URL on success. Return it to the user:
```
Server started: http://localhost:38888
Content directory: /path/to/content
```

If the port is already in use, offer to:
- Use a different port
- Stop the existing server first

## Anti-Patterns

- **Don't overwrite user files.** If `diagram.mmd` or `mindmap.md` already exists, skip it.
- **Don't auto-generate excalidraw or interactive HTML.** Too complex, quality unpredictable.
- **Don't skip validation.** Starting a server on a broken directory wastes the user's time.
- **Don't hardcode paths.** The content directory comes from `$ARGUMENTS`.
- **Don't assume a specific directory structure.** Use scan.mjs to detect mode.
- **Don't start on an occupied port.** Always check first, offer alternatives.
- **Don't split without confirmation.** Raw mode splitting creates files — user must approve.

## Red Flags (return to Step 2 if any appear)

- "I'll just start the server and see what happens" — NO. Scan first.
- "Let me generate an excalidraw file" — NO. Too fragile.
- "The directory structure doesn't matter" — NO. It matters for the frontend.
- "I'll skip the confirmation step" — NO. User must approve generation plan.
- "I'll assume the mode without scanning" — NO. Always run scan.mjs first.

## Pre-Delivery Checklist

- [ ] SKILL.md under 500 lines (current: count before packaging)
- [ ] Frontmatter has `name` and `description` only
- [ ] Description uses keyword bombing (5+ action verbs, 5+ object nouns, natural phrases)
- [ ] No README.md or unnecessary files in skill directory
- [ ] No placeholder text (TODO, FIXME, xxx)
- [ ] scripts/ pass `node --check` validation
- [ ] assets/web-dist/index.html exists (frontend build)
