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

### 2026-07-09 16:26 CST - Aesthetic preference maintenance workflow

- Version label: aesthetic-preference-maintenance-workflow.
- Task summary: add a workflow rule that keeps `aesthetic preference.md` synchronized with newer user preferences and durable key features from new tasks.
- Changed files:
  - `AGENTS.md`
  - `README.md`
  - `LAB_DIARY.md`
  - `aesthetic preference.md`
  - `scripts/check-workflow.sh`
  - `task/v 1.2/v 1.2.4.md`
- Desktop settings or profiles changed:
  - None. This is a workflow-documentation update only.
- Features included:
  - Future Codex runs must update `aesthetic preference.md` when a newer user instruction or accepted result differs from the current aesthetic direction.
  - Future Codex runs must add concise `aesthetic preference.md` notes when new tasks introduce durable key desktop, UI, visual, or interaction features.
  - The workflow verifier now checks that the agent notes, README workflow, and aesthetic preference source all include this maintenance rule.
  - The v1.2.4 task note records this workflow request for later reference.
- Verification:
  - `bash -n scripts/check-workflow.sh` completed successfully.
  - `git diff --check` completed successfully.
  - `./scripts/check-workflow.sh` completed successfully with only the expected dirty worktree warning before commit.
- Known limits:
  - This version does not change or regenerate the v1.2.3 desktop profile or project-local launcher snapshot.

### 2026-07-09 16:13 CST - v 1.2.3 aesthetic preference pass

- Version label: v1.2.3-aesthetic-preference-pass.
- Task summary: test the new `aesthetic preference.md` guidance against the existing v1.2.2 desktop lab profile, keeping the same desktop behavior while refining the visual treatment to feel calmer, more neutral, and Apple-like.
- Changed files:
  - `TASK.md`
  - `LAB_DIARY.md`
  - `scripts/check-workflow.sh`
  - `task/v 1.2/v 1.2.3.md`
  - `profiles/vm-initial-desktop-task/README.txt`
  - `profiles/vm-initial-desktop-task/extensions/desktop-lab-v12@young/extension.js`
  - `profiles/vm-initial-desktop-task/extensions/desktop-lab-v12@young/metadata.json`
  - `profiles/vm-initial-desktop-task/extensions/desktop-lab-v12@young/stylesheet.css`
  - `versions/v1/v1.2/v1.2.3/`
- Desktop settings or profiles changed:
  - Updated the tracked tuned profile `profiles/vm-initial-desktop-task`.
  - Kept the v1.2.2 GNOME behavior: solid black desktop background, empty GNOME favorite-apps, 30-minute idle trigger, disabled idle dimming, disabled selected break reminders, and inactive sleep set to `nothing`.
  - Regenerated the project-local `v1.2.3` launcher snapshot from the tuned profile.
  - Imported `profiles/vm-initial-desktop-task` into this VM desktop session.
  - Applied the saved `v1.2.3` launcher snapshot with `versions/v1/v1.2/v1.2.3/apply-v1.2.3.sh < /dev/null`.
- Features included:
  - Neutral translucent dock and market surfaces using restrained light borders and lower shadow intensity.
  - Softer hover and focus states without the old saturated blue dock hover accent.
  - Bottom app-grid gesture zone changed from teal to a subtle neutral edge affordance.
  - Wall-clock drawing changed to a low-saturation neutral palette with a faint face fill.
  - Rest screen motion changed from blue/green diagonal lines to quieter neutral motion.
  - Rest screen label shortened from `rest screen` to `Rest`.
  - Workflow verifier now checks the v1.2.3 task source, aesthetic metadata, neutral styling, removed saturated colors, and the v1.2.3 launcher snapshot.
