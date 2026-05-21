# Conflict Resolution Protocol

When `git pull --rebase` reports conflicts, follow this protocol strictly.

## Step A: Identify all conflict files

```bash
git diff --name-only --diff-filter=U
```

## Step B: Extract details for each conflict

```bash
git diff <conflict-file>
```

For each file, locate all conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`) and record:
- File path
- Conflict region (line range)
- HEAD version (our changes)
- Remote version (their changes)
- Brief description of each side

## Step C: Present conflict report to user

```
Conflict Report
===============
Detected N conflicts across M files:

File: path/to/file1
  Conflict 1 (lines X-Y):
    Ours: [description]
    Theirs: [description]
  Conflict 2 (lines A-B):
    Ours: [description]
    Theirs: [description]

File: path/to/file2
  Conflict 1 (lines C-D):
    Ours: [description]
    Theirs: [description]

Options:
1. Keep all ours
2. Accept all theirs
3. Resolve per-conflict (specify for each)
4. Abort — I'll handle manually

Please confirm resolution approach.
```

⚠️ Never resolve any conflict without user confirmation.

## Step D: Apply user's chosen resolution

```bash
# Remove conflict markers, apply chosen version
# Then stage resolved files
git add <resolved-file>
```

## Step E: Continue rebase

```bash
git rebase --continue
```

If new conflicts appear → repeat Steps A-E.
