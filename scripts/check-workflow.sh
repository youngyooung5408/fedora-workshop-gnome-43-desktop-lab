#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

failures=0
warnings=0
tmp_dir=""

pass() {
  printf 'PASS: %s\n' "$*"
}

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  failures=$((failures + 1))
}

warn() {
  printf 'WARN: %s\n' "$*" >&2
  warnings=$((warnings + 1))
}

cleanup() {
  if [ -n "$tmp_dir" ] && [ -d "$tmp_dir" ]; then
    rm -rf "$tmp_dir"
  fi
}
trap cleanup EXIT

require_file() {
  local file="$1"

  if [ -f "$file" ]; then
    pass "found $file"
  else
    fail "missing $file"
  fi
}

require_heading() {
  local file="$1"
  local heading="$2"

  if [ ! -f "$file" ]; then
    return
  fi

  if rg -q "^${heading}$" "$file"; then
    pass "$file contains $heading"
  else
    fail "$file is missing $heading"
  fi
}

require_text() {
  local file="$1"
  local text="$2"
  local description="$3"

  if [ ! -f "$file" ]; then
    return
  fi

  if grep -Fq "$text" "$file"; then
    pass "$description"
  else
    fail "$description"
  fi
}

require_absent_text() {
  local file="$1"
  local text="$2"
  local description="$3"

  if [ ! -f "$file" ]; then
    return
  fi

  if grep -Fq "$text" "$file"; then
    fail "$description"
  else
    pass "$description"
  fi
}

validate_gsettings_file() {
  local file="$1"
  local parsed
  local line_count=0
  local checked_count=0

  if ! command -v python3 >/dev/null 2>&1; then
    fail "python3 is required to parse $file safely"
    return
  fi

  if ! command -v gsettings >/dev/null 2>&1; then
    fail "gsettings is required to validate $file"
    return
  fi

  if ! parsed=$(python3 - "$file" <<'PY'
import shlex
import sys

path = sys.argv[1]
with open(path, "r", encoding="utf-8") as handle:
    for lineno, raw_line in enumerate(handle, 1):
        line = raw_line.strip()
        if not line.startswith("gsettings set "):
            continue

        try:
            parts = shlex.split(line, posix=True)
        except ValueError as error:
            message = str(error).replace("\t", " ")
            print(f"ERROR\t{lineno}\t{message}")
            continue

        if len(parts) < 5 or parts[:2] != ["gsettings", "set"]:
            print(f"ERROR\t{lineno}\tinvalid gsettings command")
            continue

        print(f"KEY\t{lineno}\t{parts[2]}\t{parts[3]}")
PY
  ); then
    fail "could not parse $file"
    return
  fi

  while IFS=$'\t' read -r kind lineno field1 field2; do
    [ -n "${kind:-}" ] || continue

    case "$kind" in
      KEY)
        line_count=$((line_count + 1))
        if gsettings range "$field1" "$field2" >/dev/null 2>&1; then
          checked_count=$((checked_count + 1))
        else
          fail "$file:$lineno references unsupported setting $field1 $field2"
        fi
        ;;
      ERROR)
        fail "$file:$lineno $field1"
        ;;
      *)
        fail "$file:$lineno unexpected parser output: $kind"
        ;;
    esac
  done <<< "$parsed"

  if [ "$line_count" -eq 0 ]; then
    fail "$file contains no gsettings commands"
  else
    pass "$file has $checked_count parseable supported gsettings commands"
  fi
}

metadata_value() {
  local metadata="$1"
  local key="$2"

  python3 - "$metadata" "$key" <<'PY'
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as handle:
    data = json.load(handle)

value = data.get(sys.argv[2], "")
if isinstance(value, list):
    print("\n".join(str(item) for item in value))
else:
    print(str(value))
PY
}

