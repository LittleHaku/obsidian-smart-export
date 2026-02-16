# Obsidian Plugin Review Guidelines

Updated: February 16, 2026

## Core Rules

- Use `this.app`, not global `app` / `window.app`.
- Avoid noisy console logs in normal usage.
- Organize multi-file code into clear folders (`engine`, `ui`, `utils`, etc.).

## UI and Settings

- Use sentence case in UI strings.
- Do not add unnecessary top-level settings headings.
- Avoid heading text like "Advanced settings"; use "Advanced".
- Prefer `new Setting(containerEl).setName(...).setHeading()` over raw `<h1>/<h2>`.
- Avoid hardcoded inline styles; use CSS classes and Obsidian CSS variables.

## Security

- Do not use `innerHTML`, `outerHTML`, or `insertAdjacentHTML` with dynamic content.
- Build DOM with Obsidian/DOM APIs (`createEl`, `createDiv`, `createSpan`).
- Use `el.empty()` for clearing containers.

## Resource Management

- Register events/commands with plugin lifecycle helpers (`registerEvent`, `addCommand`).
- Clean up long-lived resources on unload.
- Do not detach user leaves in `onunload()`.

## Commands and Workspace

- Avoid default hotkeys for commands.
- Use the correct command callback type (`callback`, `checkCallback`, `editorCallback`, etc.).
- Prefer `getActiveViewOfType()` / `activeEditor` over direct `workspace.activeLeaf` assumptions.
- Avoid storing direct references to custom views; query active leaves when needed.

## Vault and File Operations

- Prefer Vault API over Adapter API.
- Use `getFileByPath` / `getFolderByPath` / `getAbstractFileByPath` (do not scan all files).
- Prefer `Vault.process` over `Vault.modify` for background edits.
- For active editor content, prefer Editor API over `Vault.modify`.
- For frontmatter changes, use `FileManager.processFrontMatter`.
- Normalize user-provided paths (`normalizePath`) when constructing/accepting vault paths.

## Mobile Compatibility

- Do not rely on Node/Electron APIs on mobile.
- Avoid regex lookbehind without fallback (older iOS Safari limitations).

## TypeScript

- Prefer `const`/`let` over `var`.
- Prefer `async/await` over Promise chains for readability and maintainability.
