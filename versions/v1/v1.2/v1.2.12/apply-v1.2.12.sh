#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEFAULT_LAB_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
if [ -x "$DEFAULT_LAB_ROOT/scripts/import-layout.sh" ]; then
  LAB_ROOT="$DEFAULT_LAB_ROOT"
else
  LAB_ROOT="/home/sdafsaasd/Downloads/gnome-layout-sync-lab"
fi
PROFILE_DIR="$SCRIPT_DIR/profile"
VERSION="v1.2.12"

echo "Applying GNOME layout lab version $VERSION"
echo "Profile: $PROFILE_DIR"
echo

"$LAB_ROOT/scripts/import-layout.sh" "$PROFILE_DIR"
"$LAB_ROOT/scripts/record-current-version.sh" "$VERSION"

echo
echo "Applied $VERSION."
echo "Log out and back in if GNOME Shell does not immediately show the version UI."
echo
read -r -p "Press Enter to close this window." _ || true
