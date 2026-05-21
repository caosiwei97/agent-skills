---
name: teaching-viz
description: "Generate interactive teaching cases from markdown source documents. Splits markdown into progressive cases with 5 output files each: executable code (index.mjs for WebContainer), knowledge articles, Mermaid diagrams, Markmap mindmaps, and standalone interactive HTML demos. For Astro + React + WebContainer teaching platforms. Triggers: 'generate teaching cases', 'create cases from markdown', 'split markdown into cases', 'visualize teaching content', 'render teaching notes', 'teaching demo', '生成教学案例', '教学可视化', '从文档生成案例', '拆分教学内容', 'generate interactive demos', 'create code examples from docs'. Actions: generate, split, create, build, render, visualize. Objects: teaching cases, knowledge articles, mermaid diagrams, mindmaps, interactive demos, executable examples, markdown source."
---

# Teaching Viz

IRON LAW: EVERY GENERATED index.mjs MUST USE mock-model — NEVER CALL A REAL LLM API. A case that requires API keys is a broken case.

## Workflow

```
Teaching Viz Progress:

- [ ] Step 1: Parse Input ⚠️ REQUIRED
  - [ ] 1.1 Resolve source path from $ARGUMENTS
  - [ ] 1.2 Resolve output path (default: same directory)
  - [ ] 1.3 Handle flags: --output, --dry-run, --only <caseId>
- [ ] Step 2: Analyze Source ⚠️ REQUIRED
  - [ ] 2.1 Read markdown file(s)
  - [ ] 2.2 Split by ## headings into sections
  - [ ] 2.3 For each section: determine slug, title, group
  - [ ] 2.4 Identify preamble (content before first ##)
- [ ] Step 3: Confirm Plan ⚠️ REQUIRED
  - [ ] Present case breakdown to user
  - [ ] Show: case count, slugs, groups, files to generate
  - [ ] Wait for explicit approval before writing
- [ ] Step 4: Generate Cases
  - [ ] 4.1 Create output directory structure
  - [ ] 4.2 Copy lib/ shared modules (if not present)
  - [ ] 4.3 For each case (in order):
    - [ ] Generate knowledge.md
    - [ ] Generate mindmap.md (mechanical)
    - [ ] Generate diagram.mmd
    - [ ] Generate index.mjs ⚠️ CRITICAL
    - [ ] Generate interactive.html ⚠️ CRITICAL
- [ ] Step 5: Validate ⚠️ REQUIRED
  - [ ] 5.1 node --check every index.mjs
  - [ ] 5.2 Verify knowledge.md is non-empty
  - [ ] 5.3 Verify diagram.mmd is valid mermaid syntax
  - [ ] 5.4 Verify interactive.html is well-formed HTML
- [ ] Step 6: Report
  - [ ] List all generated files
  - [ ] Report any validation failures
  - [ ] Suggest next steps (pnpm build / pnpm dev)
```

## Parameters

- `$ARGUMENTS` — path to source markdown file or directory (required)
- `--output <path>` — where to write cases (default: `cases/` sibling to source)
- `--dry-run` — analyze and show plan only, don't write files
- `--only <NN-slug>` — regenerate only one specific case

## Step 1: Parse Input

Ask: Does the user provide a source path? If not, ask for one.

Resolve paths:
- Source: absolute path to .md file or directory containing .md files
- Output: `--output` flag, or `<source-parent>/cases/`

## Step 2: Analyze Source

Read each .md file. Split on `## ` headings (h2 level).

For each section:
1. Extract title from `## <title>` line
2. Generate slug: `NN-english-kebab-case` (e.g., `01-sse-streaming`, `05-retry-backoff`)
3. Determine group from content topic

Ask: Does this section teach a distinct, executable concept? If it's meta-content (references, exercise lists, preamble), it still gets a case but mark it as secondary.

Slug rules:
- Two-digit prefix: `01`, `02`, ... `12`
- English lowercase kebab-case (no Chinese in directory names)
- Max 30 characters after prefix
- Descriptive of the core concept

