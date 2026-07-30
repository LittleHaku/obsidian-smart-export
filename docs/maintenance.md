# Maintenance plan

Updated: July 30, 2026

## Current baseline

Smart Export 1.15.1 is the maintenance baseline:

- Node.js 24 LTS is the recommended development runtime; Node.js 22-26 is supported.
- pnpm 11.18.0 is pinned through `package.json`.
- Windows and WSL/Linux use the same lockfile but separate `node_modules` installations.
- The Obsidian SDK is aligned with the 1.13 release line.
- The plugin remains mobile-compatible and does not import Node.js or Electron modules at runtime.
- The minimum supported Obsidian version is 1.6.6, matching `Vault.getAllFolders()`.

## Completed for 1.15.1

- Refreshed direct development dependencies without taking the pending major-version migrations.
- Removed the critical Vitest development advisory and reduced the audit to one transitive development-only advisory.
- Updated GitHub Actions, pnpm setup, Node.js setup, coverage uploads, and artifact actions.
- Added explicit formatting, linting, type checking, tests, and production build validation.
- Added release tag and metadata validation.
- Fixed parsing of GitHub-generated release notes and made API failures visible.
- Corrected historical `versions.json` compatibility mappings from Smart Export 1.5.1 onward.
- Removed unused placeholder code.

## Next maintenance work

### Priority 1: Obsidian 1.13 settings

Migrate `SmartExportSettingTab` to the declarative `getSettingDefinitions()` API so plugin settings appear in Obsidian search.

Decide between:

- dual support, retaining the imperative `display()` implementation for Obsidian 1.6.6-1.12; or
- raising `minAppVersion` to 1.13 and using only declarative settings.

Completion criteria:

- all settings remain editable and persist correctly;
- conditional sections and custom folder suggestions still work;
- settings are searchable on Obsidian 1.13;
- deprecated `display()` and `setDynamicTooltip()` calls are removed from the selected support path.

### Priority 1: API and pop-out-window cleanup

- Replace direct `Vault.adapter` access in the Markdown template resolver when `Vault` APIs cover the same files.
- Verify or replace the locally typed `openExternal` helper with a supported public mechanism.
- Use Obsidian DOM helpers such as `createFragment`, `createEl`, `createDiv`, and `createSpan`.
- Use window-scoped timers and animation frames for pop-out-window compatibility.

Completion criteria:

- the current Obsidian lint rules report no API, deprecation, DOM helper, or pop-out-window warnings in `src/`;
- desktop and mobile behavior remains unchanged.

### Priority 1: TypeScript and coverage guarantees

- Enable full TypeScript `strict` mode.
- Move the compilation target and libraries toward the current Obsidian sample plugin baseline.
- Cover the remaining branches in `exportMarkdownLinks` and `BFSTraversal`.
- Add Vitest thresholds for 100% project and patch coverage once the existing gaps are closed.

Completion criteria:

- type checking succeeds without weakening types or adding `any`;
- statements, branches, functions, and lines meet the repository's 100% policy;
- CI enforces the thresholds.

### Priority 2: Module boundaries

- Extract the settings tab from `src/main.ts`.
- Split `ExportModal` into focused source-selection, output, filtering, redaction, and tree-selection sections.
- Keep export behavior in engine and utility modules rather than UI classes.

Completion criteria:

- `src/main.ts` remains lifecycle and orchestration focused;
- modal sections have isolated tests;
- no user-visible behavior changes during the refactor.

### Priority 2: Mobile and performance verification

- Test clipboard export, note creation, folder suggestions, custom templates, and release notes on Android and iOS.
- Test the settings migration on desktop, phone, and tablet layouts.
- Run Obsidian startup profiling and the export benchmark before release.

Completion criteria:

- no desktop-only runtime dependency is introduced;
- a real Android or iOS run is recorded in the release evidence;
- startup work remains registration-only and export performance does not regress materially.

### Priority 2: Major toolchain migrations

Evaluate major upgrades separately for Vitest 4, ESLint 10, TypeScript 7, jsdom 30, and newer esbuild releases.

Completion criteria:

- each migration is isolated enough to identify regressions;
- peer dependencies are satisfied without broad overrides;
- the remaining transitive development audit advisory is removed or documented as upstream-only.

## Release readiness

Before publishing any version:

1. Run `pnpm format`.
2. Run `pnpm format:check`.
3. Run `pnpm lint`.
4. Run `pnpm typecheck`.
5. Run `pnpm test`.
6. Run `pnpm build`.
7. Test the production bundle in Obsidian desktop and at least one mobile runtime.
8. Confirm `package.json`, `manifest.json`, `versions.json`, `CHANGELOG.md`, and bundled release notes use the same version.
9. Create the stable tag from `main` without a `v` prefix.
