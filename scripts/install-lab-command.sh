#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN_DIR="$HOME/.local/bin"
COMMAND_PATH="$BIN_DIR/lab"

mkdir -p "$BIN_DIR"
ln -sfn "$ROOT/scripts/lab" "$COMMAND_PATH"

echo "Installed VM lab command: $COMMAND_PATH"
echo "Run: lab -version"