validate_extension() {
  local metadata="$1"
  local profile="$2"
  local ext_dir
  local uuid
  local enabled_file="$profile/enabled-extensions.txt"
  local shell_major="${3:-}"

  ext_dir="$(dirname "$metadata")"

  if ! uuid="$(metadata_value "$metadata" uuid)"; then
    fail "could not read UUID from $metadata"
    return
  fi

  if [ -z "$uuid" ]; then
    fail "$metadata has no uuid"
  elif [ -f "$enabled_file" ] && grep -Fq "$uuid" "$enabled_file"; then
    pass "$uuid is enabled in $enabled_file"
  elif [ -f "$enabled_file" ]; then
    warn "$uuid exists in $profile/extensions but is not enabled"
  fi

  if [ -n "$shell_major" ]; then
    if python3 - "$metadata" "$shell_major" <<'PY'
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as handle:
    data = json.load(handle)

target = sys.argv[2]
versions = [str(item) for item in data.get("shell-version", [])]
majors = {version.split(".", 1)[0] for version in versions}
if target not in majors:
    print(", ".join(versions))
    sys.exit(1)
PY
    then
      pass "$uuid metadata supports GNOME Shell $shell_major"
    else
      fail "$uuid metadata does not support GNOME Shell $shell_major"
    fi
  fi

  if command -v gnome-extensions >/dev/null 2>&1; then
    if gnome-extensions pack --force --out-dir "$tmp_dir" "$ext_dir" >/dev/null; then
      pass "$uuid extension bundle packs"
    else
      fail "$uuid extension bundle does not pack"
    fi
  else
    warn "gnome-extensions is not installed; skipped packing $uuid"
  fi
}

validate_version_launcher() {
  local version_dir="$1"
  local version
  local apply_script
  local desktop_file
  local profile_dir

  version="$(basename "$version_dir")"
  apply_script="$version_dir/apply-$version.sh"
  desktop_file="$version_dir/Apply $version.desktop"
  profile_dir="$version_dir/profile"

  require_file "$apply_script"
  require_file "$desktop_file"
  require_file "$profile_dir/gsettings-export.sh"

  if [ -f "$apply_script" ]; then
    if [ -x "$apply_script" ]; then
      pass "$apply_script is executable"
    else
      fail "$apply_script is not executable"
    fi

    if bash -n "$apply_script"; then
      pass "$apply_script has valid Bash syntax"
    else
      fail "$apply_script has invalid Bash syntax"
    fi
  fi

  if [ -f "$desktop_file" ]; then
    if [ -x "$desktop_file" ]; then
      pass "$desktop_file is executable"
    else
      fail "$desktop_file is not executable"
    fi

    if command -v desktop-file-validate >/dev/null 2>&1; then
      if desktop-file-validate "$desktop_file"; then
        pass "$desktop_file is valid"
      else
        fail "$desktop_file is invalid"
      fi
    else
      warn "desktop-file-validate is not installed; skipped $desktop_file"
    fi
  fi

  if rg -q '(/home/sdafsaasd/versions|\$HOME/versions|~/versions)' "$version_dir"; then
    fail "$version_dir references the old home-level versions path"
  else
    pass "$version_dir uses project-local version paths"
  fi
}

printf 'Checking GNOME layout sync lab workflow...\n'

git_available=0
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git_available=1
  pass "Git repository is available"
else
  fail "this directory is not a Git repository"
fi

require_file README.md
require_file TASK.md
require_file LAB_DIARY.md
require_heading README.md "## Codex Workflow"
require_heading TASK.md "## Acceptance checks"
require_heading LAB_DIARY.md "## Versions"

if command -v rg >/dev/null 2>&1; then
  pass "ripgrep is available"
else
  fail "ripgrep is required for workflow document checks"
fi

if [ "$git_available" -eq 1 ]; then
  mapfile -t shell_files < <(
    {
      find scripts -type f -name '*.sh' -print
      git ls-files 'profiles/*/gsettings-export.sh'
    } | sort -u
  )
else
  mapfile -t shell_files < <(find scripts -type f -name '*.sh' -print | sort)
fi

for file in "${shell_files[@]}"; do
  if bash -n "$file"; then
    pass "$file has valid Bash syntax"
  else
    fail "$file has invalid Bash syntax"
  fi
done

if [ "$git_available" -eq 1 ]; then
  mapfile -t profile_dirs < <(
    git ls-files 'profiles/*' |
      awk -F/ 'NF >= 3 && $2 != ".gitkeep" {print $1 "/" $2}' |
      sort -u
  )
else
  profile_dirs=()
fi

if [ "${#profile_dirs[@]}" -eq 0 ]; then
  fail "no tracked profile directories found"
else
  pass "found ${#profile_dirs[@]} tracked profile directory"
fi

tuned_profile="profiles/vm-initial-desktop-task"
tuned_settings="$tuned_profile/gsettings-export.sh"
tuned_enabled="$tuned_profile/enabled-extensions.txt"
tuned_v12_extension="$tuned_profile/extensions/desktop-lab-v12@young"
tuned_v12_stylesheet="$tuned_v12_extension/stylesheet.css"
tuned_v12_metadata="$tuned_v12_extension/metadata.json"

