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

FINAL_VERSION_DIR="$VERSIONS_ROOT/$MAJOR/$MINOR/$PATCH"
VERSION_PARENT="$VERSIONS_ROOT/$MAJOR/$MINOR"
VERSION_DIR=""
SNAPSHOT_DIR="$VERSION_DIR/profile"
APPLY_SCRIPT="$VERSION_DIR/apply-$PATCH.sh"
DESKTOP_FILE="$VERSION_DIR/Apply $PATCH.desktop"
README_FILE="$VERSION_DIR/README.md"
HOST_MANIFEST="$VERSION_DIR/host-manifest.json"

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

if [ -e "$FINAL_VERSION_DIR" ]; then
  echo "Refusing to overwrite immutable version: $FINAL_VERSION_DIR" >&2
  exit 1
fi

mkdir -p "$VERSION_PARENT"
VERSION_DIR="$(mktemp -d "$VERSION_PARENT/.${PATCH}.staging.XXXXXX")"
trap 'rm -rf "$VERSION_DIR"' EXIT
SNAPSHOT_DIR="$VERSION_DIR/profile"
APPLY_SCRIPT="$VERSION_DIR/apply-$PATCH.sh"
DESKTOP_FILE="$VERSION_DIR/Apply $PATCH.desktop"
README_FILE="$VERSION_DIR/README.md"
HOST_MANIFEST="$VERSION_DIR/host-manifest.json"
FINAL_APPLY_SCRIPT="$FINAL_VERSION_DIR/apply-$PATCH.sh"
FINAL_DESKTOP_FILE="$FINAL_VERSION_DIR/Apply $PATCH.desktop"

echo "Version generation preview"
echo "  create: $FINAL_VERSION_DIR"
echo "  copy profile: $PROFILE_DIR -> $FINAL_VERSION_DIR/profile"
echo "  generate: $FINAL_APPLY_SCRIPT"
echo "  generate: $FINAL_DESKTOP_FILE"
echo "  generate: $FINAL_VERSION_DIR/README.md"
echo "  generate from host-features.json: $FINAL_VERSION_DIR/host-manifest.json"

mkdir -p "$SNAPSHOT_DIR"
cp -a "$PROFILE_DIR/." "$SNAPSHOT_DIR/"

python3 "$ROOT/scripts/host-feature-registry.py" manifest "$PATCH" "$SNAPSHOT_DIR" "$HOST_MANIFEST"

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
"\$LAB_ROOT/scripts/record-current-version.sh" "\$VERSION"

echo
echo "Applied \$VERSION."
echo "Log out and back in if GNOME Shell does not immediately show the version UI."
echo
read -r -p "Press Enter to close this window." _ || true
EOF

chmod +x "$APPLY_SCRIPT"

if command -v ptyxis >/dev/null 2>&1; then
  DESKTOP_EXEC="ptyxis -- $FINAL_APPLY_SCRIPT"
  DESKTOP_TERMINAL="false"
elif command -v gnome-terminal >/dev/null 2>&1; then
  DESKTOP_EXEC="gnome-terminal -- $FINAL_APPLY_SCRIPT"
  DESKTOP_TERMINAL="false"
elif command -v kgx >/dev/null 2>&1; then
  DESKTOP_EXEC="kgx -- $FINAL_APPLY_SCRIPT"
  DESKTOP_TERMINAL="false"
else
  DESKTOP_EXEC="$FINAL_APPLY_SCRIPT"
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

> **Lab restore warning:** This launcher reproduces the exact saved lab profile
> and can overwrite current GNOME settings. On a host, use
> \`./scripts/update-host.sh\` instead.

- Version: $PATCH
- Source lab repo: $ROOT
- Source commit before launcher generation: $COMMIT
- Snapshot profile: $FINAL_VERSION_DIR/profile
- Executable script: $FINAL_APPLY_SCRIPT
- Clickable launcher: $FINAL_DESKTOP_FILE
- Safe host manifest: $FINAL_VERSION_DIR/host-manifest.json

To apply this version from a terminal:

\`\`\`bash
"$FINAL_APPLY_SCRIPT"
\`\`\`

To apply this version from GNOME Files, double-click:

\`\`\`
$FINAL_DESKTOP_FILE
\`\`\`

After applying, log out and back in if GNOME Shell does not immediately reload the panel extensions.
EOF

if command -v desktop-file-validate >/dev/null 2>&1; then
  desktop-file-validate "$DESKTOP_FILE"
fi

mv "$VERSION_DIR" "$FINAL_VERSION_DIR"
trap - EXIT

echo "Installed $PATCH version launcher:"
echo "  $FINAL_APPLY_SCRIPT"
echo "  $FINAL_DESKTOP_FILE"
echo "  $FINAL_VERSION_DIR/host-manifest.json"
