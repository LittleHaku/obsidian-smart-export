# Smart Export Startup Process

Updated: February 16, 2026

## Table of Contents

- [Overview](#overview)
- [Startup Phases](#startup-phases)
  - [Phase 1: Plugin registration](#phase-1-plugin-registration)
  - [Phase 2: User opens export modal](#phase-2-user-opens-export-modal)
  - [Phase 3: Tree build and export](#phase-3-tree-build-and-export)
- [Critical Runtime Mechanisms](#critical-runtime-mechanisms)
  - [Traversal cache keys](#traversal-cache-keys)
  - [Ignored folder filtering](#ignored-folder-filtering)
  - [Debounced settings writes](#debounced-settings-writes)
- [Shutdown Process](#shutdown-process)

## Overview

Smart Export startup is intentionally lightweight. The plugin registers commands and UI entrypoints on load, then performs traversal/export work only when the user opens the modal.

```mermaid
sequenceDiagram
    participant Obsidian
    participant Plugin as SmartExportPlugin
    participant Modal as ExportModal
    participant Traversal as BFSTraversal

    Obsidian->>Plugin: onload()
    Plugin->>Plugin: loadSettings()
    Plugin->>Obsidian: register ribbon + command + settings tab
    Obsidian->>Modal: user opens modal
    Modal->>Traversal: build export tree on demand
```

## Startup Phases

### Phase 1: Plugin registration

Trigger: `Plugin.onload()` in `src/main.ts`.

1. Load and normalize persisted settings.
2. Register ribbon icon (`Smart export`).
3. Register command (`Smart Export: Open export`).
4. Register settings tab UI.

No traversal is executed during plugin startup.

### Phase 2: User opens export modal

Trigger: ribbon click or command invocation.

1. `ExportModal` is instantiated with current settings.
2. Modal initializes default values (depths, direction, format).
3. Optional auto-selection of active file is applied.

### Phase 3: Tree build and export

Trigger: tree preview render or export action.

1. Modal computes a traversal cache key from root/depth/mode/folder filters.
2. On cache miss, `BFSTraversal.traverse(...)` builds the note tree.
3. Folder exclusions are applied before nodes enter the tree.
4. Exporter serializes to XML, LLM Markdown, or Print-friendly Markdown.
5. Output is copied to clipboard.

## Critical Runtime Mechanisms

### Traversal cache keys

- Implemented in `ExportModal.getTreeCacheKey()`.
- Uses `JSON.stringify(ignoredTraversalFolders)` to avoid delimiter collisions.

### Ignored folder filtering

- Configured via `Ignored folders` setting.
- Applies to all link modes (`outgoing`, `incoming`, `both`).
- Excluded notes are not added or traversed further.
- Selected root note is always kept.

### Debounced settings writes

- `Ignored folders` textarea changes are debounced before `saveSettings()`.
- Prevents saving to disk on every keystroke.

## Shutdown Process

Trigger: `Plugin.onunload()` in `src/main.ts`.

Current behavior is minimal: no long-lived background workers are started by Smart Export, so unload remains lightweight.
