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

  if grep -Fq -- "$text" "$file"; then
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

  if grep -Fq -- "$text" "$file"; then
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

validate_host_manifest() {
  local manifest="$1"
  if python3 - "$manifest" <<'PY'
import json
import pathlib
import re
import sys

path = pathlib.Path(sys.argv[1])
data = json.loads(path.read_text(encoding="utf-8"))
required = {"version", "extensions", "settings"}
if set(data) != required:
    raise SystemExit("manifest must contain exactly version, extensions, and settings")
if data["version"] != path.parent.name or not re.fullmatch(r"v\d+\.\d+\.\d+", data["version"]):
    raise SystemExit("manifest version must match its version directory")
if not data["extensions"] or len(data["extensions"]) != len(set(data["extensions"])):
    raise SystemExit("extensions must be a non-empty unique list")
for uuid in data["extensions"]:
    if not isinstance(uuid, str) or not (path.parent / "profile" / "extensions" / uuid / "metadata.json").is_file():
        raise SystemExit(f"missing declared extension: {uuid}")
for item in data["settings"]:
    if set(item) != {"schema", "key", "value"} or not all(isinstance(v, str) for v in item.values()):
        raise SystemExit("each setting requires string schema, key, and value")
    if not item["schema"].startswith("org.gnome.shell.extensions."):
        raise SystemExit(f"broad host setting is prohibited: {item['schema']} {item['key']}")
PY
  then
    pass "$manifest is a safe, explicit host manifest"
  else
    fail "$manifest is not a safe host manifest"
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

    require_text "$apply_script" '"$LAB_ROOT/scripts/record-current-version.sh" "$VERSION"' "$apply_script records its version"
    import_line="$(rg -n -F '"$LAB_ROOT/scripts/import-layout.sh" "$PROFILE_DIR"' "$apply_script" | cut -d: -f1)"
    record_line="$(rg -n -F '"$LAB_ROOT/scripts/record-current-version.sh" "$VERSION"' "$apply_script" | cut -d: -f1)"
    if [ -n "$import_line" ] && [ -n "$record_line" ] && [ "$record_line" -gt "$import_line" ]; then
      pass "$apply_script records only after its import command"
    else
      fail "$apply_script does not record after its import command"
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
require_file scripts/lab
require_file scripts/record-current-version.sh
require_file scripts/install-lab-command.sh
require_heading README.md "## Codex Workflow"
require_heading TASK.md "## Acceptance checks"
require_heading LAB_DIARY.md "## Versions"

for file in scripts/lab scripts/record-current-version.sh scripts/install-lab-command.sh; do
  if [ -x "$file" ]; then
    pass "$file is executable"
  else
    fail "$file is not executable"
  fi
  if bash -n "$file"; then
    pass "$file has valid Bash syntax"
  else
    fail "$file has invalid Bash syntax"
  fi
done

require_text scripts/lab 'Current GNOME Desktop Lab version:' "lab command reports the current version"
require_text scripts/install-version-launcher.sh 'record-current-version.sh' "future launchers record their applied version"
require_absent_text scripts/update-host.sh 'install-lab-command.sh' "safe host updater does not install the VM lab command"

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
require_text "aesthetic preference.md" "Desktop clocks should stay very simple" "aesthetic preference records clock preference"
require_text "aesthetic preference.md" "12 small hourly dots" "aesthetic preference records v1.2.6 clock marker preference"
require_text "aesthetic preference.md" "desktop background widgets on the main workspace" "aesthetic preference records main-workspace background widget preference"
require_text "aesthetic preference.md" "Dark marine blue is preferred" "aesthetic preference records v1.2.7 marine background preference"
require_text "aesthetic preference.md" "embed their shared layer into the main workspace background" "aesthetic preference records v1.2.8 overview background embedding"
require_text "aesthetic preference.md" "narrow slice of the actual dock visible" "aesthetic preference records v1.2.8 dock silhouette"
require_text "aesthetic preference.md" "pointer-proximity wave magnification" "aesthetic preference records dock wave preference"
require_text "aesthetic preference.md" "edge reveal behavior" "aesthetic preference records v1.2.6 dock reveal preference"
require_text "aesthetic preference.md" "open intentionally on click" "aesthetic preference records click-open folder preference"
require_text "aesthetic preference.md" "icon-only dock and flyout controls" "aesthetic preference records v1.2.6 icon-only app cluster preference"
require_text "aesthetic preference.md" "larger app icons/buttons" "aesthetic preference records v1.2.7 larger app flyout preference"
require_text "aesthetic preference.md" "Dock groups should have an understandable editing path" "aesthetic preference records v1.2.7 dock editing preference"
require_text "aesthetic preference.md" "hide update-time or provider/API labels" "aesthetic preference records market simplicity preference"
require_text "aesthetic preference.md" "selected symbols be changed directly from a compact chooser" "aesthetic preference records v1.2.6 stock chooser preference"
require_text "aesthetic preference.md" "preset shortcuts" "aesthetic preference records v1.2.7 stock preset preference"
require_text "TASK.md" 'Version `v1.2.9`' "TASK.md records v1.2.9 as the current request"
require_text "TASK.md" 'Version `v1.2.10`' "TASK.md records v1.2.10 host installation safety work"
require_text "TASK.md" 'Version `v1.2.11`' "TASK.md records v1.2.11 fullscreen dock suppression"
require_text "task/v 1.2/v 1.2.10.md" "## version 1.2.10" "v1.2.10 task note exists"
require_text "task/v 1.2/v 1.2.11.md" "## version 1.2.11" "v1.2.11 task note exists"
require_file scripts/update-host.sh
require_text scripts/update-host.sh "Safe host update preview" "host updater previews changes"
require_text scripts/update-host.sh "--rollback" "host updater supports rollback"
require_absent_text scripts/update-host.sh "bluetoothctl" "host updater does not manipulate Bluetooth"
require_text "task/v 1.2/v 1.2.9.md" "## version 1.2.9" "v1.2.9 task note exists"
require_text "$tuned_enabled" "desktop-lab-v12@young" "desktop-lab-v12@young is enabled in $tuned_enabled"
require_text "$tuned_settings" "gsettings set org.gnome.desktop.background picture-options \\'none\\'" "v1.2 background disables wallpaper image"
require_text "$tuned_settings" "gsettings set org.gnome.desktop.background color-shading-type \\'vertical\\'" "v1.2.8 keeps vertical marine shading"
require_text "$tuned_settings" "gsettings set org.gnome.desktop.background primary-color \\'#041D2F\\'" "v1.2.8 background primary color is marine blue"
require_text "$tuned_settings" "gsettings set org.gnome.desktop.background secondary-color \\'#0A5266\\'" "v1.2.8 background secondary color is marine blue"
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
require_text "$tuned_v12_extension/extension.js" "DOCK_EDGE_REVEAL_WIDTH" "v1.2.6 dock defines a left-edge reveal zone"
require_text "$tuned_v12_extension/extension.js" "DOCK_PEEK_WIDTH = 14" "v1.2.8 dock defines a visible dock slice"
require_text "$tuned_v12_extension/extension.js" "_showDock" "v1.2.6 dock includes reveal animation"
require_text "$tuned_v12_extension/extension.js" "_hideDock" "v1.2.6 dock includes hide animation"
require_text "$tuned_v12_extension/extension.js" "_dockRevealZone" "v1.2.6 dock includes a Shell-level reveal zone"
require_absent_text "$tuned_v12_extension/extension.js" "_dockHint" "v1.2.8 removes the separate shadow-like dock hint actor"
require_text "$tuned_v12_extension/extension.js" "translation_x: 0" "v1.2.8 dock reveal animates a transform"
require_text "$tuned_v12_extension/extension.js" "duration: 480" "v1.2.8 dock reveal uses longer slide timing"
require_text "$tuned_v12_extension/extension.js" "EASE_OUT_CUBIC" "v1.2.8 dock slide uses cubic easing"
require_text "$tuned_v12_extension/extension.js" "DOCK_WAVE_RADIUS" "v1.2.5 dock includes pointer wave magnification"
require_text "$tuned_v12_extension/extension.js" "_updateDockWave" "v1.2.5 dock applies Mac-like wave scaling"
require_text "$tuned_v12_extension/extension.js" "_beginDockDrag" "v1.2.5 dock includes custom drag handling"
require_text "$tuned_v12_extension/extension.js" "_reorderDockClusterForY" "v1.2.5 dock includes drag/drop group reordering"
require_text "$tuned_v12_extension/extension.js" "_buildFolderFlyout" "v1.2.5 dock includes app cluster folder flyouts"
require_text "$tuned_v12_extension/extension.js" "_toggleClusterFolder" "v1.2.5 app clusters open folder flyouts by click toggle"
require_text "$tuned_v12_extension/extension.js" "_dockPinnedByCluster" "v1.2.9 dock keeps a cluster-click pin state"
require_text "$tuned_v12_extension/extension.js" "in-fullscreen-changed" "v1.2.11 listens for fullscreen changes"
require_text "$tuned_v12_extension/extension.js" "_isDockMonitorFullscreen" "v1.2.11 checks fullscreen state on the dock monitor"
require_text "$tuned_v12_extension/extension.js" "this._dockRevealZone?.set_visible(!fullscreen)" "v1.2.11 disables fullscreen edge reveal"
require_text "$tuned_v12_extension/extension.js" "this._dock.hide()" "v1.2.11 hides the dock during fullscreen"
require_text "$tuned_v12_extension/extension.js" "if (this._dockPinnedByCluster)" "v1.2.9 pointer motion respects the cluster-click pin"
require_text "$tuned_v12_extension/extension.js" "this._hideDock();" "v1.2.9 outside clicks can dismiss the pinned dock"
require_absent_text "$tuned_v12_extension/extension.js" "cluster.connect('enter-event'" "v1.2.5 app clusters do not open folder flyouts on hover"
require_absent_text "$tuned_v12_extension/extension.js" "desktop-lab-v12-group-label" "v1.2.6 dock does not render visible category words"
require_absent_text "$tuned_v12_extension/extension.js" "desktop-lab-v12-folder-label" "v1.2.6 app flyouts do not render app description text"
require_absent_text "$tuned_v12_extension/extension.js" '`${group.label} Apps`' "v1.2.6 app flyouts remove Category Apps title wording"
require_text "$tuned_v12_extension/extension.js" "FOLDER_ICON_SIZE = 34" "v1.2.7 app flyout icons are larger"
require_text "$tuned_v12_extension/extension.js" "const flyoutWidth = 98" "v1.2.7 app flyout panel is larger"
require_text "$tuned_v12_extension/extension.js" "_buildDockEditor" "v1.2.7 includes compact dock editor UI"
require_text "$tuned_v12_extension/extension.js" "_addDockEditorItem" "v1.2.7 dock editor can add groups and app IDs"
require_text "$tuned_v12_extension/extension.js" "dock-groups.json" "v1.2.7 stores edited dock groups in user config"
require_text "$tuned_v12_extension/extension.js" "_drawClockFace" "desktop-lab-v12 includes a circular wall clock"
require_text "$tuned_v12_extension/extension.js" "const CLOCK_SIZE = 198" "v1.2.5 keeps the large clock size from v1.2.4"
require_text "$tuned_v12_extension/extension.js" "const CLOCK_REFRESH_MS = 250" "v1.2.5 clock refreshes continuously"
require_text "$tuned_v12_extension/extension.js" "BACKGROUND_WORKSPACE_INDEX = 0" "v1.2.6 targets the main workspace for desktop widgets"
require_text "$tuned_v12_extension/extension.js" "Main.layoutManager?._backgroundGroup" "v1.2.6 uses the Shell background group when available"
require_text "$tuned_v12_extension/extension.js" "_syncWorkspaceVisibility" "v1.2.6 hides clock and stock outside the main workspace"
require_text "$tuned_v12_extension/extension.js" "_buildBackgroundWidgetLayer" "v1.2.8 creates one shared clock and stock background layer"
require_text "$tuned_v12_extension/extension.js" "_getOverviewWorkspaceBackgroundBin" "v1.2.8 locates the active overview workspace background"
require_text "$tuned_v12_extension/extension.js" "workspace?._background?._bin" "v1.2.8 targets the overview workspace background bin"
require_text "$tuned_v12_extension/extension.js" "_reparentDesktopActor(this._backgroundWidgetLayer, container)" "v1.2.8 reparents the shared widget layer into overview"
require_text "$tuned_v12_extension/extension.js" "_restoreDesktopActor(this._backgroundWidgetLayer)" "v1.2.8 restores the shared widget layer after overview"
require_text "$tuned_v12_extension/extension.js" "notify::value" "v1.2.8 follows overview transition progress"
require_text "$tuned_v12_extension/extension.js" "_handleOverviewStateChanged" "v1.2.8 restores widgets before overview workspace teardown"
require_text "$tuned_v12_extension/extension.js" "Main.layoutManager?.overviewGroup" "v1.2.8 keeps guarded overview container fallback"
require_text "$tuned_v12_extension/extension.js" "OVERVIEW_FALLBACK_WIDGET_SCALE" "v1.2.8 keeps manual scale compatibility fallback"
require_text "$tuned_v12_extension/extension.js" "Main.overview.connect('showing'" "v1.2.8 listens for Activities overview show events"
require_text "$tuned_v12_extension/extension.js" "_formatMonthDay" "v1.2.5 clock date shows month and day"
require_text "$tuned_v12_extension/extension.js" "now.get_day_of_month()" "v1.2.5 clock date includes day of month"
require_text "$tuned_v12_extension/extension.js" "hourIndex < 12" "v1.2.6 clock adds 12 hourly dots"
require_absent_text "$tuned_v12_extension/extension.js" "for (let tick = 0; tick < 60; tick++)" "v1.2.5 clock removes minute tick scale"
require_absent_text "$tuned_v12_extension/extension.js" "secondAngle" "v1.2.6 clock removes the second hand"
require_absent_text "$tuned_v12_extension/extension.js" "now.format('%B %Y')" "v1.2.5 clock no longer shows month and year"
require_text "$tuned_v12_extension/extension.js" "DEFAULT_MARKET_SYMBOLS" "desktop-lab-v12 includes default visible market symbols"
require_text "$tuned_v12_extension/extension.js" "_buildStockChooser" "v1.2.6 includes a stock chooser app"
require_text "$tuned_v12_extension/extension.js" "MARKET_PRESET_SYMBOLS" "v1.2.7 includes stock chooser preset symbols"
require_text "$tuned_v12_extension/extension.js" "_createStockPresetButton" "v1.2.7 stock chooser builds preset buttons"
require_text "$tuned_v12_extension/extension.js" "_addMarketSymbolFromEntry" "v1.2.6 can add chosen stock symbols"
require_text "$tuned_v12_extension/extension.js" "_addMarketSymbol(symbol)" "v1.2.7 stock add path is shared by presets and typed input"
require_text "$tuned_v12_extension/extension.js" "_removeMarketSymbol" "v1.2.6 can remove chosen stock symbols"
require_text "$tuned_v12_extension/extension.js" "market-symbols.json" "v1.2.6 stores chosen market symbols in user config"
require_text "$tuned_v12_extension/extension.js" "DESKTOP_LAB_ALPHA_VANTAGE_KEY" "v1.2.6 supports optional Alpha Vantage quote lookup"
require_text "$tuned_v12_extension/extension.js" "fetch_yahoo_chart" "v1.2.6 keeps no-key fallback quotes"
require_absent_text "$tuned_v12_extension/extension.js" "Yahoo Chart API" "v1.2.5 removes visible Yahoo Chart API provider text"
require_absent_text "$tuned_v12_extension/extension.js" "_marketUpdatedLabel" "v1.2.5 removes market update-time label"
require_text "$tuned_v12_extension/extension.js" "_buildGestureZone" "desktop-lab-v12 includes a bottom app-grid gesture zone"
require_text "$tuned_v12_extension/extension.js" "IDLE_SCREEN_SECONDS = 30 * 60" "desktop-lab-v12 rest screen waits 30 minutes"
require_text "$tuned_v12_extension/extension.js" "add_idle_watch" "v1.2.5 rest screen uses GNOME Shell idle monitor when available"
require_text "$tuned_v12_extension/extension.js" "_resetIdleTimer" "v1.2.5 rest screen keeps timer fallback"
require_text "$tuned_v12_extension/extension.js" "_drawIdleBackground" "desktop-lab-v12 includes an animated rest screen background"
require_absent_text "$tuned_v12_extension/extension.js" "_createMarkdownNote" "desktop-lab-v12 no longer creates Markdown notes"
require_absent_text "$tuned_v12_extension/extension.js" "_moveMotionDot" "desktop-lab-v12 no longer uses the moving idle marker"
require_text "$tuned_v12_extension/extension.js" "_tryHideBatteryIcon" "desktop-lab-v12 includes guarded battery-icon hiding"
require_text "$tuned_v12_metadata" "fullscreen dock suppression" "desktop-lab-v12 metadata records v1.2.11 refinement"
require_text "$tuned_v12_stylesheet" "background-gradient-direction: vertical;" "v1.2.5 uses textured translucent surfaces"
require_text "$tuned_v12_stylesheet" "desktop-lab-v12-folder-flyout" "v1.2.5 stylesheet includes app cluster folder flyout"
require_text "$tuned_v12_stylesheet" "desktop-lab-v12-cluster-dragging" "v1.2.5 stylesheet includes dock drag state"
require_text "$tuned_v12_stylesheet" "desktop-lab-v12-dock-reveal-zone" "v1.2.6 stylesheet includes left-edge reveal zone"
require_absent_text "$tuned_v12_stylesheet" "desktop-lab-v12-dock-hint" "v1.2.8 stylesheet removes the separate dock hint"
require_text "$tuned_v12_stylesheet" "border-right: 1px solid" "v1.2.8 dock surface includes a restrained silhouette edge"
require_text "$tuned_v12_stylesheet" "desktop-lab-v12-stock-chooser" "v1.2.6 stylesheet includes compact stock chooser"
require_text "$tuned_v12_stylesheet" "desktop-lab-v12-stock-preset-button" "v1.2.7 stylesheet includes stock preset buttons"
require_text "$tuned_v12_stylesheet" "desktop-lab-v12-dock-editor" "v1.2.7 stylesheet includes compact dock editor"
require_text "$tuned_v12_stylesheet" "rgba(4, 29, 47, 0.66)" "v1.2.8 dock silhouette uses a dark marine surface"
require_text "$tuned_v12_stylesheet" "font-weight: 600;" "v1.2.5 uses restrained component typography"
require_text "$tuned_v12_extension/extension.js" "text: 'Rest'" "v1.2.5 rest screen label is concise"
require_text "$tuned_v12_extension/extension.js" "0.96, 0.96, 0.97" "v1.2.5 drawing code uses a low-saturation neutral palette"
require_text "$tuned_v12_extension/extension.js" "0.015, 0.11, 0.18" "v1.2.8 keeps the dark marine rest screen base"
require_absent_text "$tuned_v12_stylesheet" "background-color: #000000" "v1.2.8 stylesheet does not return to solid black surfaces"
require_absent_text "$tuned_v12_stylesheet" "rgba(20, 119, 184" "v1.2.5 removes old saturated blue hover accent"
require_absent_text "$tuned_v12_stylesheet" "rgba(20, 184, 166" "v1.2.5 removes old saturated teal gesture accent"
require_absent_text "$tuned_v12_extension/extension.js" "0.24, 0.66, 0.96" "v1.2.5 removes old blue idle animation lines"
require_absent_text "$tuned_v12_extension/extension.js" "0.20, 0.83, 0.60" "v1.2.5 removes old green idle animation lines"

version_v127="versions/v1/v1.2/v1.2.7"
version_v127_extension="$version_v127/profile/extensions/desktop-lab-v12@young"
require_file "$version_v127/apply-v1.2.7.sh"
require_file "$version_v127/Apply v1.2.7.desktop"
require_file "$version_v127/profile/gsettings-export.sh"
require_text "$version_v127/profile/gsettings-export.sh" "gsettings set org.gnome.desktop.background primary-color \\'#041D2F\\'" "v1.2.7 launcher snapshot includes marine background"
require_text "$version_v127_extension/metadata.json" "v1.2.7 refinement" "v1.2.7 launcher snapshot includes v1.2.7 metadata"
require_text "$version_v127_extension/extension.js" "Main.layoutManager?._backgroundGroup" "v1.2.7 launcher snapshot includes background widget layer"
require_text "$version_v127_extension/extension.js" "_setOverviewWidgetMode" "v1.2.7 launcher snapshot includes overview widget scaling"
require_text "$version_v127_extension/extension.js" "_dockHint" "v1.2.7 launcher snapshot includes edge hint"
require_text "$version_v127_extension/extension.js" "_buildStockChooser" "v1.2.7 launcher snapshot includes stock chooser"
require_text "$version_v127_extension/extension.js" "_buildDockEditor" "v1.2.7 launcher snapshot includes dock editor"
require_absent_text "$version_v127_extension/extension.js" "secondAngle" "v1.2.7 launcher snapshot removes second hand"
require_absent_text "$version_v127_extension/extension.js" "Yahoo Chart API" "v1.2.7 launcher snapshot omits visible Yahoo Chart API text"

version_v128="versions/v1/v1.2/v1.2.8"
version_v128_extension="$version_v128/profile/extensions/desktop-lab-v12@young"
require_file "$version_v128/apply-v1.2.8.sh"
require_file "$version_v128/Apply v1.2.8.desktop"
require_file "$version_v128/profile/gsettings-export.sh"
require_text "$version_v128/profile/gsettings-export.sh" "gsettings set org.gnome.desktop.background primary-color \\'#041D2F\\'" "v1.2.8 launcher snapshot includes marine background"
require_text "$version_v128_extension/metadata.json" "v1.2.8 refinement" "v1.2.8 launcher snapshot includes v1.2.8 metadata"
require_text "$version_v128_extension/extension.js" "_buildBackgroundWidgetLayer" "v1.2.8 launcher snapshot includes the shared background widget layer"
require_text "$version_v128_extension/extension.js" "workspace?._background?._bin" "v1.2.8 launcher snapshot includes overview workspace embedding"
require_text "$version_v128_extension/extension.js" "_restoreDesktopActor(this._backgroundWidgetLayer)" "v1.2.8 launcher snapshot restores widgets after overview"
require_text "$version_v128_extension/extension.js" "_handleOverviewStateChanged" "v1.2.8 launcher snapshot restores before overview teardown"
require_text "$version_v128_extension/extension.js" "DOCK_PEEK_WIDTH = 14" "v1.2.8 launcher snapshot includes the visible dock slice"
require_text "$version_v128_extension/extension.js" "translation_x: 0" "v1.2.8 launcher snapshot includes transform-based dock reveal"
require_absent_text "$version_v128_extension/extension.js" "_dockHint" "v1.2.8 launcher snapshot removes the old dock hint actor"
require_absent_text "$version_v128_extension/extension.js" "secondAngle" "v1.2.8 launcher snapshot keeps the clock second hand removed"
require_absent_text "$version_v128_extension/extension.js" "Yahoo Chart API" "v1.2.8 launcher snapshot omits visible Yahoo Chart API text"

version_v129="versions/v1/v1.2/v1.2.9"
version_v129_extension="$version_v129/profile/extensions/desktop-lab-v12@young"
require_file "$version_v129/apply-v1.2.9.sh"
require_file "$version_v129/Apply v1.2.9.desktop"
require_file "$version_v129/profile/gsettings-export.sh"
require_text "$version_v129_extension/extension.js" "_dockPinnedByCluster" "v1.2.9 launcher snapshot keeps dock pinned after a cluster click"
require_text "$version_v129_extension/extension.js" "if (this._dockPinnedByCluster)" "v1.2.9 launcher snapshot protects pinned dock from pointer motion"
require_text "$version_v129_extension/metadata.json" "v1.2.9 refinement" "v1.2.9 launcher snapshot records its refinement"

version_v1210="versions/v1/v1.2/v1.2.10"
require_file "$version_v1210/apply-v1.2.10.sh"
require_file "$version_v1210/Apply v1.2.10.desktop"
require_file "$version_v1210/profile/gsettings-export.sh"
require_file "$version_v1210/host-manifest.json"
validate_host_manifest "$version_v1210/host-manifest.json"
require_text "$version_v1210/README.md" "Lab restore warning" "v1.2.10 labels its exact launcher as a lab restore"

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

latest_version_dir="$(printf '%s\n' "${version_dirs[@]}" | sort -V | tail -n 1)"
if [ -n "$latest_version_dir" ]; then
  require_file "$latest_version_dir/host-manifest.json"
  if [ -f "$latest_version_dir/host-manifest.json" ]; then
    validate_host_manifest "$latest_version_dir/host-manifest.json"
    pass "latest release is eligible for the safe host updater"
  fi
fi

while IFS= read -r manifest; do
  validate_host_manifest "$manifest"
done < <(find versions -name host-manifest.json -print | sort)

if tests/test-update-host.sh; then
  pass "safe host updater isolated apply and rollback tests pass"
else
  fail "safe host updater isolated apply and rollback tests failed"
fi

if tests/test-lab-version.sh; then
  pass "Desktop Lab version tracker isolated tests pass"
else
  fail "Desktop Lab version tracker isolated tests failed"
fi

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
