# Smart Export

[![Version](https://img.shields.io/github/v/release/LittleHaku/obsidian-smart-export)](https://github.com/LittleHaku/obsidian-smart-export/releases)
[![Downloads](https://img.shields.io/badge/dynamic/json?logo=obsidian&color=%23483699&label=Downloads&query=%24%5B%22smart-export%22%5D.downloads&suffix=%20installs&url=https%3A%2F%2Fraw.githubusercontent.com%2Fobsidianmd%2Fobsidian-releases%2Fmaster%2Fcommunity-plugin-stats.json)](https://obsidian.md/plugins?id=smart-export)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-support%20me-orange?logo=buy-me-a-coffee&logoColor=white&style=flat)](https://buymeacoffee.com/littlehaku)

Smart Export turns one Obsidian note into a clean exportable context bundle by following wikilinks to a configurable depth. It is built for people who want readable note packets, print-friendly exports, or structured context for LLM workflows without manually stitching notes together.

Landing page: [smart-export.vercel.app](https://smart-export.vercel.app/)

Smart Export 1.16.0 and later require Obsidian 1.13.0 or newer. Smart Export 1.15.3 remains available for older Obsidian installations.

## Why Smart Export

- Follow outgoing links, backlinks, or both from a root note.
- Export all notes matching a tag as top-level roots.
- Include disconnected notes or tags in the export modal.
- Export as XML, print-friendly Markdown, or Markdown templates such as `LLM-ready`.
- Exclude folders, tags, and notes based on frontmatter properties (property rules) from traversal.
- Optionally redact marked private sections from exported note content.
- Copy exports to the clipboard or create a new note directly in your vault.
- Rewrite links between exported notes, and preserve referenced exported headings when possible, so navigation still works inside the generated Markdown note.

## Installation

### Community Plugins (recommended)

1. Open **Settings → Community plugins**.
2. Turn off **Restricted mode** if needed.
3. Click **Browse**, search for **Smart Export**, then install and enable it.

### BRAT (optional beta testing only)

Use [BRAT (Beta Reviewers Auto-update Tool)](https://github.com/TfTHacker/obsidian42-brat) only if you want to test prerelease builds before they reach the Community Plugins catalog.

1. In Obsidian, open **Settings → Community plugins → Browse** and install **BRAT**.
2. Open BRAT settings and click **Add a beta plugin**.
3. Paste: `https://github.com/LittleHaku/obsidian-smart-export`
4. Select the latest prerelease you want to test.

## Quick Start

1. Open command palette (`Cmd/Ctrl+P`) and run `Smart Export: Open export` (or click the ribbon icon).
2. Select a root note, or switch **Source** to **Tag** and choose a tag.
3. Optionally include disconnected notes as **single note** or **new root** entries, or include another tag.
4. Set depth values (recommended start: content `2`, title `4`).
5. Choose output format.
6. Click **Export to clipboard** or **Export to new note**.

`Export to new note` prompts for a vault-relative folder and note name, then creates the Markdown note using your default folder/open preferences from settings.

## Export Formats

- **XML** for structured machine-readable exports.
- **Markdown templates** for prompt and context workflows, including the built-in `LLM-ready` template and custom templates loaded from your vault.
- **Print-friendly Markdown** for readable note bundles, PDF export, linked tables of contents, and normalized nested headings.

## Core Features

- Smart note discovery using breadth-first traversal.
- Tag source exports that start from every matching inline or frontmatter tag.
- Link direction modes: outgoing, incoming, or both.
- Session-only extra notes in the export modal:
  - single note includes just the selected note
  - new root starts another tree from that note
- Session-only extra tags that add matching notes as additional export roots.
- Dual depth controls:
  - content depth for full note content
  - title depth for title-only context
- Folder exclusion with comma-separated wildcard or path patterns.
- Tag and property exclusion rules for traversal.
- Optional content redaction for private sections marked with a delimiter such as `:::private text:::`.
- Linked table of contents, numbered headings, section dividers, and page breaks for print-friendly Markdown.
- Built-in and custom Markdown templates with placeholder support.
- Token estimate display before export.
- One-time in-app "What's new in Smart Export" modal after plugin updates.

## Settings

Settings location: **Obsidian → Settings → Smart Export**

On Obsidian 1.13+, Smart Export settings are indexed by the global settings search. Redaction detail controls appear when their corresponding redaction mode is enabled, and folder fields use Obsidian's native vault-folder suggestions.

### Export defaults

- **Default content depth**: `1-20`
- **Default title depth**: `1-20`
- **Default output**: XML, print-friendly Markdown, `LLM-ready`, or your custom templates
- **Default export target**: clipboard or new note
- **Default link direction**
- **Default export note folder**: vault-relative folder for new export notes (leave empty to use the source note folder)

### Traversal exclusions

- **Ignored folders**: comma-separated folders/patterns (for example `templates, assets*, /archive`) excluded from traversal/export. Leading `/` anchors to vault root.
- **Hide notes with tags**: comma-separated tag patterns (for example `archive*, #draft, projects/*/old`) excluded from traversal/export.
- **Hide notes with property rules**: comma-separated rules using `key` or `key=value` (for example `status=done, published=true, archived`) excluded from traversal/export.

Tag source exports use tags from Obsidian metadata, including inline tags and frontmatter `tag`/`tags`. Tag suggestions are built on demand and cached until Obsidian reports metadata or vault changes. Matching notes are grouped as top-level export roots in vault-path order, and folder/tag/property exclusions still remove matching notes from the export.

### Content redaction

- **Redact marked sections**: replaces private sections during export without editing source notes.
- **Redaction delimiter**: exact marker used at both ends of private text. Default: `:::`, so `:::private text:::` becomes `REDACTED`.
- **Marked section replacement**: text inserted in the export for each marked section. Default: `REDACTED`.
- **Apply regular expression redaction rules**: enables pattern-based export cleanup separately from marked-section redaction.
- **Regular expression redaction rules**: optional regular expression rules, one per line, for removing patterned content such as footnotes, image embeds, URLs, comments, or private YAML lines. Example rules are prefilled but inactive until enabled.
- **Regular expression replacement**: text inserted for regular expression matches. Leave blank to remove matches.
- **Test content redaction**: live sample input and redacted result preview for checking delimiter and regular expression redaction before exporting.

### Markdown templates

- **Markdown template folder**: vault-relative folder for custom Markdown templates, with folder autocomplete

### Print-friendly Markdown

- **Include table of contents**: adds a linked table of contents to print-friendly exports
- **Number headings**: prefixes exported note headings with section numbers such as `1.` and `1.1`
- **Insert section dividers**: adds divider lines between note sections in print-friendly exports
- **Insert page breaks**: starts each note section after the first on a new page and replaces section dividers
- **Normalize content headings**: shifts headings inside included notes below the exported note title heading

By default, included note content headings are normalized below the exported note title heading so nested note sections remain visually subordinate in print-friendly output. Turn off **Normalize content headings** to preserve source heading levels exactly.

### Export modal behavior

- **Auto-select current note**
- **Close modal after export**
- **Open created export note**
- **Show per-note token estimates**

Exclusion details (folders/tags/properties): [Exclusion rules](docs/exclude-folders.md)

## Using Markdown Templates

For Markdown template exports, Smart Export can load a custom template from your vault:

1. Choose a template folder in **Settings → Smart Export → Markdown template folder**.
2. Create one or more `.md` notes in that folder.
3. Add placeholders from [template docs](templates/README.md) to those notes.

Default folder: `smart-templates` (you can change it).
The selected folder must be visible inside Obsidian; hidden or excluded folders are not available as template sources.

Template selection:

- In the export modal, use the **Output** dropdown.
- It includes XML, print-friendly Markdown, and Markdown template options.
- Markdown template options include built-in templates and templates found in your configured folder.
- Built-in templates are always available as fallback.

Default recommendation:

- In settings, the built-in option shown is **LLM-ready**.
- This template is the recommended baseline because it includes structured guidance text for prompt/context ingestion.
- Additional templates like `compact` are provided as examples for users who want starting points.

Resolution order (only when no explicit template is selected / `templateId` is omitted):

- `<template-folder>/llm-markdown.md`
- first `.md` file in `<template-folder>` (alphabetical path order)
- built-in default template if no custom template is found via the above rules

Placeholder reference: [`templates/README.md`](templates/README.md)

`{{metadata_yaml}}` includes the full YAML block with `---` delimiters and keys like
`export_timestamp`, `starting_note`, `total_notes_exported`, and `missing_notes_count`.

## Keyboard Shortcuts

- Primary command: `Smart Export: Open export`
- Quick command: `Smart Export: Quick export current note` (uses default settings and follows your configured default export target)
- Assign your own shortcut in **Settings → Hotkeys**.

## Documentation

- [Documentation index](docs/README.md)
- [API reference](docs/api-reference.md)
- [Exclusion rules](docs/exclude-folders.md)
- [Content redaction](docs/content-redaction.md)
- [Export architecture](docs/export-architecture.md)
- [Startup process](docs/startup-process.md)
- [Versioning and releases](docs/versioning-and-releases.md)
- [Template placeholders](templates/README.md)
- [Contributing guide](CONTRIBUTING.md)
- [Roadmap and feature backlog (GitHub Issues)](https://github.com/LittleHaku/obsidian-smart-export/issues)

## Example Output

### XML (excerpt)

```xml
<obsidian_export>
  <metadata>
    <starting_note>Machine Learning</starting_note>
    <total_notes_exported>5</total_notes_exported>
  </metadata>
</obsidian_export>
```

### LLM Markdown (excerpt)

```markdown
# Smart Export Vault

- Starting Note: Machine Learning
- Total Notes: 5
```

## Troubleshooting

### Empty export or missing notes

- Ensure the root note exists.
- Ensure links resolve to real notes.
- Check that excluded folders are not filtering expected notes.

### Export too large

- Use **Export to new note** to avoid clipboard limits for large exports.
- Set **Default export target** to `New note` if your quick-export hotkey should create files instead of using the clipboard.
- Lower content/title depth.
- Switch to Print-friendly Markdown.
- Start from a more specific root note.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

Quick setup:

```bash
git clone https://github.com/LittleHaku/obsidian-smart-export.git
cd obsidian-smart-export
pnpm install
pnpm run dev
```

Optional WSL/Linux workflow:

- Keep the repo on the Linux filesystem for faster `pnpm`/TypeScript/esbuild performance.
- Create a local-only `.env.local` from `.env.example`.
- Set `OBSIDIAN_PLUGIN_DIR` to your Windows or vault plugin folder, for example `.../.obsidian/plugins/smart-export`.
- With that env var set, `pnpm dev` and `pnpm build` keep their normal OSS behavior and also mirror `main.js`, `manifest.json`, and `styles.css` into your local Obsidian plugin directory.
- `.env.local` is git-ignored, so contributors can use different vault paths without changing the repo.

Benchmark:

```bash
pnpm benchmark
```

See [recorded benchmark results](benchmarks/README.md) for the current synthetic baseline
and methodology.

## Support

- Star the repo.
- Report bugs and request features in [GitHub Issues](https://github.com/LittleHaku/obsidian-smart-export/issues).
- Support development: [Buy me a coffee](https://buymeacoffee.com/littlehaku).

[![Star History Chart](https://api.star-history.com/image?repos=LittleHaku/obsidian-smart-export&type=date&legend=top-left)](https://www.star-history.com/?repos=LittleHaku%2Fobsidian-smart-export&type=date&legend=top-left)

## License

MIT License. See [LICENSE](LICENSE).
