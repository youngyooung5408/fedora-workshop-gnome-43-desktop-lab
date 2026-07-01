# Lab Diary

Readable version diary for the GNOME layout sync lab.
Git is the exact file history; this file explains what each lab version is for.

## Version Format

Each version entry should include:
- date and time
- version label
- task summary
- files, desktop settings, or profiles changed
- features included in the version
- verification result
- known limits or follow-up items

The exact Git commit hash is reported after each version is committed and can be checked with `git log`.
A diary entry does not embed its own final commit hash because changing the file would change the hash again.

## Versions

### 2026-07-01 18:42 JST - Workflow files and Git version process

- Version label: workflow-files-and-git-version-process.
- Task summary: make the Codex desktop customization workflow persistent across conversations.
- Changed files:
  - `README.md`
  - `TASK.md`
  - `LAB_DIARY.md`
- Features included:
  - Added `TASK.md` as the user-maintained task input file.
  - Added `LAB_DIARY.md` as the readable version diary.
  - Defined one Git commit on `main` as one lab version.
  - Defined the repeatable workflow: read task, update desktop/lab, verify, write diary, commit, report version.
- Verification:
  - `README.md`, `TASK.md`, and `LAB_DIARY.md` were read back after editing.
  - Final Git commit hash is reported by Codex after commit.
- Known limits:
  - No desktop layout setting was changed in this version; this version only formalizes the workflow.

### 2026-07-01 - Initial lab setup

- Commit: `13127b3`.
- Task summary: initialize the VM desktop customization lab.
- Changed files:
  - `.gitignore`
  - `README.md`
  - `notes.md`
  - `profiles/.gitkeep`
  - `scripts/apply-to-host.sh`
  - `scripts/export-current-layout.sh`
  - `scripts/export-host-layout.sh`
  - `scripts/import-layout.sh`
- Features included:
  - Established this VM as the desktop customization lab environment.
  - Initialized Git version control on branch `main`.
  - Added scripts for exporting, importing, and applying GNOME layout profiles.
  - Ignored exported profile snapshots by default while keeping the `profiles/` directory.
- Verification:
  - Git repository initialized successfully.
  - Initial commit created successfully.
- Known limits:
  - Exported profile snapshots are not tracked by Git unless the ignore policy is changed.
