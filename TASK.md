# Desktop Lab Task

Update this file before asking Codex to work on the VM desktop layout.
Codex should read this file at the start of each desktop customization task.

## Current request

- Version `v1.2.1`: start the next desktop lab profile from `task/v 1.2/v 1.2.1.md`.
- Improve text-editing defaults for Markdown-heavy work.
- Start a black desktop/background lab with glanceable data, including a clock and a market watchlist.
- Add a left-side quick-launch dock with writing, coding, web, and system app clusters.
- Hide battery percentage and make battery-icon hiding best-effort through the lab extension when GNOME Shell exposes a stable actor.
- Add idle protection that keeps work running while dimming/blanking safely and showing a slow moving desktop marker.

## Desired features

- Keep GNOME window controls on the top-left as close, maximize/restore, minimize.
- Keep the Bluetooth battery panel indicator enabled with the current BlueZ and UPower support.
- Keep the Codex usage icon-only panel indicator and detailed menu from v1.1.4.
- Set the desktop background to solid black as the base lab background.
- Configure GNOME Text Editor for fast autosave, session restore, line numbers, wrapping, and Markdown-note work.
- Provide a one-click Markdown note action that creates a timestamped `.md` file and opens it in Text Editor.
- Add a left dock with app clusters for writing, coding, web, and system tools.
- Add a small desktop data panel with a clock and watchlist shortcuts.
- Use GNOME idle, dimming, and break-reminder settings to protect the screen without suspending background work on AC power.
- Create an executable script and clickable GNOME launcher that import the `v1.2.1` profile snapshot.
- Make the project-local `versions/` archive the source of truth for saved launchers.

## Constraints

- Keep work inside this VM desktop lab unless explicitly told otherwise.
- Avoid destructive changes unless explicitly requested.
- Use Git for every completed lab version.
- Update `LAB_DIARY.md` for every committed version.
- Keep this as an importable tuned profile change; do not write live GNOME dconf settings directly.
- Keep workflow folders inside this project unless explicitly told otherwise.

## Must not change

- Do not alter unrelated GNOME app favorites or app grid layout.
- Do not remove existing GNOME extensions from the profile.
- Do not remove the existing Bluetooth battery indicator or Codex usage indicator icon.

## Acceptance checks

- The tuned profile sets `org.gnome.desktop.wm.preferences button-layout` to `close,maximize,minimize:`.
- `bluetooth-battery@young` includes both BlueZ and UPower battery queries.
- The Codex usage top-panel indicator does not show adjacent numeric percentage text.
- The Codex usage menu still shows detailed 5-hour and weekly percentages.
- The icon drawing code uses the 5-hour remaining percent for the outer ring.
- The icon drawing code uses the weekly remaining percent to fill the `C` glyph.
- The tuned profile sets `org.gnome.desktop.background picture-options` to `none`.
- The tuned profile sets both desktop background colors to `#000000`.
- The tuned profile enables `desktop-lab-v12@young`.
- `desktop-lab-v12@young` creates a left dock with a Markdown note action and app clusters.
- `desktop-lab-v12@young` creates a clock/watchlist data panel and a slow moving idle marker.
- GNOME Text Editor autosave, session restore, line numbers, and wrapping are configured in the tuned profile.
- GNOME break reminders and idle delay are configured, while AC inactive sleep remains `nothing`.
- Battery percentage is disabled and the lab extension includes guarded battery-icon hiding.
- Importing `profiles/vm-initial-desktop-task` with `./scripts/import-layout.sh` completes.
- `versions/v1/v1.2/v1.2.1/apply-v1.2.1.sh` exists and is executable.
- `versions/v1/v1.2/v1.2.1/Apply v1.2.1.desktop` exists and is executable.
- The `v1.2.1` version launcher stores a `profile/` snapshot with `gsettings-export.sh`.
- `scripts/install-version-launcher.sh` defaults to the repo-local `versions/` directory.
- Existing project-local launchers do not reference the old home-level versions directory.
- `bluetooth-battery@young` extension bundle packs successfully with `gnome-extensions pack --force`.
- `codex-usage@young` extension bundle packs successfully with `gnome-extensions pack --force`.
- `desktop-lab-v12@young` extension bundle packs successfully with `gnome-extensions pack --force`.
- `./scripts/check-workflow.sh` completes successfully.

## Notes for host apply

- Import `profiles/vm-initial-desktop-task` with `./scripts/import-layout.sh profiles/vm-initial-desktop-task`.
- Log out and back in after import if GNOME Shell does not immediately reload the updated top-panel extension.
