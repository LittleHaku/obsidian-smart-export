# Obsidian Plugin Review Checklist

Updated: March 3, 2026

Use this checklist for feature reviews, pre-release checks, and PRs that affect plugin behavior.

## Source of truth

- https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines
- https://docs.obsidian.md/Developer+policies
- https://docs.obsidian.md/Plugins/Releasing/Submission+requirements+for+plugins
- https://docs.obsidian.md/Reference/Manifest
- https://docs.obsidian.md/Reference/Versions
- https://docs.obsidian.md/Plugins/Getting+started/Mobile+development
- https://docs.obsidian.md/Plugins/Guides/Optimize+plugin+load+time
- https://docs.obsidian.md/oo/plugin

## Policy and disclosure blockers

- [ ] No code obfuscation, dynamic ads, client-side telemetry, or self-updater mechanisms.
- [ ] README discloses any required account, paid features, network use, external file access, ads, server-side telemetry, and privacy policy (if telemetry exists).
- [ ] License and third-party attribution obligations are met.
- [ ] Plugin naming/branding does not imply first-party Obsidian ownership.

## Manifest and release metadata

- [ ] `manifest.json` is valid and complete (`id`, `name`, `version`, `minAppVersion`, `description`, `author`, `isDesktopOnly`).
- [ ] `id` does not contain `obsidian` and matches the plugin folder name in local dev.
- [ ] `description` is concise, under 250 chars, sentence case, and ends with a period.
- [ ] `isDesktopOnly` is `true` if Node/Electron APIs are required.
- [ ] `minAppVersion` is set intentionally.
- [ ] If `minAppVersion` changed, `versions.json` is updated (only required when min version changes).
- [ ] GitHub release tag exactly matches `manifest.json` version in `x.y.z` format.
- [ ] Release assets include `main.js`, `manifest.json`, and optional `styles.css`.
- [ ] `fundingUrl` is present only when real support links exist.

## API correctness and data safety

- [ ] Use `this.app`, not global `app`/`window.app`.
- [ ] Prefer Vault API over Adapter API.
- [ ] Do not scan all files to resolve a path; use `getFileByPath`, `getFolderByPath`, or `getAbstractFileByPath`.
- [ ] For active note edits, use Editor APIs instead of `Vault.modify`.
- [ ] For background edits, use `Vault.process`.
- [ ] For frontmatter updates, use `FileManager.processFrontMatter`.
- [ ] Use `normalizePath()` for user-defined or constructed vault paths.
- [ ] Use `Plugin.loadData()` / `Plugin.saveData()` for plugin data storage.
- [ ] Use `FileManager.trashFile` rather than direct hard delete behavior.

## Lifecycle, workspace, and commands

- [ ] Register events/resources through lifecycle helpers (`registerEvent`, `registerInterval`, command registration helpers, etc.).
- [ ] Do not detach user leaves in `onunload()`.
- [ ] Avoid direct `workspace.activeLeaf` assumptions; use `getActiveViewOfType()` / `activeEditor`.
- [ ] Do not keep long-lived direct references to custom views; resolve leaves/views when needed.
- [ ] No default command hotkeys.
- [ ] Command IDs are not prefixed manually with plugin ID, and command names do not repeat plugin name.
- [ ] Use correct callback type (`callback`, `checkCallback`, `editorCallback`, `editorCheckCallback`).

## UI and styling

- [ ] UI text uses sentence case.
- [ ] Settings headings are only used when there are multiple sections.
- [ ] Settings headings avoid redundant words like "settings" or "options".
- [ ] Use `Setting(...).setName(...).setHeading()` rather than raw `<h1>/<h2>` in settings UI.
- [ ] Do not hardcode styles in JS/HTML; use CSS classes and Obsidian CSS variables.
- [ ] Avoid unnecessary console logging in normal usage.

## Security and DOM handling

- [ ] Avoid `innerHTML`, `outerHTML`, and `insertAdjacentHTML` with dynamic/user content.
- [ ] Build DOM via safe APIs (`createEl`, `createDiv`, `createSpan`, DOM methods).
- [ ] Clear container content with `el.empty()` where appropriate.
- [ ] Dependency footprint is justified and minimized.
- [ ] Lockfile is committed (`pnpm-lock.yaml`, `package-lock.json`, or `yarn.lock`).

## Mobile compatibility

Complete this section when `isDesktopOnly` is `false`.

- [ ] Node/Electron-only modules are not imported at top level; desktop-only logic is gated with `Platform` checks and runtime `require()` when needed.
- [ ] `Vault.adapter` casts to `FileSystemAdapter` are guarded with `instanceof`.
- [ ] `process.platform` is not used for app-platform branching; Obsidian `Platform` helpers are used.
- [ ] Regex lookbehind has fallback behavior for iOS versions below 16.4 (if applicable).
- [ ] Networking uses Obsidian `requestUrl` where needed instead of browser/library defaults when Obsidian API behavior is required.
- [ ] `pnpm mobile:check` passes; physical-device testing is optional exploratory testing when a
      suitable device is available.

## Performance and startup behavior

- [ ] `onload()` does only essential registration work.
- [ ] Heavy work and startup UI initialization are deferred (for example `workspace.onLayoutReady()`).
- [ ] `vault.on("create")` handlers are layout-ready aware to avoid startup storms.
- [ ] Custom view constructors avoid expensive work at startup.
- [ ] Production build is released, and `main.js` is minimized.
- [ ] Automated lifecycle tests prove startup remains registration-only; interactive profiling is
      reserved for investigating reported regressions.

## Repository hygiene before submission

- [ ] Placeholder sample class names and sample code are removed.
- [ ] `README.md`, `LICENSE`, and `manifest.json` exist at repository root.
- [ ] `main.js` is not committed to source control and is shipped via release artifacts.
