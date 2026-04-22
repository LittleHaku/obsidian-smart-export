# Versioning and Releases

Updated: March 4, 2026

## Overview

This project uses semantic versioning with a strict tag/version format:

- Use `X.Y.Z` for stable releases (example: `1.3.0`)
- Use `X.Y.Z-beta.N` / `X.Y.Z-alpha.N` / `X.Y.Z-canary.N` for prereleases
- Do **not** use a `v` prefix

Examples:

- `1.3.0`
- `1.3.0-beta.1`
- `1.3.0-canary.2`

Invalid examples:

- `v1.3.0`
- `release-1.3.0`

## Why this matters

The release workflow is triggered on tag push and determines prerelease status from the tag name:

- If tag contains `beta`, `alpha`, or `canary` → GitHub prerelease
- Otherwise → normal GitHub release

## Branch and tagging policy

- Prefer merging release-ready PRs into `main` as a **single squash commit** to keep history clean.
- Create and push **stable release tags only from `main`** (after merge), not from feature branches.
- This avoids duplicate release builds and keeps release provenance unambiguous.

## Changelog rule

Changelog section headers must match the tag version exactly.

If the tag is:

- `1.3.0-beta.1` then `CHANGELOG.md` should include `## [1.3.0-beta.1]`
- `1.3.0` then `CHANGELOG.md` should include `## [1.3.0]`

If no matching section exists, release notes fallback text is generated automatically.

Use section types consistently:

- `Added`: new features introduced in that version.
- `Changed`: behavior/performance/UX refinements to features being shipped in that same version.
- `Fixed`: regressions/bugs from an already shipped version (not just in-progress branch work).

## Update modal rule

Smart Export's in-app "What's new" modal does not read `CHANGELOG.md` at runtime.
It uses bundled structured release-note data from:

- `src/constants/releaseNotes.ts`

When preparing a release, keep these in sync:

1. Add or update the matching section in `CHANGELOG.md`.
2. Add the corresponding bundled entry in `src/constants/releaseNotes.ts`.

Treat `CHANGELOG.md` as the human-readable release history and `src/constants/releaseNotes.ts`
as the runtime source for the post-update modal.

The post-update modal intentionally uses a grouped recap window for version ranges.
When upgrading between two known versions, the modal may include both the previous
release and the new release in the same view instead of showing only strictly unseen
entries. This matches the intended "what's new" recap behavior.

## Prerelease flow (for BRAT testing)

Use this flow when a feature is still in a PR branch and should be tested without a final release:

1. On your branch, bump version to a prerelease:

```bash
pnpm version 1.3.0-beta.1 --no-git-tag-version
```

2. Add matching changelog entry:

```md
## [1.3.0-beta.1] - YYYY-MM-DD
```

3. Commit and push branch.
4. Create and push the prerelease tag:

```bash
git tag -a 1.3.0-beta.1 -m "1.3.0 beta 1"
git push origin 1.3.0-beta.1
```

5. Share release for BRAT testing.

## Final release flow

After merge and validation:

1. Prepare release changes in your PR branch (version files + changelog), then merge into `main` using a single squash commit.
2. On `main`, validate that `package.json`, `manifest.json`, `versions.json`, and `CHANGELOG.md` are aligned.
3. Create and push the stable tag from `main`:

```bash
git tag -a 1.3.0 -m "1.3.0"
git push origin 1.3.0
```

4. If you shipped prerelease notes, ensure they are consolidated under:

```md
## [1.3.0] - YYYY-MM-DD
```

## Files updated by version bump

`pnpm version ... --no-git-tag-version` updates:

- `package.json`
- `manifest.json` (via `version-bump.mjs`)
- `versions.json` (via `version-bump.mjs`)
