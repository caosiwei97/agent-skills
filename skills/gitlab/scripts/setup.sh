#!/usr/bin/env bash
# setup.sh — GitLab skill first-time setup
# Usage: bash setup.sh --url <gitlab_base_url> --token <gitlab_token>
# Detects platform, installs glab if missing, tests connectivity, saves config.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_DIR="$HOME/.gitlab-skill"
CONFIG_FILE="$CONFIG_DIR/config.json"
GITLAB_URL=""
GITLAB_TOKEN=""

# ── Portable version extraction (no grep -P) ────────────────────
# Usage: fetch_glab_version → prints version string (e.g. "1.48.0")
fetch_glab_version() {
  local raw
  raw=$(curl -sfL --connect-timeout 10 --max-time 15 \
        "https://gitlab.com/api/v4/projects/gitlab-org%2Fcli/releases?per_page=1" 2>/dev/null || true)
  if [[ -n "$raw" ]]; then
    # Extract "tag_name":"v1.48.0" → "1.48.0" (portable sed, no grep -P)
    echo "$raw" | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"v\{0,1\}\([^"]*\)".*/\1/p' | head -1
  fi
}

# ── Detect platform & arch ───────────────────────────────────────
detect_os() {
  case "$(uname -s)" in
    Darwin*)  echo "macos" ;;
    Linux*)   echo "linux" ;;
    MINGW*|MSYS*|CYGWIN*) echo "windows" ;;
    *)        echo "unknown" ;;
  esac
}

detect_arch() {
  case "$(uname -m)" in
    arm64|aarch64) echo "arm64" ;;
    x86_64|amd64)  echo "amd64" ;;
    *)             echo "amd64" ;;
  esac
}

OS=$(detect_os)
ARCH=$(detect_arch)

# ── Parse arguments ──────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --url)    GITLAB_URL="${2%/}"; shift 2 ;;
    --token)  GITLAB_TOKEN="$2"; shift 2 ;;
    *)        echo "UNKNOWN_ARG: $1"; exit 1 ;;
  esac
done

if [[ -z "$GITLAB_URL" ]]; then
  echo "ERROR: --url is required (e.g. https://gitlab.example.com)"
  exit 1
fi
if [[ -z "$GITLAB_TOKEN" ]]; then
  echo "ERROR: --token is required"
  exit 1
fi

# ── Install glab if missing ──────────────────────────────────────
install_glab() {
  echo "PLATFORM: $OS"
  echo "ARCH: $ARCH"
  echo "Installing glab CLI..."

  case "$OS" in
    macos)
      if command -v brew &>/dev/null; then
        brew install glab
      else
        GLAB_VERSION=$(fetch_glab_version)
        if [[ -z "$GLAB_VERSION" ]]; then
          echo "ERROR: Cannot determine latest glab version. Install glab manually:"
          echo "  brew install glab  # install Homebrew first from https://brew.sh"
          exit 1
        fi
        echo "FALLBACK: Downloading glab $GLAB_VERSION ($ARCH)..."
        TMPFILE=$(mktemp)
        curl -sfL "https://gitlab.com/gitlab-org/cli/-/releases/v${GLAB_VERSION}/downloads/glab_${GLAB_VERSION}_macOS_${ARCH}.tar.gz" -o "$TMPFILE"
        mkdir -p "$HOME/.local/bin"
        tar xzf "$TMPFILE" -C "$HOME/.local/bin/" glab 2>/dev/null || \
          tar xzf "$TMPFILE" -C /usr/local/bin/ glab 2>/dev/null
        rm -f "$TMPFILE"
        export PATH="$HOME/.local/bin:/usr/local/bin:$PATH"
      fi
      ;;
    linux)
      if command -v apt-get &>/dev/null; then
        curl -sfL https://packages.gitlab.com/install/repositories/gitlab/cli/script.deb.sh 2>/dev/null | sudo bash 2>/dev/null || true
        sudo apt-get install -y glab 2>/dev/null || true
      elif command -v dnf &>/dev/null; then
        curl -sfL https://packages.gitlab.com/install/repositories/gitlab/cli/script.rpm.sh 2>/dev/null | sudo bash 2>/dev/null || true
        sudo dnf install -y glab 2>/dev/null || true
      elif command -v apk &>/dev/null; then
        sudo apk add --no-cache glab 2>/dev/null || true
      fi

      if ! command -v glab &>/dev/null; then
        if command -v go &>/dev/null; then
          go install gitlab.com/gitlab-org/cli@latest
        else
          GLAB_VERSION=$(fetch_glab_version)
          if [[ -z "$GLAB_VERSION" ]]; then
            echo "ERROR: Cannot determine latest glab version."
            echo "Install manually from https://gitlab.com/gitlab-org/cli/-/releases"
            exit 1
          fi
          echo "FALLBACK: Downloading glab $GLAB_VERSION (Linux $ARCH)..."
          mkdir -p "$HOME/.local/bin"
          curl -sfL "https://gitlab.com/gitlab-org/cli/-/releases/v${GLAB_VERSION}/downloads/glab_${GLAB_VERSION}_Linux_${ARCH}.tar.gz" | tar xz -C "$HOME/.local/bin/" glab
          export PATH="$HOME/.local/bin:$PATH"
        fi
      fi
      ;;
    windows)
      if command -v scoop &>/dev/null; then
        scoop install glab
      elif command -v winget &>/dev/null; then
        winget install --id GitLab.glab --accept-package-agreements --accept-source-agreements
      elif command -v choco &>/dev/null; then
        choco install glab -y
      else
        echo "ERROR: No supported package manager found on Windows (need scoop, winget, or choco)"
        echo "FALLBACK: Install glab manually from https://gitlab.com/gitlab-org/cli/-/releases"
        exit 1
      fi
      ;;
    *)
      echo "ERROR: Unsupported platform '$OS'. Install glab manually."
      exit 1
      ;;
  esac

  if command -v glab &>/dev/null; then
    echo "OK: glab installed ($(glab version 2>/dev/null | head -1 || echo 'version unknown'))"
  else
    echo "GLAB_INSTALL_FAILED"
    exit 1
  fi
}

