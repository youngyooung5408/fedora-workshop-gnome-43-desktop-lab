#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="${1:-$ROOT/profiles/host-current}"
EXT_OUT="$OUT_DIR/extensions"

mkdir -p "$OUT_DIR" "$EXT_OUT"

echo "Exporting GNOME layout to: $OUT_DIR"

schemas=(
  org.gnome.desktop.interface
  org.gnome.desktop.background
  org.gnome.desktop.wm.preferences
  org.gnome.desktop.wm.keybindings
  org.gnome.desktop.input-sources
  org.gnome.shell
  org.gnome.shell.app-switcher
  org.gnome.shell.keybindings
  org.gnome.shell.window-switcher
  org.gnome.mutter
  org.gnome.mutter.keybindings
)

: > "$OUT_DIR/gsettings-export.sh"
printf '#!/usr/bin/env bash\nset -euo pipefail\n\n' > "$OUT_DIR/gsettings-export.sh"

for schema in "${schemas[@]}"; do
  while IFS= read -r key; do
    value=$(gsettings get "$schema" "$key")
    printf 'gsettings set %q %q %q\n' "$schema" "$key" "$value" >> "$OUT_DIR/gsettings-export.sh"
  done < <(gsettings list-keys "$schema")
done

chmod +x "$OUT_DIR/gsettings-export.sh"

gsettings get org.gnome.shell enabled-extensions > "$OUT_DIR/enabled-extensions.txt"
gsettings get org.gnome.shell favorite-apps > "$OUT_DIR/favorite-apps.txt"
gsettings get org.gnome.desktop.background picture-uri > "$OUT_DIR/background-picture-uri.txt" || true
gsettings get org.gnome.desktop.background picture-uri-dark > "$OUT_DIR/background-picture-uri-dark.txt" || true
dconf dump /org/gnome/ > "$OUT_DIR/dconf-org-gnome.ini"

if [ -d "$HOME/.local/share/gnome-shell/extensions" ]; then
  cp -a "$HOME/.local/share/gnome-shell/extensions/." "$EXT_OUT/"
fi

cat > "$OUT_DIR/README.txt" <<EOF
This folder is a GNOME layout snapshot exported from the source machine.

Files:
- gsettings-export.sh : replayable GNOME settings commands
- dconf-org-gnome.ini : full /org/gnome/ dconf dump
- extensions/         : copied local shell extensions, if any

To import on another GNOME machine:
  ./scripts/import-layout.sh $OUT_DIR
EOF

echo "Done."
