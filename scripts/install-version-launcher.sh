#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="${1:-v1.1.2}"
PROFILE_ARG="${2:-profiles/vm-initial-desktop-task}"
VERSIONS_ROOT="${VERSIONS_ROOT:-$ROOT/versions}"

if [[ "$VERSION" =~ ^v([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
  MAJOR="v${BASH_REMATCH[1]}"
  MINOR="$MAJOR.${BASH_REMATCH[2]}"
  PATCH="$MINOR.${BASH_REMATCH[3]}"
else
  echo "Usage: $0 vA.B.C [profile-dir]" >&2
  echo "Example: $0 v1.1.2 profiles/vm-initial-desktop-task" >&2
  exit 1
fi

VERSION_DIR="$VERSIONS_ROOT/$MAJOR/$MINOR/$PATCH"
SNAPSHOT_DIR="$VERSION_DIR/profile"
APPLY_SCRIPT="$VERSION_DIR/apply-$PATCH.sh"
DESKTOP_FILE="$VERSION_DIR/Apply $PATCH.desktop"
README_FILE="$VERSION_DIR/README.md"

if [[ "$PROFILE_ARG" = /* ]]; then
  PROFILE_DIR="$PROFILE_ARG"
else
  PROFILE_DIR="$ROOT/$PROFILE_ARG"
fi

if [ ! -d "$PROFILE_DIR" ]; then
  echo "Profile directory not found: $PROFILE_DIR" >&2
  exit 1
fi

if [ ! -f "$PROFILE_DIR/gsettings-export.sh" ]; then
  echo "Profile is missing gsettings-export.sh: $PROFILE_DIR" >&2
  exit 1
fi

mkdir -p "$VERSION_DIR"
rm -rf "$SNAPSHOT_DIR"
mkdir -p "$SNAPSHOT_DIR"
cp -a "$PROFILE_DIR/." "$SNAPSHOT_DIR/"

COMMIT="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || printf 'unknown')"

cat > "$APPLY_SCRIPT" <<EOF
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="\$(cd "\$(dirname "\$0")" && pwd)"
DEFAULT_LAB_ROOT="\$(cd "\$SCRIPT_DIR/../../../.." && pwd)"
if [ -x "\$DEFAULT_LAB_ROOT/scripts/import-layout.sh" ]; then
  LAB_ROOT="\$DEFAULT_LAB_ROOT"
else
  LAB_ROOT="$ROOT"
fi
PROFILE_DIR="\$SCRIPT_DIR/profile"
VERSION="$PATCH"

echo "Applying GNOME layout lab version \$VERSION"
echo "Profile: \$PROFILE_DIR"
echo

"\$LAB_ROOT/scripts/import-layout.sh" "\$PROFILE_DIR"

echo
echo "Applied \$VERSION."
echo "Log out and back in if GNOME Shell does not immediately show the version UI."
echo
read -r -p "Press Enter to close this window." _ || true
EOF

chmod +x "$APPLY_SCRIPT"

if command -v ptyxis >/dev/null 2>&1; then
  DESKTOP_EXEC="ptyxis -- $APPLY_SCRIPT"
  DESKTOP_TERMINAL="false"
elif command -v gnome-terminal >/dev/null 2>&1; then
  DESKTOP_EXEC="gnome-terminal -- $APPLY_SCRIPT"
  DESKTOP_TERMINAL="false"
elif command -v kgx >/dev/null 2>&1; then
  DESKTOP_EXEC="kgx -- $APPLY_SCRIPT"
  DESKTOP_TERMINAL="false"
else
  DESKTOP_EXEC="$APPLY_SCRIPT"
  DESKTOP_TERMINAL="true"
fi

cat > "$DESKTOP_FILE" <<EOF
[Desktop Entry]
Type=Application
Name=Apply GNOME Lab $PATCH
Comment=Import GNOME layout lab version $PATCH
Exec=$DESKTOP_EXEC
Icon=preferences-desktop-theme
Terminal=$DESKTOP_TERMINAL
Categories=Utility;
EOF

chmod +x "$DESKTOP_FILE"

if command -v gio >/dev/null 2>&1; then
  gio set -t boolean "$DESKTOP_FILE" metadata::trusted true 2>/dev/null || true
fi

cat > "$README_FILE" <<EOF
# GNOME Lab $PATCH

This folder stores a clickable VM layout version launcher.

- Version: $PATCH
- Source lab repo: $ROOT
- Source commit before launcher generation: $COMMIT
- Snapshot profile: $SNAPSHOT_DIR
- Executable script: $APPLY_SCRIPT
- Clickable launcher: $DESKTOP_FILE

To apply this version from a terminal:

\`\`\`bash
"$APPLY_SCRIPT"
\`\`\`

To apply this version from GNOME Files, double-click:

\`\`\`
$DESKTOP_FILE
\`\`\`

After applying, log out and back in if GNOME Shell does not immediately reload the panel extensions.
EOF

if command -v desktop-file-validate >/dev/null 2>&1; then
  desktop-file-validate "$DESKTOP_FILE"
fi

echo "Installed $PATCH version launcher:"
echo "  $APPLY_SCRIPT"
echo "  $DESKTOP_FILE"
