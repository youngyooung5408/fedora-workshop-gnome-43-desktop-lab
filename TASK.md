# Desktop Lab Task

Update this file before asking Codex to work on the VM desktop layout.
Codex should read this file at the start of each desktop customization task.

## Current request

- Version `v1.2.17`: replace coarse automatically carried host manifests with an explicit feature registry, make host updates content-aware and version-selectable, preserve everything outside registered feature surfaces, and add the previously omitted `close`, `maximize/restore`, `minimize` window-button order as a single managed GSettings feature.
- Version `v1.2.16`: restore the exact v1.2.14 dock, clock, and market presentation while retaining v1.2.15's maximized/left-tiled dock suppression; repair the extension startup error that left those actors partially initialized, and guard against another unintended presentation regression.
- Version `v1.2.15`: preserve fullscreen suppression, suppress the left dock for maximized and left-tiled active windows on the dock monitor, keep it available beside right-tiled windows, and immediately reevaluate focus, geometry, and workspace changes.
- Version `v1.2.14`: fix the remaining v1.2.13 fullscreen dock problem by using GNOME Shell's authoritative per-monitor fullscreen state instead of relying on the focused window fallback.
- Version `v1.2.13`: keep fullscreen dock suppression, restrict left-edge reveal to the dock's dynamically sized vertical bounds as dock groups change, and remove the bottom app-grid drag/scroll zone.
- Version `v1.2.12`: add an authoritative VM-only current-version tracker. Both
  `lab -version` and `lab --version` report the last successfully applied saved
  lab launcher, including when an older version is restored.
- Version `v1.2.11`: suppress the left dock and its edge reveal zone while a fullscreen application or game occupies the dock's monitor, then restore normal hidden-dock behavior after fullscreen ends.
- Version `v1.2.10`: separate exact lab restoration from safe host installation.
- Keep historical version launchers unchanged as exact lab snapshots for
  comparing features across versions.
- Add a latest-version host updater driven by an explicit reviewed manifest.
- Preserve host scaling, sizing, unrelated settings and extensions, local
  managed-setting customizations, and Bluetooth state.
- Preview and confirm changes, create a rollback backup, and support dry runs.

- Version `v1.2.9`: refine the desktop-lab left dock from `v1.2.8` using the completed task note at `task/v 1.2/v 1.2.9.md`.
- Keep the v1.2.7 behavior and feature set intact unless this task explicitly refines it.
- Keep the clock and stock widgets in one main-workspace background layer and reparent that layer into the active overview workspace background so Shell moves and shrinks both widgets with the background.
- Show the clock and stock widgets only on the main workspace and leave other workspaces visually empty.
- Keep the left dock as Shell-level chrome that can appear on every workspace, but hide it until the pointer reaches the left edge.
- Remove the clock second hand and add 12 simple hourly scale dots.
- Keep the stock panel simple, but improve the chooser with preset buttons and reliable add/remove updates.
- Simplify the left dock and app flyouts by removing category words, visible app descriptions, the "Apps" title wording, and extra nested margin boxes, while making opened app flyout icons larger.
- Replace the solid black lab background with a dark marine blue surface.
- Leave a narrow slice of the actual left dock visible when hidden, remove the separate shadow-like hint, and use a longer transform animation so the dock visibly slides from that silhouette.
- Add a compact UI path for editing dock groups and adding app desktop IDs, saved in the user config directory.
- Keep the Bluetooth battery panel indicator and Codex usage indicator.

## Desired features

