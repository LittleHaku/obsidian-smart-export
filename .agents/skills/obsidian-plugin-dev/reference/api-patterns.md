# API patterns

## Active view and editor access

- Prefer `this.app.workspace.getActiveViewOfType(MarkdownView)` to resolve active markdown context.
- Use `editorCallback`/`editorCheckCallback` when command behavior depends on the editor.
- Use command callback types intentionally:
  - `callback` for unconditional commands.
  - `checkCallback` for conditional commands.
  - `editorCallback` / `editorCheckCallback` for editor-dependent commands.

```ts
this.addCommand({
	id: "export-current-branch",
	name: "Export current branch",
	editorCheckCallback: (checking, editor, view) => {
		if (!view) return false;
		if (!checking) {
			// Use editor APIs for the active note.
			const selection = editor.getSelection();
			void doExport(selection);
		}
		return true;
	},
});
```

## File operations

- Active note edits: editor operations.
- Background edits: `Vault.process()` for atomic read-modify-write semantics.
- Frontmatter changes: `FileManager.processFrontMatter()`.
- Path handling: always use `normalizePath()` for user input and generated vault paths.
- Config directory access: use `Vault.configDir`; do not hardcode `.obsidian`.
- Prefer Vault/FileManager APIs over direct adapter operations.
- Prefer direct path lookups over iterating all vault files.
- Do not cast `Vault.adapter` to `FileSystemAdapter` without an `instanceof` check.

```ts
const file = this.app.vault.getFileByPath(normalizePath(userPath));
```

## Lifecycle safety

- Register and clean up through plugin helpers:
  - `registerEvent(...)`
  - `registerInterval(...)`
  - `addCommand(...)`
- Avoid long-lived references to views/leaves where possible; resolve when needed.
- Keep `onload()` lightweight and registration-only.
- Defer non-essential startup work with `this.app.workspace.onLayoutReady(...)`.
- `vault.on("create")` fires during vault initialization. Register create handlers in `onLayoutReady(...)`, or return early until `this.app.workspace.layoutReady` is `true`.

## Networking

- Prefer Obsidian `requestUrl()` instead of browser `fetch()` or `axios.get(...)` when network behavior must align with Obsidian plugin expectations.

## Platform behavior

- Use `Platform` helpers for platform gating (mobile/desktop).
- If Node/Electron APIs are required, `manifest.json` must set `isDesktopOnly` to `true`.
- If mobile support is intended, avoid top-level imports of desktop-only modules (`fs`, `path`, `electron`); gate with `Platform.isDesktopApp` and runtime dynamic `require()`.
- Avoid `process.platform`; use Obsidian `Platform`.
- Regex lookbehind may fail on older iOS versions; avoid it or provide fallback behavior.