require_file "$tuned_v12_extension/metadata.json"
require_file "$tuned_v12_extension/extension.js"
require_file "$tuned_v12_extension/stylesheet.css"

require_file "aesthetic preference.md"
require_heading "aesthetic preference.md" "## Living Preference Maintenance"
require_text AGENTS.md "When a newer user instruction or accepted result conflicts with the current aesthetic direction" "agent workflow updates aesthetic preference when user preferences differ"
require_text AGENTS.md "When a new task introduces a durable key visual, interaction, or desktop feature" "agent workflow records durable new task features in aesthetic preference"
require_text README.md 'Codex compares newer user preferences and accepted results against `aesthetic preference.md`' "codex workflow compares newer preferences against aesthetic preference"
require_text README.md "When a new task introduces durable key visual, interaction, or desktop features" "codex workflow records durable key features in aesthetic preference"
require_text "aesthetic preference.md" "If a newer user preference differs from the existing aesthetic direction" "aesthetic preference records newer preference conflicts"
require_text "aesthetic preference.md" "When a task introduces a durable key desktop, UI, or interaction feature" "aesthetic preference records durable new task features"
require_text "task/v 1.2/v 1.2.3.md" "aesthetic preference.md" "v1.2.3 task references the aesthetic preference source"
require_text "$tuned_enabled" "desktop-lab-v12@young" "desktop-lab-v12@young is enabled in $tuned_enabled"
require_text "$tuned_settings" "gsettings set org.gnome.desktop.background picture-options \\'none\\'" "v1.2 background disables wallpaper image"
require_text "$tuned_settings" "gsettings set org.gnome.desktop.background primary-color \\'#000000\\'" "v1.2 background primary color is black"
require_text "$tuned_settings" "gsettings set org.gnome.desktop.background secondary-color \\'#000000\\'" "v1.2 background secondary color is black"
require_absent_text "$tuned_settings" "gsettings set org.gnome.TextEditor" "v1.2.2 removes Text Editor custom settings"
require_text "$tuned_settings" "gsettings set org.gnome.shell favorite-apps @as\\ \\[\\]" "v1.2.2 clears GNOME favorite-apps"
require_text scripts/import-layout.sh '[ "$key" = "app-picker-layout" ]' "import skips app-grid ordering without skipping favorite-apps"
require_absent_text scripts/import-layout.sh '[ "$key" = "favorite-apps" ]' "import no longer skips favorite-apps"
require_text "$tuned_settings" "gsettings set org.gnome.desktop.session idle-delay uint32\\ 1800" "v1.2.2 idle trigger is 30 minutes"
require_text "$tuned_settings" "gsettings set org.gnome.desktop.break-reminders selected-breaks @as\\ \\[\\]" "v1.2.2 break reminders are not selected"
require_text "$tuned_settings" "gsettings set org.gnome.settings-daemon.plugins.power idle-dim false" "v1.2.2 disables GNOME idle dimming"
require_text "$tuned_settings" "gsettings set org.gnome.settings-daemon.plugins.power sleep-inactive-ac-type \\'nothing\\'" "AC inactive sleep keeps background work running"
require_text "$tuned_settings" "gsettings set org.gnome.settings-daemon.plugins.power sleep-inactive-battery-type \\'nothing\\'" "battery inactive sleep keeps background work running"
require_text "$tuned_v12_extension/extension.js" "DOCK_GROUPS" "desktop-lab-v12 defines dock app clusters"
require_text "$tuned_v12_extension/extension.js" "_drawClockFace" "desktop-lab-v12 includes a circular wall clock"
require_text "$tuned_v12_extension/extension.js" "MARKET_SYMBOLS" "desktop-lab-v12 includes visible market symbols"
require_text "$tuned_v12_extension/extension.js" "_buildGestureZone" "desktop-lab-v12 includes a bottom app-grid gesture zone"
require_text "$tuned_v12_extension/extension.js" "IDLE_SCREEN_SECONDS = 30 * 60" "desktop-lab-v12 rest screen waits 30 minutes"
require_text "$tuned_v12_extension/extension.js" "_drawIdleBackground" "desktop-lab-v12 includes an animated rest screen background"
require_absent_text "$tuned_v12_extension/extension.js" "_createMarkdownNote" "desktop-lab-v12 no longer creates Markdown notes"
require_absent_text "$tuned_v12_extension/extension.js" "_moveMotionDot" "desktop-lab-v12 no longer uses the moving idle marker"
require_text "$tuned_v12_extension/extension.js" "_tryHideBatteryIcon" "desktop-lab-v12 includes guarded battery-icon hiding"
require_text "$tuned_v12_metadata" "v1.2.3 aesthetic refinement" "desktop-lab-v12 metadata records v1.2.3 aesthetic refinement"
require_text "$tuned_v12_stylesheet" "rgba(245, 245, 247, 0.16)" "v1.2.3 uses neutral translucent panel borders"
require_text "$tuned_v12_stylesheet" "font-weight: 600;" "v1.2.3 uses restrained component typography"
require_text "$tuned_v12_extension/extension.js" "text: 'Rest'" "v1.2.3 rest screen label is concise"
require_text "$tuned_v12_extension/extension.js" "0.96, 0.96, 0.97" "v1.2.3 drawing code uses a low-saturation neutral palette"
require_absent_text "$tuned_v12_stylesheet" "rgba(20, 119, 184" "v1.2.3 removes old saturated blue hover accent"
require_absent_text "$tuned_v12_stylesheet" "rgba(20, 184, 166" "v1.2.3 removes old saturated teal gesture accent"
require_absent_text "$tuned_v12_extension/extension.js" "0.24, 0.66, 0.96" "v1.2.3 removes old blue idle animation lines"
require_absent_text "$tuned_v12_extension/extension.js" "0.20, 0.83, 0.60" "v1.2.3 removes old green idle animation lines"

