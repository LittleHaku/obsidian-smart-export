# Automated release QA

Updated: August 1, 2026

Release validation is intentionally reproducible and unattended. A contributor does not need a
device lab, a second operating system, an Obsidian test vault, screenshots, or manually recorded
startup timings to prepare a release.

## Release gate

A release candidate is ready when the required `Test & Lint` and `Build Plugin` GitHub checks pass
on its exact commit and the release metadata is aligned. Those aggregate checks cover every job in
the platform matrices, so a skipped, cancelled, or failed matrix job cannot produce a passing gate.

Manual desktop or mobile testing is optional exploratory testing. It can discover integration
issues that a plugin repository cannot reproduce without Obsidian's application binaries, but it
does not block a release and no manual evidence document is required.

## Automated platform matrix

GitHub Actions installs dependencies from the lockfile and validates the plugin on
`windows-latest`, `ubuntu-latest`, and `macos-latest`:

```bash
corepack enable pnpm
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm mobile:check
pnpm typecheck
pnpm test
pnpm build
```

The Windows test job benchmarks the target branch and candidate on the same runner, then applies
the target branch's committed tolerances. The aggregate `Test & Lint` check requires the entire
matrix, including that performance gate, to succeed.

## Mobile compatibility

`pnpm mobile:check` parses the TypeScript runtime source and fails when it finds:

- a Node.js or Electron module import, export, `require()`, or dynamic import;
- `process.platform` instead of Obsidian's `Platform` helpers;
- regular-expression lookbehind in literals or statically defined `RegExp` constructors without an
  older-mobile fallback;
- a manifest that no longer declares `isDesktopOnly` as `false`.

ESLint's Obsidian rules provide an independent API-policy check. Vitest exercises the plugin with
the mocked Obsidian runtime, while the production build proves the platform-neutral bundle can be
created on all three desktop runner operating systems.

GitHub-hosted runners do not own or distribute the Obsidian Android and iOS applications. For that
reason, the repository does not claim that CI launches Obsidian on a physical phone or tablet. A
device-specific failure should be filed as a bug with the available model, operating-system, ROM,
and Obsidian details; reproducing it is not routine release work.

## Startup behavior

`tests/main.test.ts` is the startup gate. It must continue to prove that `onload()` performs no
vault-wide file enumeration, metadata scan, cached note read, or export traversal. The vault
`create` listener must remain inside `workspace.onLayoutReady(...)`.

Obsidian's interactive startup profiler remains a diagnostic tool for investigating a reported
regression. Repeated cold launches and manually transcribed medians are not release requirements.

## Performance gate

`pnpm benchmark:check` runs deterministic synthetic 1,365-note traversal and 10,000-note tag
fixtures. Locally it compares their medians with `benchmarks/baseline.json`. GitHub Actions instead
benchmarks the target branch and candidate on the same Windows runner, avoiding comparisons
between unrelated hardware and anchoring the accepted tolerances to the target branch. Both modes
fail when those tolerances are exceeded, and neither reads a private vault.

The benchmark is executed automatically by GitHub Actions. A baseline may be updated only for an
intentional, reviewed fixture or environment change, never simply to turn a failing check green.

## Release decision

The release PR or workflow URL is the validation record. Before tagging, verify that:

1. `Test & Lint` passed for the exact release commit;
2. `Build Plugin` passed for the exact release commit;
3. `package.json`, `manifest.json`, `versions.json`, `CHANGELOG.md`, and bundled release notes are
   aligned;
4. no unresolved release-blocking regression is linked from the PR.

No separate QA template, device matrix, screenshot collection, or manual timing sheet is needed.

## References

- [Obsidian load-time guide](https://docs.obsidian.md/plugins/guides/load-time)
- [Performance benchmark methodology](../benchmarks/README.md)
- [Startup process](startup-process.md)
- [Testing and coverage](testing.md)
