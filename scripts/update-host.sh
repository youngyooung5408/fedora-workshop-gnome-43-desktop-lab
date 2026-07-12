#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REGISTRY_TOOL="$ROOT/scripts/host-feature-registry.py"
CONFIG_ROOT="${XDG_CONFIG_HOME:-$HOME/.config}/gnome-layout-sync-lab"
BACKUP_ROOT="$CONFIG_ROOT/backups"
STATE_DIR="$CONFIG_ROOT/state"
EXT_ROOT="$HOME/.local/share/gnome-shell/extensions"
TARGET_VERSION=""
DRY_RUN=0
AUDIT_ONLY=0
ASSUME_YES=0
ROLLBACK_DIR=""

usage() {
  cat <<'EOF'
Usage: scripts/update-host.sh [--version vA.B.C] [--audit|--dry-run] [--yes]
       scripts/update-host.sh --rollback <backup-directory> [--yes]

Audits and applies only the explicitly registered features for a host release.
The VM profile is never imported. Unregistered host settings and files remain
untouched. Unknown modifications inside a managed extension block the update.
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --version)
      [ $# -ge 2 ] || { echo "--version requires vA.B.C" >&2; exit 2; }
      TARGET_VERSION="$2"
      shift
      ;;
    --audit) AUDIT_ONLY=1 ;;
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

restore_backup() {
  local backup="$1"
  local uuid
  [ -d "$backup" ] || { echo "Backup not found: $backup" >&2; return 1; }
  [ -f "$backup/changed-extensions.txt" ] || { echo "Invalid backup: $backup" >&2; return 1; }

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
  if [ -f "$backup/disable-user-extensions.txt" ]; then
    gsettings set org.gnome.shell disable-user-extensions "$(cat "$backup/disable-user-extensions.txt")"
  fi
  if [ -f "$backup/settings.tsv" ]; then
    while IFS=$'\t' read -r schema key value; do
      [ -n "${schema:-}" ] || continue
      gsettings set "$schema" "$key" "$value"
    done < "$backup/settings.tsv"
  fi

  rm -rf "$STATE_DIR"
  if [ -d "$backup/state" ]; then
    cp -a "$backup/state" "$STATE_DIR"
  fi
}

rollback() {
  local backup="$1"
  echo "Rollback preview: $backup"
  [ -f "$backup/changed-extensions.txt" ] && sed 's/^/  extension: /' "$backup/changed-extensions.txt"
  [ -s "$backup/settings.tsv" ] && sed 's/^/  setting: /' "$backup/settings.tsv"
  confirm "Restore this feature backup?" || { echo "Rollback cancelled."; exit 1; }
  restore_backup "$backup"
  echo "Rollback complete. Log out and back in if GNOME Shell still has cached extension code."
}

if [ -n "$ROLLBACK_DIR" ]; then
  [ "$DRY_RUN" -eq 0 ] && [ "$AUDIT_ONLY" -eq 0 ] || {
    echo "--audit/--dry-run cannot be combined with --rollback" >&2
    exit 2
  }
  rollback "$ROLLBACK_DIR"
  exit 0
fi

if [ -z "$TARGET_VERSION" ]; then
  TARGET_VERSION="$(python3 "$REGISTRY_TOOL" latest)"
fi

resolved_json="$(python3 "$REGISTRY_TOOL" resolve "$TARGET_VERSION")"
mapfile -t feature_lines < <(python3 - "$resolved_json" <<'PY'
import json
import sys

for feature in json.loads(sys.argv[1])["features"]:
    if feature["kind"] == "extension":
        print("\t".join([
            "EXT", feature["id"], feature["revision"], feature["uuid"],
            feature["payload"], feature["sha256"],
        ]))
    else:
        print("\t".join([
            "SET", feature["id"], feature["revision"], feature["schema"],
            feature["key"], feature["value"],
        ]))
PY
)

declare -a SELECTED_EXTENSIONS=()
declare -a CHANGED_EXTENSIONS=()
declare -a SETTINGS_TO_APPLY=()
declare -a FEATURE_STATE_LINES=()
blocked=0
ENABLEMENT_CHANGE=0

