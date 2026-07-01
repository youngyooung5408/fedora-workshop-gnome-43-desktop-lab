#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="${1:-$ROOT/profiles/exported-$(date +%Y%m%d-%H%M%S)}"
exec "$ROOT/scripts/export-host-layout.sh" "$OUT_DIR"
