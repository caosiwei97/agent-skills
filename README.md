# agent-skills

A collection of agent skills for OpenCode, Claude Code, and other AI coding agents.

## Skills

| Skill                          | Description                                        | Install                                                       |
| ------------------------------ | -------------------------------------------------- | ------------------------------------------------------------- |
| [**commit**](./skills/commit/) | Git 提交与推送自动化：风格检测、原子拆分、冲突处理 | `npx skills add caosiwei97/agent-skills --path skills/commit --global` |
| [**teaching-viz**](./skills/teaching-viz/) | Markdown 教学内容可视化：扫描目录、生成思维导图/Mermaid 流程图、启动交互式教学页面 | `npx skills add caosiwei97/agent-skills --path skills/teaching-viz --global` |
| [**ez-explain**](./skills/ez-explain/) | 多源消化重写：验证时效性、融合知识点、原创表达、配 Mermaid 图 | `npx skills add caosiwei97/agent-skills --path skills/ez-explain --global` |
| [**gitlab**](./skills/gitlab/) | GitLab 全栈 Skill：跨平台 glab 安装 + 任意实例配置 + Token 检测 + 官方 glab 命令参考自动同步 | `npx skills add caosiwei97/agent-skills --path skills/gitlab --global` |

## Install

```bash
# Install a specific skill (global, available in all projects)
npx skills add caosiwei97/agent-skills --path skills/<skill-name> --global

# Install to current project only
npx skills add caosiwei97/agent-skills --path skills/<skill-name>

# List all available skills
npx skills add caosiwei97/agent-skills --list
```

## License

MIT
