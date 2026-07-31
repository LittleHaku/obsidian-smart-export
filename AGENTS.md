# AGENTS.md

Operational guide for coding agents working on `obsidian-smart-export`.

## Project snapshot

- Type: Obsidian community plugin (`manifest.json` + bundled `main.js`).
- Language: TypeScript (`strict`), Vitest, ESLint, Prettier.
- Package manager: `pnpm` (authoritative workflow for this repo).
- Entrypoint: `src/main.ts`.
- Core modules:
  - `src/engine/`: traversal and exporters (`BFSTraversal`, `XMLExporter`, `LlmMarkdownExporter`, `PrintFriendlyMarkdownExporter`)
  - `src/ui/`: modal and tree selection UX
  - `src/utils/`: shared filtering/template helpers

## Source-of-truth docs

Read these first for behavior and release expectations:

- `docs/exclude-folders.md`
- `docs/export-architecture.md`
- `docs/startup-process.md`
- `docs/versioning-and-releases.md`
- `.agents/skills/obsidian-plugin-dev/reference/obsidian-plugin-guidelines.md`

External references used by this repository:

- API docs: <https://docs.obsidian.md>
- Load-time guide: <https://docs.obsidian.md/plugins/guides/load-time>
- Plugin guidelines: <https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines>
- Developer policies: <https://docs.obsidian.md/Developer+policies>
- Submission requirements: <https://docs.obsidian.md/Plugins/Releasing/Submission+requirements+for+plugins>
- Submit your plugin: <https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin>
- Manifest reference: <https://docs.obsidian.md/Reference/Manifest>
- Official sample plugin: <https://github.com/obsidianmd/obsidian-sample-plugin>

## Quick start commands (PNPM)

- `pnpm install`
- `pnpm run dev`
- `pnpm build`
- `pnpm lint`
- `pnpm format`
- `pnpm format:check`
- `pnpm test`
- `pnpm vitest run tests/engine/BFSTraversal.test.ts`
- `pnpm benchmark`

## Codex Cloud and clone setup

- This `AGENTS.md` is versioned and is the repository-wide source of durable agent instructions.
- Codex discovers the shared Obsidian workflow at `.agents/skills/obsidian-plugin-dev/SKILL.md`.
- Read `docs/codex-cloud.md` for the recommended Codex Cloud environment and clone setup.
- Keep repository instructions, skills, and their references portable: use repository-relative paths and never include credentials or machine-specific paths.
- Personal Codex configuration, authenticated connectors, and globally installed skills are not part of this repository; do not assume they are available in another clone or Cloud environment.

## Required workflow for changes

1. Read relevant code and matching docs in `docs/`.
2. Implement focused changes in `src/` (keep `src/main.ts` orchestration-focused).
3. Add/update tests in `tests/<domain>/`.
4. For user-visible behavior changes, update `README.md` and `CHANGELOG.md`.
5. Run checks in this order: `pnpm format` -> `pnpm format:check` -> `pnpm lint` -> `pnpm test`.
   Use `format:check` as the final Prettier gate before commit/push so CI and local formatting stay aligned.
6. Verify plugin compliance using `.agents/skills/obsidian-plugin-dev/reference/obsidian-plugin-guidelines.md`.

## Code standards

- Keep TypeScript strictness intact; avoid `any`.
- Use `PascalCase` for classes/types and `camelCase` for values/functions.
- Keep shared logic in `src/utils` instead of duplicating across modules.
- Add concise comments/JSDoc for non-obvious rules (traversal semantics, filtering precedence, caching assumptions).
- Use sentence case for user-facing strings.
- Avoid unnecessary console logging in normal usage.
- Remove sample-plugin leftovers and placeholder names (for example `MyPlugin`, `SampleSettingTab`).

## Obsidian API and lifecycle rules

- Use `this.app` (never global `app` or `window.app`).
- Prefer view-safe APIs (`getActiveViewOfType`) over `workspace.activeLeaf` assumptions.
- Keep `onload()` lightweight and initialization-only.
- Do not run expensive computation, large vault scans, or network/data fetching in `onload()` unless strictly required for initialization.
- Defer startup work with `this.app.workspace.onLayoutReady(...)` when possible.
- Caveat: `vault.on("create")` fires during vault initialization. Register the create handler inside `onLayoutReady(...)`, or check `this.app.workspace.layoutReady` before reacting.
- Use Editor API for active note edits.
- Use `Vault.process()` for background file edits.
- Use `FileManager.processFrontMatter()` for frontmatter changes.
- Use `normalizePath()` for user-provided or constructed vault paths.
- Register disposable resources via lifecycle helpers (`registerEvent`, `registerInterval`, command registration APIs).
- Use command callbacks intentionally:
  - `callback` for unconditional commands.
  - `checkCallback` for conditional commands.
  - `editorCallback` / `editorCheckCallback` for editor-dependent commands.
