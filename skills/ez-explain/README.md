# ez-explain

将信息源消化后重写为一篇通俗易懂的新文章。

## 功能

- 支持多篇信息源输入（文件/URL/粘贴文本），输出始终为一篇融合文章
- 先验证信息源质量：检查时效性和准确性，过时内容联网搜索更新
- 完全原创表达：每个知识点用全新的措辞、结构和示例呈现
- 所有代码/JSON 示例重新构造，不复用来源的场景和变量
- 复杂知识点自动配 Mermaid 图（时序图/流程图/状态图）辅助理解
- 写完后执行 AI 腔检查，排除模板化措辞

## 安装

```bash
# 全局安装（所有项目可用）
npx skills add caosiwei97/agent-skills --path skills/ez-explain --global

# 仅当前项目
npx skills add caosiwei97/agent-skills --path skills/ez-explain
```

## 使用

```
/ez-explain path/to/source.md
```

或使用触发词：重写、根据资料写、融合写一篇、消化后重写、写篇通俗的。

### 参数

- `$ARGUMENTS` — 信息源路径或 URL（可多个，空格分隔）
- `--output <path>` — 输出文件路径（默认：打印到终端）
- `--outline-only` — 仅生成大纲，不写正文
- `--no-verify` — 跳过信息源验证

## License

MIT
