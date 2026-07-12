#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

export HOME="$TMP/home"
export XDG_STATE_HOME="$HOME/.local/state"
mkdir -p "$HOME"

if output="$($ROOT/scripts/lab -version 2>/dev/null)"; then
  echo "an unrecorded version unexpectedly succeeded" >&2
  exit 1
fi
[ "$output" = "Current GNOME Desktop Lab version: unknown" ]

"$ROOT/scripts/record-current-version.sh" v1.1.2 >/dev/null
[ "$("$ROOT/scripts/lab" -version)" = "Current GNOME Desktop Lab version: v1.1.2" ]
[ "$("$ROOT/scripts/lab" --version)" = "Current GNOME Desktop Lab version: v1.1.2" ]

"$ROOT/scripts/record-current-version.sh" v1.2.12 >/dev/null
[ "$(cat "$XDG_STATE_HOME/gnome-layout-sync-lab/current-version")" = "v1.2.12" ]

if "$ROOT/scripts/record-current-version.sh" 1.2.12 >/dev/null 2>&1; then
  echo "an invalid version unexpectedly succeeded" >&2
  exit 1
fi
[ "$("$ROOT/scripts/lab" -version)" = "Current GNOME Desktop Lab version: v1.2.12" ]

printf 'invalid\n' > "$XDG_STATE_HOME/gnome-layout-sync-lab/current-version"
if output="$($ROOT/scripts/lab --version 2>/dev/null)"; then
  echo "an invalid saved version unexpectedly succeeded" >&2
  exit 1
fi
[ "$output" = "Current GNOME Desktop Lab version: unknown" ]

if "$ROOT/scripts/lab" version >/dev/null 2>&1; then
  echo "an unsupported argument unexpectedly succeeded" >&2
  exit 1
fi

echo "Desktop Lab version tracker tests passed."
