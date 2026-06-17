---
name: gitlab
description: "GitLab 操作（支持任意 GitLab 实例）。基于 glab CLI + GITLAB_TOKEN。当用户说'发起 MR'、'创建合并请求'、'提交 MR'、'合到 main/sit/dev'、'推送分支'、'push 一下'、'流水线挂了'、'CI 失败'、'pipeline 报错'、'job 挂了'、'看看流水线'、'重试流水线'、'合并 MR'、'关闭 MR'、'配置 GitLab'、'open MR'、'check pipeline'、'retry CI job'、'rebase branch'时使用。Actions: create/merge/close MR, push branch, view/retry pipeline, trace failed job, fix CI error, configure GitLab. 对象: merge request, MR, pipeline, CI/CD, job, branch."
---

# GitLab

**Scripts**: 所有脚本位于本 skill 的 `scripts/` 目录。使用相对路径（相对于本 SKILL.md 所在目录），如 `scripts/setup.sh`、`scripts/check.sh`。

IRON LAW: **绝不输出 GITLAB_TOKEN 明文。** 不 echo `$GITLAB_TOKEN`、不打印含 token 的 curl 命令、不写入任何文件或 commit。认证只通过 `glab` CLI 隐式传递。

## 首次配置 ⛔ BLOCKING

首次使用或 `~/.gitlab-skill/config.json` 不存在时，引导用户配置：

1. **询问用户**：
   - GitLab 实例 URL（如 `https://gitlab.example.com`）
   - GitLab Personal Access Token（`glpat-` 开头，scope 含 `api`）

2. **运行 setup 脚本**：
   ```bash
   bash scripts/setup.sh --url "<用户提供的URL>" --token "$GITLAB_TOKEN"
   ```
   脚本自动：检测平台 → 安装 glab（macOS/Linux/Windows）→ 验证连通性 → 认证 glab → 保存配置

3. **解读 setup 输出**：
   - `SETUP_COMPLETE` → 配置成功，可以继续
   - `CONNECTIVITY: TOKEN_INVALID` → 提示用户检查 token
   - `CONNECTIVITY: UNREACHABLE` → 提示用户检查 URL / VPN
   - `GLAB_INSTALL_FAILED` → 告知用户手动安装 glab

配置只保存 URL 和 hostname 到 `~/.gitlab-skill/config.json`（600 权限），token 明文不持久化。

## Workflow

```
GitLab Progress:

- [ ] Step 0: 前置检查 ⛔ BLOCKING（每次操作前必做）
  - [ ] 运行 check.sh，根据输出决定下一步
- [ ] Step 1: 执行用户请求的操作（按用户意图选其一）
  - (mr)   若用户说「发起 MR / 合并 / 关闭 MR / 查看 MR」→ 走「发起 MR」段
  - (push) 若用户说「推送 / push / 推一下」→ 走「推送分支」段
  - (ci)   若用户说「流水线 / CI / job / pipeline / 报错」→ 走「流水线」段
- [ ] Step 2: 写操作确认 ⚠️ REQUIRED（合并 / force push 前）
- [ ] Step 3: 报告结果
```

## Step 0: 前置检查 ⛔ BLOCKING

**每次操作前运行**（不依赖记忆，始终验证）：

```bash
bash scripts/check.sh
```

根据输出分支处理：

| 输出 | 含义 | 操作 |
|------|------|------|
| `OK` | 一切就绪 | 继续执行 Step 1 |
| `NEED_CONFIG` | 未配置 | 引导首次配置（见上方） |
| `NEED_TOKEN` | 环境变量缺失 | 提示 `export GITLAB_TOKEN=<token>` |
| `TOKEN_EXPIRED` | token 过期或无效 | 提示用户重新生成 token 并运行 setup |
| `UNREACHABLE` | 网络不通 | 提示检查网络 / VPN |
| `GLAB_NOT_INSTALLED` | glab 未安装 | 运行 setup.sh（自动安装） |
| `GLAB_NOT_AUTHED` | glab 未认证 | 运行 `echo "$GITLAB_TOKEN" \| glab auth login --hostname <hostname> --stdin` |

所有 glab 命令在当前仓库目录下运行（glab 从 git remote 自动推断项目）。

## 发起 MR

问：**源分支是否已推送到 origin？** 未推送则先 `git push -u origin <branch>`。

问：**是否已有同 source→target 的 open MR？** 避免重复创建：
```bash
glab mr list --source-branch "$(git branch --show-current)" --state opened
```
已有 → 直接返回现有 MR 链接，不重复创建。

问：**目标分支是什么？** 若用户未指定，使用项目默认分支（`main` 或 `master`），或询问用户。常见约定：`main`、`master`、`develop`、`sit`、`release`。

创建：
```bash
glab mr create \
  --target-branch <target> \
  --title "<commit message 或用户指定>" \
  --description "<描述>" \
  --remove-source-branch=false \
  --yes
```

**MR 描述**：从 `git log <target>..HEAD` 归纳，结构固定两段：
- `## 改动摘要`：按关注点分组，每组 1-2 句，总长 ≤200 字
- `## 验证`：列出已跑的检查，未跑则写「未跑」

## 推送分支

推送前必做：`git fetch origin` → 若落后则 `git pull --rebase` → 处理冲突 → 推送。

问：**是否需要 force push？** rebase/amend 后需要时，**必须用 `--force-with-lease`**，禁止裸 `--force`，且需用户确认：
```bash
git push --force-with-lease origin <branch>
```

## 流水线 / CI 错误

查看状态与失败 job：
```bash
glab ci status
glab ci trace --job <job-name>
```

**错误处理原则**（读完日志再动手，不盲试）：
- 可本地复现的错误 → 修 → 本地验证通过 → 推送
- 无法复现 / 疑似 flaky → 查看最近 3 次 pipeline 是否偶发 → `glab ci retry --job <job-id>`
- 环境/依赖问题（包缺失等）→ 通知用户，不自行处理

## 合并 / 关闭 MR（⚠️ 需用户确认）

```bash
glab mr merge <iid> --yes     # 合并前必须告知用户并等待确认
glab mr close <iid>           # 关闭
```

## 报告结果

每次操作后报告：MR URL / 推送结果 / 流水线新状态 / 失败原因与下一步。

## Anti-Patterns

- ❌ `echo $GITLAB_TOKEN` 或在日志/commit/文件里出现 token 明文
- ❌ 未经用户确认就 `mr merge`
- ❌ 裸 `--force` 推送（用 `--force-with-lease`）
- ❌ 重复创建 MR（不检查就 create）
- ❌ 不读日志就 `ci retry`（先定位根因，确认 flaky 才重试）
- ❌ 用 curl 直接调 API（glab 更简洁、认证隐式、错误信息更好）
- ❌ 跳过 check.sh 前置检查
- ❌ 硬编码 GitLab URL / hostname / 项目名 / 目标分支

## Pre-Delivery Checklist

- [ ] 操作前后 git 工作区状态明确（有无未提交改动）
- [ ] MR 创建后 `glab mr view <iid>` 确认 author 是预期账号
- [ ] 写操作（merge/force push）已经用户确认
- [ ] CI 修复已本地复现验证（非盲推）
- [ ] 报告含可操作的下一步
- [ ] 未在任何输出中暴露 token 全文
