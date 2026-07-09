# Desktop Lab Task

Update this file before asking Codex to work on the VM desktop layout.
Codex should read this file at the start of each desktop customization task.

## Current request

- Version `v1.2.3`: test the new `aesthetic preference.md` guidance against the existing desktop lab profile from `v1.2.2`.
- Keep the v1.2.2 behavior and feature set intact.
- Refine the desktop-lab overlay so the dock, wall clock, market board, app-grid drag zone, and 30-minute rest screen feel calm, spacious, restrained, and Apple-like.
- Keep the solid black lab background as the base surface.
- Keep the Bluetooth battery panel indicator and Codex usage indicator.

## Desired features

- Keep GNOME window controls on the top-left as close, maximize/restore, minimize.
- Keep the Bluetooth battery panel indicator enabled with the current BlueZ and UPower support.
- Keep the Codex usage icon-only panel indicator and detailed menu from v1.1.4.
- Set the desktop background to solid black as the base lab background.
- Do not apply custom GNOME Text Editor autosave, session restore, line number, wrapping, dark style, or Markdown notes directory settings.
- Add a larger middle-left dock with app clusters for writing, coding, web, system tools, and application-grid access.
- Add a simple circular wall-clock overlay near the upper middle of the desktop.
- Add a visible market board for common symbols without opening a browser on click.
- Add a bottom edge drag/scroll zone that opens the GNOME application grid when supported by the current Shell API.
- Show an animated rest screen after 30 minutes of no input while keeping background work running.
- Apply the `aesthetic preference.md` direction with neutral translucent surfaces, restrained text weights, subtle hover/focus states, and low-saturation motion.
- Avoid decorative rainbow, blue/teal-heavy, or flashy visual treatment.
- Create an executable script and clickable GNOME launcher that import the `v1.2.3` profile snapshot.
- Make the project-local `versions/` archive the source of truth for saved launchers.

## Constraints

- Keep work inside this VM desktop lab unless explicitly told otherwise.
- Avoid destructive changes unless explicitly requested.
- Use Git for every completed lab version.
- Update `LAB_DIARY.md` for every committed version.
- Keep this as an importable tuned profile change; do not write live GNOME dconf settings directly except through the import workflow.
- Keep workflow folders inside this project unless explicitly told otherwise.

## Must not change

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
- The tuned profile does not set `org.gnome.TextEditor` custom settings.
- The tuned profile sets `org.gnome.shell favorite-apps` to an empty array.
- `scripts/import-layout.sh` applies `favorite-apps` from the tuned profile while still skipping app-grid ordering.
- `desktop-lab-v12@young` creates a larger vertically centered left dock with grouped app clusters.
- `desktop-lab-v12@young` creates a circular wall-clock overlay near the upper middle of the desktop.
- `desktop-lab-v12@young` creates a visible market board instead of clickable quote URL chips.
- `desktop-lab-v12@young` creates a guarded bottom drag/scroll zone for opening the app grid.
- `desktop-lab-v12@young` creates a 30-minute animated rest screen instead of a small moving idle marker.
- `desktop-lab-v12@young` applies the `aesthetic preference.md` direction with neutral translucent surfaces and restrained typography.
- The v1.2.3 stylesheet does not use the old saturated blue hover accent or teal gesture-zone accent.
- The v1.2.3 animated rest screen uses low-saturation neutral motion instead of blue/green diagonal lines.
- The v1.2.3 rest screen label is concise and polished.
- GNOME break reminders and idle dimming are disabled for this tuned profile.
- AC and battery inactive sleep remain `nothing` so the VM does not suspend background work.
- Battery percentage is disabled and the lab extension includes guarded battery-icon hiding.
- Importing `profiles/vm-initial-desktop-task` with `./scripts/import-layout.sh` completes.
- `versions/v1/v1.2/v1.2.3/apply-v1.2.3.sh` exists and is executable.
- `versions/v1/v1.2/v1.2.3/Apply v1.2.3.desktop` exists and is executable.
- The `v1.2.3` version launcher stores a `profile/` snapshot with `gsettings-export.sh`.
- `scripts/install-version-launcher.sh` defaults to the repo-local `versions/` directory.
- Existing project-local launchers do not reference the old home-level versions directory.
- `bluetooth-battery@young` extension bundle packs successfully with `gnome-extensions pack --force`.
- `codex-usage@young` extension bundle packs successfully with `gnome-extensions pack --force`.
- `desktop-lab-v12@young` extension bundle packs successfully with `gnome-extensions pack --force`.
- `./scripts/check-workflow.sh` completes successfully.

## Notes for host apply

- Import `profiles/vm-initial-desktop-task` with `./scripts/import-layout.sh profiles/vm-initial-desktop-task`.
- Log out and back in after import if GNOME Shell does not immediately reload the updated top-panel extension.
