# Repository Guidelines

## Project Structure & Module Organization

- `src/main.ts`: Obsidian plugin entrypoint, settings load/save, settings UI tab.
- `src/engine/`: core traversal/export logic (`BFSTraversal`, `XMLExporter`, `LlmMarkdownExporter`, `PrintFriendlyMarkdownExporter`).
- `src/ui/`: export modal and tree interaction UI.
- `src/utils/`: shared helpers (for example folder filter normalization/matching).
- `tests/`: Vitest suites split by area (`tests/engine`, `tests/ui`, `tests/utils`) plus mocks in `tests/mocks`.
- `docs/`: product/process docs and release/versioning references.

## Build, Test, and Development Commands

- `pnpm install`: install dependencies.
- `pnpm run dev`: incremental development build.
- `pnpm build`: type-check + production build (`main.js`).
- `pnpm lint`: ESLint checks.
- `pnpm format`: run Prettier and apply formatting updates.
- `pnpm format:check`: Prettier check.
- `pnpm test`: full Vitest run with coverage.
- `pnpm vitest run tests/engine/BFSTraversal.test.ts`: run a focused suite.
- `pnpm benchmark`: performance benchmark run.

## Coding Style & Naming Conventions

- Language: TypeScript with strict checks.
- Formatting/linting: Prettier + ESLint (`eslint-plugin-obsidianmd` included).
- Follow existing style (tabs/spacing and sentence-case UI text enforced by lint rules).
- Naming: `PascalCase` for classes/types, `camelCase` for functions/variables, descriptive file names.
- Keep shared logic in `src/utils` when used by multiple modules.
- Document all non-trivial logic with concise JSDoc/comments (public APIs, traversal rules, filtering behavior, caching assumptions).

## Testing Guidelines

- Framework: Vitest.
- Test files: `*.test.ts` under `tests/<domain>/`.
- Add tests for new behavior and edge cases (especially traversal mode/filter interactions).
- Coverage requirement is strict: maintain **100% project coverage** and **100% patch coverage** for changed code.
- Run targeted tests first, then `pnpm test` before opening/updating a PR.

## Documentation & Architecture Notes

- Any user-facing feature change must update `README.md` and `CHANGELOG.md`.
- Any meaningful logic/design change must be documented in `docs/` (new file or update existing).
- Use `docs/` as the source of truth for behavior rules (for example traversal/filtering semantics and release process).
- Obsidian-specific review checklist: `docs/obsidian-plugin-guidelines.md`.
- Keep documentation scope proportional to project size. Do not add large-plugin style doc sprawl unless complexity requires it.
- Preferred baseline docs for this repository:
  - `docs/exclude-folders.md`
  - `docs/export-architecture.md`
  - `docs/startup-process.md`
  - `docs/versioning-and-releases.md`
  - `docs/obsidian-plugin-guidelines.md`
- Add new architecture docs only when introducing a new subsystem or non-trivial lifecycle that cannot be explained by updating existing docs.

## Obsidian Plugin Compliance

- Treat `docs/obsidian-plugin-guidelines.md` as a required pre-PR checklist for plugin behavior, UI, settings, manifest, and release changes.
- Follow current official Obsidian guidance captured in that checklist (`Plugin guidelines`, `Developer policies`, and `Submission requirements`).
- Ensure README disclosures exist when applicable: network use, account/paywall requirements, external file access, ads, telemetry/privacy policy, or closed-source components.
- Keep `manifest.json` values intentional and valid (`id`, `version`, `minAppVersion`, `isDesktopOnly`, concise `description`).
- Update `versions.json` only when `minAppVersion` changes.
- Keep release tags equal to `manifest.json` version (`X.Y.Z`) and publish release assets `main.js`, `manifest.json`, and optional `styles.css`.
- Do not commit `main.js` to source control; ship it as a release artifact.

## Commit & Pull Request Guidelines

- Use Conventional Commits (e.g., `feat:`, `fix:`, `docs:`, `test:`).
- Before committing, always run `pnpm format`, then `pnpm lint`, and finally `pnpm test`.
- PRs should include:
  - clear description and linked issue (`Fixes #...` when applicable),
  - updated tests and docs for user-facing changes,
  - passing lint/format/tests.
- Follow `.github/pull_request_template.md` checklist.

## Versioning & Release Notes

- Use tags without `v` prefix: `X.Y.Z` or prerelease `X.Y.Z-beta.N`.
- Changelog header must match the tag exactly (for release note extraction).
- Changelog section intent:
  - `Added`: new features introduced in that version.
  - `Changed`: behavior/performance/UX refinements to features in that same version.
  - `Fixed`: regressions/bugs that existed in a previously shipped version.
- See `docs/versioning-and-releases.md` for full flow.
