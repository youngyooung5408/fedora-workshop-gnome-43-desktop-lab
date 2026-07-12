#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

export HOME="$TMP/home"
export XDG_CONFIG_HOME="$HOME/.config"
EXT_ROOT="$HOME/.local/share/gnome-shell/extensions"
mkdir -p "$EXT_ROOT/unrelated@example" "$TMP/bin"
printf 'keep\n' > "$EXT_ROOT/unrelated@example/original"

for uuid in bluetooth-battery@young codex-usage@young; do
  cp -a "$ROOT/versions/v1/v1.2/v1.2.17/profile/extensions/$uuid" "$EXT_ROOT/$uuid"
done
cp -a "$ROOT/versions/v1/v1.2/v1.2.10/profile/extensions/desktop-lab-v12@young" "$EXT_ROOT/desktop-lab-v12@young"
chmod 600 "$EXT_ROOT/bluetooth-battery@young/metadata.json"

printf "['unrelated@example']\n" > "$TMP/enabled"
printf "true\n" > "$TMP/disabled"
printf "'close,minimize,maximize:'\n" > "$TMP/button-layout"

cat > "$TMP/bin/gsettings" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
case "$1:$2:$3" in
  get:org.gnome.shell:enabled-extensions) cat "$TEST_ENABLED" ;;
  set:org.gnome.shell:enabled-extensions) printf '%s\n' "$4" > "$TEST_ENABLED" ;;
  get:org.gnome.shell:disable-user-extensions) cat "$TEST_DISABLED" ;;
  set:org.gnome.shell:disable-user-extensions) printf '%s\n' "$4" > "$TEST_DISABLED" ;;
  get:org.gnome.desktop.wm.preferences:button-layout) cat "$TEST_BUTTON_LAYOUT" ;;
  set:org.gnome.desktop.wm.preferences:button-layout) printf '%s\n' "$4" > "$TEST_BUTTON_LAYOUT" ;;
  *) echo "Unexpected gsettings call: $*" >&2; exit 1 ;;
esac
EOF
chmod +x "$TMP/bin/gsettings"
export PATH="$TMP/bin:$PATH"
export TEST_ENABLED="$TMP/enabled"
export TEST_DISABLED="$TMP/disabled"
export TEST_BUTTON_LAYOUT="$TMP/button-layout"

snapshot() {
  find "$HOME" -type f -print -exec sha256sum {} \; -exec stat -c '%a %n' {} \; | sort
}

before="$(snapshot)"
dry_output="$("$ROOT/scripts/update-host.sh" --dry-run)"
after="$(snapshot)"
[ "$before" = "$after" ] || { echo "dry run changed host state" >&2; exit 1; }
grep -Fq "SKIP bluetooth-battery" <<< "$dry_output"
grep -Fq "SKIP codex-usage" <<< "$dry_output"
grep -Fq "UPDATE desktop-lab-v12" <<< "$dry_output"
grep -Fq "SET window-button-order" <<< "$dry_output"

output="$("$ROOT/scripts/update-host.sh" --yes)"
backup="$(sed -n 's/^Backup: //p' <<< "$output")"
[ -n "$backup" ] && [ -d "$backup" ]
[ -f "$EXT_ROOT/unrelated@example/original" ]
[ "$(stat -c %a "$EXT_ROOT/bluetooth-battery@young/metadata.json")" = 600 ]
[ "$(cat "$TMP/button-layout")" = "'close,maximize,minimize:'" ]
grep -Fq "unrelated@example" "$TMP/enabled"
grep -Fq "desktop-lab-v12@young" "$TMP/enabled"
[ "$(cat "$TMP/disabled")" = false ]
cmp -s \
  "$EXT_ROOT/desktop-lab-v12@young/extension.js" \
  "$ROOT/versions/v1/v1.2/v1.2.17/profile/extensions/desktop-lab-v12@young/extension.js"

"$ROOT/scripts/update-host.sh" --rollback "$backup" --yes >/dev/null
[ "$(cat "$TMP/button-layout")" = "'close,minimize,maximize:'" ]
[ "$(cat "$TMP/enabled")" = "['unrelated@example']" ]
[ "$(cat "$TMP/disabled")" = true ]
cmp -s \
  "$EXT_ROOT/desktop-lab-v12@young/extension.js" \
  "$ROOT/versions/v1/v1.2/v1.2.10/profile/extensions/desktop-lab-v12@young/extension.js"

# A deliberately selected old release changes only its registered features.
"$ROOT/scripts/update-host.sh" --yes >/dev/null
"$ROOT/scripts/update-host.sh" --version v1.2.10 --yes >/dev/null
[ "$(cat "$TMP/button-layout")" = "'close,maximize,minimize:'" ]
cmp -s \
  "$EXT_ROOT/desktop-lab-v12@young/extension.js" \
  "$ROOT/versions/v1/v1.2/v1.2.10/profile/extensions/desktop-lab-v12@young/extension.js"

# Unknown changes inside a managed extension block the entire update.
printf '\n// local unknown change\n' >> "$EXT_ROOT/desktop-lab-v12@young/extension.js"
blocked_before="$(snapshot)"
if "$ROOT/scripts/update-host.sh" --audit >/dev/null 2>&1; then
  echo "unknown managed extension content did not block the update" >&2
  exit 1
fi
blocked_after="$(snapshot)"
[ "$blocked_before" = "$blocked_after" ] || { echo "blocked audit changed host state" >&2; exit 1; }

echo "Safe feature-scoped host updater tests passed."
