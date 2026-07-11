This folder is a GNOME layout snapshot exported from the source machine.

Profile changes in this tuned lab version:
- Window controls are placed on the left as close, maximize/restore, minimize.
- The bluetooth-battery@young panel extension is included and enabled, with BlueZ and UPower battery sources.
- The codex-usage@young panel extension uses only an icon in the top panel.
- The Codex usage icon uses an outer 5-hour usage ring and fills the inner C glyph with weekly remaining usage.
- Detailed Codex percentages remain available from the indicator menu.
- The desktop background is a dark marine blue lab surface.
- GNOME Text Editor custom tuning from v1.2.1 is removed, so Text Editor uses the normal profile defaults again.
- The desktop-lab-v12@young extension adds a larger Mac-like grouped app dock, a simplified large wall-clock widget, a visible market board, a bottom drag/scroll app-grid zone, and a 30-minute animated rest screen.
- The v1.2.8 refinement keeps the clock and stock widgets in one main-workspace background layer, reparents that layer into the Shell overview workspace background so it moves and shrinks with the workspace, and retains a guarded manual transform fallback. The hidden left dock now leaves a narrow slice of its actual marine surface visible and uses a longer transform animation to slide in and out instead of popping into place.
- The v1.2.9 refinement pins the dock after an app cluster is clicked, so its flyout remains usable while the pointer moves away; clicking outside the dock, flyout, or editor dismisses the dock.
- GNOME break reminders and idle dimming are disabled for this tuned profile; the custom rest screen appears without suspending background work and keeps a timer fallback if the Shell idle monitor is unavailable.
- The GNOME favorite-apps list is cleared so the left lab dock is the primary quick launcher.
- Battery percentage is hidden. The desktop-lab-v12@young extension also tries to hide GNOME Shell battery actors when the current Shell version exposes them safely.

Files:
- gsettings-export.sh : replayable GNOME settings commands
- dconf-org-gnome.ini : full /org/gnome/ dconf dump
- extensions/         : copied local shell extensions, if any

To import on another GNOME machine:
  ./scripts/import-layout.sh /home/young/hermes-workspace/gnome-layout-sync-lab/profiles/host-current
