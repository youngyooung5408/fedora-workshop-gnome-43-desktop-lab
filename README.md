# GNOME Layout Sync Lab

Use a GNOME Boxes VM as a safe layout lab:

1. export this computer's GNOME layout
2. import it into a Fedora GNOME VM
3. change the layout inside the VM
4. export the VM layout for version history and comparison
5. use the safe host updater to install reviewed project features

## What this project is for

This project supports two deliberately separate workflows:
- start from the current layout of this computer
- customize it in the VM/app environment
- keep exact lab snapshots for visual comparison
- update the host without overwriting its unrelated settings

## Important limitation

GNOME Boxes itself is only the VM container.
The actual layout data comes from GNOME settings and extensions.
So this project moves settings between host and VM for you.

## Files

- `TASK.md` - user-maintained task list and feature requests for Codex
- `aesthetic preference.md` - living visual preference source for desktop, UI, layout, and feature decisions
- `LAB_DIARY.md` - readable version diary for every committed lab version
- `scripts/export-host-layout.sh` — dump the current host GNOME layout
- `scripts/import-layout.sh` — load a dumped layout onto the current machine/VM
- `scripts/export-current-layout.sh` — export the current machine/VM layout to a chosen folder
- `scripts/apply-to-host.sh` — apply a chosen dump back onto the host
- `scripts/update-host.sh` — preview, back up, and safely install the latest host manifest
- `scripts/check-workflow.sh` — verify workflow documents, scripts, tracked profiles, project-local versions, and extension bundles
- `scripts/install-version-launcher.sh` — create clickable `versions/vA/vA.B/vA.B.C/` launchers
- `scripts/install-lab-command.sh` — install the VM-only `lab -version` command
- `profiles/host-current/` — current exported host snapshot
- `profiles/vm-initial-desktop-task/` — tracked tuned profile for the first desktop customization task
- `notes.md` — keep/reject/maybe notes while testing in the VM

## Codex Workflow

This workflow is meant to survive across Codex conversations.

1. User updates `TASK.md` with the desired desktop changes, feature ideas, constraints, and anything that must not change.
2. Codex reads `TASK.md`, `task/version.md`, and `aesthetic preference.md`, then inspects the current VM/lab state.
3. Codex compares newer user preferences and accepted results against `aesthetic preference.md`. If they differ from the current aesthetic direction, Codex updates `aesthetic preference.md` so later work follows the user's latest preference.
4. When a new task introduces durable key visual, interaction, or desktop features, Codex adds concise notes for those features to `aesthetic preference.md` before considering the workflow complete.
5. Codex makes the requested desktop layout or lab file changes.
6. Codex imports the changed profile into this VM when the task is ready for live desktop testing:
   ```bash
   ./scripts/import-layout.sh profiles/vm-initial-desktop-task
   ```
7. Codex explicitly records the release's host feature revisions in
   `host-features.json`, then installs the project-local clickable version
   launcher:
   ```bash
   ./scripts/install-version-launcher.sh v1.1.2 profiles/vm-initial-desktop-task
   ```
   The generator stages the new directory, copies the VM snapshot, and creates
   an immutable host manifest from that exact registry entry. It refuses to
   overwrite old versions and never carries a previous manifest forward.
8. Codex automatically applies the newly generated launcher in the lab VM, then verifies that `lab -version` reports the new version. Application is skipped only when the user explicitly asks to defer it:
   ```bash
   ./versions/v1/v1.1/v1.1.2/apply-v1.1.2.sh < /dev/null
   lab -version
   ```
9. Codex runs the acceptance checks listed in `TASK.md` and the workflow verifier:
   ```bash
   ./scripts/check-workflow.sh
   ```
10. Codex updates `LAB_DIARY.md` with the new version entry:
   - version label
   - task summary
   - files, settings, or profiles changed
   - features included in the version
   - verification result
   - known limits or follow-up items
11. Codex commits the changed lab files to Git.
12. Codex pushes the completed commit to the configured Git remote:
   ```bash
   git push
   ```
   If the remote or authentication is unavailable, Codex reports the push failure and leaves the commit local.
13. Codex reports the version label, commit hash, changed files, launcher application result, authoritative `lab -version`, project-local launcher path, verification result, and push result back to the user.