- Keep GNOME window controls on the top-left as close, maximize/restore, minimize.
- Keep the Bluetooth battery panel indicator enabled with the current BlueZ and UPower support.
- Keep the Codex usage icon-only panel indicator and detailed menu from v1.1.4.
- Set the desktop background to dark marine blue as the base lab background.
- Do not apply custom GNOME Text Editor autosave, session restore, line number, wrapping, dark style, or Markdown notes directory settings.
- Add a larger middle-left dock with app clusters for writing, coding, web, system tools, and application-grid access.
- Hide the left dock by default and reveal it from the left screen edge while keeping it available on every workspace.
- Add a Mac-like interactive middle-left dock with pointer wave magnification and click-open folder flyouts for app clusters.
- Add custom drag/drop reordering for the left dock groups, accepting that this personal extension path may rely on less stable Shell behavior.
- Keep the dock and app flyouts icon-only and visually transparent, without category words, app descriptions, or "Apps" title wording, while showing larger app buttons after a cluster opens.
- Keep a narrow slice of the actual marine dock surface visible when hidden and use smooth transform-based reveal/hide animation.
- Add a compact dock editor for creating dock groups and adding app desktop IDs, with edited groups saved in `~/.config/desktop-lab-v12/dock-groups.json`.
- Add a larger simple circular wall-clock widget near the upper middle of the main workspace background.
- Embed the shared clock and market layer into the main overview workspace background so Shell applies the same movement, scale, and clipping as the background; keep a guarded manual transform fallback for other Shell layouts.
- Remove clock minute tick scales, remove the second hand, add 12 hourly dots, and show month and date as the date.
- Keep the clock face continuously moving with sub-second refresh instead of minute jumps.
- Add a visible textured market board for chosen symbols without opening a browser on click, but do not show update-time or provider/API labels in the panel.
- Add a compact stock chooser app from the market panel for adding and removing symbols, including preset symbol buttons.
- Prefer Alpha Vantage when the user provides `DESKTOP_LAB_ALPHA_VANTAGE_KEY` or `~/.config/desktop-lab-v12/alpha-vantage-key`, while keeping no-key fallback quotes.
- Keep application-grid access in the left dock and do not reserve a bottom edge drag/scroll zone.
- Show an animated rest screen after 30 minutes of no input while keeping background work running, using the GNOME Shell idle monitor when available.
- Apply the `aesthetic preference.md` direction with neutral translucent surfaces, restrained text weights, subtle hover/focus states, and low-saturation motion.
- Avoid decorative rainbow, blue/teal-heavy, or flashy visual treatment.
- Create an executable script and clickable GNOME launcher that import the `v1.2.8` profile snapshot.
- Make the project-local `versions/` archive the source of truth for saved launchers.

## Constraints

- Keep work inside this VM desktop lab unless explicitly told otherwise.
- Avoid destructive changes unless explicitly requested.
- Use Git for every completed lab version.
- Update `LAB_DIARY.md` for every committed version.
- Keep this as an importable tuned profile change; do not write live GNOME dconf settings directly except through the import workflow.
- Keep workflow folders inside this project unless explicitly told otherwise.

## Must not change

- Do not remove existing GNOME extensions from the profile.
- Do not remove the existing Bluetooth battery indicator or Codex usage indicator icon.

## Acceptance checks

- `host-features.json` is the sole source of truth for host feature ownership, revisions, and release composition.
- New version generation refuses silent manifest carry-forward and refuses to overwrite historical version directories.
- Host audit and dry-run modes do not write files or settings.
- The v1.2.17 host release manages only the three project extensions and `org.gnome.desktop.wm.preferences button-layout`.
- The v1.2.17 host update sets the window controls to `close,maximize,minimize:` and rollback restores the prior host value.
- Byte-identical managed extensions are skipped rather than recopied.
- Unknown local content inside a managed extension blocks the whole update before any mutation.
- A deliberately selected older release restores only its registered feature revisions and leaves features it does not own untouched.

- `desktop-lab-v12@young` completes `enable()` without calling the unsupported `St.Widget.set_visible()` method or entering GNOME Shell's `ERROR` state.
- The tuned extension stylesheet, GNOME settings export, and dconf profile remain byte-for-byte identical to the accepted v1.2.14 presentation.
- The dock, clock, and market retain v1.2.14 sizing, formatting, spacing, drawing, and overview behavior.
- `desktop-lab-v12@young` hides the dock and disables edge reveal for maximized and left-tiled active windows on the dock monitor.
- A right-tiled active window leaves the left dock available.
- Focus, maximize, tile geometry, and workspace changes immediately reevaluate dock suppression and cannot leave an open or pinned dock stuck over the active window.
- `desktop-lab-v12@young` checks the GNOME Shell layout monitor's `inFullscreen` state before older fullscreen fallbacks.
- Fullscreen suppression does not depend on the fullscreen window remaining focused.
- Every newly finished lab version is automatically applied in the lab VM unless the user explicitly asks to defer it.
- After automatic application, `lab -version` reports the newly finished version.
- `desktop-lab-v12@young` sizes the dock from its current cluster count within the monitor's available height.
- The left-edge reveal zone has the same vertical position and height as the dock.
- Pointer motion above or below the dock's vertical bounds does not reveal it.
- Fullscreen applications still hide the dock and disable its reveal zone.
- `desktop-lab-v12@young` no longer creates a bottom app-grid drag/scroll zone.
- `lab -version` and `lab --version` report the same authoritative saved version.
- Every historical and future apply launcher records its own version only after a successful import.
- Failed imports and invalid version writes preserve the previously recorded version.
- The safe host updater does not install or update the VM-only version command.

