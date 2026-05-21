---
name: commit
description: "Git 提交与推送自动化工具。触发词：提交、commit、推送、push、提交代码、commit and push、git commit、提交变更、暂存提交。Triggers: commit changes, push to remote, stage and commit, git push, commit all, commit my work, push branch. Auto-stages, generates repo-style commit messages, fixes hook errors, handles merge conflicts with user confirmation before pushing. No signatures, no co-author. Auto-push after commit. Auto-fix pre-push hook errors. Lists all conflicts for user confirmation before resolving."
allowed-tools: ["Bash", "Read", "Edit"]
---

IRON LAW: Never add any signature. No Co-authored-by, no Ultraworked-with, no AI-assisted, no footer of any kind. Commit messages contain only style-matched descriptive text.

## Workflow Checklist

> **Commit skill progress:**

- [ ] **Step 1: Gather Context** ⛔ BLOCKING
  - [ ] 1.1 Run git status, diff, log in parallel
  - [ ] 1.2 Detect commit message style from history
  - [ ] 1.3 Check branch status and remote tracking
  - [ ] 1.4 Classify staged vs unstaged changes
- [ ] **Step 2: Plan Commits** ⚠️ REQUIRES CONFIRMATION
  - [ ] 2.1 Plan staged-area commit first (respect user staging boundary)
  - [ ] 2.2 Plan unstaged changes (atomic split rules)
  - [ ] 2.3 Generate messages matching detected style
  - [ ] 2.4 Present plan to user and wait for confirmation
- [ ] **Step 3: Execute Commits**
  - [ ] 3.1 Commit staged content directly (no re-add)
  - [ ] 3.2 Stage and commit unstaged changes in dependency order
  - [ ] 3.3 Verify each commit result
- [ ] **Step 4: Pre-push Check** ⛔ BLOCKING
  - [ ] 4.1 Fetch and rebase (detect conflicts)
  - [ ] 4.2 Conflicts → list all → wait for user confirmation
  - [ ] 4.3 Run pre-push hook, auto-fix errors if possible
- [ ] **Step 5: Push**
- [ ] **Step 6: Verify** ⚠️ REQUIRED

---

## Step 1: Gather Context (parallel)

Run all commands simultaneously:

```bash
# Group 1: current state
git status --porcelain
git diff --staged --stat
git diff --stat

# Group 2: history for style detection
git log -30 --pretty=format:"%s"

# Group 3: branch context
git branch --show-current
git rev-parse --abbrev-ref @{upstream} 2>/dev/null || echo "NO_UPSTREAM"
git log --oneline $(git merge-base HEAD main 2>/dev/null || git merge-base HEAD master 2>/dev/null)..HEAD 2>/dev/null
```

Classify from `git status --porcelain`:
- `A/M/D` in first column → staged
- `??` or space in first column → unstaged

### Staged-First Principle

Staged files = user's explicit commit boundary. Never re-add them.

- Staged files exist → first commit uses `git commit` directly (no git add)
- Unstaged files → subsequent batches via `git add` + `git commit`
- Only staged files → single commit, no splitting needed

---

## Step 2: Style Detection

Load `references/style-detection.md` for classification rules.

Detect language (Chinese/English) and style (conventional/descriptive/minimal) from recent 30 commits.

---

## Step 3: Plan Commits ⚠️ REQUIRES CONFIRMATION

### Staged-area planning

1. Staged files are never re-added — commit directly
2. Staged files ≥ 3 → split by atomic rules
3. Staged files < 3 → single commit
4. Mark as `[staged]` in plan

### Unstaged changes planning

**Rule: >3 files → must split into 2+ commits**

Split priority:
1. Different directories/modules → different commits
2. Different concerns (UI/logic/config/test) → different commits
3. Implementation + corresponding test → same commit
4. Tightly coupled config changes → same commit

Dependency order: dependent files commit after their dependencies. When unclear, alphabetical by path.

### Present plan

```
Commit Plan
===========
Staged files: N | Unstaged files: M | Planned commits: K

--- Staged commits (priority) ---

Commit 1 [staged]: <style-matched message>
  - path/to/file1
  - path/to/file2

--- Unstaged commits ---

Commit 2: <style-matched message>
  - path/to/file3
  - path/to/file3_test
  Reason: implementation + test

...
```

⚠️ Wait for explicit user confirmation before proceeding. Never continue without "ok"/"confirmed"/"yes".

---

## Step 4: Execute Commits

### Staged-area commit

```bash
git diff --staged --stat
git commit -m "<style-matched message>"
git log -1 --oneline
```

### Unstaged changes (per group)

```bash
git add <file1> <file2> ...
git diff --staged --stat
git commit -m "<style-matched message>"
git log -1 --oneline
```

---

## Step 5: Pre-push Check ⛔ BLOCKING

```bash
git fetch origin
git pull --rebase origin <branch>
```

If rebase reports conflicts → load `references/conflict-protocol.md` and follow the protocol.

If pre-push hook fails:
1. Attempt auto-fix (`npx eslint --fix`, `npx prettier --write`)
2. Stage fixes and `git commit --amend --no-edit`
3. If still failing → report error to user, ask whether to continue or abort
4. Never use `--no-verify` without explicit user permission

---

## Step 6: Push

```bash
# No upstream yet
git push -u origin <branch>

# Has upstream
git push origin <branch>

# After rebase on pushed branch
git push --force-with-lease origin <branch>
```

Never use bare `--force`. Always `--force-with-lease`.

---

## Step 7: Verify

```bash
git status
git log --oneline -5
git diff --stat
```

### Completion report

```
Done
====
Branch: <branch>
Commits: N
Pushed to: origin/<branch>

History:
  <hash1> <message1>
  <hash2> <message2>

Working tree: clean | has uncommitted changes (details)
```

---

## Prohibited Actions

1. **No signatures** — no co-authored-by, no AI attribution of any kind
2. **No push without pull** — must fetch + pull --rebase before push
3. **No auto-resolving conflicts** — list all, show to user, wait for confirmation
4. **No --no-verify** — fix errors or ask user permission to skip
5. **No bare --force** — use --force-with-lease
6. **No commit without confirmation** — show plan, wait for user approval
7. **No >3 files in one commit** — must split into atomic units
8. **No dirty working tree** — all changes committed or explicitly excluded
9. **No re-staging staged files** — staged area = user boundary, commit directly
