# GNOME Layout Sync Lab

Use a GNOME Boxes VM as a safe layout lab:

1. export this computer's GNOME layout
2. import it into a Fedora GNOME VM
3. change the layout inside the VM
4. export the VM layout
5. apply the changed layout back onto this computer

## What this project is for

This project is for the exact workflow you asked for:
- start from the current layout of this computer
- customize it in the VM/app environment
- overwrite the host layout when you like the result

## Important limitation

GNOME Boxes itself is only the VM container.
The actual layout data comes from GNOME settings and extensions.
So this project moves settings between host and VM for you.

## Files

- `TASK.md` - user-maintained task list and feature requests for Codex
- `LAB_DIARY.md` - readable version diary for every committed lab version
- `scripts/export-host-layout.sh` — dump the current host GNOME layout
- `scripts/import-layout.sh` — load a dumped layout onto the current machine/VM
- `scripts/export-current-layout.sh` — export the current machine/VM layout to a chosen folder
- `scripts/apply-to-host.sh` — apply a chosen dump back onto the host
- `profiles/host-current/` — current exported host snapshot
- `notes.md` — keep/reject/maybe notes while testing in the VM

## Codex Workflow

This workflow is meant to survive across Codex conversations.

1. User updates `TASK.md` with the desired desktop changes, feature ideas, constraints, and anything that must not change.
2. Codex reads `TASK.md`, inspects the current VM/lab state, and makes the requested desktop layout or lab file changes.
3. Codex verifies the result as far as possible inside the VM.
4. Codex updates `LAB_DIARY.md` with the new version entry:
   - version label
   - task summary
   - files, settings, or profiles changed
   - features included in the version
   - verification result
   - known limits or follow-up items
5. Codex commits the changed lab files to Git.
6. Codex reports the version label, commit hash, changed files, and verification result back to the user.

A lab version is one Git commit on `main`.
The Git history is the exact record; `LAB_DIARY.md` is the readable summary for checking from this VM or from the host.
The exact commit hash for a diary entry is reported after the commit and can always be checked with `git log`.

## Version Control

This lab is a Git repository.
Use Git for exact file history and `LAB_DIARY.md` for a readable summary of total updates.

The `profiles/` exports are ignored by default except for `profiles/.gitkeep`, because exported desktop profiles can be machine-specific snapshots.
Record important profile exports in `LAB_DIARY.md` when they matter.

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

### Back on the host
After copying `profiles/vm-tuned/` back to the host:
```bash
./scripts/apply-to-host.sh profiles/vm-tuned
```

Then log out and back in if needed.

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

Applying a VM-tuned profile back to the host will overwrite GNOME settings in the covered areas.
Back up first if you care about the current state.
