This folder is a GNOME layout snapshot exported from the source machine.

Profile changes in this tuned lab version:
- Window controls are placed on the right as close, maximize/restore, minimize.
- The bluetooth-battery@young panel extension is included and enabled.

Files:
- gsettings-export.sh : replayable GNOME settings commands
- dconf-org-gnome.ini : full /org/gnome/ dconf dump
- extensions/         : copied local shell extensions, if any

To import on another GNOME machine:
  ./scripts/import-layout.sh /home/young/hermes-workspace/gnome-layout-sync-lab/profiles/host-current
