# Smart Export

[![CI/CD](https://github.com/LittleHaku/obsidian-smart-export/actions/workflows/ci.yml/badge.svg)](https://github.com/LittleHaku/obsidian-smart-export/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/LittleHaku/obsidian-smart-export/branch/main/graph/badge.svg)](https://codecov.io/gh/LittleHaku/obsidian-smart-export/branch/main)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/github/v/release/LittleHaku/obsidian-smart-export)](https://github.com/LittleHaku/obsidian-smart-export/releases)
[![Downloads](https://img.shields.io/github/downloads/LittleHaku/obsidian-smart-export/total)](https://github.com/LittleHaku/obsidian-smart-export/releases)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-support%20me-orange?logo=buy-me-a-coffee&logoColor=white&style=flat)](https://buymeacoffee.com/littlehaku)

Smart Export follows links from a root note, builds a note tree, and exports it in formats that work well for both humans and LLMs.

## 1 Installation

### 1.1 BRAT (current installation method)

Use [BRAT (Beta Reviewers Auto-update Tool)](https://github.com/TfTHacker/obsidian42-brat):

1. In Obsidian, open **Settings → Community plugins → Browse** and install **BRAT**.
2. Open BRAT settings and click **Add a beta plugin**.
3. Paste: `https://github.com/LittleHaku/obsidian-smart-export`
4. Select the latest release.

### 1.2 Community plugins (when available)

1. Open **Settings → Community plugins**.
2. Turn off **Restricted mode**.
3. Click **Browse**, search for **Smart Export**, then install and enable it.

## 2 Quick Start

1. Open command palette (`Cmd/Ctrl+P`) and run `Smart Export: Open export` (or click the ribbon icon).
2. Select a root note.
3. Set depth values (recommended start: content `2`, title `4`).
4. Choose output format.
5. Click **Export to clipboard** or **Export to new note**.

`Export to new note` prompts for a vault-relative folder and note name, then creates the Markdown note using your default folder/open preferences from settings.

## 3 Features

- Smart note discovery using breadth-first traversal.
- Link direction modes: outgoing, incoming, or both.
- Dual depth controls:
  - content depth (full content)
  - title depth (title-only context)
- Folder exclusion (`Ignored folders`) for traversal with comma-separated wildcard/path patterns.
- Tag/property exclusion rules for traversal (`Hide notes with tags`, `Hide notes with property rules`).
- Output formats: XML, Markdown templates, Print-friendly Markdown.
- Multiple Markdown templates (built-in + custom folder templates) with placeholder support.
- Export delivery options: copy to clipboard or create a new note in the vault after choosing folder and note name.
- Markdown-based exports rewrite links to exported notes into Obsidian heading links so they stay navigable inside the generated note.
- Print-friendly Markdown can add a linked table of contents, numbered headings, and section dividers for easier PDF scanning.
- Token estimate display before export.

## 4 Settings

Settings location: **Obsidian → Settings → Smart Export**

### 4.1 Export defaults

- **Default content depth**: `1-20`
- **Default title depth**: `1-20`
- **Default output**: XML, print-friendly Markdown, `LLM-ready`, or your custom templates
- **Default export target**: clipboard or new note
- **Default link direction**
- **Default export note folder**: vault-relative folder for new export notes (leave empty to use the source note folder)

### 4.2 Traversal exclusions

- **Ignored folders**: comma-separated folders/patterns (for example `templates, assets*, /archive`) excluded from traversal/export. Leading `/` anchors to vault root.
- **Hide notes with tags**: comma-separated tag patterns (for example `archive*, #draft, projects/*/old`) excluded from traversal/export.
- **Hide notes with property rules**: comma-separated rules using `key` or `key=value` (for example `status=done, published=true, archived`) excluded from traversal/export.

### 4.3 Markdown templates

- **Markdown template folder**: vault-relative folder for custom Markdown templates, with folder autocomplete

### 4.4 Print-friendly Markdown

- **Include table of contents**: adds a linked table of contents to print-friendly exports
- **Number headings**: prefixes exported note headings with section numbers such as `1.` and `1.1`
- **Insert section dividers**: adds divider lines between note sections in print-friendly exports

### 4.5 Export modal behavior

- **Auto-select current note**
- **Close modal after export**
- **Open created export note**
- **Show per-note token estimates**

Exclusion details (folders/tags/properties): [Exclusion rules](docs/exclude-folders.md)

### 4.6 Markdown templates

For Markdown template exports, Smart Export can load a custom template from your vault:

1. Choose a template folder in **Settings → Smart Export → Markdown template folder**.
2. Create one or more `.md` notes in that folder.
3. Add placeholders from [template docs](templates/README.md) to those notes.

Default folder: `smart-templates` (you can change it).

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

## 5 Keyboard Shortcut

- Primary command: `Smart Export: Open export`
- Quick command: `Smart Export: Quick export current note` (uses default settings and follows your configured default export target)
- Assign your own shortcut in **Settings → Hotkeys**.

## 6 Documentation

- [Documentation index](docs/README.md)
- [API reference](docs/api-reference.md)
- [Exclusion rules](docs/exclude-folders.md)
- [Export architecture](docs/export-architecture.md)
- [Startup process](docs/startup-process.md)
- [Versioning and releases](docs/versioning-and-releases.md)
- [Template placeholders](templates/README.md)
- [Contributing guide](CONTRIBUTING.md)
- [Roadmap and feature backlog (GitHub Issues)](https://github.com/LittleHaku/obsidian-smart-export/issues)

## 7 Example Output

### 7.1 XML (excerpt)

```xml
<obsidian_export>
  <metadata>
    <starting_note>Machine Learning</starting_note>
    <total_notes_exported>5</total_notes_exported>
  </metadata>
</obsidian_export>
```

### 7.2 LLM Markdown (excerpt)

```markdown
# Smart Export Vault

- Starting Note: Machine Learning
- Total Notes: 5
```

## 8 Troubleshooting

### 8.1 Empty export or missing notes

- Ensure the root note exists.
- Ensure links resolve to real notes.
- Check that excluded folders are not filtering expected notes.

### 8.2 Export too large

- Use **Export to new note** to avoid clipboard limits for large exports.
- Set **Default export target** to `New note` if your quick-export hotkey should create files instead of using the clipboard.
- Lower content/title depth.
- Switch to Print-friendly Markdown.
- Start from a more specific root note.

## 9 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

Quick setup:

```bash
git clone https://github.com/LittleHaku/obsidian-smart-export.git
cd obsidian-smart-export
pnpm install
pnpm run dev
```

Benchmark:

```bash
pnpm benchmark
```

## 10 Support

- Star the repo.
- Report bugs and request features in [GitHub Issues](https://github.com/LittleHaku/obsidian-smart-export/issues).
- Support development: [Buy me a coffee](https://buymeacoffee.com/littlehaku).

[![Star History Chart](https://api.star-history.com/image?repos=LittleHaku/obsidian-smart-export&type=date&legend=top-left)](https://www.star-history.com/?repos=LittleHaku%2Fobsidian-smart-export&type=date&legend=top-left)

## 11 License

MIT License. See [LICENSE](LICENSE).
