# Workspace Workflow Notes

## Aesthetic Direction

- Read `aesthetic preference.md` before making desktop, UI, layout, or visual feature changes.
- Treat `aesthetic preference.md` as the default visual source of truth unless a newer user instruction overrides it.
- When a newer user instruction or accepted result conflicts with the current aesthetic direction, update `aesthetic preference.md` so it records the user's current preference.
- When a new task introduces a durable key visual, interaction, or desktop feature, add a concise note to `aesthetic preference.md` before considering the workflow complete.
- Keep future feature work aligned with the Apple-like aesthetic described there: calm, spacious, restrained, functional, and polished.

## Versioning

- Read `task/version.md` before changing release or task version metadata.
- Use version format `v a.b.c`.
- `a` is the total/major version for large overall updates.
- `b` is the task update version for smaller updates tied to specific tasks.
- `c` is the minor fix version for task-level fixes.
- If `task/version.md` is updated with more specific version workflow rules, follow that file as the source of truth.
- After every version update using `v a.b.c`, record the matching lab diary Markdown update for that version before considering the version workflow complete.
- Every new version launcher must contain a `host-manifest.json` generated from an explicit release entry in `host-features.json`. Never carry a previous manifest forward automatically. Reuse unchanged feature revision identifiers and add a new revision only for a feature that actually changed.
- After a new lab version is finished and its launcher is generated, automatically apply that launcher in the lab VM and verify `lab -version` reports the new version. Do not leave the VM on an older finished version unless the user explicitly asks to defer or skip application.
- Never apply a version launcher, `scripts/import-layout.sh`, or `scripts/apply-to-host.sh` to the host during a normal host update. On the host, use only `scripts/update-host.sh --dry-run` followed by `scripts/update-host.sh`.
- After committing a completed lab version, run `git push` to the configured remote. If the push fails because the remote or authentication is unavailable, report that the commit remains local.
