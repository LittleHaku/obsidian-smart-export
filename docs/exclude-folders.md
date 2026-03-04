# Excluded Folders

Updated: March 4, 2026

## Overview

Smart Export uses one exclusion setting:

`Ignored folders`

It is a comma-separated list of folders/patterns. Matching notes are excluded from traversal in every link direction (`outgoing`, `incoming`, `both`).

## Input format

Use commas between entries:

- `templates, assets*, /archive, /res*, /*/temp, /projects/*`

Newlines are still accepted for backwards compatibility.

## Matching model

Rules are normalized (trimmed, slash-normalized, deduplicated), then applied to the note folder path:

1. Exact folder prefix (legacy behavior):
   - `GeminiHelper`
   - `Research/AI`
2. Name wildcard (no slash, matches any folder segment):
   - `assets*` (segment starts with `assets`)
   - `*_temp` (segment ends with `_temp`)
3. Root/path wildcard (slash patterns):
   - `/archive` (root `archive` folder)
   - `/res*` (root folders starting with `res`)
   - `/*/temp` (temp folder one level deep)
   - `/projects/*` (folders inside `projects`)

## Rule summary

- If a linked note matches any exclusion rule, it is not added to the export tree and is not traversed.
- The selected root note is always kept.

## Where this is used in code

- Settings parsing: `src/main.ts`
- Filter normalization + matcher compilation: `src/utils/folderFilters.ts`
- Traversal exclusion checks: `src/engine/BFSTraversal.ts`
- Traversal tests: `tests/engine/BFSTraversal.test.ts`
- Filter utility tests: `tests/utils/folderFilters.test.ts`
