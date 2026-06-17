#!/usr/bin/env bash
# check.sh — Pre-operation connectivity & auth check for GitLab skill
# Usage: bash check.sh
# Reads config from ~/.gitlab-skill/config.json, tests API connectivity,
# verifies glab auth status. Returns exit 0 if all OK.
#
# Output tokens (for SKILL.md to parse):
#   OK               — everything is ready
#   NEED_CONFIG      — no config file found, run setup
#   NEED_TOKEN       — GITLAB_TOKEN env var missing
#   TOKEN_EXPIRED    — token rejected by API (401)
#   UNREACHABLE      — cannot reach GitLab instance
#   GLAB_NOT_INSTALLED — glab CLI not found
#   GLAB_NOT_AUTHED  — glab not authenticated for configured hostname
#   OK (with UPDATE_AVAILABLE note) — ready, but official glab skill has update
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_DIR="$HOME/.gitlab-skill"
CONFIG_FILE="$CONFIG_DIR/config.json"

# ── Check config file ────────────────────────────────────────────
if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "NEED_CONFIG"
  exit 1
fi

# ── Read config (lightweight, no jq dependency) ─────────────────
read_config() {
  local key="$1"
  # Try jq first, fallback to grep+sed
  if command -v jq &>/dev/null; then
    jq -r ".$key // empty" "$CONFIG_FILE" 2>/dev/null
  else
    grep -o "\"$key\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" "$CONFIG_FILE" | \
      sed "s/\"$key\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\"/\1/" | head -1
  fi
}

GITLAB_URL=$(read_config "url")
HOSTNAME=$(read_config "hostname")

if [[ -z "$GITLAB_URL" ]]; then
  echo "NEED_CONFIG"
  echo "Config file exists but 'url' is missing or empty."
  exit 1
fi

# ── Check GITLAB_TOKEN env var ───────────────────────────────────
if [[ -z "${GITLAB_TOKEN:-}" ]]; then
  echo "NEED_TOKEN"
  echo "GITLAB_TOKEN environment variable is not set."
  echo "Set it with: export GITLAB_TOKEN=<your-token>"
  exit 1
fi

# ── Check glab installed ─────────────────────────────────────────
if ! command -v glab &>/dev/null; then
  echo "GLAB_NOT_INSTALLED"
  exit 1
fi

# ── Check glab auth ──────────────────────────────────────────────
GLAB_AUTH_OUTPUT=$(glab auth status --hostname "$HOSTNAME" 2>&1) || true
if echo "$GLAB_AUTH_OUTPUT" | grep -qiE "not logged in|no credentials|not authenticated"; then
  echo "GLAB_NOT_AUTHED"
  echo "glab is not authenticated for $HOSTNAME."
  echo "Run: echo \"\$GITLAB_TOKEN\" | glab auth login --hostname $HOSTNAME --stdin"
  exit 1
fi

# ── Version check helpers (non-blocking) ──────────────────────────
read_json_field() {
  local file="$1" field="$2"
  if command -v jq &>/dev/null; then
    jq -r ".$field // empty" "$file" 2>/dev/null
  else
    grep -o "\"$field\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" "$file" | \
      sed "s/\"$field\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\"/\1/" | head -1
  fi
}

check_glab_skill_update() {
  local local_hash remote_hash raw
  local_hash=$(read_json_field "$CONFIG_FILE" "glab_skill_commit")

  raw=$(curl -sfL --connect-timeout 5 --max-time 10 \
    "https://gitlab.com/api/v4/projects/gitlab-org%2Fai%2Fskills/repository/commits?path=skills/glab&per_page=1" 2>/dev/null) || return 0
  [[ -z "$raw" ]] && return 0

  if command -v jq &>/dev/null; then
    remote_hash=$(echo "$raw" | jq -r '.[0].id // empty' 2>/dev/null || true)
  else
    remote_hash=$(echo "$raw" | sed -n 's/.*"id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)
  fi

  [[ -z "$remote_hash" ]] && return 0
  [[ "$local_hash" == "$remote_hash" ]] && return 0

  echo "UPDATE_AVAILABLE"
  echo "Official glab skill has a new version (remote: ${remote_hash:0:8}, local: ${local_hash:-(none)})."
  echo "Run: bash $SCRIPT_DIR/sync-glab-skill.sh"
}

# ── Test API connectivity ────────────────────────────────────────
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  "$GITLAB_URL/api/v4/user" \
  -H "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  --connect-timeout 10 \
  --max-time 15 2>/dev/null) || HTTP_CODE="000"

case "$HTTP_CODE" in
  200)
    check_glab_skill_update
    echo "OK"
    ;;
  401)
    echo "TOKEN_EXPIRED"
    echo "GitLab rejected the token (HTTP 401). Generate a new token and re-run setup:"
    echo "  bash $SCRIPT_DIR/setup.sh --url $GITLAB_URL --token <new-token>"
    exit 1
    ;;
  000)
    echo "UNREACHABLE"
    echo "Cannot reach $GITLAB_URL. Check network/VPN."
    exit 1
    ;;
  *)
    echo "CONNECTIVITY_ERROR"
    echo "Unexpected HTTP $HTTP_CODE from $GITLAB_URL/api/v4/user"
    exit 1
    ;;
esac