- `desktop-lab-v12@young` listens for GNOME Shell fullscreen-state changes.
- `desktop-lab-v12@young` hides the dock and disables its reveal zone while the dock monitor is fullscreen.
- `desktop-lab-v12@young` refuses edge-triggered dock reveal while the dock monitor is fullscreen.
- `desktop-lab-v12@young` restores the normal hidden dock and reveal zone after fullscreen ends.
- The tuned profile sets `org.gnome.desktop.wm.preferences button-layout` to `close,maximize,minimize:`.
- `bluetooth-battery@young` includes both BlueZ and UPower battery queries.
- The Codex usage top-panel indicator does not show adjacent numeric percentage text.
- The Codex usage menu still shows detailed 5-hour and weekly percentages.
- The icon drawing code uses the 5-hour remaining percent for the outer ring.
- The icon drawing code uses the weekly remaining percent to fill the `C` glyph.
- The tuned profile sets `org.gnome.desktop.background picture-options` to `none`.
- The tuned profile sets `org.gnome.desktop.background color-shading-type` to `vertical`.
- The tuned profile sets the desktop background primary color to `#041D2F`.
- The tuned profile sets the desktop background secondary color to `#0A5266`.
- The tuned profile enables `desktop-lab-v12@young`.
- The tuned profile does not set `org.gnome.TextEditor` custom settings.
- The tuned profile sets `org.gnome.shell favorite-apps` to an empty array.
- `scripts/import-layout.sh` applies `favorite-apps` from the tuned profile while still skipping app-grid ordering.
- `desktop-lab-v12@young` creates a Mac-like interactive larger vertically centered left dock with grouped app clusters.
- `desktop-lab-v12@young` hides the left dock by default and reveals it from a left-edge pointer zone.
- `desktop-lab-v12@young` keeps the left dock as Shell-level chrome so it can appear on every workspace.
- `desktop-lab-v12@young` magnifies dock buttons as a pointer-proximity wave instead of resizing the whole dock.
- `desktop-lab-v12@young` supports custom drag/drop reordering of the left dock groups.
- `desktop-lab-v12@young` creates folder flyouts for app clusters.
- `desktop-lab-v12@young` opens app cluster folder flyouts on click, not hover.
- After an app cluster is clicked, `desktop-lab-v12@young` keeps the dock and its flyout open while the pointer moves away.
- A click outside the dock, cluster flyout, and dock editor dismisses a dock pinned by a cluster click.
- `desktop-lab-v12@young` creates a larger circular wall-clock widget near the upper middle of the main workspace background.
- `desktop-lab-v12@young` places the clock and stock widgets inside one full-monitor background layer on the main workspace.
- `desktop-lab-v12@young` reparents the shared widget layer into the GNOME Shell overview workspace background bin while Activities overview is visible.
- `desktop-lab-v12@young` keeps the shared layer embedded through the full overview exit animation and restores it before Shell destroys the temporary overview workspace actors.
- `desktop-lab-v12@young` keeps a guarded overview-group and manual-transform fallback when the workspace background bin is unavailable.
- `desktop-lab-v12@young` hides the clock and stock widgets outside the main workspace.
- `desktop-lab-v12@young` removes clock minute tick marks.
- `desktop-lab-v12@young` removes the clock second hand.
- `desktop-lab-v12@young` adds 12 simple hourly clock dots.
- `desktop-lab-v12@young` shows month and day for the clock date label.
- `desktop-lab-v12@young` refreshes the clock at sub-second cadence so the analog hands move continuously.
- `desktop-lab-v12@young` creates a visible textured market board instead of clickable quote URL chips.
- `desktop-lab-v12@young` creates a compact stock chooser app for adding and removing market symbols.
- `desktop-lab-v12@young` provides stock preset buttons in the stock chooser.
- `desktop-lab-v12@young` stores chosen market symbols in the user config directory.
- `desktop-lab-v12@young` supports optional Alpha Vantage quote lookup with no-key fallback quotes.
- `desktop-lab-v12@young` does not show update-time text in the market panel.
- `desktop-lab-v12@young` does not show Yahoo Chart API/provider text in the market panel.
- `desktop-lab-v12@young` keeps dock category buttons icon-only without visible group label text.
- `desktop-lab-v12@young` keeps app flyout items icon-only without visible app description text.
- `desktop-lab-v12@young` does not show the old "Category Apps" title wording.
- `desktop-lab-v12@young` makes opened app flyout buttons larger than the v1.2.6 flyout buttons.
- `desktop-lab-v12@young` leaves a narrow slice of the actual dock visible while the dock is hidden.
- `desktop-lab-v12@young` reveals and hides the dock by animating `translation_x` with longer cubic easing instead of moving the layout position and fading to zero.
- The v1.2.8 stylesheet gives the dock a restrained marine surface and right border so its hidden slice reads as the dock silhouette without a separate shadow actor.
- `desktop-lab-v12@young` includes a compact dock editor action and stores edited dock groups in user config.
- `desktop-lab-v12@young` does not create a bottom drag/scroll zone for opening the app grid.
- `desktop-lab-v12@young` creates a 30-minute animated rest screen using the GNOME Shell idle monitor when available.
- `desktop-lab-v12@young` keeps a timer fallback for the rest screen if the Shell idle monitor is unavailable.
- `desktop-lab-v12@young` applies the `aesthetic preference.md` direction with neutral translucent surfaces and restrained typography.
- The v1.2.8 stylesheet uses dark marine surfaces without returning to solid black as the base surface.
- The v1.2.8 animated rest screen uses low-saturation marine motion instead of blue/green diagonal lines.
- The v1.2.8 rest screen label is concise and polished.
- The v1.2.8 metadata records the v1.2.8 refinement.
- The v1.2.9 metadata records the v1.2.9 refinement.
- GNOME break reminders and idle dimming are disabled for this tuned profile.
- AC and battery inactive sleep remain `nothing` so the VM does not suspend background work.
- Battery percentage is disabled and the lab extension includes guarded battery-icon hiding.
- Importing `profiles/vm-initial-desktop-task` with `./scripts/import-layout.sh` completes.
- `versions/v1/v1.2/v1.2.8/apply-v1.2.8.sh` exists and is executable.
- `versions/v1/v1.2/v1.2.8/Apply v1.2.8.desktop` exists and is executable.
- The `v1.2.8` version launcher stores a `profile/` snapshot with `gsettings-export.sh`.
- `versions/v1/v1.2/v1.2.9/apply-v1.2.9.sh` exists and is executable.
- `versions/v1/v1.2/v1.2.9/Apply v1.2.9.desktop` exists and is executable.
- The `v1.2.9` version launcher stores a `profile/` snapshot with `gsettings-export.sh`.
- `scripts/install-version-launcher.sh` defaults to the repo-local `versions/` directory.
- Existing project-local launchers do not reference the old home-level versions directory.
- `bluetooth-battery@young` extension bundle packs successfully with `gnome-extensions pack --force`.
- `codex-usage@young` extension bundle packs successfully with `gnome-extensions pack --force`.
- `desktop-lab-v12@young` extension bundle packs successfully with `gnome-extensions pack --force`.
- `./scripts/check-workflow.sh` completes successfully.

## Notes for host apply

- Use `./scripts/update-host.sh --dry-run`, then `./scripts/update-host.sh`.
- Do not use `scripts/import-layout.sh` or a historical Apply launcher on the host; those are exact lab restoration tools.
- Log out and back in after import if GNOME Shell does not immediately reload the updated top-panel extension.
