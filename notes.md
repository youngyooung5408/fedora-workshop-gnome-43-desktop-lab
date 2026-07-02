# Layout notes

## Keep
- Track the first tuned desktop profile as `profiles/vm-initial-desktop-task`.
- Keep existing enabled extensions and add `bluetooth-battery@young` instead of replacing the extension list.
- Keep the Codex usage panel icon, with the `C` icon carrying the 5-hour and weekly remaining-usage state.
- Keep detailed Codex usage percentages in the indicator menu instead of next to the top-panel icon.

## Reject
- 

## Maybe
- Test whether Logitech G703 and Keychron devices expose `org.bluez.Battery1` in the real GNOME session.

## VM changes to re-test on host
- Import `profiles/vm-initial-desktop-task`.
- Verify the top-panel Bluetooth battery indicator appears after login.
- Verify window buttons appear at upper left as close, maximize/restore, minimize.
- Verify the Codex usage indicator shows only the icon in the top panel after login.
- Verify the Codex usage indicator shows an outer 5-hour ring and inner weekly C reservoir after login.

## Extensions involved
- `bluetooth-battery@young`
- `background-logo@fedorahosted.org`
- `codex-usage@young`
