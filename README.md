# Smart Export

[![CI/CD](https://github.com/LittleHaku/obsidian-smart-export/actions/workflows/ci.yml/badge.svg)](https://github.com/LittleHaku/obsidian-smart-export/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/LittleHaku/obsidian-smart-export/branch/main/graph/badge.svg)](https://codecov.io/gh/LittleHaku/obsidian-smart-export/branch/main)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/github/v/release/LittleHaku/obsidian-smart-export)](https://github.com/LittleHaku/obsidian-smart-export/releases)
[![Downloads](https://img.shields.io/github/downloads/LittleHaku/obsidian-smart-export/total)](https://github.com/LittleHaku/obsidian-smart-export/releases)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-support%20me-orange?logo=buy-me-a-coffee&logoColor=white&style=flat)](https://buymeacoffee.com/littlehaku)

Obsidian plugin that lets you export your notes by following the wikilinks until a certain depth. It is optimized for human readable exports and LLM exports.

Ever found yourself manually copying notes from Obsidian to paste into ChatGPT or Claude? I built this plugin to solve that exact problem.

If not, did you ever want to review all your notes on a certain topic and got lost in all your wikilinks? This plugin also solves that.

Smart Export automatically finds all the notes connected to your starting point and exports them in a format that both humans and LLMs can actually work with. No more copy-pasting individual notes or losing the connections between your ideas. And no more having to export dozens of notes to then be able to haven them all in a PDF.

## What it does

### Smart note discovery

The plugin follows your wikilinks to find related notes, just like you would when exploring your vault. It uses a breadth-first search, so it gathers all the notes that are linked from your root note, then does the same for all the gathered ones until a certain depth.

### Flexible depth control

You can control how deep it goes in two ways:

- **Content depth**: How many levels of notes to include with full content
- **Title depth**: A different depth that only will include the note titles.

The title depth is mainly thought for when working with LLMs, so you can pass them your notes until a given depth but then the title of more notes so that they know that they exist without filling the LLM's context.

### Multiple export formats

- **XML**
- **LLM Markdown**
- **Print-friendly**

### Token awareness

The plugin estimates how many tokens your export will use and warns you if you're approaching common LLM limits (like GPT-4's 128k or Claude's 200k).

## Getting started

### Installation

For beta testing and the easiest way to install pre-release plugins, use the [BRAT (Beta Reviewers Auto-update Tool)](https://github.com/TfTHacker/obsidian42-brat) plugin by TfTHacker:

1. In Obsidian, go to **Settings → Community Plugins → Browse** and search for "BRAT" by TfTHacker. Install and enable it.
2. Once BRAT is enabled, open its settings and click **Add a new plugin**.
3. Paste this repository link: `https://github.com/LittleHaku/obisidian-smart-export`
4. Select the latest version when prompted.
5. BRAT will handle installation and updates for you.

This is the recommended way to beta test plugins, as it keeps everything up to date and avoids manual file management.

## How to use it

1. **Open the export dialog**: Click the 🧠 brain icon or use Cmd/Ctrl+P → "Smart Export"
2. **Pick your starting note**: It'll default to your current note, or you can choose any note
3. **Set your depths**: I recommend starting with Content Depth: 3, Title Depth: 6
4. **Choose your format**: XML for structured data, Markdown for readability
5. **Export**: Click "Export to Clipboard" and paste into your favorite LLM

## Example exports

### XML format

```xml
<obsidian_export>
  <metadata>
    <export_timestamp>2025-01-25T10:30:00.000Z</export_timestamp>
    <starting_note>Machine Learning</starting_note>
    <total_notes_exported>5</total_notes_exported>
    <missing_notes_count>0</missing_notes_count>
  </metadata>
  <note_contents>
    <note id="1" name="Machine Learning">
      <![CDATA[# Machine Learning
      Content with [[wikilinks]] preserved...]]>
    </note>
  </note_contents>
</obsidian_export>
```

### LLM Markdown

```markdown
# Obsidian Vault Export

**Export Details:**

- Starting Note: Machine Learning
- Total Notes: 5
- Export Depth: Content (3), Titles (6)
- Generated: 2025-01-25T10:30:00.000Z

## Note Contents

### 1. Machine Learning

# Machine Learning

Content with [[wikilinks]] preserved...
```

## Settings

You can customize the defaults in Settings → Smart Export:

- **Default Content Depth**: How deep to go with full content (1-20)
- **Default Title Depth**: How deep to go with titles only (1-30)
- **Default Export Format**: Your preferred output format
- **Auto-select Current Note**: Whether to automatically pick your active note

## What I use it for

### Research analysis

I'll export a cluster of notes about a topic and ask the LLM to identify themes, connections, and gaps in my thinking.

### Writing help

When I'm writing about something, I export my research notes and ask the LLM to help me structure the content or identify missing pieces.

### Knowledge discovery

Sometimes I'll export a broad set of notes and ask the LLM to suggest new connections or research directions I haven't explored yet.

### Study assistance

When learning something new, I export my notes and ask the LLM to create study guides or explain concepts in different ways.

## Tips for best results

### Token management

- Start with Content Depth 2-3 for most uses
- Use Title Depth 5-8 to get broader context without overwhelming content
- Watch the token counter to stay within your LLM's limits

### Organizing your notes

- Use descriptive note titles (they show up in title-only levels)
- Create hub notes that link to related concepts
- Keep your wikilinks clean and consistent

### Export strategies

- **Deep dive**: High content depth (4-6) for comprehensive analysis
- **Broad overview**: Low content depth (1-2), high title depth (8-12) for big picture
- **Balanced**: Medium depths (3/6) for most research and writing

## Common issues

**"No notes found" or empty export?**

- Make sure your starting note has wikilinks to other notes
- Check that the linked notes actually exist in your vault
- Verify the note names match your wikilinks exactly

**Token count too high?**

- Reduce your Content Depth or Title Depth
- Pick a more specific starting note with fewer connections
- Try the Print-Friendly format for smaller exports

**Missing links reported?**

- Check the export output for the list of missing notes
- Fix any broken wikilinks in your vault
- Make sure you're using exact note names in your links

## Contributing

I'd love your help improving this plugin! Check out the [Contributing Guidelines](CONTRIBUTING.md) for details on how to get started.

### Development setup

Clone the repo inside your vault `/.obsidian/plugins/`. I recommend using a dev vault just in case you mess something up.

```bash
git clone https://github.com/LittleHaku/obsidian-smart-export.git
cd obsidian-smart-export
pnpm install
pnpm run dev
```

Install the community plugin `Hot Reload` so that the plugin updates as you make changes. Remember to have `pnpm run dev` running.


## License

MIT License - see the [LICENSE](LICENSE) file for details.

## Support

If Smart Export helps you work more efficiently, consider supporting its development:

- ⭐ **Star this repository** to show your support
- 🐛 **Report bugs** to help improve the plugin
- 💡 **Share ideas** for new features
- ☕ **Buy me a coffee** to support continued development

### ☕ Support Development

This plugin is free and open-source, but if it saves you time and enhances your workflow, consider [buying me a coffee](https://buymeacoffee.com/littlehaku). Your support helps me continue developing and maintaining this plugin for the Obsidian community.

## What's coming next

I'm working on:

- **Vault context**: Include broader vault information for better LLM understanding
- **Template system**: Pre-built prompts for common workflows
- **Export presets**: Save and reuse your favorite configurations
- **Batch exports**: Export multiple starting notes at once

---

**Built for the Obsidian community with ❤️**
