# UI and accessibility

## Copy and settings UI

- Use sentence case for all user-facing text.
- Keep labels short and explicit.
- Use settings headings only when there are multiple distinct sections.
- Avoid redundant heading text like "settings" or "options".
- Use `new Setting(...).setName(...).setHeading()` for settings headings; do not use raw `<h1>` / `<h2>` in settings tabs.

## Commands and shortcuts

- Keep command IDs stable.
- Do not include plugin ID manually in command IDs (Obsidian prefixes automatically).
- Avoid redundant plugin-name prefixes in command IDs and names.
- Avoid "command" in command names/IDs.
- Do not ship default hotkeys.
- Use callback types intentionally:
  - `callback` for unconditional commands.
  - `checkCallback` for conditional commands.
  - `editorCallback` / `editorCheckCallback` for editor-dependent commands.

## DOM and safety

- Build UI with safe APIs (`createEl`, `createDiv`, `createSpan`).
- Avoid `innerHTML`, `outerHTML`, and `insertAdjacentHTML` for dynamic content.
- Move styles to `styles.css`; avoid inline style construction and `el.style...` styling in TS.

## Styling expectations

- Use Obsidian CSS variables for colors, spacing, and typography.
- Scope styles to plugin containers/classes to prevent global leakage.
- Use CSS classes in `styles.css` rather than per-element style mutations in code.
- Avoid global overrides of core Obsidian styling.

## Accessibility baseline

- Keyboard navigation must work for interactive controls.
- Add ARIA labels where icon-only buttons are used.
- Preserve visible focus styles (`:focus-visible`).
- Keep touch targets practical for mobile.
