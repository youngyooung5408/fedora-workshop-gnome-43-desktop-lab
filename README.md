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

- `scripts/export-host-layout.sh` — dump the current host GNOME layout
- `scripts/import-layout.sh` — load a dumped layout onto the current machine/VM
- `scripts/export-current-layout.sh` — export the current machine/VM layout to a chosen folder
- `scripts/apply-to-host.sh` — apply a chosen dump back onto the host
- `profiles/host-current/` — current exported host snapshot
- `notes.md` — keep/reject/maybe notes while testing in the VM

## Version Control

This lab is a Git repository.
Use Git for exact file history and this README diary for a readable summary of total updates.

The `profiles/` exports are ignored by default except for `profiles/.gitkeep`, because exported desktop profiles can be machine-specific snapshots.
Record important profile exports in the Lab Diary when they matter.

## Lab Diary

Use this section as the running diary for desktop customization work.
Every change made by the assistant in this lab should add an entry here with:
- date and time
- files or settings changed
- reason for the change
- test or verification result, when available

### 2026-07-01

- Agreed that this VM is the desktop customization lab environment.
- Agreed that the assistant can use full VM permissions for lab work while avoiding destructive actions unless explicitly requested.
- Started using this README as the lab diary for future desktop customization changes.
- Initialized this lab as a Git repository for version control.
- Clarified that Git keeps exact file history while this README summarizes total updates for easier checking from the VM or host.

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