- Verification:
  - `git diff --check` completed successfully.
  - `bash -n scripts/check-workflow.sh` completed successfully.
  - `gnome-extensions pack --force --out-dir /tmp` completed successfully for `bluetooth-battery@young`, `codex-usage@young`, and `desktop-lab-v12@young`.
  - `./scripts/import-layout.sh profiles/vm-initial-desktop-task` completed successfully.
  - `./scripts/install-version-launcher.sh v1.2.3 profiles/vm-initial-desktop-task` completed successfully.
  - `versions/v1/v1.2/v1.2.3/apply-v1.2.3.sh < /dev/null` completed successfully.
  - `gnome-extensions disable desktop-lab-v12@young && gnome-extensions enable desktop-lab-v12@young` completed successfully, and `gnome-extensions info desktop-lab-v12@young` reported `State: ACTIVE`.
  - `./scripts/check-workflow.sh` completed successfully with only the expected dirty worktree warning before commit.
  - `gsettings get org.gnome.desktop.background picture-options` returned `'none'`.
  - `gsettings get org.gnome.desktop.background primary-color` and `secondary-color` returned `'#000000'`.
  - `gsettings get org.gnome.shell favorite-apps` returned `@as []`.
  - `gsettings get org.gnome.desktop.session idle-delay` returned `uint32 1800`.
  - `gsettings get org.gnome.settings-daemon.plugins.power idle-dim` returned `false`.
  - `journalctl --user -b` showed no `desktop-lab-v12` JavaScript errors after the extension was toggled.
- Known limits:
  - `gnome-extensions info desktop-lab-v12@young` still showed cached old description text after reload, but the installed metadata file in `~/.local/share/gnome-shell/extensions/desktop-lab-v12@young/metadata.json`, the tracked profile, and the `v1.2.3` launcher snapshot all contain the v1.2.3 aesthetic description.
  - Market values still depend on the public Stooq CSV endpoint and fall back to `--` when offline or unavailable.
  - The application-grid drag/scroll zone still uses guarded GNOME Shell APIs because the overview internals are not a stable extension API.
  - Log out and back in if GNOME Shell does not fully refresh the updated extension UI after applying the profile.

### 2026-07-09 15:05 CST - v 1.2.2 desktop lab workflow refinement

- Version label: v1.2.2-desktop-lab-workflow-refinement.
- Task summary: finish the version 1.2 minor refinement from `task/v 1.2/v 1.2.2.md` by removing the v1.2.1 text-editing customization, making the left dock the primary launcher, replacing the market shortcuts and idle dot with visible desktop features, and saving a new project-local launcher snapshot.
- Changed files:
  - `TASK.md`
  - `LAB_DIARY.md`
  - `scripts/check-workflow.sh`
  - `scripts/import-layout.sh`
  - `scripts/install-version-launcher.sh`
  - `task/v 1.2/v 1.2.2.md`
  - `profiles/vm-initial-desktop-task/README.txt`
  - `profiles/vm-initial-desktop-task/dconf-org-gnome.ini`
  - `profiles/vm-initial-desktop-task/favorite-apps.txt`
  - `profiles/vm-initial-desktop-task/gsettings-export.sh`
  - `profiles/vm-initial-desktop-task/extensions/desktop-lab-v12@young/`
  - `versions/v1/v1.2/v1.2.2/`
- Desktop settings or profiles changed:
  - Updated the tracked tuned profile `profiles/vm-initial-desktop-task`.
  - Kept the desktop background as solid black with no wallpaper image.
  - Removed the `org.gnome.TextEditor` custom settings that v1.2.1 added.
  - Set `org.gnome.shell favorite-apps` to `@as []` so the left lab dock is the primary quick launcher.
  - Changed `scripts/import-layout.sh` so imports apply `favorite-apps` while still skipping app-grid ordering.
  - Set the idle trigger to 30 minutes, disabled GNOME idle dimming and selected break reminders, and kept AC and battery inactive sleep as `nothing`.
  - Imported the saved `v1.2.2` launcher snapshot into this VM desktop session with `versions/v1/v1.2/v1.2.2/apply-v1.2.2.sh < /dev/null`.
