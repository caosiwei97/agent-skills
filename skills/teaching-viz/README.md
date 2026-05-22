# teaching-viz

从 Markdown 源文档生成交互式教学案例的 Skill。将任意技术长文转化为可运行、可交互的分步教学内容。

## 功能

- 将 Markdown 长文按 `##` 标题自动拆分为独立教学案例
- 每个案例生成 5 个文件：
  - `index.mjs` — 可在 WebContainer 中执行的示例代码
  - `knowledge.md` — 结构化知识文章
  - `diagram.mmd` — Mermaid 流程图/时序图/状态图
  - `mindmap.md` — Markmap 思维导图
  - `interactive.html` — 单文件交互演示（暗色主题，零外部依赖）
- 案例间递进式设计，逐步引入新概念
- 生成后自动语法校验（`node --check`）
- 支持 `--only` 单案例重新生成、`--dry-run` 预览模式

## 适用场景

任何需要将技术文档转化为交互式教学内容的场景，例如：框架原理讲解、算法教学、系统设计分享、协议解析等。

## 适用平台

Astro + React + WebContainer 教学站点。生成内容可直接在浏览器沙箱中运行。

## 安装

```bash
# 全局安装（所有项目可用）
npx skills add caosiwei97/agent-skills --path skills/teaching-viz --global

# 仅当前项目
npx skills add caosiwei97/agent-skills --path skills/teaching-viz
```

## 使用

```
/teaching-viz path/to/source.md
```

或使用触发词：生成教学案例、教学可视化、从文档生成案例、拆分教学内容、generate teaching cases、create cases from markdown。

### 参数

- `$ARGUMENTS` — 源 Markdown 文件或目录路径（必需）
- `--output <path>` — 输出目录（默认：源文件同级 `cases/`）
- `--dry-run` — 仅分析并展示计划，不写入文件
- `--only <NN-slug>` — 仅重新生成指定案例

## License

MIT
