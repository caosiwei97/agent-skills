---
name: teaching-viz
description: "Visualize markdown-based teaching content as an interactive web page with multiple tabs: code viewer, markdown rendering, mermaid diagrams, markmap mindmaps, excalidraw scenes, and interactive demos. Scan a directory, validate its structure, generate missing visualizations, launch a local server, and return a localhost URL. Triggers: 'visualize teaching content', 'render teaching notes', 'start teaching server', 'teaching demo', 'interactive teaching page', 'launch teaching page', 'generate mermaid from markdown', 'create mindmap from headings', '教学演示', '可视化教学内容'. Actions: visualize, render, launch, start, generate, scan, serve. Objects: teaching content, markdown, mermaid diagram, mindmap, markmap, excalidraw, interactive page, knowledge base, course materials."
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
- [ ] Step 2: Scan Directory ⚠️ REQUIRED
  - [ ] 2.1 Run: node scripts/scan.mjs <directory>
  - [ ] 2.2 Verify at least one case has knowledge.md
  - [ ] 2.3 Report findings: how many cases, which files exist/missing
- [ ] Step 3: Generate Missing Content (conditional)
  - [ ] 3.1 For each case missing mindmap.md: generate from knowledge.md headings
  - [ ] 3.2 For each case missing diagram.mmd: analyze knowledge.md, generate mermaid
  - [ ] 3.3 Present generation plan, ask user to confirm
- [ ] Step 4: Confirm Plan ⚠️ REQUIRED
  - [ ] Present: scan results + any files to be generated
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

## Step 2: Scan Directory

Run the scan script:
```bash
node <skill-dir>/scripts/scan.mjs <directory>
```

Ask after scanning:
- Does the directory contain at least one subdirectory with `knowledge.md`?
- How many cases were found? How many are "complete" (have all optional files)?
- Which files need generation?

If no cases have `knowledge.md`: report the problem, suggest the expected directory structure. Load `references/content-spec.md` and present it to the user.

## Step 3: Generate Missing Content

### 3.1 Generate mindmap.md (mechanical)

For each case missing `mindmap.md` but having `knowledge.md`:
1. Read `knowledge.md`
2. Extract all headings (`#`, `##`, `###`, etc.) with their text
3. Write `mindmap.md` as heading hierarchy only:
   ```markdown
   # <h1 text>
   ## <h2 text>
   ### <h3 text>
   ```
4. Preserve the original heading order
5. Skip code blocks, lists, and body text — headings only

This is mechanical. No LLM creativity needed.

### 3.2 Generate diagram.mmd (LLM-assisted)

For each case missing `diagram.mmd` but having `knowledge.md`:
1. Read `knowledge.md`
2. Analyze the content to choose a mermaid diagram type:
   - Describes a process with steps? → `sequenceDiagram`
   - Describes decisions or flow? → `flowchart TD`
   - Describes components and relationships? → `graph LR`
3. Generate the mermaid content
4. Write to `diagram.mmd`

Ask before generating: "I found N cases missing diagrams. I'll analyze each knowledge.md and generate appropriate mermaid diagrams. Proceed?"

### 3.3 Files NEVER auto-generated

- `overview.excalidraw` — too fragile, quality unpredictable
- `interactive.html` — too complex to auto-generate reliably
- `index.mjs` — user's executable code

## Step 4: Confirm Plan

Present a summary:
```
Content Directory: /path/to/content
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

Ask: Can the server run?

Check these in order:
1. `node --version` — Node.js 18+ required
2. `npm ls hono` in skill directory — needed for server
3. `assets/web-dist/index.html` exists — pre-built frontend

If dependencies missing:
- For node: tell user to install Node.js
- For hono: offer to run `npm install hono @hono/node-server` in the scripts directory
- For web-dist: tell user the frontend needs to be built first (reference BUILD_INSTRUCTIONS in assets/)

## Step 6: Launch Server

```bash
node <skill-dir>/scripts/serve.mjs --dir <content-dir> --port <port>
```

The script outputs the URL on success. Return it to the user:
```
Server started: http://localhost:38888
Content directory: /path/to/content
```

If the port is already in use, the script reports the error. Offer to:
- Use a different port
- Stop the existing server first

## Anti-Patterns

- **Don't overwrite user files.** If `diagram.mmd` or `mindmap.md` already exists, skip it — the user wrote it for a reason.
- **Don't auto-generate excalidraw or interactive HTML.** These are too complex and the quality would be unpredictable.
- **Don't skip validation.** Starting a server on a broken directory wastes the user's time with a broken page.
- **Don't hardcode paths.** The content directory comes from `$ARGUMENTS`, not from assumptions.
- **Don't assume knowledge.md exists.** A subdirectory without knowledge.md is not a valid case — skip it gracefully.
- **Don't start on an occupied port.** Always check first, offer alternatives.

## Red Flags (return to Step 2 if any appear)

- "I'll just start the server and see what happens" — NO. Scan first.
- "Let me generate an excalidraw file" — NO. Too fragile.
- "The directory structure doesn't matter" — NO. It matters for the frontend.
- "I'll skip the confirmation step" — NO. User must approve generation plan.

## Pre-Delivery Checklist

- [ ] SKILL.md under 500 lines (current: count before packaging)
- [ ] Frontmatter has `name` and `description` only
- [ ] Description uses keyword bombing (5+ action verbs, 5+ object nouns, natural phrases)
- [ ] No README.md or unnecessary files in skill directory
- [ ] No placeholder text (TODO, FIXME, xxx)
- [ ] scripts/ pass `node --check` validation
- [ ] assets/web-dist/index.html exists (frontend build)