- Features included:
  - Larger middle-left dock grouped into writing, code, web, system, and application-grid clusters.
  - Simple circular wall-clock overlay near the upper middle of the desktop.
  - Visible market board for SPY, QQQ, NVDA, and AAPL that fetches values directly instead of opening quote URLs.
  - Bottom edge drag/scroll zone that opens the application grid through guarded GNOME Shell APIs.
  - Animated 30-minute rest screen that replaces the small moving idle marker.
  - Updated workflow verifier checks for v1.2.2 and fails if the old Markdown note action or moving idle marker returns.
- Verification:
  - `bash -n` completed successfully for the edited shell scripts and tuned `gsettings-export.sh`.
  - `gnome-extensions pack --force --out-dir /tmp profiles/vm-initial-desktop-task/extensions/desktop-lab-v12@young` completed successfully.
  - `./scripts/check-workflow.sh` completed successfully after the new `v1.2.2` snapshot was generated, with only the expected dirty worktree warning.
  - `./scripts/install-version-launcher.sh v1.2.2 profiles/vm-initial-desktop-task` completed successfully.
  - `versions/v1/v1.2/v1.2.2/apply-v1.2.2.sh < /dev/null` completed successfully.
  - `gsettings get org.gnome.shell favorite-apps` returned `@as []`.
  - `gsettings get org.gnome.desktop.session idle-delay` returned `uint32 1800`.
  - `gsettings get org.gnome.desktop.break-reminders selected-breaks` returned `@as []`.
  - `gsettings get org.gnome.settings-daemon.plugins.power idle-dim` returned `false`.
  - `gsettings get org.gnome.settings-daemon.plugins.power sleep-inactive-ac-type` and `sleep-inactive-battery-type` returned `'nothing'`.
  - `gnome-extensions disable desktop-lab-v12@young && gnome-extensions enable desktop-lab-v12@young` completed successfully, and `gnome-extensions info desktop-lab-v12@young` reported `State: ACTIVE`.
  - `journalctl --user -b` showed no `desktop-lab-v12` JavaScript errors after the extension was toggled.
- Known limits:
  - `gnome-extensions info desktop-lab-v12@young` still showed cached old description text after reload, but the metadata files in the profile, version snapshot, and `~/.local/share/gnome-shell/extensions/desktop-lab-v12@young/` contain the corrected v1.2.2 description.
  - Market values depend on the public Stooq CSV endpoint and fall back to `--` when offline or unavailable.
  - The application-grid drag/scroll zone uses guarded GNOME Shell APIs because the overview internals are not a stable extension API.
  - Log out and back in if GNOME Shell does not fully refresh the updated extension UI after applying the profile.

### 2026-07-09 13:22 CST - v 1.2.1 desktop lab overlay

- Version label: v1.2.1-desktop-lab-overlay.
- Task summary: start version 1.2 from `task/v 1.2/v 1.2.1.md` by adding a black desktop lab surface, Markdown-focused text editing defaults, a left quick-launch dock, data overlay, and idle protection settings.
- Changed files:
  - `TASK.md`
  - `LAB_DIARY.md`
  - `scripts/check-workflow.sh`
  - `task/v 1.2/v 1.2.1.md`
  - `profiles/vm-initial-desktop-task/README.txt`
  - `profiles/vm-initial-desktop-task/dconf-org-gnome.ini`
  - `profiles/vm-initial-desktop-task/enabled-extensions.txt`
  - `profiles/vm-initial-desktop-task/gsettings-export.sh`
  - `profiles/vm-initial-desktop-task/extensions/desktop-lab-v12@young/`
  - `versions/v1/v1.2/v1.2.1/`
