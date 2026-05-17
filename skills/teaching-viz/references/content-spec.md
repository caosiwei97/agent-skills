# Content Directory Specification

## Table of Contents
1. [Two Input Modes](#two-input-modes)
2. [Raw Mode (Primary)](#raw-mode-primary)
3. [Pre-Built Mode (Fallback)](#pre-built-mode-fallback)
4. [Case Output Structure](#case-output-structure)
5. [File Types](#file-types)
6. [Case Discovery](#case-discovery)
7. [Excalidraw Fallback Chain](#excalidraw-fallback-chain)
8. [Minimal Valid Input](#minimal-valid-input)

## Two Input Modes

The skill accepts content in two formats:

| Mode | When | Input | Action |
|------|------|-------|--------|
| **Raw** | `.md` files found in directory root | Longform markdown + optional assets | Skill splits into cases |
| **Pre-built** | Subdirectories with `knowledge.md` found | Already-structured case dirs | Serve as-is |

Detection priority: Raw mode checked first (`.md` in root), then pre-built (subdirs with `knowledge.md`).

## Raw Mode (Primary)

User provides a directory with raw markdown files and optional assets. The skill splits them into cases.

### Input Structure

```
input-dir/                      ← $ARGUMENTS points here
├── some-article.md             ← One or more markdown files (longform)
├── another-article.md
├── overview.excalidraw         ← Optional: excalidraw assets in root
└── assets/                     ← Optional: subdirectory for assets
    ├── section-diagram.excalidraw
    └── hero-image.png
```

### Splitting Rules

Each `.md` file in the root is split by `##` headings (h2) into cases:

1. Everything before the first `##` is the **preamble** (discarded for case creation, used as global context)
2. Each `## Section Title` block becomes one case
3. Content under a `##` heading includes all text until the next `##` or end of file
4. `###` and deeper headings are preserved within the case body
5. Case IDs are generated: `01-<slug>` where slug is derived from the heading text

### Case Generation from Raw

For each split section, the skill creates:
```
cases-output/
├── 01-section-one/
│   ├── knowledge.md        ← Section content (with ## heading promoted to #)
│   ├── mindmap.md          ← Auto-generated from headings
│   └── diagram.mmd         ← Auto-generated from content analysis
├── 02-section-two/
│   ├── knowledge.md
│   ├── mindmap.md
│   └── diagram.mmd
└── lib/                    ← Empty (no shared code in raw mode)
```

### Asset Resolution

Excalidraw assets are searched in order:
1. Same directory as the `.md` file (root)
2. `assets/` subdirectory
3. Any `.excalidraw` file found is available as a global fallback

## Pre-Built Mode (Fallback)

User provides a directory already structured as cases. The skill serves it directly.

### Input Structure

```
content-root/                  ← $ARGUMENTS points here
├── 01-first-topic/
│   ├── knowledge.md           ← REQUIRED
│   ├── index.mjs
│   ├── diagram.mmd
│   ├── mindmap.md
│   ├── interactive.html
│   └── overview.excalidraw
├── 02-second-topic/
│   ├── knowledge.md
│   └── ...
├── content/                   ← Optional: shared excalidraw scenes
│   └── overview.excalidraw
└── lib/                       ← Optional: shared JS utilities
    └── utils.mjs
```

## Case Output Structure

Regardless of input mode, the final directory served has this structure:

```
cases-root/
├── 01-topic-name/
│   ├── knowledge.md           ← Teaching content (REQUIRED)
│   ├── index.mjs              ← Optional: executable code
│   ├── diagram.mmd            ← Optional: mermaid diagram
│   ├── mindmap.md             ← Optional: heading-based mindmap
│   ├── interactive.html       ← Optional: interactive demo
│   └── overview.excalidraw    ← Optional: excalidraw scene
├── lib/                       ← Optional: shared JS utilities
└── assets/                    ← Optional: shared assets
```

## File Types

| File | Name | Required | Auto-generatable |
|------|------|----------|-----------------|
| Teaching content | `knowledge.md` | YES | No (from raw mode: split) |
| Executable code | `index.mjs` | No | No |
| Mermaid diagram | `diagram.mmd` | No | Yes (LLM) |
| Mindmap | `mindmap.md` | No | Yes (mechanical) |
| Interactive demo | `interactive.html` | No | No |
| Excalidraw scene | `overview.excalidraw` | No | No |

### knowledge.md (REQUIRED)
Markdown file with the teaching content. Standard markdown:
- `#` for main title
- `##` for sections
- `###` for subsections
- Code blocks with language tags
- Inline formatting

### diagram.mmd
Mermaid diagram file. Common types:
- `sequenceDiagram` — request/response flows
- `flowchart TD/LR` — process flows
- `graph TD` — decision trees

### mindmap.md
Markdown heading hierarchy representing a mindmap:
```markdown
# Root Topic
## Branch 1
### Leaf 1.1
## Branch 2
### Leaf 2.1
```

### interactive.html
Self-contained HTML file loaded in an iframe. Must be fully standalone.

### overview.excalidraw
JSON file in Excalidraw format. Rendered by @excalidraw/excalidraw React component.

### index.mjs
ESM JavaScript file. Supports `@title`, `@group`, `@description` JSDoc tags.

## Case Discovery

1. Scan all subdirectories in the cases root
2. Exclude: `lib`, `content`, `source`, `assets`, `apps`, `node_modules`, `dist`, `.git`, and any name starting with `_` or `.`
3. Sort by directory name (natural sort — `01-`, `02-` prefixes ensure ordering)
4. Each subdirectory is a "case" regardless of its contents
5. A case is valid if it contains `knowledge.md`

## Excalidraw Fallback Chain

When rendering the Excalidraw tab for a case:
1. Check `cases/<caseId>/overview.excalidraw` (case-level)
2. Check `rootDir/assets/*.excalidraw` (shared assets)
3. Check `rootDir/content/overview.excalidraw` (legacy shared)
4. Check `rootDir/source/assets/*.excalidraw` (raw mode assets)
5. If none found, hide the Excalidraw tab for that case

## Minimal Valid Input

### Raw mode (minimum)
```
my-teaching/
└── article.md          ← Any markdown file with ## headings
```

### Pre-built mode (minimum)
```
my-cases/
└── 01-topic/
    └── knowledge.md
```
