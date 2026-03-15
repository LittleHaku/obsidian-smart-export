# API reference

Updated: March 6, 2026

This reference documents current Smart Export behavior exposed to users and contributors.

## Commands

Defined in `src/main.ts`:

- `open-export-modal` (`Open export`)
  - Opens the Smart Export modal.
- `quick-export-current-note` (`Quick export current note`)
  - Requires an active Markdown note.
  - Builds an export with current default settings and copies output to clipboard.

## Settings

Defined in `src/main.ts` (`SmartExportSettings` + settings tab):

- Section `Export defaults`
  - `Default content depth` (`1-20`)
  - `Default title depth` (`1-20`, kept `>=` content depth)
  - `Default output`
    - XML
    - Print-friendly Markdown
    - Markdown templates (`LLM-ready` built-in + custom templates)
  - `Default link direction`
    - `outgoing`
    - `incoming`
    - `both`
- Section `Traversal exclusions`
  - `Ignored folders` (comma/newline-separated patterns)
  - `Hide notes with tags` (comma/newline-separated tag patterns)
  - `Hide notes with property rules` (comma/newline-separated `key` or `key=value`)
- Section `Markdown templates`
  - `Markdown template folder` (vault-relative, default `smart-templates`)
- Section `Print-friendly Markdown`
  - `Include table of contents`
  - `Number headings`
  - `Insert section dividers`
- Section `Export modal behavior`
  - `Auto-select current note`
  - `Close modal after export`
  - `Show per-note token estimates`

## Export formats

Format dispatch is implemented in `src/engine/exportOutput.ts`:

- `xml` via `XMLExporter`
- `llm-markdown` via `LlmMarkdownExporter`
- `print-friendly-markdown` via `PrintFriendlyMarkdownExporter`
  - Uses settings-controlled formatting for table of contents links, heading numbering, and note dividers.

Invalid stored/selected format values normalize to `xml`.

## Template behavior

Template resolver: `src/utils/llmMarkdownTemplateResolver.ts`.

- Built-in templates in repository:
  - `builtin:default` (`LLM-ready`)
  - `builtin:compact` (`Compact`, kept as a reference template)
- Settings/modal dropdowns intentionally show:
  - XML
  - Print-friendly Markdown
  - `LLM-ready`
  - Custom templates from `<template-folder>/*.md`

Resolution rules:

1. With an explicit template id:
   - built-in id match, else `user:<path>` read, else built-in default fallback.
2. Without an explicit template id:
   - `<template-folder>/llm-markdown.md`
   - first readable `.md` file in folder (sorted path order)
   - built-in default fallback.

## Exclusion and traversal behavior

Traversal engine: `src/engine/BFSTraversal.ts`.

- Exclusion rules are applied for all link modes (`outgoing`, `incoming`, `both`).
- If a note matches any folder/tag/property exclusion rule:
  - it is not added to the export tree,
  - it is not traversed further.
- The selected root note is always kept.

Detailed matching rules are documented in [Exclusion rules](exclude-folders.md).

## Runtime data flow

High-level flow:

1. User opens modal (or triggers quick export).
2. Plugin builds/reads traversal tree.
3. Output is generated in selected format.
4. Output is copied to clipboard.

Architecture details are in [Export architecture](export-architecture.md) and [Startup process](startup-process.md).
