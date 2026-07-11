#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG_ROOT="${XDG_CONFIG_HOME:-$HOME/.config}/gnome-layout-sync-lab"
BACKUP_ROOT="$CONFIG_ROOT/backups"
STATE_DIR="$CONFIG_ROOT/state"
EXT_ROOT="$HOME/.local/share/gnome-shell/extensions"
DRY_RUN=0
ASSUME_YES=0
ROLLBACK_DIR=""

usage() {
  cat <<'EOF'
Usage: scripts/update-host.sh [--dry-run] [--yes]
       scripts/update-host.sh --rollback <backup-directory> [--yes]

Safely installs the latest version that contains host-manifest.json.
Lab snapshot launchers are intentionally separate and remain exact restores.
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --yes) ASSUME_YES=1 ;;
    --rollback)
      [ $# -ge 2 ] || { echo "--rollback requires a backup directory" >&2; exit 2; }
      ROLLBACK_DIR="$2"
      shift
      ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

confirm() {
  local prompt="$1"
  if [ "$ASSUME_YES" -eq 1 ]; then
    return 0
  fi
  if [ ! -t 0 ]; then
    echo "Confirmation required. Re-run interactively or pass --yes." >&2
    return 1
  fi
  read -r -p "$prompt [y/N] " reply
  [[ "$reply" = y || "$reply" = Y || "$reply" = yes || "$reply" = YES ]]
}

rollback() {
  local backup="$1"
  [ -d "$backup" ] || { echo "Backup not found: $backup" >&2; exit 1; }
  [ -f "$backup/changed-extensions.txt" ] || { echo "Invalid backup: $backup" >&2; exit 1; }

  echo "Rollback preview: $backup"
  sed 's/^/  extension: /' "$backup/changed-extensions.txt"
  [ -s "$backup/settings.tsv" ] && sed 's/^/  setting: /' "$backup/settings.tsv"
  confirm "Restore this backup?" || { echo "Rollback cancelled."; exit 1; }

  mkdir -p "$EXT_ROOT" "$CONFIG_ROOT"
  while IFS= read -r uuid; do
    [ -n "$uuid" ] || continue
    rm -rf "$EXT_ROOT/$uuid"
    if [ -d "$backup/extensions/$uuid" ]; then
      cp -a "$backup/extensions/$uuid" "$EXT_ROOT/$uuid"
    fi
  done < "$backup/changed-extensions.txt"

  if [ -f "$backup/enabled-extensions.txt" ]; then
    gsettings set org.gnome.shell enabled-extensions "$(cat "$backup/enabled-extensions.txt")"
  fi
  while IFS=$'\t' read -r schema key value; do
    [ -n "${schema:-}" ] || continue
    gsettings set "$schema" "$key" "$value"
  done < "$backup/settings.tsv"

  rm -rf "$STATE_DIR"
  if [ -d "$backup/state" ]; then
    cp -a "$backup/state" "$STATE_DIR"
  fi
  echo "Rollback complete. Log out and back in if GNOME Shell still shows cached extension code."
}

if [ -n "$ROLLBACK_DIR" ]; then
  [ "$DRY_RUN" -eq 0 ] || { echo "--dry-run cannot be combined with --rollback" >&2; exit 2; }
  rollback "$ROLLBACK_DIR"
  exit 0
fi

mapfile -t manifest_info < <(python3 - "$ROOT/versions" <<'PY'
import json
import pathlib
import re
import sys

root = pathlib.Path(sys.argv[1])
candidates = []
for path in root.glob("v*/v*.*/*.*/host-manifest.json"):
    match = re.fullmatch(r"v(\d+)\.(\d+)\.(\d+)", path.parent.name)
    if match:
        candidates.append((tuple(map(int, match.groups())), path))
if not candidates:
    raise SystemExit("No host-installable version manifest found")
version, path = max(candidates)
data = json.loads(path.read_text(encoding="utf-8"))
if data.get("version") != path.parent.name:
    raise SystemExit(f"Manifest version mismatch: {path}")
print(path)
print(data["version"])
for uuid in data.get("extensions", []):
    print("EXT\t" + uuid)
for item in data.get("settings", []):
    print("SET\t" + item["schema"] + "\t" + item["key"] + "\t" + item["value"])
PY
)

MANIFEST="${manifest_info[0]}"
VERSION="${manifest_info[1]}"
VERSION_DIR="$(dirname "$MANIFEST")"
EXTENSIONS=()
SETTINGS=()
for line in "${manifest_info[@]:2}"; do
  if [[ "$line" == EXT$'\t'* ]]; then
    EXTENSIONS+=("${line#*$'\t'}")
  elif [[ "$line" == SET$'\t'* ]]; then
    SETTINGS+=("${line#*$'\t'}")
  fi
done

echo "Safe host update preview"
echo "  current: $(cat "$STATE_DIR/version" 2>/dev/null || echo 'not installed')"
echo "  target:  $VERSION"
echo "  manifest: $MANIFEST"
echo "  project extensions to update:"
printf '    %s\n' "${EXTENSIONS[@]}"
echo "  unrelated extensions: preserved"
echo "  display scaling, text sizing, Bluetooth, favorites, and other undeclared settings: preserved"

declare -a SETTINGS_TO_APPLY=()
declare -a SETTINGS_PRESERVED=()
for item in "${SETTINGS[@]}"; do
  IFS=$'\t' read -r schema key desired <<< "$item"
  current="$(gsettings get "$schema" "$key")"
  previous=""
  if [ -f "$STATE_DIR/settings.tsv" ]; then
    previous="$(awk -F '\t' -v s="$schema" -v k="$key" '$1 == s && $2 == k {print $3; exit}' "$STATE_DIR/settings.tsv")"
  fi
  if [ -z "$previous" ]; then
    SETTINGS_PRESERVED+=("$schema $key (first install keeps $current)")
  elif [ "$current" != "$previous" ]; then
    SETTINGS_PRESERVED+=("$schema $key (locally changed; keeps $current)")
  elif [ "$current" != "$desired" ]; then
    SETTINGS_TO_APPLY+=("$item")
  fi
done

if [ "${#SETTINGS_TO_APPLY[@]}" -gt 0 ]; then
  echo "  settings to update:"
  printf '    %s\n' "${SETTINGS_TO_APPLY[@]}"
else
  echo "  settings to update: none"
fi
if [ "${#SETTINGS_PRESERVED[@]}" -gt 0 ]; then
  echo "  local settings preserved:"
  printf '    %s\n' "${SETTINGS_PRESERVED[@]}"
fi

for uuid in "${EXTENSIONS[@]}"; do
  source_dir="$VERSION_DIR/profile/extensions/$uuid"
  [ -d "$source_dir" ] || { echo "Manifest extension is missing: $source_dir" >&2; exit 1; }
done

if [ "$DRY_RUN" -eq 1 ]; then
  echo "Dry run complete; no changes made."
  exit 0
fi
confirm "Create a backup and apply $VERSION?" || { echo "Update cancelled."; exit 1; }

timestamp="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$BACKUP_ROOT/$timestamp-$VERSION"
mkdir -p "$BACKUP_DIR/extensions" "$EXT_ROOT"
printf '%s\n' "${EXTENSIONS[@]}" > "$BACKUP_DIR/changed-extensions.txt"
gsettings get org.gnome.shell enabled-extensions > "$BACKUP_DIR/enabled-extensions.txt"
: > "$BACKUP_DIR/settings.tsv"
for item in "${SETTINGS_TO_APPLY[@]}"; do
  IFS=$'\t' read -r schema key _ <<< "$item"
  printf '%s\t%s\t%s\n' "$schema" "$key" "$(gsettings get "$schema" "$key")" >> "$BACKUP_DIR/settings.tsv"
done
for uuid in "${EXTENSIONS[@]}"; do
  [ -d "$EXT_ROOT/$uuid" ] && cp -a "$EXT_ROOT/$uuid" "$BACKUP_DIR/extensions/$uuid"
done
[ ! -d "$STATE_DIR" ] || cp -a "$STATE_DIR" "$BACKUP_DIR/state"

for uuid in "${EXTENSIONS[@]}"; do
  source_dir="$VERSION_DIR/profile/extensions/$uuid"
  rm -rf "$EXT_ROOT/$uuid"
  cp -a "$source_dir" "$EXT_ROOT/$uuid"
done

current_enabled="$(gsettings get org.gnome.shell enabled-extensions)"
merged_enabled="$(python3 - "$current_enabled" "${EXTENSIONS[@]}" <<'PY'
import ast
import sys
items = ast.literal_eval(sys.argv[1].removeprefix("@as "))
for uuid in sys.argv[2:]:
    if uuid not in items:
        items.append(uuid)
print(repr(items))
PY
)"
gsettings set org.gnome.shell disable-user-extensions false
gsettings set org.gnome.shell enabled-extensions "$merged_enabled"

