# Versioning and Releases

Updated: February 16, 2026

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

## Changelog rule

Changelog section headers must match the tag version exactly.

If the tag is:

- `1.3.0-beta.1` then `CHANGELOG.md` should include `## [1.3.0-beta.1]`
- `1.3.0` then `CHANGELOG.md` should include `## [1.3.0]`

If no matching section exists, release notes fallback text is generated automatically.

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

1. Bump to stable version:

```bash
pnpm version 1.3.0 --no-git-tag-version
```

2. Consolidate/rename prerelease changelog notes under:

```md
## [1.3.0] - YYYY-MM-DD
```

3. Commit and push.
4. Create and push stable tag:

```bash
git tag -a 1.3.0 -m "1.3.0"
git push origin 1.3.0
```

## Files updated by version bump

`pnpm version ... --no-git-tag-version` updates:

- `package.json`
- `manifest.json` (via `version-bump.mjs`)
- `versions.json` (via `version-bump.mjs`)
