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
5. Click **Export to clipboard**.

## 3 Features

- Smart note discovery using breadth-first traversal.
- Link direction modes: outgoing, incoming, or both.
- Dual depth controls:
  - content depth (full content)
  - title depth (title-only context)
- Folder exclusion (`Ignored folders`) for traversal.
- Output formats: XML, LLM Markdown, Print-friendly Markdown.
- Token estimate display before export.

## 4 Settings

Settings location: **Obsidian → Settings → Smart Export**

- **Default content depth**: `1-20`
- **Default title depth**: `1-20`
- **Default export format**
- **Default link direction**
- **Ignored folders**: one folder path per line; excluded from traversal/export
- **Auto-select current note**
- **Close modal after export**
- **Show per-note token estimates**

Folder exclusion details: [Excluded folders](docs/exclude-folders.md)

## 5 Keyboard Shortcut

- Primary command: `Smart Export: Open export`
- Assign your own shortcut in **Settings → Hotkeys**.

## 6 Documentation

- [Excluded folders](docs/exclude-folders.md)
- [Versioning and releases](docs/versioning-and-releases.md)
- [Product requirements document](docs/PRD.md)
- [Development tasks](docs/TASKS.md)
- [Contributing guide](CONTRIBUTING.md)

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

## 11 License

MIT License. See [LICENSE](LICENSE).
