# Smart Export Startup Process

Updated: August 1, 2026

## Table of Contents

- [Overview](#overview)
- [Startup Phases](#startup-phases)
  - [Phase 1: Plugin registration](#phase-1-plugin-registration)
  - [Phase 2: User opens export modal](#phase-2-user-opens-export-modal)
  - [Phase 3: Tree build and export](#phase-3-tree-build-and-export)
- [Critical Runtime Mechanisms](#critical-runtime-mechanisms)
  - [Traversal cache keys](#traversal-cache-keys)
  - [Tag discovery cache](#tag-discovery-cache)
  - [Ignored note filtering](#ignored-note-filtering)
  - [Debounced settings writes](#debounced-settings-writes)
- [Shutdown Process](#shutdown-process)

## Overview

Smart Export startup is intentionally lightweight. The plugin registers commands and UI entrypoints on load, defers update-notice UI until the workspace layout is ready, and performs traversal/export work only when the user opens the export modal.

```mermaid
sequenceDiagram
    participant Obsidian
    participant Plugin as SmartExportPlugin
    participant ReleaseNotes as ReleaseNotesModal
    participant Tags as TagDiscoveryService
    participant Modal as ExportModal
    participant Traversal as BFSTraversal

    Obsidian->>Plugin: onload()
    Plugin->>Plugin: loadSettings()
    Plugin->>Tags: create lazy cache + register invalidation events
    Plugin->>Obsidian: register ribbon + command + settings tab
    Obsidian->>Plugin: workspace.onLayoutReady()
    Plugin->>ReleaseNotes: optional what's new modal after version change
    Obsidian->>Modal: user opens modal
    Modal->>Traversal: build export tree on demand
```

## Startup Phases

### Phase 1: Plugin registration

Trigger: `Plugin.onload()` in `src/main.ts`.

1. Load and normalize persisted settings through `src/settings/pluginData.ts`.
2. Register ribbon icon (`Smart export`).
3. Register command (`Smart Export: Open export`).
4. Register settings tab UI.
5. Create the shared `TagDiscoveryService` without scanning the vault and register metadata/vault invalidation events through plugin lifecycle helpers.
6. After `workspace.onLayoutReady(...)`, register the vault `create` invalidation listener, compare the persisted plugin version with `manifest.json`, and optionally open the what's new modal once per version.

No traversal or tag scan is executed during plugin startup. Deferred post-start work is limited to event registration and the lightweight release-notes/version check.

### Phase 2: User opens export modal

Trigger: ribbon click or command invocation.

1. `ExportModal` is instantiated with current settings.
2. Modal initializes default values (depths, direction, format).
3. Optional auto-selection of active file is applied.
4. DOM-free source, export-choice, cache-key, selection, collapse, and estimate rules are delegated to `src/ui/exportModalState.ts`.

### Phase 3: Tree build and export

Trigger: tree preview render or export action.

1. Modal computes a traversal cache key from root/depth/mode/folder/tag/property filters.
2. On cache miss, `src/ui/exportTreeController.ts` coordinates `BFSTraversal` and composes any extra roots, tags, or standalone notes.
3. Folder/tag/property exclusions are applied before nodes enter the tree.
4. `src/ui/exportExecution.ts` applies content selection, resolves templates, and delegates serialization to XML, LLM Markdown, or Print-friendly Markdown exporters.
5. Output is copied to clipboard.

## Critical Runtime Mechanisms

### Traversal cache keys

- Implemented in `exportModalState.getTreeCacheKey()` and called by `ExportModal`.
- Uses `JSON.stringify(...)` on ignored folders/tags/property rules to avoid delimiter collisions.

### Tag discovery cache

- `TagDiscoveryService` builds normalized tag suggestions only when a tag picker first requests them.
- Reopening either tag picker reuses the shared deterministic result while the vault is unchanged.
- Metadata `changed`/`deleted` and vault `create`/`delete`/`rename` events invalidate the cache.
- The vault `create` listener is registered only after layout readiness to avoid initialization storms.
- All event references use plugin lifecycle registration and are disposed when the plugin unloads.

### Ignored note filtering

- Configured via:
  - `Ignored folders`
  - `Hide notes with tags`
  - `Hide notes with property rules`
- Accepts comma-separated entries.
- Applies to all link modes (`outgoing`, `incoming`, `both`).
- Excluded notes are not added or traversed further.
- Selected root note is always kept.

### Debounced settings writes

- Traversal exclusion inputs wait 300 ms and regular expression rules wait 500 ms before
  `saveSettings()`.
- Markdown template folder changes wait 300 ms before saving and refreshing the derived output
  choices in place.
- These delays prevent disk writes on every keystroke and keep the active folder input focused.

## Shutdown Process

Trigger: `Plugin.onunload()` in `src/main.ts`.

No long-lived background workers are started by Smart Export. Obsidian disposes the registered
tag-cache event references through the plugin lifecycle, so unload remains lightweight.
