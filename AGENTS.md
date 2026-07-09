# Workspace Workflow Notes

## Aesthetic Direction

- Read `aesthetic preference.md` before making desktop, UI, layout, or visual feature changes.
- Treat `aesthetic preference.md` as the default visual source of truth unless a newer user instruction overrides it.
- Keep future feature work aligned with the Apple-like aesthetic described there: calm, spacious, restrained, functional, and polished.

## Versioning

- Read `task/version.md` before changing release or task version metadata.
- Use version format `v a.b.c`.
- `a` is the total/major version for large overall updates.
- `b` is the task update version for smaller updates tied to specific tasks.
- `c` is the minor fix version for task-level fixes.
- If `task/version.md` is updated with more specific version workflow rules, follow that file as the source of truth.
- After every version update using `v a.b.c`, record the matching lab diary Markdown update for that version before considering the version workflow complete.
