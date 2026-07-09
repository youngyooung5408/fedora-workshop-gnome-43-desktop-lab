This folder is a GNOME layout snapshot exported from the source machine.

Profile changes in this tuned lab version:
- Window controls are placed on the left as close, maximize/restore, minimize.
- The bluetooth-battery@young panel extension is included and enabled, with BlueZ and UPower battery sources.
- The codex-usage@young panel extension uses only an icon in the top panel.
- The Codex usage icon uses an outer 5-hour usage ring and fills the inner C glyph with weekly remaining usage.
- Detailed Codex percentages remain available from the indicator menu.
- The desktop background is a solid black lab surface.
- GNOME Text Editor custom tuning from v1.2.1 is removed, so Text Editor uses the normal profile defaults again.
- The desktop-lab-v12@young extension adds a larger middle-left grouped app dock, a simple wall-clock overlay, a visible market board, a bottom drag/scroll app-grid zone, and a 30-minute animated rest screen.
- The v1.2.3 aesthetic pass applies the project preference for calm Apple-like visual polish: neutral translucent surfaces, restrained typography, subtle hover states, and low-saturation rest-screen motion.
- GNOME break reminders and idle dimming are disabled for this tuned profile; the custom rest screen appears without suspending background work.
- The GNOME favorite-apps list is cleared so the left lab dock is the primary quick launcher.
- Battery percentage is hidden. The desktop-lab-v12@young extension also tries to hide GNOME Shell battery actors when the current Shell version exposes them safely.

Files:
- gsettings-export.sh : replayable GNOME settings commands
- dconf-org-gnome.ini : full /org/gnome/ dconf dump
- extensions/         : copied local shell extensions, if any

To import on another GNOME machine:
  ./scripts/import-layout.sh /home/young/hermes-workspace/gnome-layout-sync-lab/profiles/host-current
