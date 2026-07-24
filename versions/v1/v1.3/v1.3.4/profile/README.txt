This folder is a GNOME layout snapshot exported from the source machine.

Profile changes in this tuned lab version:
- Window controls are placed on the left as close, maximize/restore, minimize.
- The bluetooth-battery@young panel extension is included and enabled; it lists all connected BlueZ devices, merges matching UPower percentages, chooses a device-class icon, and leaves the percentage unavailable when hardware does not publish it.
- The codex-usage@young panel extension uses only an icon in the top panel.
- The Codex usage icon uses an outer 5-hour usage ring and fills the inner C glyph with weekly remaining usage.
- Detailed Codex percentages remain available from the indicator menu.
- The desktop background is a dark marine blue lab surface.
- GNOME Text Editor custom tuning from v1.2.1 is removed, so Text Editor uses the normal profile defaults again.
- The desktop-lab-v12@young extension adds a larger Mac-like grouped app dock, a simplified large wall-clock widget, a visible market board, and a 30-minute animated rest screen.
- The v1.2.8 refinement introduced the shared main-workspace widget layer and the narrow visible slice of the hidden marine dock.
- The v1.2.9 refinement pins the dock after an app cluster is clicked, so its flyout remains usable while the pointer moves away; clicking outside the dock, flyout, or editor dismisses the dock.
- The v1.2.11 refinement hides the dock and disables its left-edge reveal zone while a fullscreen application or game occupies the dock monitor, restoring normal hidden-dock behavior when fullscreen ends.
- The v1.2.13 refinement limits edge reveal to the dock's dynamically sized vertical span, retains fullscreen suppression, and removes the bottom app-grid drag/scroll zone.
- The v1.2.14 fix reads GNOME Shell's authoritative per-monitor `inFullscreen` state, so fullscreen dock suppression does not depend on which window currently has focus.
- The v1.2.15 refinement also suppresses the dock for maximized and left-tiled active windows, while keeping it available beside right-tiled windows and resynchronizing immediately as focus, geometry, or workspace state changes.
- The v1.2.16 repair keeps that suppression policy but uses GNOME Shell's supported actor visibility property, allowing extension startup to complete and restoring the exact v1.2.14 dock, clock, and market presentation.
- The v1.3.1 refinement keeps the accepted presentation while replacing manual overview reparenting with a stable first-workspace background actor that fades for Activities and app search. The dock editor now offers group management, a symbolic icon palette, and installed-app search with real IDs and icons. Market selection now requires a verified structured result from official TWSE/TPEx OpenAPI or Twelve Data, supports a protected user key, migrates legacy symbol lists, and keeps cached prices during temporary failures.
- The v1.3.2 refinement keeps the live clock/market actor stable and uses a disposable non-interactive clone so both widgets remain embedded in the main workspace as Activities zooms it out. Market editing now starts with a pen, exposes inline × removal and an edit-only plus button, searches automatically in a fixed scrolling area, and keeps optional key setup collapsed. GNOME's second bottom overview dash and the Show Applications shortcut are removed while unique running apps appear in a bounded section at the bottom of the custom left dock.
- The v1.3.3 refinement puts that Activities clone beside the full-monitor wallpaper so both scale identically; widens the market panel by 25%, caps and scrolls 10 instruments, matches the chooser width, shows latest price plus currency or an explicit key requirement, restores compact Show Applications access, removes nested running-app scrolling, and dismisses both editors with an outside click.
- The v1.3.4 refinement keeps the Activities clone at its native monitor aspect ratio and applies one shared scale factor on both axes as the overview changes state, so the clock stays circular instead of being squeezed while the compact Show Applications behavior remains unchanged.
- GNOME break reminders and idle dimming are disabled for this tuned profile; the custom rest screen appears without suspending background work and keeps a timer fallback if the Shell idle monitor is unavailable.
- The GNOME favorite-apps list is cleared so the left lab dock is the primary quick launcher.
- Battery percentage is hidden. The desktop-lab-v12@young extension also tries to hide GNOME Shell battery actors when the current Shell version exposes them safely.

Files:
- gsettings-export.sh : replayable GNOME settings commands
- dconf-org-gnome.ini : full /org/gnome/ dconf dump
- extensions/         : copied local shell extensions, if any

To import on another GNOME machine:
  ./scripts/import-layout.sh /home/young/hermes-workspace/gnome-layout-sync-lab/profiles/host-current
