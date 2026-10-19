#!/usr/bin/env bash
set -euo pipefail

REPO_RAW_BASE="${BOTAUTOTASK_RAW_BASE:-https://raw.githubusercontent.com/huongmh14/BotAutoTask-/dev}"
INSTALL_DIR="${HOME}/.local/bin"
mkdir -p "$INSTALL_DIR"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-.}")" && pwd)"
if [ -f "$SCRIPT_DIR/dist/botautotask.mjs" ]; then
  cp "$SCRIPT_DIR/dist/botautotask.mjs" "$INSTALL_DIR/botautotask"
else
  echo "🌐 Downloading standalone botautotask from $REPO_RAW_BASE/dist/botautotask.mjs ..."
  curl -fsSL "$REPO_RAW_BASE/dist/botautotask.mjs" -o "$INSTALL_DIR/botautotask"
fi

chmod +x "$INSTALL_DIR/botautotask"
echo "✅ Installed 'botautotask' to $INSTALL_DIR/botautotask"
echo "🚀 Run: botautotask models | botautotask cores | botautotask run \"<goal>\""
