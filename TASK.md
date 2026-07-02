# Desktop Lab Task

Update this file before asking Codex to work on the VM desktop layout.
Codex should read this file at the start of each desktop customization task.

## Current request

- Version `v 1.1.4`: final minor cleanup for the tuned VM desktop profile.
- Add a clickable VM version launcher for `v1.1.4` under `/home/sdafsaasd/versions/v1/v1.1/v1.1.4/`.
- Source task file: `/home/sdafsaasd/task/v 1.2/v 1.1.4.md`.
- Note: `/home/sdafsaasd/task/v 1.1/v 1.1.4.md` was empty; the completed task note was found under `task/v 1.2/`.

## Desired features

- Keep GNOME window controls on the top-left as close, maximize/restore, minimize.
- Keep the Bluetooth battery panel indicator enabled with the current BlueZ and UPower support.
- Remove the numeric Codex usage percentage text from the GNOME top panel.
- Keep the 5-hour usage window as the outer circular remaining-usage ring.
- Make the weekly usage window fill the inner `C` glyph itself as the reservoir.
- Keep detailed Codex usage percentages available in the indicator menu.
- Create an executable script and clickable GNOME launcher that import the `v1.1.4` profile snapshot.

## Constraints

- Keep work inside this VM desktop lab unless explicitly told otherwise.
- Avoid destructive changes unless explicitly requested.
- Use Git for every completed lab version.
- Update `LAB_DIARY.md` for every committed version.
- Keep this as an importable tuned profile change; do not write live GNOME dconf settings directly.

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
- Importing `profiles/vm-initial-desktop-task` with `./scripts/import-layout.sh` completes.
- `/home/sdafsaasd/versions/v1/v1.1/v1.1.4/apply-v1.1.4.sh` exists and is executable.
- `/home/sdafsaasd/versions/v1/v1.1/v1.1.4/Apply v1.1.4.desktop` exists and is executable.
- The `v1.1.4` version launcher stores a `profile/` snapshot with `gsettings-export.sh`.
- `bluetooth-battery@young` extension bundle packs successfully with `gnome-extensions pack --force`.
- `codex-usage@young` extension bundle packs successfully with `gnome-extensions pack --force`.
- `./scripts/check-workflow.sh` completes successfully.

## Notes for host apply

- Import `profiles/vm-initial-desktop-task` with `./scripts/import-layout.sh profiles/vm-initial-desktop-task`.
- Log out and back in after import if GNOME Shell does not immediately reload the updated top-panel extension.
