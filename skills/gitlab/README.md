# gitlab

GitLab 配置与连接管理 Skill。一个 skill 搞定 glab 安装、配置、认证、更新。

## 功能

- **跨平台自动安装 glab CLI**：macOS / Linux / Windows，自动检测并使用 brew/apt/scoop/winget/choco/go/binary
- **任意 GitLab 实例**：支持 gitlab.com、自托管、企业内网
- **首次配置引导**：交互式输入 URL + Token，自动验证连通性
- **Token 有效期检测**：每次操作前自动检查 API 连通性和 glab 认证状态
- **官方 glab skill 自动同步**：首次配置时自动从 `gitlab-org/ai/skills` 拉取最新 glab skill（命令参考），后续通过 commit hash 检测更新
- **安全**：Token 不持久化，Iron Law 禁止明文输出

## 一个 Skill，两层能力

**安装一个 skill，同时获得：**

| 层 | 来源 | 能力 |
|----|------|------|
| 配置与连接 | 本 skill | 安装 glab、配置多实例、Token 检测、自动更新 |
| 命令与操作 | 官方 glab skill（自动拉取） | MR / Issue / CI / Pipeline / Epic / Search 等全部 glab 命令 |

用户不需要单独安装官方 glab skill，本 skill 在首次配置时自动拉取并持续同步。

## 安装

```bash
# 全局安装（所有项目可用）
npx skills add caosiwei97/agent-skills --path skills/gitlab --global

# 仅当前项目
npx skills add caosiwei97/agent-skills --path skills/gitlab
```

## 使用

首次使用时会自动引导配置 GitLab URL 和 Token，之后通过触发词操作：

```
配置 GitLab
发起 MR / 创建合并请求
合到 main / 合并 MR
推送分支 / push 一下
流水线挂了 / CI 失败
```

## 环境变量

```bash
export GITLAB_TOKEN=<your-personal-access-token>
```

Token 需要 `api` scope。

## License

MIT
