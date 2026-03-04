# Export Architecture

Updated: March 3, 2026

## Overview

Smart Export builds a note tree from a selected root note, applies traversal filters, and serializes the result into a chosen export format.

Core modules:

- `src/ui/ExportModal.ts`
- `src/engine/BFSTraversal.ts`
- `src/engine/XMLExporter.ts`
- `src/engine/LlmMarkdownExporter.ts`
- `src/engine/PrintFriendlyMarkdownExporter.ts`
- `src/utils/folderFilters.ts`
- `src/utils/llmMarkdownTemplateResolver.ts`

## 1) Export Runtime Flow

```mermaid
sequenceDiagram
    actor User
    participant Modal as ExportModal
    participant Traversal as BFSTraversal
    participant API as ObsidianAPI
    participant Exporter as Selected exporter

    User->>Modal: Open export + choose root/options
    Modal->>Traversal: traverse(rootPath)
    Traversal->>API: getFileByPath(rootPath)
    loop BFS levels
        Traversal->>API: get outgoing/incoming links
        Traversal->>Traversal: apply ignored folder filter
        Traversal->>Traversal: add node + queue children
    end
    Traversal->>API: read content for content-eligible nodes
    Traversal-->>Modal: export tree + missing notes count
    Modal->>Modal: resolve custom Markdown template (optional)
    Modal->>Exporter: export(tree, vault, missingNotes, template?)
    Exporter-->>Modal: serialized output
    Modal-->>User: copy to clipboard
```

Markdown template selection and resolution:

1. User chooses output in the modal dropdown (`Output`).
2. The built-in template exposed in UI is `default` (`LLM-ready`).
3. Custom templates are loaded from `<llmMarkdownTemplateDirectory>/*.md`.
4. If a selected custom template is missing/unreadable, exporter falls back to built-in `default`.
5. Quick export passes `settings.defaultLlmTemplateId` to `resolveLlmMarkdownTemplate(...)`.
6. For an explicit template id, resolver attempts:
   - built-in template id match
   - `user:` template path read
   - built-in `default` fallback when selection is missing/unreadable
7. Folder fallback is only used when resolver is called without an explicit template id:
   - `<llmMarkdownTemplateDirectory>/llm-markdown.md`
   - first readable `.md` in `<llmMarkdownTemplateDirectory>/`
   - built-in `default`

Notes:

- `{{metadata_yaml}}` renders as a complete YAML frontmatter block (including `---` delimiters).
- Templates can use full metadata keys (`{{total_notes_exported}}`) or aliases (`{{total_notes}}`).
- Plugin settings expose `Default output`, which shows XML/print-friendly, built-in `LLM-ready`, and custom templates.
- The modal output dropdown uses the same built-in filtering as settings (`LLM-ready` only).
- `compact` remains in the repository as a reference template example for users to copy/customize.

## 2) Traversal and Folder Exclusion Logic

```mermaid
flowchart TD
    A[Discovered linked file] --> B{In ignored folders?}
    B -- Yes --> C[Skip node]
    B -- No --> D{Already visited?}
    D -- Yes --> E[Skip duplicate]
    D -- No --> F[Create ExportNode]
    F --> G[Add to parent.children]
    G --> H[Queue for next BFS depth]
```

Notes:

- Exclusion applies in all link modes: `outgoing`, `incoming`, `both`.
- Excluded notes are not added to the tree and are not traversed further.
- The selected root note is always kept.

## 3) Tree Cache and Invalidation

```mermaid
flowchart LR
    A[Modal inputs] --> B[Cache key]
    B --> C{Cache hit?}
    C -- Yes --> D[Reuse export tree]
    C -- No --> E[Build new traversal]
    E --> F[Store in bounded cache]

    A1[Root note]
    A2[Content depth]
    A3[Title depth]
    A4[Link direction]
    A5[Ignored folders]
    A1 --> B
    A2 --> B
    A3 --> B
    A4 --> B
    A5 --> B
```

Cache keys serialize ignored folders with `JSON.stringify(...)` to avoid delimiter collisions.
