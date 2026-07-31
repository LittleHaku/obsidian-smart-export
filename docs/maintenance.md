# Maintenance plan

Updated: August 1, 2026

## Current baseline

Smart Export 1.16.1 is the maintenance baseline:

- Node.js 24 LTS is the recommended development runtime; Node.js 22-26 is supported.
- pnpm 11.18.0 is pinned through `package.json`.
- Windows and WSL/Linux use the same lockfile but separate `node_modules` installations.
- The Obsidian SDK is aligned with the 1.13 release line.
- The plugin remains mobile-compatible and does not import Node.js or Electron modules at runtime.
- The minimum supported Obsidian version is 1.13.0 so the plugin can use the declarative settings API without maintaining a second legacy UI.

## Completed for 1.15.1

- Refreshed direct development dependencies without taking the pending major-version migrations.
- Removed the critical Vitest development advisory and reduced the audit to one transitive development-only advisory.
- Updated GitHub Actions, pnpm setup, Node.js setup, coverage uploads, and artifact actions.
- Added explicit formatting, linting, type checking, tests, and production build validation.
- Added release tag and metadata validation.
- Fixed parsing of GitHub-generated release notes and made API failures visible.
- Corrected historical `versions.json` compatibility mappings from Smart Export 1.5.1 onward.
- Removed unused placeholder code.

## Completed for 1.15.2

- Replaced direct `Vault.adapter` access in the Markdown template resolver with normalized public Vault API lookups and cached reads ([#97](https://github.com/LittleHaku/obsidian-smart-export/issues/97)).
- Preserved template precedence and ordering while covering missing, invalid, empty, unreadable, and nested template paths.
- Documented that custom template folders must be visible inside Obsidian.

## Completed for 1.15.3

- Created settings and export UI descriptions in their owning Obsidian document for pop-out-window compatibility ([#98](https://github.com/LittleHaku/obsidian-smart-export/issues/98)).
- Scheduled and canceled release-note focus through the modal's owning window.
- Replaced the locally declared `openExternal` helper with a safe standard external link that works without undocumented Obsidian SDK exports.

## Completed for 1.16.0

- Raised `minAppVersion` to Obsidian 1.13.0 and selected the clean declarative-only migration path recommended by Obsidian ([#95](https://github.com/LittleHaku/obsidian-smart-export/issues/95)).
- Moved `SmartExportSettingTab` out of `src/main.ts` and replaced its deprecated `display()` implementation with searchable `getSettingDefinitions()` groups.
- Replaced custom settings-tab folder suggesters with Obsidian's declarative `folder` controls while retaining normalized stored paths.
- Added conditional visibility for marked-section and regular-expression redaction details, preserved the live preview and dynamic template dropdown, and removed obsolete dynamic slider tooltip calls.
- Added tests for definition generation, explicit defaults, normalized persistence, conditional visibility, and the derived output selector.

## Completed for 1.16.1

- Replaced the undocumented aggregate tag lookup with supported Obsidian metadata APIs ([#96](https://github.com/LittleHaku/obsidian-smart-export/issues/96)).
- Added a shared on-demand tag cache that is invalidated by lifecycle-managed metadata and vault events without scanning during plugin startup.
- Preserved inline/frontmatter tag normalization, deduplication, and deterministic sorting.
- Added empty-vault, nested-tag, frontmatter, duplicate, invalidation, and 10,000-note coverage plus a recorded cold/warm benchmark baseline.

## Completed for 1.16.2

- Enabled the complete TypeScript `strict` family and additional switch-fallthrough and file-casing
  guarantees ([#99](https://github.com/LittleHaku/obsidian-smart-export/issues/99)).
- Aligned TypeScript's target and standard library with the production bundle's conservative ES2018
  target for the supported Obsidian 1.13 desktop and mobile range.
- Normalized SDK dropdown values at runtime and explicitly marked modal-lifecycle fields, resolving
  strict diagnostics without weakening their public types.
- Documented the JavaScript compatibility baseline and the required build and runtime verification
  process in [TypeScript and JavaScript compatibility](typescript-compatibility.md).

## Next maintenance work

The GitHub issues linked below are the durable source of truth for implementation scope,
acceptance criteria, and validation evidence.

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
