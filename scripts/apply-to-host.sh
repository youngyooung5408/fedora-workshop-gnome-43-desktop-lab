#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROFILE_DIR="${1:-$ROOT/profiles/vm-tuned}"
exec "$ROOT/scripts/import-layout.sh" "$PROFILE_DIR"