echo "Safe host feature audit"
echo "  target release: $TARGET_VERSION"
echo "  registry: $ROOT/host-features.json"
echo "  only registered feature surfaces can change"

for line in "${feature_lines[@]}"; do
  IFS=$'\t' read -r kind feature_id revision field1 field2 field3 <<< "$line"
  if [ "$kind" = EXT ]; then
    uuid="$field1"
    source_dir="$field2"
    target_hash="$field3"
    SELECTED_EXTENSIONS+=("$uuid")
    if [ ! -d "$source_dir" ]; then
      echo "  BLOCKED $feature_id: target payload is missing: $source_dir" >&2
      blocked=1
      continue
    fi
    if [ ! -d "$EXT_ROOT/$uuid" ]; then
      echo "  INSTALL $feature_id ($revision): extension is absent"
      CHANGED_EXTENSIONS+=("$line")
      FEATURE_STATE_LINES+=("$feature_id"$'\t'"$revision"$'\t'"$target_hash")
      continue
    fi
    current_hash="$(python3 "$REGISTRY_TOOL" tree-hash "$EXT_ROOT/$uuid")"
    if [ "$current_hash" = "$target_hash" ]; then
      echo "  SKIP $feature_id ($revision): extension payload is already identical"
    elif known_revision="$(python3 "$REGISTRY_TOOL" identify "$feature_id" "$current_hash" 2>/dev/null)"; then
      echo "  UPDATE $feature_id: known revision $known_revision -> $revision"
      CHANGED_EXTENSIONS+=("$line")
    else
      echo "  BLOCKED $feature_id: installed extension has unknown local content" >&2
      echo "    current sha256: $current_hash" >&2
      echo "    target sha256:  $target_hash" >&2
      blocked=1
    fi
    FEATURE_STATE_LINES+=("$feature_id"$'\t'"$revision"$'\t'"$target_hash")
  elif [ "$kind" = SET ]; then
    schema="$field1"
    key="$field2"
    desired="$field3"
    current="$(gsettings get "$schema" "$key")"
    if [ "$current" = "$desired" ]; then
      echo "  SKIP $feature_id ($revision): $schema $key is already $desired"
    else
      echo "  SET $feature_id ($revision):"
      echo "    $schema $key"
      echo "    current: $current"
      echo "    target:  $desired"
      SETTINGS_TO_APPLY+=("$line")
    fi
    FEATURE_STATE_LINES+=("$feature_id"$'\t'"$revision"$'\t'"$desired")
  fi
done

if [ "${#SELECTED_EXTENSIONS[@]}" -gt 0 ]; then
  current_enabled_audit="$(gsettings get org.gnome.shell enabled-extensions)"
  mapfile -t missing_enabled < <(python3 - "$current_enabled_audit" "${SELECTED_EXTENSIONS[@]}" <<'PY'
import ast
import sys

items = ast.literal_eval(sys.argv[1].removeprefix("@as "))
for uuid in sys.argv[2:]:
    if uuid not in items:
        print(uuid)
PY
)
  if [ "${#missing_enabled[@]}" -gt 0 ]; then
    ENABLEMENT_CHANGE=1
    printf '  ENABLE registered extension: %s\n' "${missing_enabled[@]}"
  fi
  if [ "$(gsettings get org.gnome.shell disable-user-extensions)" != false ]; then
    ENABLEMENT_CHANGE=1
    echo "  ENABLE GNOME user extensions globally (rollback restores the current switch)"
  fi
fi

echo "  unrelated extensions and all unregistered GNOME settings: preserved"

if [ "$blocked" -ne 0 ]; then
  echo "Audit blocked the update; no changes were made." >&2
  exit 1
fi
if [ "$AUDIT_ONLY" -eq 1 ] || [ "$DRY_RUN" -eq 1 ]; then
  echo "Read-only audit complete; no changes made."
  exit 0
fi

