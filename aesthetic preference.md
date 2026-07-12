# Aesthetic Preference

When setting up a custom desktop, it is important to have a personal aesthetic preference. This project should follow an Apple-like aesthetic direction for future desktop, UI, and feature work.

## Living Preference Maintenance

This file is a living record of the user's current visual and interaction preferences.

If a newer user preference differs from the existing aesthetic direction, update this file instead of treating the preference as a one-off exception.

When a task introduces a durable key desktop, UI, or interaction feature, add a concise note here so later workflow runs can preserve and refine that feature.

Keep durable preference notes focused on reusable direction. Do not add temporary implementation details that only matter to one task.

## Durable Desktop Preferences

- Desktop clocks should stay very simple: no minute tick scale, no dense markings, no extra inner margin/ring, 12 small hourly dots when scale is needed, no second hand, month-and-day date text, and continuous analog movement rather than minute jumps.
- Dark marine blue is preferred over a pure solid black background when the lab surface needs more depth while staying calm and low-saturation.
- Clock and stock widgets should behave like desktop background widgets on the main workspace. During Activities overview, embed their shared layer into the main workspace background so Shell moves and scales them with that workspace; keep a guarded manual transform only as a compatibility fallback.
- Left-side docks should feel interactive in a Mac-like way, with pointer-proximity wave magnification instead of whole-dock growth, clear app grouping, click-open folder access to app clusters, support for custom drag/drop ordering when useful, and smooth edge reveal behavior. When hidden, leave a narrow slice of the actual dock visible as its silhouette instead of drawing a separate shadow-like hint.
- App clusters should behave like useful folders or flyouts that open intentionally on click, not automatically just because the pointer passes over them. Prefer icon-only dock and flyout controls without category words, app descriptions, or repeated "Apps" wording when the icons are clear.
- After a cluster is clicked, keep its dock and flyout available until an intentional outside click dismisses them; pointer travel alone should not demand precise mouse movement or close the interaction.
- Fullscreen applications and games should have an uninterrupted screen edge: hide the left dock and disable its reveal zone on the dock's monitor until fullscreen ends.
- Maximized and left-tiled active windows should also have an uninterrupted left edge, while a right-tiled active window should leave the left dock available; reevaluate this behavior immediately as window focus, geometry, or workspace changes.
- Hidden left docks should reveal only when the pointer reaches the edge within the dock's visible vertical span. That span should grow or shrink with the configured cluster count, and the desktop should not reserve a separate bottom-edge app-grid gesture.
- Opened app flyouts should feel easy to target, with larger app icons/buttons than the hidden dock trigger when space allows.
- Dock groups should have an understandable editing path for adding categories and app desktop IDs, with personal edits saved in user config rather than hard-coded only in the extension source.
- Detailed particle-like, technological texture is preferred when it stays restrained, neutral, and polished.
- Data panels, including market panels, should remain visible and visually textured with restrained translucent surfaces, but keep only essential values visible and hide update-time or provider/API labels unless explicitly requested. Market panels should let selected symbols be changed directly from a compact chooser with simple preset shortcuts when useful.
- Long-idle rest screens should use reliable system idle detection when GNOME Shell exposes it, with a timer fallback only when needed.

# Apple Design Guidelines

## Philosophy

Design every interface as if it were a first-party Apple application.

The interface should feel:

* Calm
* Elegant
* Spacious
* Premium
* Effortless
* Functional before decorative

When uncertain, choose the simpler solution.

---

## Simplicity

Remove unnecessary elements.

Every button, icon, border, animation, and piece of text should have a purpose.

Avoid visual clutter.

---

## Whitespace

Whitespace is a primary design element.

Prefer generous margins and padding.

Never compress content merely to fit more information on the screen.

---

## Typography

Use modern sans-serif typography (Inter or SF Pro when available).

Create a clear hierarchy through size and weight rather than color.

Limit font weights to:

* 400
* 500
* 600
* 700

Avoid decorative fonts.

---

## Color

Prefer neutral colors.

Accent colors should be used sparingly.

Backgrounds should remain clean and unobtrusive.

Avoid rainbow palettes and excessive gradients.

---

## Components

Components should feel soft and refined.

* Rounded corners
* Consistent spacing
* Light shadows
* Thin borders only when necessary

Avoid heavy outlines.

---

## Layout

Everything should align to a grid.

Content should breathe.

Limit content width for readability.

Maintain consistent spacing between sections.

---

## Motion

Animations should be subtle.

Use:

* fade
* scale
* smooth transitions

Avoid flashy or distracting effects.

---

## Icons

Use one icon library consistently.

Icons should support content rather than dominate it.

---

## Interaction

Interfaces should feel predictable.

Users should understand what is clickable without excessive visual cues.

Hover, focus, and pressed states should be subtle.

---

## Code Quality

Write reusable components.

Avoid duplicated styling.

Keep styling consistent throughout the application.

---

## Final Review

Before considering a UI complete, ask:

* Can anything be removed?
* Is there enough whitespace?
* Is the hierarchy immediately obvious?
* Does the interface feel calm?
* Would this look appropriate as a native Apple application?

If not, continue refining the design.

## References

This project should feel similar to:

- Apple.com
- Apple Settings
- Apple Music
- Apple Wallet
- Apple Notes
- Apple Human Interface Guidelines

Do not imitate the functionality—only the visual language:
- generous whitespace
- restrained colors
- smooth hierarchy
- subtle animations
- clean typography
- premium polish