- Do not set default command hotkeys.
- Prefer `requestUrl()` over `fetch()` when network calls are required by plugin behavior.

## API-first mapping (mandatory)

- File lookup by path: `getFileByPath` / `getFolderByPath` / `getAbstractFileByPath` (not `getFiles().find(...)` scans).
- Vault reads/writes: `app.vault.*` or `app.fileManager.*` (not direct `app.vault.adapter.*` by default).
- Active note edits: Editor API (`editorCallback`, `editorCheckCallback`, `view.editor`), not `Vault.modify`.
- Background note edits: `Vault.process()` for atomic updates.
- Frontmatter updates: `FileManager.processFrontMatter()`, not manual YAML string edits.
- User-provided paths: normalize with `normalizePath()` before lookup/write.
- Config directory access: use `Vault.configDir`; do not hardcode `.obsidian`.
- Platform detection: Obsidian `Platform` helpers, not `navigator.platform` or app-level `process.platform` checks.
- Networking in plugins: `requestUrl()` over `fetch()` / `axios.get(...)` unless there is a documented, deliberate exception.
- If Node.js or Electron APIs are required, set `manifest.json:isDesktopOnly` to `true`.
- If mobile support is intended, do not top-level import desktop-only modules (`fs`, `path`, `electron`); gate desktop-only paths with `Platform.isDesktopApp` and dynamic `require()` at runtime.
- Do not cast `Vault.adapter` to `FileSystemAdapter` without an `instanceof` check.
- Regex lookbehind may fail on older iOS versions; avoid or provide fallback logic.

## Policy and disclosure guardrails

- Never add code obfuscation, dynamic ads, client-side telemetry, or self-updating mechanisms.
- If functionality requires network access, account/paywall, external file access, server-side telemetry, ads, or closed-source components, document it clearly in `README.md`.
- If telemetry exists, include a privacy policy link in `README.md`.
- Use `fundingUrl` only for real financial support links.
- Keep plugin metadata user-facing and compliant:
  - `description` should be short (target <= 250 chars), sentence case, and end with punctuation.
  - Command IDs should not manually include plugin ID (Obsidian prefixes them automatically).
  - Avoid "command" in command names/IDs.

## Manifest, release, and versioning

- Keep `manifest.json` intentional and valid: `id`, `version`, `minAppVersion`, `description`, `isDesktopOnly`.
- PRs that change shipped plugin behavior or runtime code must include their intended release version and complete release metadata.
- Documentation, agent-guidance, or infrastructure-only PRs with no shipped runtime impact may use `Release: none` and omit version metadata changes.
- Use `pnpm version <version> --no-git-tag-version` so `package.json`, `manifest.json`, and the new `versions.json` mapping stay aligned.
- Keep `CHANGELOG.md` and `src/constants/releaseNotes.ts` aligned with the PR version.
- Do not rewrite historical `versions.json` mappings unless correcting a documented compatibility error.
- Release tags must match `manifest.json` exactly (`X.Y.Z` or `X.Y.Z-beta.N`, no `v` prefix).
- Release assets: `main.js`, `manifest.json`, optional `styles.css`.
- Release `main.js` should be a production build.
- Do not commit generated release artifacts like `main.js` to source control.

## Testing policy

- Framework: Vitest (`*.test.ts` in `tests/<domain>/`).
- Maintain 100% project coverage and 100% patch coverage for touched code.
- Add edge-case tests for traversal/filter interactions and exporter output correctness.

## Finish checks

- Scan changed code for deprecated Obsidian API usage before finishing.

## Skills in this repository

Repository-local skill for Obsidian plugin development is available at:

- `.agents/skills/obsidian-plugin-dev/SKILL.md`

Use it for implementation/review tasks that need quick access to API patterns, compliance checks, and release policy.

## PR and commit rules

- Name branches with a purpose prefix such as `feat/`, `fix/`, `docs/`, or `chore/`. Do not use `agent/`.
- Follow Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, etc.).
- Runtime PRs must be release-ready and include the appropriate semantic version bump. Documentation, agent-guidance, or infrastructure-only PRs may explicitly use `Release: none`.
- Follow `.github/pull_request_template.md`.
- PR descriptions should include behavior change summary, test evidence, and docs updates when applicable.