- Desktop settings or profiles changed:
  - Updated the tracked tuned profile `profiles/vm-initial-desktop-task`.
  - Set the desktop background to solid black with no wallpaper image.
  - Kept `org.gnome.desktop.wm.preferences button-layout` as `close,maximize,minimize:` for top-left window buttons.
  - Kept `bluetooth-battery@young` and `codex-usage@young` enabled.
  - Added and enabled `desktop-lab-v12@young` in the tuned profile and version snapshot.
  - Configured GNOME Text Editor for 3-second autosave delay, session restore, line numbers, spellcheck, wrapping, dark style, and `~/Documents/Markdown Notes`.
  - Set idle delay to 300 seconds, enabled break reminders, enabled idle dimming, and kept AC inactive sleep as `nothing` so background work can keep running.
  - Imported `profiles/vm-initial-desktop-task` into this VM desktop session with `./scripts/import-layout.sh`.
  - Installed a clickable version launcher under `versions/v1/v1.2/v1.2.1/`.
- Features included:
  - New `desktop-lab-v12@young` Shell extension with a left-side dock grouped into writing, code, web, and system actions.
  - One-click Markdown note action that creates a timestamped `.md` file and opens it through the default file handler.
  - Clock and watchlist overlay with market-symbol shortcuts.
  - Slow moving idle marker for the black desktop lab surface.
  - Guarded best-effort battery actor hiding when the running GNOME Shell exposes compatible quick-settings actors.
  - `scripts/check-workflow.sh` now validates the v1.2.1 profile settings and extension features.
- Verification:
  - `./scripts/import-layout.sh profiles/vm-initial-desktop-task` completed successfully.
  - `./scripts/install-version-launcher.sh v1.2.1 profiles/vm-initial-desktop-task` completed successfully.
  - `versions/v1/v1.2/v1.2.1/apply-v1.2.1.sh < /dev/null` completed successfully.
  - `gsettings get org.gnome.desktop.background picture-options` returned `'none'`.
  - `gsettings get org.gnome.desktop.background primary-color` and `secondary-color` returned `'#000000'`.
  - `gsettings get org.gnome.desktop.interface show-battery-percentage` returned `false`.
  - `gsettings get org.gnome.TextEditor auto-save-delay` returned `uint32 3`.
  - `gsettings get org.gnome.desktop.session idle-delay` returned `uint32 300`.
  - `gsettings get org.gnome.settings-daemon.plugins.power sleep-inactive-ac-type` returned `'nothing'`.
  - `gnome-extensions pack --force --out-dir /tmp` completed successfully for `bluetooth-battery@young`, `codex-usage@young`, and `desktop-lab-v12@young`.
  - `desktop-file-validate versions/v1/v1.2/v1.2.1/Apply v1.2.1.desktop` completed successfully.
  - `./scripts/check-workflow.sh` completed successfully before commit with only the expected dirty worktree warning.
- Known limits:
  - The running GNOME Shell session copied the new `desktop-lab-v12@young` files to `~/.local/share/gnome-shell/extensions/`, but `gnome-extensions info desktop-lab-v12@young` did not see the new UUID before logout/login. The profile and version launcher are correct; log out and back in for Shell to rescan and activate the new overlay.
  - Battery icon removal is best-effort because the built-in GNOME quick-settings power icon is not exposed through a stable public Shell extension API. The stable profile setting hides the numeric battery percentage.
  - Watchlist shortcuts open quote pages; this version does not fetch live prices into the panel.

### 2026-07-08 15:03 CST - Project-local workflow folders

- Version label: project-local-workflow-folders.
- Task summary: update the VM lab workflow after `AGENTS.md`, `task/`, and `versions/` were moved into the project folder.
- Changed files:
  - `AGENTS.md`
  - `README.md`
  - `TASK.md`
  - `LAB_DIARY.md`
  - `scripts/check-workflow.sh`
  - `scripts/install-version-launcher.sh`
  - `task/`
  - `versions/`
- Desktop settings or profiles changed:
  - No live GNOME settings were changed.
  - Existing saved launcher snapshots under `versions/v1/v1.1/` were kept with their own `profile/` directories.
- Features included:
  - `scripts/install-version-launcher.sh` now defaults to the repo-local `versions/` directory.
  - Existing `v1.1.2`, `v1.1.3`, and `v1.1.4` apply scripts resolve their snapshot profile from their own launcher folder.
  - Existing `.desktop` launchers now point at the project-local launcher scripts.
  - `scripts/check-workflow.sh` now validates project-local version launchers and fails if they reference the old `/home/sdafsaasd/versions` path.
