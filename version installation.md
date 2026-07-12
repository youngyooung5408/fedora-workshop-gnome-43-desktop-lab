## version installation
# how i installed
i install by asking the codex cli to look at the github pushed, and i directly install by asking it to follow the version apply on github.
# problem
when i install it direct it to apply the version, it completely covers up the orgiginal settings that i am having, for example the size and stuff. and addition he removes the connected bluetooth device.
a think i have mentioned enough and you get the point, it entirely overwrites the original setup.

# the way to fix

The project now separates two different operations:

1. **Lab restore:** the historical `Apply vA.B.C` launcher still restores the
   complete saved profile so versions can be viewed and compared in the lab.
   This is intentionally destructive and should not be used on the host.
2. **Safe host update:** `./scripts/update-host.sh` selects the latest reviewed
   host manifest, previews changes, and installs only declared project
   extensions and settings. It preserves display size, text scaling, favorite
   apps, unrelated extensions, Bluetooth state, and all other undeclared host
   configuration.

The host updater merges project extension UUIDs into the existing enabled list
instead of replacing that list. Before applying, it creates a backup under
`~/.config/gnome-layout-sync-lab/backups/` and prints a rollback command. A
locally changed managed setting is kept and reported rather than overwritten.
It also backs up and restores GNOME's global user-extension switch if rollback
is needed.

Every host-approved change is recorded as a named feature in
`host-features.json`. A feature owns one exact extension directory or GSettings
key and has immutable revisions. Each release explicitly selects revisions;
unchanged features reuse their prior revision. The launcher generator creates
the version manifest from this explicit entry and never carries an earlier
manifest forward.

The host updater audits live feature contents rather than treating its state
version as proof. It skips identical features, stops on unknown local changes
inside managed extensions, and changes nothing outside the selected release's
registered feature surfaces. The complete VM profile is never synchronized to
the host.

Use `./scripts/update-host.sh --dry-run` to inspect the latest update without
making changes, then run `./scripts/update-host.sh` and confirm the preview.
