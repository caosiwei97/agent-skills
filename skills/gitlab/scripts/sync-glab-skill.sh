#!/usr/bin/env bash
# sync-glab-skill.sh — Sync the official glab skill from gitlab-org/ai/skills
# Usage:
#   bash sync-glab-skill.sh              # sync (skip if up to date)
#   bash sync-glab-skill.sh --force      # sync regardless of version
#
# Downloads SKILL.md + all references/ to ~/.agents/skills/glab/
# Records remote commit hash for change detection.
#
# Output tokens:
#   GLAB_SKILL_SYNCED      — downloaded (new or forced)
#   GLAB_SKILL_UP_TO_DATE  — already at latest
#   GLAB_SKILL_SYNC_FAILED — network or download error (non-fatal)
set -euo pipefail

CONFIG_DIR="$HOME/.gitlab-skill"
CONFIG_FILE="$CONFIG_DIR/config.json"
GLAB_SKILL_DIR=""
REMOTE_REPO="gitlab-org%2Fai%2Fskills"
SKILL_PATH="skills/glab"
FORCE="${1:-}"

# ── Determine install location ───────────────────────────────────
# Try standard skill directories in order of preference
for candidate in \
  "$HOME/.agents/skills/glab" \
  "$HOME/.claude/skills/glab" \
  "$HOME/.opencode/skills/glab"; do
  if [[ -d "$candidate" ]]; then
    GLAB_SKILL_DIR="$candidate"
    break
  fi
done

# Fallback: use ~/.agents/skills/glab (create if needed)
if [[ -z "$GLAB_SKILL_DIR" ]]; then
  GLAB_SKILL_DIR="$HOME/.agents/skills/glab"
  mkdir -p "$GLAB_SKILL_DIR"
fi

# ── Read saved commit hash from config ───────────────────────────
LOCAL_COMMIT=""
if [[ -f "$CONFIG_FILE" ]]; then
  if command -v jq &>/dev/null; then
    LOCAL_COMMIT=$(jq -r '.glab_skill_commit // empty' "$CONFIG_FILE" 2>/dev/null || true)
  else
    LOCAL_COMMIT=$(grep -o '"glab_skill_commit"[[:space:]]*:[[:space:]]*"[^"]*"' "$CONFIG_FILE" | \
      sed 's/.*"\([^"]*\)"$/\1/' | head -1)
  fi
fi

# ── Fetch remote commit hash ─────────────────────────────────────
RAW_JSON=$(curl -sfL --connect-timeout 10 --max-time 20 \
  "https://gitlab.com/api/v4/projects/$REMOTE_REPO/repository/commits?path=$SKILL_PATH&per_page=1" 2>/dev/null || true)

REMOTE_COMMIT=""
if [[ -n "$RAW_JSON" ]]; then
  if command -v jq &>/dev/null; then
    REMOTE_COMMIT=$(echo "$RAW_JSON" | jq -r '.[0].id // empty' 2>/dev/null || true)
  else
    REMOTE_COMMIT=$(echo "$RAW_JSON" | sed -n 's/.*"id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)
  fi
fi

# ── Decide whether to sync ───────────────────────────────────────
if [[ -z "$REMOTE_COMMIT" ]]; then
  echo "GLAB_SKILL_SYNC_FAILED"
  echo "Could not fetch remote commit hash from gitlab-org/ai/skills."
  exit 1
fi

if [[ "$FORCE" != "--force" ]] && [[ "$LOCAL_COMMIT" == "$REMOTE_COMMIT" ]]; then
  echo "GLAB_SKILL_UP_TO_DATE"
  echo "Local glab skill matches remote commit ${REMOTE_COMMIT:0:8}."
  exit 0
fi

# ── Download SKILL.md ────────────────────────────────────────────
echo "Syncing official glab skill from gitlab-org/ai/skills ..."
mkdir -p "$GLAB_SKILL_DIR/references"

SKILL_URL="https://gitlab.com/gitlab-org/ai/skills/-/raw/main/$SKILL_PATH/SKILL.md"
if ! curl -sfL --connect-timeout 15 --max-time 60 "$SKILL_URL" -o "$GLAB_SKILL_DIR/SKILL.md" 2>/dev/null; then
  echo "GLAB_SKILL_SYNC_FAILED"
  echo "Failed to download SKILL.md from $SKILL_URL"
  exit 1
fi
echo "  SKILL.md downloaded"

# ── Parse reference files from SKILL.md ──────────────────────────
# Extract all references/*.md links from the downloaded SKILL.md
REFS=$(sed -n 's/.*\(references\/[^)]*\.md\).*/\1/p' "$GLAB_SKILL_DIR/SKILL.md" | sort -u)

# ── Download references ───────────────────────────────────────────
REF_COUNT=0
REF_FAILED=0
for ref in $REFS; do
  REF_URL="https://gitlab.com/gitlab-org/ai/skills/-/raw/main/$SKILL_PATH/$ref"
  # Extract directory part (e.g. references/) and ensure it exists
  REF_DIR=$(dirname "$ref")
  mkdir -p "$GLAB_SKILL_DIR/$REF_DIR"

  if curl -sfL --connect-timeout 10 --max-time 30 "$REF_URL" -o "$GLAB_SKILL_DIR/$ref" 2>/dev/null; then
    REF_COUNT=$((REF_COUNT + 1))
  else
    REF_FAILED=$((REF_FAILED + 1))
    echo "  WARN: Failed to download $ref (non-fatal)"
  fi
done
echo "  $REF_COUNT references downloaded ($REF_FAILED failed)"

# ── Save commit hash to config ───────────────────────────────────
mkdir -p "$CONFIG_DIR"

if [[ -f "$CONFIG_FILE" ]]; then
  # Update existing config: add/replace glab_skill_commit and glab_skill_synced_at
  if command -v jq &>/dev/null; then
    TMPFILE=$(mktemp)
    jq --arg hash "$REMOTE_COMMIT" --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
      '. + {glab_skill_commit: $hash, glab_skill_synced_at: $ts}' "$CONFIG_FILE" > "$TMPFILE"
    mv "$TMPFILE" "$CONFIG_FILE"
    rm -f "$TMPFILE"
  else
    # Portable sed approach: remove old fields, add new ones before closing brace
    sed -i.bak \
      -e '/"glab_skill_commit"/d' \
      -e '/"glab_skill_synced_at"/d' \
      "$CONFIG_FILE"
    # Insert before the last }
    sed -i.bak2 \
      '$ s/^}/  "glab_skill_commit": "'"$REMOTE_COMMIT"'",\n  "glab_skill_synced_at": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'",\n}/' \
      "$CONFIG_FILE"
    rm -f "$CONFIG_FILE.bak" "$CONFIG_FILE.bak2"
  fi
else
  # No config yet — create minimal one (setup.sh will overwrite later)
  cat > "$CONFIG_FILE" <<CONF
{
  "glab_skill_commit": "$REMOTE_COMMIT",
  "glab_skill_synced_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
CONF
fi
chmod 600 "$CONFIG_FILE"

echo ""
echo "GLAB_SKILL_SYNCED"
echo "Installed to: $GLAB_SKILL_DIR"
echo "Remote commit: $REMOTE_COMMIT"
echo "Version in frontmatter: $(sed -n 's/^version:[[:space:]]*//p' "$GLAB_SKILL_DIR/SKILL.md" | head -1)"
