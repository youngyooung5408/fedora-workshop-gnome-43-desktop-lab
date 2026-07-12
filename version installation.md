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

Every newly generated version automatically carries forward the most recent
reviewed `host-manifest.json`. The workflow verifier fails if the newest version
does not have a valid manifest. This makes the safe updater the standard path
for later versions, while still allowing the manifest to be deliberately
reviewed when a version adds or removes a managed extension or extension-only
setting.

Use `./scripts/update-host.sh --dry-run` to inspect the latest update without
making changes, then run `./scripts/update-host.sh` and confirm the preview.
