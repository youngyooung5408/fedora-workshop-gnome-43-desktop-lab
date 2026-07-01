# Layout notes

## Keep
- Track the first tuned desktop profile as `profiles/vm-initial-desktop-task`.
- Keep existing enabled extensions and add `bluetooth-battery@young` instead of replacing the extension list.

## Reject
- 

## Maybe
- Test whether Logitech G703 and Keychron devices expose `org.bluez.Battery1` in the real GNOME session.

## VM changes to re-test on host
- Import `profiles/vm-initial-desktop-task`.
- Verify the top-panel Bluetooth battery indicator appears after login.
- Verify window buttons appear at upper right as close, maximize/restore, minimize.

## Extensions involved
- `bluetooth-battery@young`
- `background-logo@fedorahosted.org`
- `codex-usage@young`
