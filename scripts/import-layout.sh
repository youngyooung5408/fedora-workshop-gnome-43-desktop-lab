#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <profile-dir>"
  exit 1
fi

PROFILE_DIR="$1"

if [ ! -d "$PROFILE_DIR" ]; then
  echo "Profile directory not found: $PROFILE_DIR"
  exit 1
fi

if [ -f "$PROFILE_DIR/gsettings-export.sh" ]; then
  echo "Applying GNOME settings from $PROFILE_DIR"
else
  echo "Missing $PROFILE_DIR/gsettings-export.sh"
  exit 1
fi

if [ -d "$PROFILE_DIR/extensions" ]; then
  mkdir -p "$HOME/.local/share/gnome-shell/extensions"
  cp -a "$PROFILE_DIR/extensions/." "$HOME/.local/share/gnome-shell/extensions/"
fi

while read -r cmd subcmd schema key value; do
  [ "$cmd $subcmd" = "gsettings set" ] || continue

  # Keep the VM independent from host-only apps. Missing apps can still be
  # installed later without blocking the desktop layout and extensions.
  if [ "$schema" = "org.gnome.shell" ] &&
     { [ "$key" = "favorite-apps" ] || [ "$key" = "app-picker-layout" ]; }; then
    continue
  fi

  if ! gsettings set "$schema" "$key" "$value" 2>/dev/null; then
    echo "Skipped unsupported setting: $schema $key"
  fi
done < "$PROFILE_DIR/gsettings-export.sh"

if [ -f "$PROFILE_DIR/enabled-extensions.txt" ]; then
  gsettings set org.gnome.shell disable-user-extensions false || true
  gsettings set org.gnome.shell enabled-extensions "$(cat "$PROFILE_DIR/enabled-extensions.txt")" || true
fi

echo
echo "Import complete."
echo "If GNOME Shell does not fully reflect the changes, log out and back in."
