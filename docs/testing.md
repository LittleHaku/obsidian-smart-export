# Testing and coverage

Updated: August 1, 2026

## Test scope

Vitest measures every executable TypeScript module under `src/**/*.ts`, including plugin lifecycle orchestration, Obsidian API wrappers, settings and modal UI, traversal, exporters, and shared utilities.

The sole coverage exclusion is `src/types.ts`. It contains only TypeScript interfaces and type aliases, so the compiler erases the file and it cannot contribute executable statements, branches, functions, or lines. If a runtime value is added to that file, it must be moved to an executable module or the exclusion must be removed.

Broad source-directory exclusions and coverage-ignore comments must not be used to satisfy the thresholds. A genuinely unreachable defensive branch should be simplified when that can be done without changing observable behavior.

## Required thresholds

`vitest.config.ts` enforces these global thresholds locally:

- Statements: 100%
- Branches: 100%
- Functions: 100%
- Lines: 100%

`codecov.yml` independently requires 100% project coverage and 100% patch coverage for pull requests, with no threshold allowance.

## Commands

Run the repository checks in this order before publishing changes:

```bash
pnpm format
pnpm format:check
pnpm lint
pnpm mobile:check
pnpm typecheck
pnpm test
pnpm build
pnpm benchmark:check
```

Use focused Vitest commands while developing, but always finish with `pnpm test` so the complete instrumented source scope and global thresholds are evaluated.

## Cross-platform determinism

Coverage uses Vitest's V8 provider, repository-relative source globs, and LCOV/JSON/HTML/text
reporters. GitHub Actions runs the same formatting, linting, mobile compatibility, type checking,
tests, and builds on Windows, Linux, and macOS. The Windows job also enforces the synthetic
performance baseline. Generated `coverage/` output is ignored and must not be committed.

Tests must not depend on platform-specific path separators, locale-formatted coverage paths, network access, wall-clock timing, or test execution order.
