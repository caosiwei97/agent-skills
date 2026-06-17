---
name: gitlab
description: "GitLab 配置与连接管理（支持任意 GitLab 实例）。跨平台自动安装 glab CLI、首次配置引导、Token 有效期检测、glab 认证状态校验、官方 glab skill 自动同步与更新检测。解决 glab 装不上、连不上、token 过期的前置问题。Triggers: configure GitLab, setup glab, GitLab token expired, check GitLab connection, 配置 GitLab, GitLab 连不上, token 过期, update glab skill."
---

# GitLab

**Scripts**: 所有脚本位于本 skill 的 `scripts/` 目录。使用相对路径（相对于本 SKILL.md 所在目录）。

IRON LAW: **绝不输出 GITLAB_TOKEN 明文。** 不 echo `$GITLAB_TOKEN`、不打印含 token 的 curl 命令、不写入任何文件或 commit。认证只通过 `glab` CLI 隐式传递。

## 本 Skill 的定位

本 skill 负责 **配置与连接层**：安装 glab、验证 Token、认证 glab、自动拉取并更新官方 glab skill。
GitLab 操作命令（MR/Issue/CI/Pipeline 等）由自动安装的官方 `glab` skill 处理。用户只需装一个 skill。

## Available Scripts

### scripts/setup.sh
首次配置：检测平台 → 安装 glab → 验证连通性 → 认证 glab → 保存配置 → **自动拉取官方 glab skill**。
Usage: `bash scripts/setup.sh --url <gitlab_url> --token <token>`

### scripts/check.sh
前置检查：读配置 → 验证 Token → 检查 glab 认证 → **检测官方 glab skill 更新**。
Usage: `bash scripts/check.sh`
每次操作前必跑，返回状态 token 供分支处理。

### scripts/sync-glab-skill.sh
从 `gitlab-org/ai/skills` 拉取官方 glab SKILL.md + references 到 `~/.agents/skills/glab/`。
Usage: `bash scripts/sync-glab-skill.sh [--force]`
幂等设计：对比远端 commit hash，已是最新则跳过。setup.sh 首次配置时自动调用。

## 首次配置 ⛔ BLOCKING

首次使用或 `~/.gitlab-skill/config.json` 不存在时，引导用户配置：

1. **询问用户**：
   - GitLab 实例 URL（如 `https://gitlab.example.com`）
   - GitLab Personal Access Token（`glpat-` 开头，scope 含 `api`）

2. **运行 setup 脚本**：
   ```bash
   bash scripts/setup.sh --url "<用户提供的URL>" --token "$GITLAB_TOKEN"
   ```
   脚本自动：检测平台 → 安装 glab → 验证连通性 → 认证 glab → 保存配置 → 拉取官方 glab skill

3. **解读 setup 输出**：
   - `SETUP_COMPLETE` → 配置成功
   - `GLAB_SKILL_SYNCED` → 官方 glab skill 已安装
   - `CONNECTIVITY: TOKEN_INVALID` → 提示用户检查 token
   - `CONNECTIVITY: UNREACHABLE` → 提示用户检查 URL / VPN
   - `GLAB_INSTALL_FAILED` → 告知用户手动安装 glab

## Workflow

```
GitLab Progress:

- [ ] Step 0: 前置检查 ⛔ BLOCKING（每次操作前必做）
  - [ ] 运行 check.sh，根据输出决定下一步
- [ ] Step 1: 执行用户请求的操作（委派给官方 glab skill）
```

## Step 0: 前置检查 ⛔ BLOCKING

**每次执行 GitLab 操作前运行**：

```bash
bash scripts/check.sh
```

根据输出分支处理：

| 输出 | 含义 | 操作 |
|------|------|------|
| `OK` | 一切就绪 | 继续执行 GitLab 操作（交给 glab skill） |
| `OK` + `UPDATE_AVAILABLE` | 就绪，但官方 glab skill 有更新 | 先跑 `bash scripts/sync-glab-skill.sh` 再操作 |
| `NEED_CONFIG` | 未配置 | 引导首次配置（见上方） |
| `NEED_TOKEN` | 环境变量缺失 | 提示 `export GITLAB_TOKEN=<token>` |
| `TOKEN_EXPIRED` | token 过期或无效 | 提示用户重新生成 token 并运行 setup |
| `UNREACHABLE` | 网络不通 | 提示检查网络 / VPN |
| `GLAB_NOT_INSTALLED` | glab 未安装 | 运行 setup.sh（自动安装 + 拉取官方 skill） |
| `GLAB_NOT_AUTHED` | glab 未认证 | 运行 `echo "$GITLAB_TOKEN" \| glab auth login --hostname <hostname> --stdin` |

## 官方 glab Skill 生命周期

```
用户安装本 skill
  → 首次配置（setup.sh）
    → 自动拉取官方 glab skill 到 ~/.agents/skills/glab/
    → 记录远端 commit hash
  → 日常使用（check.sh 每次跑）
    → 对比远端 commit hash，检测更新
    → 发现新版本 → 输出 UPDATE_AVAILABLE
    → 用户确认 → sync-glab-skill.sh 更新
```

不需要用户手动安装或更新官方 glab skill，全部由本 skill 管理。

## Anti-Patterns

- ❌ `echo $GITLAB_TOKEN` 或在日志/commit/文件里出现 token 明文
- ❌ 跳过 check.sh 前置检查
- ❌ 在本 skill 里重复 glab 命令参考（那是官方 glab skill 的职责）
- ❌ 手动让用户安装官方 glab skill（setup.sh 自动拉取）

## Pre-Delivery Checklist

- [ ] check.sh 返回 `OK`（无 UPDATE_AVAILABLE 阻塞）
- [ ] 未在任何输出中暴露 token 全文
- [ ] GitLab 操作正确委派给官方 glab skill
