#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:-}"
if [[ ! "$VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Usage: $0 vA.B.C" >&2
  exit 2
fi

STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/gnome-layout-sync-lab"
STATE_FILE="$STATE_DIR/current-version"

mkdir -p "$STATE_DIR"
temporary_file="$(mktemp "$STATE_DIR/.current-version.XXXXXX")"
trap 'rm -f "$temporary_file"' EXIT
printf '%s\n' "$VERSION" > "$temporary_file"
chmod 600 "$temporary_file"
mv -f "$temporary_file" "$STATE_FILE"
trap - EXIT

echo "Recorded current GNOME Desktop Lab version: $VERSION"
