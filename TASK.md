# Desktop Lab Task

Update this file before asking Codex to work on the VM desktop layout.
Codex should read this file at the start of each desktop customization task.

## Current request

- Create the first tuned VM desktop profile from the initial desktop setup notes in `/home/sdafsaasd/task.md`.

## Desired features

- Add a GNOME top-panel indicator for Bluetooth device battery status.
- Track connected Bluetooth devices that expose a battery percentage, especially a Logitech G703 mouse and a Keychron keyboard.
- Put GNOME window controls at the upper right in this order: close, maximize/restore, minimize.

## Constraints

- Keep work inside this VM desktop lab unless explicitly told otherwise.
- Avoid destructive changes unless explicitly requested.
- Use Git for every completed lab version.
- Update `LAB_DIARY.md` for every committed version.
- The Codex sandbox cannot write live GNOME dconf settings directly, so create a tuned profile that can be imported from a normal desktop session.

## Must not change

- Do not alter unrelated GNOME app favorites or app grid layout.
- Do not remove existing GNOME extensions from the profile.

## Acceptance checks

- Tuned profile includes `org.gnome.desktop.wm.preferences button-layout` set to `:close,maximize,minimize`.
- Tuned profile enables `bluetooth-battery@young`.
- Tuned profile contains the `bluetooth-battery@young` extension files.
- Extension bundle packs successfully with `gnome-extensions pack --force`.
- Tuned profile `gsettings-export.sh` is valid Bash syntax.

## Notes for host apply

- Import `profiles/vm-initial-desktop-task` with `./scripts/import-layout.sh profiles/vm-initial-desktop-task`.
- Log out and back in after import if GNOME Shell does not immediately load the new extension or window button order.
