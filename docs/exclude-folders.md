# Excluded Folders

Updated: February 16, 2026

## Overview

Smart Export supports a single folder filter:

`Ignored folders`

Notes in ignored folders are excluded from traversal in every link direction. Those notes do not appear in the export tree, and links from those notes are not followed.

## Precedence

The traversal applies ignore matching before adding discovered links to the tree.

### Rule summary

- If `Ignored folders` matches a note path, that note is not traversed and will not appear in the tree.
- The selected root note is never removed by this feature. Filters only affect discovered linked notes.

## Matching model

Folder entries are normalized before matching:

- Trim whitespace
- Convert `\` to `/`
- Remove leading and trailing `/`
- Deduplicate values

Each folder is treated as a prefix with a trailing slash (`Folder/Sub/`), then compared with
`sourcePath.startsWith(prefix)`.

Examples:

- `GeminiHelper` matches `GeminiHelper/snapshot-a.md`
- `Research/AI` matches `Research/AI/notes/model.md`
- `Research` does not match `Research.md` (file at vault root, not inside `Research/`)

## Examples

### Exclude one noisy folder everywhere

- Ignored folders (all link directions):
  - `GeminiHelper`

Result: notes under `GeminiHelper/` are excluded from traversal and do not appear in the tree.

### Exclude multiple folders

- Ignored folders:
  - `Research/Archive`
  - `GeminiHelper`

Result: notes under either folder are excluded from traversal and export.

## Where this is used in code

- Settings model: `src/types.ts`
- Settings UI + persistence normalization: `src/main.ts`
- Traversal filter application: `src/engine/BFSTraversal.ts`
- Modal traversal options + cache key: `src/ui/ExportModal.ts`
- Traversal coverage tests: `tests/engine/BFSTraversal.test.ts`
