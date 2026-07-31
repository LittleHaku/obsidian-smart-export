---
name: obsidian-plugin-dev
description: Obsidian plugin development and review skill for this repository. Use when changing plugin behavior, lifecycle code, manifest/release metadata, or user-facing UI/settings text.
---

# Obsidian plugin dev skill

Use this skill when working on any of the following:

- `src/main.ts`, `src/engine/*`, `src/ui/*`, `src/utils/*`
- `manifest.json`, `versions.json`, release/versioning flow
- Obsidian API usage, plugin lifecycle, or submission compliance

## Load order

1. `AGENTS.md`
2. `reference/obsidian-plugin-guidelines.md`
3. One or more focused references from `reference/`

## Implementation defaults

- Use `pnpm` commands and existing scripts in `package.json`.
- Keep `src/main.ts` focused on lifecycle/orchestration; move logic to modules.
- Keep `onload()` lightweight and registration-focused; defer non-critical startup work with `this.app.workspace.onLayoutReady(...)`.
- For `vault.on("create")`, register inside `onLayoutReady(...)` or guard handlers with `this.app.workspace.layoutReady`.
- Maintain sentence case for user-facing copy.
- For path-based behavior, normalize and validate early.
- Add/adjust tests in `tests/<domain>/` for any behavior change.

## Hard guardrails

- Always prefer Obsidian APIs over generic web/Node alternatives for vault/plugin operations.
- Do not introduce `app.vault.adapter` operations when `Vault`/`FileManager` APIs cover the use case.
- Do not hardcode `.obsidian`; use `Vault.configDir` when configuration-directory access is needed.
- Do not add default command hotkeys.
- Do not include plugin ID manually in command IDs.
- Do not use global `app` or `window.app`; use `this.app`.
- Avoid unnecessary console logging and remove sample-plugin placeholder leftovers before finishing.
- Preserve policy compliance and README disclosures for network/account/telemetry/external access behavior.

## API patterns to enforce

- `this.app.workspace.getActiveViewOfType(MarkdownView)` over deprecated active-leaf assumptions.
- Editor API for active note edits.
- `Vault.process()` for background note edits.
- `FileManager.processFrontMatter()` for frontmatter mutation.
- `requestUrl()` over `fetch()` / `axios.get(...)` when network calls are needed.
- `callback`/`checkCallback`/`editorCallback`/`editorCheckCallback` selection should match command behavior.
- Lifecycle-safe registrations (`registerEvent`, `registerInterval`, command registrations).

## Validation flow before finishing

1. `pnpm format`
2. `pnpm format:check`
3. `pnpm lint`
4. `pnpm test`
5. Scan for deprecated Obsidian API usage in touched code.
6. Compliance pass against `reference/obsidian-plugin-guidelines.md`

Treat `pnpm format:check` as the final formatting gate before commit/push so CI catches no additional Prettier changes.

## Reference files

- `reference/api-patterns.md`
- `reference/submission-and-release.md`
- `reference/ui-and-accessibility.md`
- `reference/policy-and-disclosures.md`
- `reference/obsidian-plugin-guidelines.md`