if ! command -v glab &>/dev/null; then
  install_glab
fi

# ── Extract hostname from URL ────────────────────────────────────
HOSTNAME=$(echo "$GITLAB_URL" | sed -E 's|^https?://||' | sed -E 's|:[0-9]+||' | sed -E 's|/.*||')

# ── Test connectivity ────────────────────────────────────────────
echo "Testing connectivity to $GITLAB_URL ..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  "$GITLAB_URL/api/v4/user" \
  -H "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  --connect-timeout 10 \
  --max-time 15 2>/dev/null) || HTTP_CODE="000"

case "$HTTP_CODE" in
  200)
    echo "CONNECTIVITY: OK"
    ;;
  401)
    echo "CONNECTIVITY: TOKEN_INVALID"
    echo "The token was rejected by $GITLAB_URL (HTTP 401). Check token value and scopes (api scope required)."
    exit 1
    ;;
  404)
    echo "CONNECTIVITY: URL_NOT_FOUND"
    echo "The API endpoint was not found at $GITLAB_URL/api/v4/user. Check the GitLab URL."
    exit 1
    ;;
  000)
    echo "CONNECTIVITY: UNREACHABLE"
    echo "Cannot reach $GITLAB_URL. Check URL, network, and VPN."
    exit 1
    ;;
  *)
    echo "CONNECTIVITY: HTTP_$HTTP_CODE"
    echo "Unexpected HTTP $HTTP_CODE from $GITLAB_URL/api/v4/user"
    exit 1
    ;;
esac

# ── Authenticate glab ────────────────────────────────────────────
echo "Authenticating glab with $HOSTNAME ..."
echo "$GITLAB_TOKEN" | glab auth login --hostname "$HOSTNAME" --stdin 2>/dev/null || \
  glab auth login --hostname "$HOSTNAME" --token "$GITLAB_TOKEN" 2>/dev/null || {
    echo "GLAB_AUTH_FAILED"
    exit 1
  }
echo "OK: glab authenticated"

# ── Save config ──────────────────────────────────────────────────
mkdir -p "$CONFIG_DIR"
cat > "$CONFIG_FILE" <<CONF
{
  "url": "$GITLAB_URL",
  "hostname": "$HOSTNAME",
  "configured_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "platform": "$OS",
  "arch": "$ARCH",
  "scripts_dir": "$SCRIPT_DIR"
}
CONF
chmod 600 "$CONFIG_FILE"

echo ""
echo "SETUP_COMPLETE"
echo "Config saved to $CONFIG_FILE"
echo "  URL:      $GITLAB_URL"
echo "  Hostname: $HOSTNAME"
echo "  Platform: $OS ($ARCH)"
echo ""
echo "Add GITLAB_TOKEN to your shell profile or .env file for persistent use."

# ── Sync official glab skill ──────────────────────────────────────
echo ""
echo "Syncing official glab skill ..."
bash "$SCRIPT_DIR/sync-glab-skill.sh" || echo "WARN: glab skill sync failed (non-fatal, retry later)"
