# Submission and release

## Manifest and metadata

Before release, verify:

- `manifest.json` has intentional values for `id`, `name`, `version`, `minAppVersion`, `description`, `isDesktopOnly`.
- `id` remains stable after release.
- `description` is concise (max 250 chars), sentence case, and ends with a period.
- `description` avoids emoji/special characters and avoids starting with "This is a plugin".
- `fundingUrl` exists only when real support links are provided.
- Command IDs do not manually include the plugin ID.

## Submission prerequisites

Before submitting, repository root includes:

- `README.md` describing plugin purpose and usage.
- `LICENSE`.
- `manifest.json`.
- Committed lockfile (`pnpm-lock.yaml` for this repo).

## Version mapping

- PRs that change shipped plugin behavior or runtime code must include their intended release version.
- Documentation, agent-guidance, or infrastructure-only PRs with no shipped runtime impact may use `Release: none` and omit version metadata changes.
- Use `pnpm version <version> --no-git-tag-version` to update `package.json`, `manifest.json`, and the new `versions.json` mapping.
- Keep `CHANGELOG.md` and `src/constants/releaseNotes.ts` aligned with that version.
- Do not rewrite historical `versions.json` mappings unless correcting a documented compatibility error.
- Release tag must match plugin version exactly:
  - Stable: `X.Y.Z`
  - Prerelease: `X.Y.Z-beta.N`
- Do not prefix tags with `v`.

## Required release assets

- `main.js`
- `manifest.json`
- `styles.css` (only if present)

## Release build quality

- Release `main.js` should be a production build.

## Compliance references

- `reference/obsidian-plugin-guidelines.md` is the repository pre-release checklist used by agent tooling.
- Official references:
  - https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines
  - https://docs.obsidian.md/Developer+policies
  - https://docs.obsidian.md/Plugins/Releasing/Submission+requirements+for+plugins
  - https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin
  - https://docs.obsidian.md/Reference/Manifest

## Repo policy

- Generated artifacts like `main.js` are release artifacts and should not be committed to source control.