A lab version is one Git commit on `main`, pushed to the configured remote when available.
The Git history is the exact record; `LAB_DIARY.md` is the readable summary for checking from this VM or from the host.
The exact commit hash for a diary entry is reported after the commit and can always be checked with `git log`.

## Version Control

This lab is a Git repository.
Use Git for exact file history and `LAB_DIARY.md` for a readable summary of total updates.

The `profiles/` exports are ignored by default except for `profiles/.gitkeep`, because exported desktop profiles can be machine-specific snapshots.
Record important profile exports in `LAB_DIARY.md` when they matter.
Curated version launcher snapshots under `versions/` are tracked so each saved VM lab version travels with the repo.

## Version Launchers

> **Lab restore warning:** Version launchers reproduce an exact saved lab layout.
> They can overwrite GNOME settings and must not be used as the normal host
> updater. Use `./scripts/update-host.sh` on the host instead.

Clickable VM layout version launchers live inside this Git repo under `versions/`.
The hierarchy is:

```text
versions/vA/vA.B/vA.B.C/
```

For example, version `v1.1.2` is installed at:

```text
/home/sdafsaasd/Downloads/gnome-layout-sync-lab/versions/v1/v1.1/v1.1.2/
```

Each version folder contains:
- `profile/` - a snapshot copy of the importable GNOME profile
- `apply-vA.B.C.sh` - executable shell script
- `Apply vA.B.C.desktop` - clickable GNOME Files launcher
- `README.md` - notes for that version launcher

## Current Lab Version

Install the VM-only version query command once:

```bash
./scripts/install-lab-command.sh
```

Then check the last successfully applied saved layout with either form:

```bash
lab -version
lab --version
```

Every project-local `apply-vA.B.C.sh` launcher records its version only after
the layout import succeeds. Applying an older launcher updates the command to
report that older version. Direct manual imports do not claim a saved version.
The command and its per-user state are for the lab VM only and are not installed
by the safe host updater.

## Recommended flow

### On the host
```bash
cd /home/young/hermes-workspace/gnome-layout-sync-lab
./scripts/export-host-layout.sh
```

This creates a snapshot in `profiles/host-current/`.

### Move the project into the VM
Copy this project folder into the VM using shared folders, git, or a copied archive.

### Inside the VM
```bash
cd ~/gnome-layout-sync-lab
./scripts/import-layout.sh profiles/host-current
```

Then log out and back in if GNOME Shell does not fully refresh.

Make your layout changes in the VM.

When done:
```bash
./scripts/export-current-layout.sh profiles/vm-tuned
```

### Apply the initial tuned profile in the VM
```bash
cd ~/gnome-layout-sync-lab
./scripts/import-layout.sh profiles/vm-initial-desktop-task
```

This tuned profile enables the Bluetooth battery panel indicator and sets
window controls to the upper-left order `close`, `maximize/restore`,
`minimize`.

### Back on the host
After pulling the latest project version:
```bash
./scripts/update-host.sh --dry-run
./scripts/update-host.sh
```

This is the permanent host-install path for every version. Do not run an
`Apply vA.B.C` launcher, `scripts/import-layout.sh`, or
`scripts/apply-to-host.sh` for a normal host update.

The updater chooses the latest registered host release unless `--version` is
given. It audits only that release's named feature surfaces, skips identical
payloads, blocks unknown local extension modifications, previews exact changes,
creates a rollback backup, and preserves everything outside the registry. It
prints the exact rollback command after a successful update.

The full VM profile is never a host target. `host-features.json` is the source
of truth for which extension directory or individual GSettings key each feature
may change and which feature revision belongs to every host release.

`scripts/apply-to-host.sh` and the version launchers remain available for exact
lab restoration and comparison, but they are intentionally destructive.

## Scope of what is captured

This project captures:
- GNOME desktop interface settings
- shell settings
- mutter/workspace settings
- window manager preferences
- background settings
- favorite apps
- enabled extensions
- local user extensions (copied when present)

## Caution

Applying a VM-tuned profile or lab version launcher overwrites GNOME settings
in the covered areas. For normal host installation, use `scripts/update-host.sh`.