version_v123="versions/v1/v1.2/v1.2.3"
version_v123_extension="$version_v123/profile/extensions/desktop-lab-v12@young"
require_file "$version_v123/apply-v1.2.3.sh"
require_file "$version_v123/Apply v1.2.3.desktop"
require_file "$version_v123/profile/gsettings-export.sh"
require_text "$version_v123_extension/metadata.json" "v1.2.3 aesthetic refinement" "v1.2.3 launcher snapshot includes aesthetic metadata"
require_text "$version_v123_extension/stylesheet.css" "rgba(245, 245, 247, 0.16)" "v1.2.3 launcher snapshot includes neutral panel borders"

shell_major=""
if command -v gnome-shell >/dev/null 2>&1; then
  shell_major="$(gnome-shell --version | awk '{print $3}' | cut -d. -f1)"
  pass "GNOME Shell major version is $shell_major"
else
  warn "gnome-shell is not installed; skipped extension shell-version checks"
fi

tmp_dir="$(mktemp -d)"

for profile in "${profile_dirs[@]}"; do
  require_file "$profile/README.txt"
  require_file "$profile/dconf-org-gnome.ini"
  require_file "$profile/enabled-extensions.txt"
  require_file "$profile/gsettings-export.sh"

  if [ -f "$profile/gsettings-export.sh" ]; then
    validate_gsettings_file "$profile/gsettings-export.sh"
  fi

  if [ -d "$profile/extensions" ]; then
    while IFS= read -r metadata; do
      validate_extension "$metadata" "$profile" "$shell_major"
    done < <(find "$profile/extensions" -mindepth 2 -maxdepth 2 -name metadata.json -print | sort)
  else
    warn "$profile has no extensions directory"
  fi
done

if [ -d versions ]; then
  mapfile -t version_dirs < <(find versions -mindepth 3 -maxdepth 3 -type d -name 'v*.*.*' | sort)
else
  version_dirs=()
fi

if [ "${#version_dirs[@]}" -eq 0 ]; then
  fail "no project-local version launcher directories found"
else
  pass "found ${#version_dirs[@]} project-local version launcher directories"
fi

for version_dir in "${version_dirs[@]}"; do
  validate_version_launcher "$version_dir"
done

if [ "$git_available" -eq 1 ]; then
  if [ -n "$(git status --short)" ]; then
    warn "working tree has uncommitted changes"
  else
    pass "working tree is clean"
  fi
fi

if [ "$failures" -eq 0 ]; then
  printf 'Workflow check passed with %s warning(s).\n' "$warnings"
else
  printf 'Workflow check failed with %s failure(s) and %s warning(s).\n' "$failures" "$warnings" >&2
  exit 1
fi
