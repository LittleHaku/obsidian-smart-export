# Smart Export Templates

This folder contains copyable templates for the LLM Markdown export path.
Print-friendly Markdown and XML outputs are not templated.

Built-in starter templates in this repo:

- `templates/llm-markdown/default.md`
- `templates/llm-markdown/compact.md`

Recommended default:

- Smart Export uses `default.md` as the built-in baseline (`LLM-ready` in UI).
- It is intended as the prompt-oriented baseline because it includes explicit prompt-like structure and context framing.
- `compact.md` is an optional built-in alternative when you want less surrounding guidance text.

Copy one or more template files into your vault at:

`smart-templates/*.md`

You can change this folder in **Settings → Smart Export → Markdown template folder**.

In the export modal, use the **Output** dropdown to select either:

- the built-in **LLM-ready** template, or
- one of your custom templates from `<template-folder>`.

## How Template Rendering Works

1. Smart Export reads your selected template file as plain Markdown text.
2. It replaces every supported placeholder like `{{starting_note}}`.
3. Unknown placeholders are left unchanged (so typos stay visible).

## `{{metadata_yaml}}` (important)

`{{metadata_yaml}}` expands to a full YAML frontmatter block, including the `---` lines.

Example placeholder in template:

```md
{{metadata_yaml}}
```

Example rendered output:

```yaml
---
export_timestamp: "2026-03-03T15:00:00.000Z"
vault_path: "MyVault"
starting_note: "Machine Learning"
total_notes_exported: 5
missing_notes_count: 1
max_depth_used: 3
processing_order: "BFS (Breadth-First Search)"
---
```

Use it once near the top of the template.

## Placeholder Reference

### Full sections and lists

- `{{metadata_yaml}}`: YAML frontmatter block with export metadata.
- `{{included_notes}}`: bullet list like `- Note 1: "Root"`.
- `{{mermaid_diagram}}`: complete fenced Mermaid graph for the selected note traversal.
- `{{note_contents}}`: all exported note sections separated by `---`.
- `{{note_contents_page_separated}}`: all exported note sections separated by HTML page breaks, so each note starts on a new page after the first.
- `{{note_structure_section}}`: prebuilt "Note Structure" section.
- `{{note_contents_section}}`: prebuilt "Note Contents" section.

### Single metadata values

- `{{export_timestamp}}`: ISO timestamp of export generation.
- `{{vault_path}}`: vault name/path used in export.
- `{{starting_note}}`: root note title.
- `{{total_notes_exported}}`: total number of exported notes.
- `{{missing_notes_count}}`: count of unresolved linked notes.
- `{{max_depth_used}}`: deepest note depth in the exported tree.
- `{{processing_order}}`: traversal order string.

### Aliases (same values, shorter names)

- `{{total_notes}}` = `{{total_notes_exported}}`
- `{{missing_notes}}` = `{{missing_notes_count}}`
- `{{max_depth}}` = `{{max_depth_used}}`

## Navigable Mermaid Diagrams

`{{mermaid_diagram}}` is intended for custom templates. It expands to the complete fenced
Mermaid code block, including nodes, directed edges, and depth styles.

Add one of these content placeholders to the same template to make diagram titles navigate to
their exported note sections:

- `{{note_contents}}`
- `{{note_contents_section}}`
- `{{note_contents_page_separated}}`

Example:

```md
# Export graph

{{mermaid_diagram}}

## Exported notes

{{note_contents}}
```

Navigation uses HTML links with Obsidian's `internal-link` class and unique same-note block
anchors. This has several intentional rules:

- Without a recognized note-content placeholder, the diagram remains non-navigable so it never
  creates broken links.
- If more than one recognized note-content placeholder appears, links target the first one. Later
  copies remain unanchored.
- Every occurrence of `{{mermaid_diagram}}` renders the same complete graph and points to that
  first content section.
- Unique note titles stay unchanged. Equal titles are disambiguated with their vault paths in
  both the graph and exported headings.
- The graph remains readable in other Mermaid renderers, but internal navigation is only
  guaranteed in Obsidian because it depends on Obsidian's HTML `internal-link` handling.

## Minimal Template Example

```md
{{metadata_yaml}}

# Export for {{starting_note}}

Total notes: {{total_notes}}
Missing: {{missing_notes}}

## Included

{{included_notes}}

## Content

{{note_contents}}
```
