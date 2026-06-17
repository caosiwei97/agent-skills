# gitlab

GitLab 操作 Skill，支持任意 GitLab 实例（自托管 / SaaS）。

## 功能

- **跨平台自动安装**：macOS / Linux / Windows 自动检测并安装 glab CLI
- **首次配置引导**：交互式输入 GitLab URL + Token，自动验证连通性
- **Token 过期检测**：每次操作前自动检查 API 连通性和 glab 认证状态
- **MR 管理**：创建、合并、关闭 Merge Request（防重复创建）
- **分支推送**：fetch → rebase → 推送，force push 必须 `--force-with-lease` + 用户确认
- **CI/CD 流水线**：查看状态、追踪失败 job、自动分类错误、flaky 检测与重试
- **安全**：Iron Law 禁止输出 TOKEN 明文，token 不持久化

## 安装

```bash
# 全局安装（所有项目可用）
npx skills add caosiwei97/agent-skills --path skills/gitlab --global

# 仅当前项目
npx skills add caosiwei97/agent-skills --path skills/gitlab
```

## 使用

首次使用时会自动引导配置 GitLab URL 和 Token，之后直接触发操作：

```
配置 GitLab
发起 MR / 创建合并请求
合到 main / 合并 MR
推送分支 / push 一下
流水线挂了 / CI 失败
重试流水线 / 看看 job
```

## 环境变量

```bash
export GITLAB_TOKEN=<your-personal-access-token>
```

Token 需要 `api` scope。

## License

MIT
