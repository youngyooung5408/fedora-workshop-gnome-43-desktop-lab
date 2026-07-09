This folder is a GNOME layout snapshot exported from the source machine.

Profile changes in this tuned lab version:
- Window controls are placed on the left as close, maximize/restore, minimize.
- The bluetooth-battery@young panel extension is included and enabled, with BlueZ and UPower battery sources.
- The codex-usage@young panel extension uses only an icon in the top panel.
- The Codex usage icon uses an outer 5-hour usage ring and fills the inner C glyph with weekly remaining usage.
- Detailed Codex percentages remain available from the indicator menu.
- The desktop background is a solid black lab surface.
- GNOME Text Editor is tuned for Markdown-heavy work with fast autosave, session restore, line numbers, spellcheck, wrapping, and a Markdown notes directory.
- The desktop-lab-v12@young extension adds a left quick-launch dock, a one-click Markdown note action, a clock/watchlist overlay, and a slow moving idle marker.
- GNOME idle and break-reminder settings are enabled to dim/blank and remind without suspending background work on AC power.
- Battery percentage is hidden. The desktop-lab-v12@young extension also tries to hide GNOME Shell battery actors when the current Shell version exposes them safely.

Files:
- gsettings-export.sh : replayable GNOME settings commands
- dconf-org-gnome.ini : full /org/gnome/ dconf dump
- extensions/         : copied local shell extensions, if any

To import on another GNOME machine:
  ./scripts/import-layout.sh /home/young/hermes-workspace/gnome-layout-sync-lab/profiles/host-current
