# Lab Diary

Readable version diary for the GNOME layout sync lab.
Git is the exact file history; this file explains what each lab version is for.

## Version Format

Each version entry should include:
- date and time
- version label
- task summary
- files, desktop settings, or profiles changed
- features included in the version
- verification result
- known limits or follow-up items

The exact Git commit hash is reported after each version is committed and can be checked with `git log`.
A diary entry does not embed its own final commit hash because changing the file would change the hash again.

## Versions

### 2026-07-02 18:12 JST - v 1.1.3 desktop minor fixes

- Version label: v1.1.3-desktop-minor-fixes.
- Task summary: continue the version 1.1 minor fixes for the tuned VM desktop profile.
- Changed files:
  - `TASK.md`
  - `LAB_DIARY.md`
  - `profiles/vm-initial-desktop-task/README.txt`
  - `profiles/vm-initial-desktop-task/dconf-org-gnome.ini`
  - `profiles/vm-initial-desktop-task/gsettings-export.sh`
  - `profiles/vm-initial-desktop-task/extensions/bluetooth-battery@young/extension.js`
  - `profiles/vm-initial-desktop-task/extensions/bluetooth-battery@young/stylesheet.css`
  - `profiles/vm-initial-desktop-task/extensions/codex-usage@young/extension.js`
- Desktop settings or profiles changed:
  - Updated the tracked tuned profile `profiles/vm-initial-desktop-task`.
  - Set `org.gnome.desktop.wm.preferences button-layout` to `close,maximize,minimize:` for top-left window buttons.
  - Imported `profiles/vm-initial-desktop-task` into this VM desktop session with `./scripts/import-layout.sh`.
  - Installed a clickable version launcher under `/home/sdafsaasd/versions/v1/v1.1/v1.1.3/`.
- Features included:
  - `bluetooth-battery@young` now reads external device battery levels from Fedora/UPower as well as BlueZ.
  - UPower device types for mouse, keyboard, gaming input, touchpad, headset, speakers, headphones, remote control, and generic Bluetooth devices are included.
  - The Codex usage icon keeps the outer 5-hour remaining ring.
  - The weekly usage reservoir now fills the inner `C` glyph itself instead of filling only the circle behind it.
  - Added `apply-v1.1.3.sh` and `Apply v1.1.3.desktop` so the VM can be switched to this version from `~/versions`.
- Verification:
  - `./scripts/import-layout.sh profiles/vm-initial-desktop-task` completed successfully.
  - `./scripts/install-version-launcher.sh v1.1.3 profiles/vm-initial-desktop-task` completed successfully.
  - `/home/sdafsaasd/versions/v1/v1.1/v1.1.3/apply-v1.1.3.sh < /dev/null` completed successfully.
  - `gsettings get org.gnome.desktop.wm.preferences button-layout` returned `'close,maximize,minimize:'`.
  - `gnome-extensions info bluetooth-battery@young` reported enabled and active.
  - `gnome-extensions info codex-usage@young` reported enabled and active.
  - `gnome-extensions pack --force --out-dir /tmp profiles/vm-initial-desktop-task/extensions/bluetooth-battery@young` completed successfully.
  - `gnome-extensions pack --force --out-dir /tmp profiles/vm-initial-desktop-task/extensions/codex-usage@young` completed successfully.
  - `./scripts/check-workflow.sh` completed successfully before commit with only the expected dirty worktree warning.
  - `gjs -m` for both updated extension files parsed far enough to reach the expected GNOME Shell resource import limit outside GNOME Shell.
- Known limits:
  - `/home/sdafsaasd/task/v 1.1/v 1.1.3.md` was empty at the start of this work, so it was filled from the remaining concrete `v 1.1.2` minor-fix notes before implementation.
  - Bluetooth or external device battery display still depends on Fedora exposing the device through UPower or BlueZ.
  - GNOME Shell may need a logout and login before already-running panel extension instances show the updated drawing code.

### 2026-07-02 16:49 JST - v 1.1.2 Codex usage icon

- Version label: v1.1.2-codex-usage-icon.
- Task summary: improve the Codex usage panel icon for the next version 1.1 minor fix.
- Changed files:
  - `README.md`
  - `TASK.md`
  - `LAB_DIARY.md`
  - `notes.md`
  - `profiles/vm-initial-desktop-task/README.txt`
  - `profiles/vm-initial-desktop-task/extensions/codex-usage@young/extension.js`
  - `profiles/vm-initial-desktop-task/extensions/codex-usage@young/stylesheet.css`
  - `scripts/install-version-launcher.sh`
- Desktop settings or profiles changed:
  - Updated the tracked tuned profile `profiles/vm-initial-desktop-task`.
  - Imported `profiles/vm-initial-desktop-task` into this VM desktop session with `./scripts/import-layout.sh`.
  - Installed a clickable version launcher under `/home/sdafsaasd/versions/v1/v1.1/v1.1.2/`.
- Features included:
  - Replaced the plain `C` label in `codex-usage@young` with a drawn panel icon.
  - The outer icon ring represents 5-hour remaining usage.
  - The inner `C` reservoir fill represents weekly remaining usage.
  - Kept the adjacent remaining-percent text and existing menu details.
  - Added `apply-v1.1.2.sh` and `Apply v1.1.2.desktop` so the VM can be switched to this version from `~/versions`.
