# gitlab

GitLab 配置与连接管理 Skill，解决 glab 装不上、连不上、token 过期的前置问题。

## 功能

- **跨平台自动安装 glab**：macOS / Linux / Windows 自动检测并安装（brew/apt/scoop/winget/choco/go/binary）
- **首次配置引导**：交互式输入任意 GitLab 实例 URL + Token，自动验证连通性
- **Token 过期检测**：每次操作前自动检查 API 连通性（`/api/v4/user`）
- **安全**：Token 不持久化，Iron Law 禁止明文输出

## 定位

本 skill 只负责 **配置与连接层**。GitLab 操作命令（MR / Issue / CI / Pipeline 等）交给 [`gitlab-org/ai/skills`](https://gitlab.com/gitlab-org/ai/skills) 的 `glab` skill 处理。两个 skill 叠加使用，各司其职。

## 安装

```bash
# 本 skill（配置层）
npx skills add caosiwei97/agent-skills --path skills/gitlab --global

# 官方 glab skill（命令层）
npx @dgruzd/skills add https://gitlab.com/gitlab-org/ai/skills/-/tree/main/skills --global --agent opencode --skill glab
```

## 环境变量

```bash
export GITLAB_TOKEN=<your-personal-access-token>
```

Token 需要 `api` scope。

## 触发词

配置 GitLab、setup glab、GitLab token expired、check GitLab connection、GitLab 连不上、token 过期

## License

MIT
