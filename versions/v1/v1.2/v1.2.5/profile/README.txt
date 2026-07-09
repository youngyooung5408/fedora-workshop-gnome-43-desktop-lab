This folder is a GNOME layout snapshot exported from the source machine.

Profile changes in this tuned lab version:
- Window controls are placed on the left as close, maximize/restore, minimize.
- The bluetooth-battery@young panel extension is included and enabled, with BlueZ and UPower battery sources.
- The codex-usage@young panel extension uses only an icon in the top panel.
- The Codex usage icon uses an outer 5-hour usage ring and fills the inner C glyph with weekly remaining usage.
- Detailed Codex percentages remain available from the indicator menu.
- The desktop background is a solid black lab surface.
- GNOME Text Editor custom tuning from v1.2.1 is removed, so Text Editor uses the normal profile defaults again.
- The desktop-lab-v12@young extension adds a larger Mac-like middle-left grouped app dock, a simplified large wall-clock overlay, a visible market board, a bottom drag/scroll app-grid zone, and a 30-minute animated rest screen.
- The v1.2.5 refinement removes clock minute tick marks and the extra inner ring, shows month and day on the clock date label, refreshes the clock continuously, changes the dock to pointer wave magnification, opens folder flyouts on click, adds custom drag/drop group reordering, removes visible market update-time/provider labels, and keeps the GNOME Shell idle monitor when available.
- GNOME break reminders and idle dimming are disabled for this tuned profile; the custom rest screen appears without suspending background work and keeps a timer fallback if the Shell idle monitor is unavailable.
- The GNOME favorite-apps list is cleared so the left lab dock is the primary quick launcher.
- Battery percentage is hidden. The desktop-lab-v12@young extension also tries to hide GNOME Shell battery actors when the current Shell version exposes them safely.

Files:
- gsettings-export.sh : replayable GNOME settings commands
- dconf-org-gnome.ini : full /org/gnome/ dconf dump
- extensions/         : copied local shell extensions, if any

To import on another GNOME machine:
  ./scripts/import-layout.sh /home/young/hermes-workspace/gnome-layout-sync-lab/profiles/host-current