if [ "${#CHANGED_EXTENSIONS[@]}" -eq 0 ] && [ "${#SETTINGS_TO_APPLY[@]}" -eq 0 ] && [ "$ENABLEMENT_CHANGE" -eq 0 ]; then
  echo "All registered features already match $TARGET_VERSION; no changes made."
  exit 0
fi

confirm "Back up and apply only the listed $TARGET_VERSION feature changes?" || {
  echo "Update cancelled."
  exit 1
}

timestamp="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$BACKUP_ROOT/$timestamp-$TARGET_VERSION"
mkdir -p "$BACKUP_DIR/extensions" "$EXT_ROOT"
: > "$BACKUP_DIR/changed-extensions.txt"
: > "$BACKUP_DIR/settings.tsv"
gsettings get org.gnome.shell enabled-extensions > "$BACKUP_DIR/enabled-extensions.txt"
gsettings get org.gnome.shell disable-user-extensions > "$BACKUP_DIR/disable-user-extensions.txt"

for line in "${CHANGED_EXTENSIONS[@]}"; do
  IFS=$'\t' read -r _ _ _ uuid _ _ <<< "$line"
  printf '%s\n' "$uuid" >> "$BACKUP_DIR/changed-extensions.txt"
  [ ! -d "$EXT_ROOT/$uuid" ] || cp -a "$EXT_ROOT/$uuid" "$BACKUP_DIR/extensions/$uuid"
done
for line in "${SETTINGS_TO_APPLY[@]}"; do
  IFS=$'\t' read -r _ _ _ schema key _ <<< "$line"
  printf '%s\t%s\t%s\n' "$schema" "$key" "$(gsettings get "$schema" "$key")" >> "$BACKUP_DIR/settings.tsv"
done
[ ! -d "$STATE_DIR" ] || cp -a "$STATE_DIR" "$BACKUP_DIR/state"

apply_failed() {
  local status=$?
  trap - ERR
  echo "Feature update failed; restoring $BACKUP_DIR" >&2
  restore_backup "$BACKUP_DIR" || true
  exit "$status"
}
trap apply_failed ERR

for line in "${CHANGED_EXTENSIONS[@]}"; do
  IFS=$'\t' read -r _ _ _ uuid source_dir _ <<< "$line"
  rm -rf "$EXT_ROOT/$uuid"
  cp -a "$source_dir" "$EXT_ROOT/$uuid"
done

if [ "${#SELECTED_EXTENSIONS[@]}" -gt 0 ]; then
  current_enabled="$(gsettings get org.gnome.shell enabled-extensions)"
  merged_enabled="$(python3 - "$current_enabled" "${SELECTED_EXTENSIONS[@]}" <<'PY'
import ast
import sys

items = ast.literal_eval(sys.argv[1].removeprefix("@as "))
for uuid in sys.argv[2:]:
    if uuid not in items:
        items.append(uuid)
print(repr(items))
PY
)"
  if [ "$(gsettings get org.gnome.shell disable-user-extensions)" != false ]; then
    gsettings set org.gnome.shell disable-user-extensions false
  fi
  if [ "$current_enabled" != "$merged_enabled" ]; then
    gsettings set org.gnome.shell enabled-extensions "$merged_enabled"
  fi
fi

for line in "${SETTINGS_TO_APPLY[@]}"; do
  IFS=$'\t' read -r _ _ _ schema key desired <<< "$line"
  gsettings set "$schema" "$key" "$desired"
done

mkdir -p "$STATE_DIR"
printf '%s\n' "$TARGET_VERSION" > "$STATE_DIR/version"
printf '%s\n' "$resolved_json" > "$STATE_DIR/features.json"
printf '%s\n' "${FEATURE_STATE_LINES[@]}" > "$STATE_DIR/features.tsv"
trap - ERR

echo "Applied registered host features for $TARGET_VERSION."
echo "Backup: $BACKUP_DIR"
echo "Rollback: $0 --rollback '$BACKUP_DIR'"
echo "Log out and back in if GNOME Shell still has cached extension code."
