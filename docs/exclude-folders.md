# Exclusion Rules

Updated: May 17, 2026

## Overview

Smart Export supports three exclusion settings:

- `Ignored folders`
- `Hide notes with tags`
- `Hide notes with property rules`

Each one accepts comma-separated entries. Matching notes are excluded from traversal in every link direction (`outgoing`, `incoming`, `both`).

## Input format

Use commas between entries:

- `templates, assets*, /archive, /res*, /*/temp, /projects/*`
- `archive*, #draft, projects/*/old`
- `status=done, published=true, archived`

Newlines are still accepted for backwards compatibility.

## Folder matching model

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

## Tag matching model

Tag filters are normalized (trimmed, lowercased, leading `#` removed), then matched against note tags:

1. Prefix rule (tag and descendants):
   - `archive` matches `archive` and `archive/2026`
2. Descendants-only rule:
   - `archive/*` matches `archive/2026` but not `archive`
3. Wildcard rule:
   - `arch*` (segment starts with `arch`, in any path segment)
   - `*draft` (segment ends with `draft`, in any path segment)
   - `projects/*/old` (segment wildcard)

## Property matching model

Property rules are normalized (trimmed, lowercased key/value) and matched against frontmatter:

1. Existence rule:
   - `archived` matches notes with an `archived` property
2. Exact value rule:
   - `status=done`
   - `published=true`

Value matching is exact after normalization and supports scalar values and arrays.

## Rule summary

- If a linked note matches any exclusion rule, it is not added to the export tree and is not traversed.
- The selected root note is always kept.
- For tag source exports, matching tag roots are excluded if they match any folder/tag/property exclusion.
- Folder rules: leading `/` is a root anchor. If you want segment matching anywhere in the path, remove the leading `/` (for example `assets*` instead of `/assets*`).

## Where this is used in code

- Settings parsing: `src/main.ts`
- Filter normalization + matcher compilation: `src/utils/folderFilters.ts` (`compileFolderFilterMatchers`, `pathMatchesFolderFilterMatchers`)
- Filter normalization + matcher compilation (tags/properties): `src/utils/noteFilters.ts` (`compileTagFilterMatchers`, `compilePropertyFilterRules`)
- Traversal exclusion checks: `src/engine/BFSTraversal.ts`
- Traversal tests: `tests/engine/BFSTraversal.test.ts`
- Filter utility tests: `tests/utils/folderFilters.test.ts`
- Filter utility tests (tags/properties): `tests/utils/noteFilters.test.ts`