for item in "${SETTINGS_TO_APPLY[@]}"; do
  IFS=$'\t' read -r schema key desired <<< "$item"
  gsettings set "$schema" "$key" "$desired"
done

mkdir -p "$STATE_DIR"
printf '%s\n' "$VERSION" > "$STATE_DIR/version"
: > "$STATE_DIR/settings.tsv.next"
for item in "${SETTINGS[@]}"; do
  IFS=$'\t' read -r schema key desired <<< "$item"
  baseline=""
  if printf '%s\n' "${SETTINGS_TO_APPLY[@]}" | grep -Fxq "$item"; then
    baseline="$desired"
  elif [ -f "$STATE_DIR/settings.tsv" ]; then
    baseline="$(awk -F '\t' -v s="$schema" -v k="$key" '$1 == s && $2 == k {print $3; exit}' "$STATE_DIR/settings.tsv")"
  fi
  [ -z "$baseline" ] || printf '%s\t%s\t%s\n' "$schema" "$key" "$baseline" >> "$STATE_DIR/settings.tsv.next"
done
mv "$STATE_DIR/settings.tsv.next" "$STATE_DIR/settings.tsv"

echo "Applied safe host update $VERSION."
echo "Backup: $BACKUP_DIR"
echo "Rollback: $0 --rollback '$BACKUP_DIR'"
echo "Log out and back in if GNOME Shell still shows cached extension code."