- Verification:
  - `./scripts/import-layout.sh profiles/vm-initial-desktop-task` completed successfully.
  - `./scripts/install-version-launcher.sh v1.1.2 profiles/vm-initial-desktop-task` completed successfully.
  - `/home/sdafsaasd/versions/v1/v1.1/v1.1.2/apply-v1.1.2.sh < /dev/null` completed successfully.
  - `gnome-extensions pack --force --out-dir /tmp profiles/vm-initial-desktop-task/extensions/codex-usage@young` completed successfully.
  - `./scripts/check-workflow.sh` completed successfully before commit with only the expected dirty worktree warning.
  - `gjs -m profiles/vm-initial-desktop-task/extensions/codex-usage@young/extension.js` parsed far enough to reach the expected GNOME Shell resource import limit outside GNOME Shell.
- Known limits:
  - `/home/sdafsaasd/task/v 1.1/v 1.1.2.md` currently contains only an empty Markdown heading, so this version uses the remaining concrete Codex icon request from `v 1.1.1.md`.
  - The icon could not be visually inspected inside a live GNOME Shell session from the sandbox; it should be checked after importing the profile and logging back in.

### 2026-07-02 16:41 JST - Workflow verifier

- Version label: workflow-verifier.
- Task summary: check and harden the repeatable Codex lab workflow for future desktop customization fixes.
- Changed files:
  - `README.md`
  - `LAB_DIARY.md`
  - `scripts/check-workflow.sh`
- Features included:
  - Added a workflow verifier command for required workflow documents, script syntax, tracked profile structure, supported `gsettings` keys, extension metadata compatibility, and extension bundle packing.
  - Documented `./scripts/check-workflow.sh` as the standard verification gate before each lab version diary update and commit.
- Verification:
  - `./scripts/check-workflow.sh` completed successfully.
  - The only warning was the expected dirty worktree warning before this version was committed.
- Known limits:
  - The verifier checks committed lab files and tracked profiles; ignored ad hoc exports under `profiles/` remain disposable snapshots and should be regenerated when stale.

### 2026-07-01 18:52 JST - Initial desktop task tuned profile

- Version label: initial-desktop-task-tuned-profile.
- Task summary: create the first tuned VM profile for the initial desktop setup notes.
- Changed files:
  - `.gitignore`
  - `README.md`
  - `TASK.md`
  - `LAB_DIARY.md`
  - `notes.md`
  - `scripts/export-host-layout.sh`
  - `scripts/import-layout.sh`
  - `profiles/vm-initial-desktop-task/`
- Desktop settings or profiles changed:
  - Added tracked tuned profile `profiles/vm-initial-desktop-task`.
  - Set `org.gnome.desktop.wm.preferences button-layout` to `:close,maximize,minimize`.
  - Added and enabled `bluetooth-battery@young` in the tuned profile.
- Features included:
  - Window buttons are configured for upper-right close, maximize/restore, minimize order.
  - Bluetooth battery panel indicator extension queries BlueZ for connected devices exposing `org.bluez.Battery1`.
  - Indicator shows the lowest connected Bluetooth battery percentage in the top panel and lists devices in its menu.
- Verification:
  - Confirmed tuned profile references the requested `button-layout`.
  - Confirmed tuned profile enabled extensions include `bluetooth-battery@young` while preserving existing extensions.
  - Confirmed extension files exist in the tuned profile.
  - `gnome-extensions pack --force profiles/vm-initial-desktop-task/extensions/bluetooth-battery@young` completed successfully.
  - `bash -n scripts/import-layout.sh` completed successfully.
  - `bash -n scripts/export-host-layout.sh` completed successfully.
  - `bash -n profiles/vm-initial-desktop-task/gsettings-export.sh` completed successfully after fixing exported value quoting.
- Known limits:
  - The Codex sandbox cannot commit live GNOME dconf writes, so this version provides an importable tuned profile instead of changing the active desktop session directly.
  - Bluetooth device detection could not be tested from the sandbox because DBus access to BlueZ is restricted.

### 2026-07-01 18:42 JST - Workflow files and Git version process

- Version label: workflow-files-and-git-version-process.
- Task summary: make the Codex desktop customization workflow persistent across conversations.
- Changed files:
  - `README.md`
  - `TASK.md`
  - `LAB_DIARY.md`
- Features included:
  - Added `TASK.md` as the user-maintained task input file.
  - Added `LAB_DIARY.md` as the readable version diary.
  - Defined one Git commit on `main` as one lab version.
  - Defined the repeatable workflow: read task, update desktop/lab, verify, write diary, commit, report version.
- Verification:
  - `README.md`, `TASK.md`, and `LAB_DIARY.md` were read back after editing.
  - Final Git commit hash is reported by Codex after commit.
- Known limits:
  - No desktop layout setting was changed in this version; this version only formalizes the workflow.

### 2026-07-01 - Initial lab setup

- Commit: `13127b3`.
- Task summary: initialize the VM desktop customization lab.
- Changed files:
  - `.gitignore`
  - `README.md`
  - `notes.md`
  - `profiles/.gitkeep`
  - `scripts/apply-to-host.sh`
  - `scripts/export-current-layout.sh`
  - `scripts/export-host-layout.sh`
  - `scripts/import-layout.sh`
- Features included:
  - Established this VM as the desktop customization lab environment.
  - Initialized Git version control on branch `main`.
  - Added scripts for exporting, importing, and applying GNOME layout profiles.
  - Ignored exported profile snapshots by default while keeping the `profiles/` directory.
- Verification:
  - Git repository initialized successfully.
  - Initial commit created successfully.
- Known limits:
  - Exported profile snapshots are not tracked by Git unless the ignore policy is changed.
