# agent-skills

A collection of agent skills for OpenCode, Claude Code, and other AI coding agents.

## Skills

| Skill                          | Description                                        | Install                                                       |
| ------------------------------ | -------------------------------------------------- | ------------------------------------------------------------- |
| [**commit**](./skills/commit/) | Git 提交与推送自动化：风格检测、原子拆分、冲突处理 | `npx skills add caosiwei97/agent-skills --path skills/commit` |
| [**teaching-viz**](./skills/teaching-viz/) | Markdown 教学内容可视化：扫描目录、生成思维导图/Mermaid 流程图、启动交互式教学页面 | `npx skills add caosiwei97/agent-skills --path skills/teaching-viz` |

## Install

```bash
# Install a specific skill
npx skills add caosiwei97/agent-skills --path skills/<skill-name>

# List all available skills
npx skills add caosiwei97/agent-skills --list
```

## Showcase: teaching-viz

Provide a directory of Markdown teaching content, and teaching-viz generates an interactive visualization page with multiple tabs:

### Overview — Knowledge Tree

![Overview with knowledge tree](./skills/teaching-viz/docs/01-overview.png)

### Excalidraw Canvas (全景图)

![Excalidraw canvas](./skills/teaching-viz/docs/02-excalidraw.png)

### Knowledge Article (知识点)

![Knowledge article](./skills/teaching-viz/docs/03-knowledge.png)

### Mermaid Flowchart (流程图)

![Mermaid flowchart](./skills/teaching-viz/docs/04-flowchart.png)

### Interactive Demo (交互演示)

![Interactive demo](./skills/teaching-viz/docs/05-interactive.png)

### Mindmap (思维导图)

![Mindmap](./skills/teaching-viz/docs/06-mindmap.png)

### Code Examples (代码)

![Code examples](./skills/teaching-viz/docs/07-code.png)

## License

MIT