- Verification:
  - `./scripts/check-workflow.sh` completed successfully with only the expected dirty worktree warning before commit.
- Known limits:
  - The `.desktop` launcher `Exec=` paths are absolute to the current project location; regenerate launchers with `./scripts/install-version-launcher.sh` if the repo is moved again and double-click launching is needed from the new path.

### 2026-07-02 18:31 JST - v 1.1.4 usage icon cleanup

- Version label: v1.1.4-usage-icon-cleanup.
- Task summary: finish the version 1.1 minor fixes by accepting the current Bluetooth and window-button behavior, then remove the numeric Codex usage percentage text from the top panel.
- Changed files:
  - `TASK.md`
  - `LAB_DIARY.md`
  - `notes.md`
  - `profiles/vm-initial-desktop-task/README.txt`
  - `profiles/vm-initial-desktop-task/extensions/codex-usage@young/extension.js`
  - `profiles/vm-initial-desktop-task/extensions/codex-usage@young/stylesheet.css`
- Desktop settings or profiles changed:
  - Updated the tracked tuned profile `profiles/vm-initial-desktop-task`.
  - Kept `org.gnome.desktop.wm.preferences button-layout` as `close,maximize,minimize:` for top-left window buttons.
  - Kept `bluetooth-battery@young` enabled with the current BlueZ and UPower battery support.
  - Imported `profiles/vm-initial-desktop-task` into this VM desktop session with `./scripts/import-layout.sh`.
  - Installed a clickable version launcher under `/home/sdafsaasd/versions/v1/v1.1/v1.1.4/`.
- Features included:
  - Removed the adjacent numeric percentage label from the `codex-usage@young` top-panel indicator.
  - Kept the Codex usage icon as the only top-panel actor for the indicator.
  - Kept the outer 5-hour remaining ring and weekly inner `C` reservoir.
  - Kept detailed 5-hour, weekly, reset, credits, source, and stale-state values in the indicator menu.
  - Added `apply-v1.1.4.sh` and `Apply v1.1.4.desktop` so the VM can be switched to this version from `~/versions`.
- Verification:
  - `./scripts/import-layout.sh profiles/vm-initial-desktop-task` completed successfully.
  - `./scripts/install-version-launcher.sh v1.1.4 profiles/vm-initial-desktop-task` completed successfully.
  - `/home/sdafsaasd/versions/v1/v1.1/v1.1.4/apply-v1.1.4.sh < /dev/null` completed successfully.
  - `gsettings get org.gnome.desktop.wm.preferences button-layout` returned `'close,maximize,minimize:'`.
  - `gnome-extensions info bluetooth-battery@young` reported enabled and active.
  - `gnome-extensions info codex-usage@young` reported enabled and active.
  - `gnome-extensions pack --force --out-dir /tmp profiles/vm-initial-desktop-task/extensions/bluetooth-battery@young` completed successfully.
  - `gnome-extensions pack --force --out-dir /tmp profiles/vm-initial-desktop-task/extensions/codex-usage@young` completed successfully.
  - `./scripts/check-workflow.sh` completed successfully before commit with only the expected dirty worktree warning.
  - `gjs -m` for both extension files reached the expected GNOME Shell resource import limit outside GNOME Shell.
  - `rg` found no `_valueLabel`, `codex-usage-value`, or value-label child references in the tracked profile or `v1.1.4` launcher snapshot.
- Known limits:
  - The completed source task note was found at `/home/sdafsaasd/task/v 1.2/v 1.1.4.md`; `/home/sdafsaasd/task/v 1.1/v 1.1.4.md` was empty.
  - Bluetooth or external device battery display still depends on Fedora exposing the device through UPower or BlueZ.
  - GNOME Shell may need a logout and login before already-running panel extension instances show the updated top-panel indicator.

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