Group assignment — ask: What is the primary mechanism this section teaches?
- "流式响应" — SSE, streaming, tool call parsing, concurrent execution
- "容错机制" — retry, backoff, heartbeat, degradation, failover
- "运行时安全" — loop detection, token budget, truncation, agent loop skeleton

## Step 3: Confirm Plan ⚠️ REQUIRED

Present:
```
Source: /path/to/file.md
Output: /path/to/cases/
Mode: Split 1 file → N cases

Cases to generate:
  01-sse-streaming        [流式响应]  "SSE 流式响应基础"
  02-tool-call-parsing    [流式响应]  "Tool Call 流式解析"
  ...

Files per case: index.mjs, knowledge.md, diagram.mmd, mindmap.md, interactive.html
Shared lib: mock-model.mjs, mock-tools.mjs, utils.mjs, retry.mjs, loop-detection.mjs

Proceed? [y/n]
```

⚠️ Do NOT generate any files without explicit user approval.

## Step 4: Generate Cases

### 4.1 knowledge.md

Extract the corresponding section from source markdown. Promote `## Title` to `# Title`.

Ask: Is the content deep enough for a standalone knowledge article (500+ words)?
- If yes: use as-is with minor formatting cleanup
- If thin: expand with additional explanation of the concepts

### 4.2 mindmap.md (mechanical — no LLM judgment needed)

Extract all headings from knowledge.md. Write as pure heading hierarchy:
```markdown
# Root Topic
## Sub-topic A
### Detail A1
### Detail A2
## Sub-topic B
```

No body text — headings only. Markmap renders this as a tree.

### 4.3 diagram.mmd

Ask: What is the best Mermaid diagram type for this concept?
- Interaction flow → `sequenceDiagram`
- Decision logic → `flowchart TD`
- State transitions → `stateDiagram-v2`
- Timeline/phases → `gantt` or `flowchart LR`

Requirements:
- Node labels in Chinese
- Edge labels concise (2-6 chars)
- 8-20 nodes (not too sparse, not too dense)
- Must be valid Mermaid syntax

### 4.4 index.mjs ⚠️ CRITICAL

Load `references/index-mjs-spec.md` for the full specification.

**UNIFIED SKELETON RULE**: All cases share the SAME `while(true)` agent-loop skeleton. Each case adds EXACTLY ONE new feature (a function, an `if` block, or a check). The diff between case N and case N+1 should be < 30 lines.

Mark new additions with `// ═══ 本案例新增 ═══` comments.

Core rules:
- Header JSDoc with @title, @group, @description
- Import only from: `ai`, `zod`, `../lib/mock-model.mjs`, `../lib/mock-tools.mjs`, `../lib/utils.mjs`
- Use `createMockModel()` or `createMultiTurnModel()` — NEVER real API calls
- Use `streamText` from `ai` package
- Console.log with standard prefixes: `[用户]`, `[工具调用]`, `[退出]`, `[完成]`
- 80-200 lines
- Wrap in `async function agentLoop() { ... } agentLoop().catch(console.error);`

Ask: What ONE new mechanism does this case demonstrate?
- Design the simplest possible addition to the base skeleton
- A reader who understood the previous case should only need to read the new block

### 4.5 interactive.html ⚠️ CRITICAL

Load `references/interactive-html-spec.md` for the full specification.

Core rules:
- Single file, zero external dependencies
- Dark theme: background #1e1e1e, text #cccccc, mono font
- 100% height layout, no scrollbar on body
- Button-driven simulation (user clicks to trigger)
- Visual feedback: animations, color transitions, progress bars
- 200-600 lines

Ask: What interactive simulation would help a learner understand this concept?
- Retry → show exponential delay growth with bar chart
- Streaming → show tokens appearing one by one
- Concurrency → show timeline of parallel vs serial execution
- Loop detection → show fingerprint matching animation

## Step 5: Validate ⚠️ REQUIRED

