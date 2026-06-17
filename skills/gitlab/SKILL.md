---
name: gitlab
description: "GitLab 配置与连接管理（支持任意 GitLab 实例）。跨平台自动安装 glab CLI、首次配置引导、Token 有效期检测、glab 认证状态校验。解决 glab 装不上、连不上、token 过期的前置问题。配合 glab 命令类 skill（如 gitlab-org/ai/skills 的 glab skill）使用。Triggers: configure GitLab, setup glab, GitLab token expired, check GitLab connection, 配置 GitLab, GitLab 连不上, token 过期."
---

# GitLab

**Scripts**: 所有脚本位于本 skill 的 `scripts/` 目录。使用相对路径（相对于本 SKILL.md 所在目录），如 `scripts/setup.sh`、`scripts/check.sh`。

IRON LAW: **绝不输出 GITLAB_TOKEN 明文。** 不 echo `$GITLAB_TOKEN`、不打印含 token 的 curl 命令、不写入任何文件或 commit。认证只通过 `glab` CLI 隐式传递。

## 本 Skill 的定位

本 skill 只负责 **配置与连接层**：安装 glab、验证 Token、认证 glab。
GitLab 操作命令（MR/Issue/CI/Pipeline 等）交给 `gitlab-org/ai/skills` 的 `glab` skill 处理。两个 skill 叠加使用，各司其职。

## 首次配置 ⛔ BLOCKING

首次使用或 `~/.gitlab-skill/config.json` 不存在时，引导用户配置：

1. **询问用户**：
   - GitLab 实例 URL（如 `https://gitlab.example.com`）
   - GitLab Personal Access Token（`glpat-` 开头，scope 含 `api`）

2. **运行 setup 脚本**：
   ```bash
   bash scripts/setup.sh --url "<用户提供的URL>" --token "$GITLAB_TOKEN"
   ```
   脚本自动：检测平台（macOS/Linux/Windows）→ 安装 glab → 验证连通性 → 认证 glab → 保存配置

3. **解读 setup 输出**：
   - `SETUP_COMPLETE` → 配置成功，可以继续
   - `CONNECTIVITY: TOKEN_INVALID` → 提示用户检查 token
   - `CONNECTIVITY: UNREACHABLE` → 提示用户检查 URL / VPN
   - `GLAB_INSTALL_FAILED` → 告知用户手动安装 glab

配置只保存 URL 和 hostname 到 `~/.gitlab-skill/config.json`（600 权限），token 明文不持久化。

## Workflow

```
GitLab Config Progress:

- [ ] Step 0: 前置检查 ⛔ BLOCKING（每次操作前必做）
  - [ ] 运行 check.sh，根据输出决定下一步
- [ ] Step 1: 执行用户请求的操作（委派给 glab skill）
```

## Step 0: 前置检查 ⛔ BLOCKING

**每次执行 GitLab 操作前运行**（不依赖记忆，始终验证）：

```bash
bash scripts/check.sh
```

根据输出分支处理：

| 输出 | 含义 | 操作 |
|------|------|------|
| `OK` | 一切就绪 | 继续执行 GitLab 操作（交给 glab skill） |
| `NEED_CONFIG` | 未配置 | 引导首次配置（见上方） |
| `NEED_TOKEN` | 环境变量缺失 | 提示 `export GITLAB_TOKEN=<token>` |
| `TOKEN_EXPIRED` | token 过期或无效 | 提示用户重新生成 token 并运行 setup |
| `UNREACHABLE` | 网络不通 | 提示检查网络 / VPN |
| `GLAB_NOT_INSTALLED` | glab 未安装 | 运行 setup.sh（自动安装） |
| `GLAB_NOT_AUTHED` | glab 未认证 | 运行 `echo "$GITLAB_TOKEN" \| glab auth login --hostname <hostname> --stdin` |

## 与 glab Skill 的配合

本 skill 输出 `OK` 后，GitLab 操作（创建 MR、管理 Issue、CI/Pipeline、搜索等）全部由 `gitlab-org/ai/skills` 的 `glab` skill 处理。

安装官方 glab skill：
```bash
npx @dgruzd/skills add https://gitlab.com/gitlab-org/ai/skills/-/tree/main/skills --global --agent opencode --skill glab
```

## Anti-Patterns

- ❌ `echo $GITLAB_TOKEN` 或在日志/commit/文件里出现 token 明文
- ❌ 跳过 check.sh 前置检查
- ❌ 在本 skill 里重复 glab 命令参考（那是 official glab skill 的职责）

## Pre-Delivery Checklist

- [ ] check.sh 返回 `OK`
- [ ] 未在任何输出中暴露 token 全文
- [ ] GitLab 操作正确委派给 glab skill
