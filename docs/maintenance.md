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

The GitHub issues linked below are the durable source of truth for implementation scope,
acceptance criteria, and validation evidence.

### Priority 1: Obsidian 1.13 settings ([#95](https://github.com/LittleHaku/obsidian-smart-export/issues/95))

Migrate `SmartExportSettingTab` to the declarative `getSettingDefinitions()` API so plugin settings appear in Obsidian search.

Decide between:

- dual support, retaining the imperative `display()` implementation for Obsidian 1.6.6-1.12; or
- raising `minAppVersion` to 1.13 and using only declarative settings.

Completion criteria:

- all settings remain editable and persist correctly;
- conditional sections and custom folder suggestions still work;
- settings are searchable on Obsidian 1.13;
- deprecated `display()` and `setDynamicTooltip()` calls are removed from the selected support path.

### Priority 1: supported tag discovery ([#96](https://github.com/LittleHaku/obsidian-smart-export/issues/96))

Replace the locally typed optional `MetadataCache.getTags()` call with supported Obsidian APIs.
Avoid repeatedly scanning every Markdown file when tag suggestions are opened, and keep all
tag discovery out of `onload()`.

Completion criteria:

- inline and frontmatter tags keep their current normalization and sorting;
- unchanged vaults are not repeatedly rescanned;
- metadata changes invalidate or update the result;
- mobile and large-vault behavior are covered by tests and benchmarks.

### Priority 1: public Vault APIs for templates ([#97](https://github.com/LittleHaku/obsidian-smart-export/issues/97))

Replace direct `Vault.adapter` access in the Markdown template resolver with normalized path
lookups, `TFile`/`TFolder` traversal, and public `Vault` read APIs.

Completion criteria:

- the resolver contains no direct adapter calls or Node.js filesystem imports;
- template ordering and precedence remain backward compatible;
- missing, invalid, empty, and nested template directories are tested.

### Priority 1: UI API and pop-out-window cleanup ([#98](https://github.com/LittleHaku/obsidian-smart-export/issues/98))

- Verify or replace the locally typed `openExternal` helper with a supported public mechanism.
- Create DOM nodes relative to their owning Obsidian container/document.
- Use owner-window timers and animation frames for pop-out-window compatibility.

Completion criteria:

- the current Obsidian lint rules report no API, DOM, or pop-out-window warnings in touched UI code;
- callbacks cannot run after modal or plugin disposal;
- links and UI work in the main window, pop-out windows, and supported mobile clients.

### Priority 1: TypeScript guarantees ([#99](https://github.com/LittleHaku/obsidian-smart-export/issues/99))

- Enable full TypeScript `strict` mode.
- Select a modern compilation target and library set that remains compatible with the supported
  Obsidian desktop and mobile versions.

Completion criteria:

- type checking succeeds without weakening types or adding `any`;
- the target decision and mobile compatibility rationale are documented;
- mocks continue to detect public Obsidian API drift.

### Priority 1: coverage guarantees ([#100](https://github.com/LittleHaku/obsidian-smart-export/issues/100))

- Cover the remaining branches in `exportMarkdownLinks` and `BFSTraversal`.
- Remove broad exclusions for executable UI, API, and orchestration code.
- Add Vitest thresholds for 100% project coverage and a CI gate for 100% patch coverage.

Completion criteria:

- statements, branches, functions, and lines meet the repository's 100% policy;
- CI enforces both project and patch thresholds on Windows/Linux-compatible output.

### Priority 2: module boundaries ([#101](https://github.com/LittleHaku/obsidian-smart-export/issues/101))

- Extract the settings tab from `src/main.ts`.
- Split `ExportModal` into focused source-selection, output, filtering, redaction, and tree-selection sections.
- Keep export behavior in engine and utility modules rather than UI classes.

Completion criteria:

- `src/main.ts` remains lifecycle and orchestration focused;
- modal sections have isolated tests;
- no user-visible behavior changes during the refactor.

### Priority 2: mobile and performance verification ([#102](https://github.com/LittleHaku/obsidian-smart-export/issues/102))

- Test clipboard export, note creation, folder suggestions, custom templates, and release notes on Android and iOS.
- Test the settings migration on desktop, phone, and tablet layouts.
- Run Obsidian startup profiling and the export benchmark before release.

Completion criteria:

- no desktop-only runtime dependency is introduced;
- a real Android or iOS run is recorded in the release evidence;
- startup work remains registration-only and export performance does not regress materially.

### Priority 2: major toolchain migrations ([#103](https://github.com/LittleHaku/obsidian-smart-export/issues/103))

Evaluate major upgrades separately for Vitest 4, ESLint 10, TypeScript 7, jsdom 30, and newer esbuild releases.

Completion criteria:

- each migration is isolated enough to identify regressions;
- peer dependencies are satisfied without broad overrides;
- the remaining transitive development audit advisory is removed or documented as upstream-only.

### Priority 2: reproducible releases ([#104](https://github.com/LittleHaku/obsidian-smart-export/issues/104))

- Pin the Obsidian SDK to an exact reviewed version instead of `latest`.
- Keep the Node, pnpm, Corepack, CI, and local-development version policy aligned.
- Require stable release tag commits to be reachable from `main`.
- Validate tag, manifest, package, compatibility mapping, and release asset versions before publishing.

Completion criteria:

- dependency resolution is reproducible on Windows and Linux;
- stable tags from unintended branches are rejected;
- release validation has a safe dry-run or automated test path;
- `docs/versioning-and-releases.md` contains the complete policy.

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
9. Create the stable tag from `main` without a `v` prefix; [#104](https://github.com/LittleHaku/obsidian-smart-export/issues/104) tracks automated enforcement.