```bash
# Syntax check all generated code
for f in <output>/*/index.mjs; do node --check "$f"; done
```

If validation fails:
1. Fix the syntax error
2. Re-validate
3. Repeat until all pass

Also verify:
- Every knowledge.md has `# ` title on line 1
- Every diagram.mmd starts with a valid diagram type keyword
- Every interactive.html has `<!DOCTYPE html>` and `</html>`

### 5.5 Self-Verification (Functional Check)

After syntax passes, verify the generated cases work in the actual Astro platform:

1. Copy `<output>/` into the Astro project's `cases/` directory
2. Run `pnpm build` — must succeed without errors
3. Run `pnpm dev` or `pnpm preview`
4. For 2-3 sample cases, verify in browser:
   - Knowledge tree shows the case with correct title/group
   - "代码" tab displays the index.mjs with syntax highlighting
   - Click "运行" → WebContainer produces console output
   - "流程图" tab renders the Mermaid diagram
   - "思维导图" tab renders the Markmap tree
   - "交互演示" tab loads the HTML and buttons are clickable

If any tab fails to render, fix the source file and re-validate.

Also verify:
- Every knowledge.md has `# ` title on line 1
- Every diagram.mmd starts with a valid diagram type keyword
- Every interactive.html has `<!DOCTYPE html>` and `</html>`

## Anti-Patterns

- **Calling real APIs in index.mjs** — IRON LAW violation. Use mock-model always.
- **Chinese in directory names** — breaks path handling. Use English kebab-case slugs.
- **External CDN links in interactive.html** — must be fully self-contained.
- **Copy-pasting source markdown as knowledge.md without promotion** — must promote ## to #.
- **Mindmap with body text** — mindmap.md is headings ONLY, no paragraphs.
- **Diagram with >20 nodes** — becomes unreadable. Focus on the core flow.
- **index.mjs without console.log** — the output IS the teaching. Silent code teaches nothing.
- **interactive.html with white background** — must match dark theme (#1e1e1e).
- **Generating Excalidraw files** — too fragile, skip. User provides these manually.
- **Skipping the confirmation gate** — always show plan and wait for approval.

## Red Flags (return to Step 2 if any appear)

- "I'll just generate all files without checking..." — NO. Validate after generation.
- "Let me call the OpenAI API to demonstrate..." — NO. Mock model only.
- "I'll use a CDN for the chart library..." — NO. Self-contained HTML.
- "The directory name can use Chinese..." — NO. English slugs only.
- "I'll skip the interactive demo, it's too complex..." — NO. Every case needs one.

## Pre-Delivery Checklist

### Structure
- [ ] Output has `lib/` directory with all 5 shared modules
- [ ] Each case directory named `NN-english-slug` (2-digit prefix)
- [ ] Each case has exactly 5 files: index.mjs, knowledge.md, diagram.mmd, mindmap.md, interactive.html

### index.mjs
- [ ] Has @title, @group, @description in JSDoc header
- [ ] Imports only from `ai`, `zod`, `../lib/*.mjs`
- [ ] Uses createMockModel or createMultiTurnModel (no real API)
- [ ] Passes `node --check` without error
- [ ] Has console.log output explaining concepts
- [ ] 80-400 lines

### knowledge.md
- [ ] Starts with `# Title` (not `## Title`)
- [ ] 500+ words of substantive content
- [ ] Has code blocks with language tags

### diagram.mmd
- [ ] Valid Mermaid syntax (sequenceDiagram / flowchart / stateDiagram)
- [ ] Chinese node labels
- [ ] 8-20 nodes

### mindmap.md
- [ ] Only contains headings (# ## ### ####)
- [ ] No body text between headings
- [ ] Matches knowledge.md structure

### interactive.html
- [ ] Valid HTML5 with DOCTYPE
- [ ] Dark theme (background: #1e1e1e)
- [ ] No external dependencies (no CDN, no imports)
- [ ] Has at least one interactive button
- [ ] 200-600 lines
- [ ] Body overflow: hidden, height: 100%
