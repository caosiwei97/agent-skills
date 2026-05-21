# Style Detection Rules

## Language Classification

From 30 most recent commit messages:
- Chinese characters ≥ 50% → Chinese
- English ≥ 50% → English

## Style Classification

- **Conventional**: `feat:`, `fix:`, `chore:`, `refactor:` prefixes (≥ 50% of commits)
- **Descriptive**: "Add xxx", "Fix yyy", "新增 xxx" (>3 words, no prefix)
- **Minimal**: 1-3 words ("format", "lint", "格式化")

## Detection Output Format

```
Style Detection
===============
Language: [Chinese | English]
Style: [Conventional | Descriptive | Minimal]
Examples: "actual msg 1" / "actual msg 2" / "actual msg 3"
```
