#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

export HOME="$TMP/home"
export XDG_CONFIG_HOME="$HOME/.config"
mkdir -p "$HOME/.local/share/gnome-shell/extensions/unrelated@example" "$TMP/bin"
printf 'keep\n' > "$HOME/.local/share/gnome-shell/extensions/unrelated@example/original"
mkdir -p "$HOME/.local/share/gnome-shell/extensions/desktop-lab-v12@young"
printf 'old\n' > "$HOME/.local/share/gnome-shell/extensions/desktop-lab-v12@young/original"
printf "['unrelated@example']\n" > "$TMP/enabled"

cat > "$TMP/bin/gsettings" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
state="${TEST_GSETTINGS_STATE:?}"
if [ "$1" = get ] && [ "$2" = org.gnome.shell ] && [ "$3" = enabled-extensions ]; then
  cat "$state"
elif [ "$1" = set ] && [ "$2" = org.gnome.shell ] && [ "$3" = enabled-extensions ]; then
  printf '%s\n' "$4" > "$state"
elif [ "$1" = set ] && [ "$2" = org.gnome.shell ] && [ "$3" = disable-user-extensions ]; then
  :
else
  echo "Unexpected gsettings call: $*" >&2
  exit 1
fi
EOF
chmod +x "$TMP/bin/gsettings"
export PATH="$TMP/bin:$PATH"
export TEST_GSETTINGS_STATE="$TMP/enabled"

before="$(find "$HOME" -type f -print -exec sha256sum {} \; | sort)"
"$ROOT/scripts/update-host.sh" --dry-run >/dev/null
after="$(find "$HOME" -type f -print -exec sha256sum {} \; | sort)"
[ "$before" = "$after" ] || { echo "dry run changed host state" >&2; exit 1; }

output="$("$ROOT/scripts/update-host.sh" --yes)"
backup="$(sed -n 's/^Backup: //p' <<< "$output")"
[ -n "$backup" ] && [ -d "$backup" ]
[ -f "$HOME/.local/share/gnome-shell/extensions/unrelated@example/original" ]
[ -f "$HOME/.local/share/gnome-shell/extensions/desktop-lab-v12@young/metadata.json" ]
grep -Fq "unrelated@example" "$TMP/enabled"
grep -Fq "desktop-lab-v12@young" "$TMP/enabled"

"$ROOT/scripts/update-host.sh" --rollback "$backup" --yes >/dev/null
[ -f "$HOME/.local/share/gnome-shell/extensions/desktop-lab-v12@young/original" ]
[ "$(cat "$TMP/enabled")" = "['unrelated@example']" ]

echo "Safe host updater tests passed."
