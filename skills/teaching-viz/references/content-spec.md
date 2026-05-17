# Content Directory Specification

## Table of Contents
1. [Directory Structure](#directory-structure)
2. [File Naming Conventions](#file-naming-conventions)
3. [File Types](#file-types)
4. [Case Discovery](#case-discovery)
5. [Excalidraw Fallback Chain](#excalidraw-fallback-chain)
6. [Minimal Valid Case](#minimal-valid-case)

## Directory Structure

The content directory follows this structure:

```
content-root/                  ← $ARGUMENTS points here
├── 01-first-topic/            ← a "case" (subdirectory)
│   ├── knowledge.md           ← REQUIRED: teaching content
│   ├── index.mjs              ← optional: executable code
│   ├── diagram.mmd            ← optional: mermaid diagram
│   ├── mindmap.md             ← optional: heading-based mindmap
│   ├── interactive.html       ← optional: interactive demo
│   └── overview.excalidraw    ← optional: excalidraw scene
├── 02-second-topic/
│   ├── knowledge.md
│   └── ...
├── content/                   ← optional: shared excalidraw scenes
│   ├── overview.excalidraw
│   └── section-*.excalidraw
└── lib/                       ← optional: shared JS utilities
    └── utils.mjs
```

## File Naming Conventions

| File | Name | Required | Auto-generatable |
|------|------|----------|-----------------|
| Teaching content | `knowledge.md` | YES | No |
| Executable code | `index.mjs` | No | No |
| Mermaid diagram | `diagram.mmd` | No | Yes (LLM) |
| Mindmap | `mindmap.md` | No | Yes (mechanical) |
| Interactive demo | `interactive.html` | No | No |
| Excalidraw scene | `overview.excalidraw` | No | No |

## File Types

### knowledge.md (REQUIRED)
Markdown file with the teaching content. Uses standard markdown:
- `#` for main title
- `##` for sections
- `###` for subsections
- Code blocks with language tags
- Inline formatting (bold, links, etc.)

The heading structure is parsed to generate mindmaps when `mindmap.md` is missing.

### diagram.mmd
Mermaid diagram file. Common types used:
- `sequenceDiagram` — for request/response flows
- `flowchart TD/LR` — for process flows
- `graph TD` — for decision trees

### mindmap.md
Markdown file using heading hierarchy to represent a mindmap:
```markdown
# Root Topic
## Branch 1
### Leaf 1.1
### Leaf 1.2
## Branch 2
### Leaf 2.1
```

Parsed by markmap-lib and rendered by markmap-view.

### interactive.html
Self-contained HTML file loaded in an iframe. Must be fully standalone (inline CSS/JS).

### overview.excalidraw
JSON file in Excalidraw format. Rendered by @excalidraw/excalidraw React component.

### index.mjs
ESM JavaScript file. Can contain `@title`, `@group`, `@description` JSDoc tags in comments for metadata.

## Case Discovery

1. Scan all subdirectories in the content root
2. Exclude directories starting with `_` (underscore prefix = hidden)
3. Sort by directory name (natural sort order — `01-`, `02-` prefixes ensure ordering)
4. Each subdirectory is a "case" regardless of its contents
5. A case is valid if it contains `knowledge.md` — everything else is optional

## Excalidraw Fallback Chain

When rendering the Excalidraw tab for a case:
1. Check `cases/<caseId>/overview.excalidraw` (case-level)
2. Check `content/section-<section>.excalidraw` (section-level, based on `@group` metadata)
3. Check `content/overview.excalidraw` (global)
4. If none found, hide the Excalidraw tab for that case

## Minimal Valid Case

A case needs only `knowledge.md` to be useful:

```
01-my-topic/
└── knowledge.md
```

The skill will generate `mindmap.md` and `diagram.mmd` if missing, and the frontend will show the tabs that have content.
