# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.15.0] - 2026-05-17

### Added

- Export modal can now use a tag as the starting point, exporting all matching inline/frontmatter tagged notes as top-level roots while preserving traversal exclusions.
- Include more notes now supports adding tags, so another tag can contribute matching notes to the same export.

## [1.14.0] - 2026-05-16

### Added

- Export modal now supports session-only extra notes. Extra notes can be added as single notes, or as new roots that use the current depth and link-direction settings.

## [1.13.0] - 2026-04-29

### Added

- Content redaction now supports optional regular expression rules, one per line, for replacing patterned content such as emails, URLs, footnotes, comments, and private metadata in exported note content.
- Content redaction settings now include a live preview for testing delimiter and regular expression rules against sample text before exporting.
- Marked-section redaction and regular expression redaction now have separate toggles and replacement text. Marked sections default to `REDACTED`, while regular expression matches default to being removed.
- New installs include example regular expression rules and preview input, but both redaction systems remain off until enabled.

## [1.12.0] - 2026-04-29

### Added

- Optional content redaction can replace private sections marked with a configurable delimiter such as `:::private text:::` during export.
- Redaction is not active by default. Enable it in **Settings -> Smart Export -> Content redaction -> Redact marked sections**, then configure the delimiter and replacement text if needed.

## [1.11.0] - 2026-04-25

### Changed

- Print-friendly Markdown exports now normalize included note content headings below each exported note title heading by default so nested source headings do not visually outrank their note section
- New print-friendly Markdown setting `Normalize content headings` can preserve source heading levels exactly when disabled

## [1.10.3] - 2026-04-23

### Changed

- The post-update modal title now names Smart Export explicitly, so release notes clearly identify which plugin was updated

## [1.10.2] - 2026-04-23

### Fixed

- Markdown exports now preserve cross-note block links such as `[[note^block]]` by rewriting them to same-note block anchors instead of falling back to note-level links
- Aliased cross-note block links such as `[[note^block|alias]]` now preserve readable `ref:` context while still pointing to the referenced exported block anchor

## [1.10.1] - 2026-04-23

### Fixed

- Markdown exports now include notes referenced through heading and block links such as `[[note#heading]]` and `[[note^block]]` during traversal
- Markdown exports now preserve referenced note headings by rewriting `[[note#heading]]` links to generated same-note block anchors with valid Obsidian same-note link syntax when the target heading is included in the export

## [1.10.1-beta.1] - 2026-04-22

### Fixed

- Markdown exports now include notes referenced through heading and block links such as `[[note#heading]]` and `[[note^block]]` during traversal
- Markdown exports now preserve referenced note headings by rewriting `[[note#heading]]` links to generated same-note block anchors with valid Obsidian same-note link syntax when the target heading is included in the export

## [1.10.0] - 2026-04-21

### Added

- Smart Export now shows a one-time what's new modal after plugin updates, with the current release notes plus `OK` and `Buy me a coffee` actions

## [1.9.0] - 2026-04-21

### Changed

- Print-friendly Markdown exports can now include a linked table of contents, numbered section headings, and divider lines between note blocks
- New print-friendly Markdown settings now control whether table of contents links, heading numbering, and section dividers are included in clipboard and new-note exports
- Print-friendly Markdown exports can now insert HTML page breaks between note sections, which also puts the table of contents on its own page when enabled
- New print-friendly Markdown setting now controls whether page breaks replace section dividers in clipboard and new-note exports

## [1.9.0-beta.2] - 2026-04-21

### Changed

- Print-friendly Markdown exports can now insert HTML page breaks between note sections, which also puts the table of contents on its own page when enabled
- New print-friendly Markdown setting now controls whether page breaks replace section dividers in clipboard and new-note exports

## [1.9.0-beta.1] - 2026-03-15

### Changed

- Print-friendly Markdown exports can now include a linked table of contents, numbered section headings, and divider lines between note blocks
- New print-friendly Markdown settings now control whether table of contents links, heading numbering, and section dividers are included in clipboard and new-note exports

## [1.8.0] - 2026-03-15

### Changed

- Markdown exports now rewrite links to exported notes into Obsidian same-note heading links when the target note is part of the export
- Aliased exported links now preserve visible target context with `ref:` text, and LLM Markdown note sections now use exported note labels directly as headings so rewritten links target native Obsidian headings
- Markdown link rewriting now scans content by jumping between special tokens instead of slicing on every character, improving large-export performance

### Fixed

- Same-note link rewriting now safely handles duplicate note titles, heading labels containing wiki-link control characters, and same-note heading/block links
- Markdown exports now preserve code and fence content correctly across indented fences, list-item and blockquote fences, trailing fence whitespace, and inline backtick spans
- Print-friendly Markdown export now guards against cyclic note graphs when building and rendering the exported note
- Exported frontmatter now keeps a blank line before the closing fence so Obsidian/PDF outline rendering does not misread the last YAML property as a heading
- LLM Markdown note-structure text and `Included Notes` labels now match the actual exported headings

## [1.8.0-beta.3] - 2026-03-14

### Changed

- LLM Markdown note sections now use the exported note labels directly as headings so rewritten same-note links can target native Obsidian headings
- Markdown link rewriting now scans content by jumping between special tokens instead of slicing on every character, improving large-export performance

### Fixed

- Markdown exports now keep same-note link rewriting disabled for the full duration of fenced code blocks, including indented fenced code blocks and blocks whose content contains the fence text
- Markdown exports now recognize closing code fences even when the fence marker is followed by trailing spaces or tabs
- Markdown exports now recognize common list-item and blockquote fenced code blocks, and inline backtick spans no longer close against later lines
- Aliased same-note heading and block links such as `[[#Heading|alias]]` and `[[^block|alias]]` are now preserved as native Obsidian links instead of being flattened into plain text
- LLM Markdown exports now use the same disambiguated note labels in `Included Notes` that appear in exported section headings for duplicate titles

## [1.8.0-beta.2] - 2026-03-14

### Fixed

- Exported same-note heading links now safely escape note titles that contain wiki-link control characters such as `|` and `]`
- Print-friendly Markdown export now guards against cyclic note graphs when building and rendering the exported note
- LLM note-structure text now accurately describes rewritten same-note heading links instead of claiming links remain raw `[[wiki-style links]]`
- Markdown exports now insert a blank line before the closing fence of included note frontmatter so Obsidian/PDF outline rendering does not misread the last YAML property as a heading

## [1.8.0-beta.1] - 2026-03-13

### Changed

- Markdown exports now rewrite exported wikilinks into Obsidian same-note heading links when the target note is part of the export
- Aliased exported wikilinks now preserve visible target context with `ref:` text in Markdown exports

## [1.7.0] - 2026-03-13

### Added

- New `Export to new note` action in the export modal that prompts for a destination folder and note name before creating the Markdown export note
- New setting `Default export target` to choose whether quick export and the modal CTA default to clipboard or new-note delivery
- New setting `Default export note folder` to prefill the folder used for export-note creation and quick export to new note
- New setting `Open created export note` to let users create export notes in the background without opening them immediately

### Changed

- Export modal primary action (CTA) now follows the configured `Default export target` (clipboard or new note)
- `Close modal after export` now applies to both clipboard exports and newly created export notes
- `Quick export current note` now follows the configured default export target instead of always copying to clipboard
- Quick export to new note now auto-dedupes note names when a previous export already exists at the default path
- `Export to new note` now respects the configured default folder and background-open preference

## [1.7.0-beta.2] - 2026-03-13

### Added

- New setting `Default export target` to choose whether quick export and the modal CTA default to clipboard or new-note delivery
- New setting `Default export note folder` to prefill the folder used for export-note creation and quick export to new note
- New setting `Open created export note` to let users create export notes in the background without opening them immediately

### Changed

- `Quick export current note` now follows the configured default export target instead of always copying to clipboard
- Quick export to new note now auto-dedupes note names when a previous export already exists at the default path
- `Export to new note` now respects the configured default folder and background-open preference

## [1.7.0-beta.1] - 2026-03-12

### Added

- New `Export to new note` action in the export modal that prompts for a destination folder and note name before creating and opening the Markdown export note

### Changed

- `Export to clipboard` is now the primary export action again in the modal
- `Close modal after export` now applies to both clipboard exports and newly created export notes

## [1.6.1] - 2026-03-06

### Changed

- Settings tab layout is now grouped into clear sections (`Export defaults`, `Traversal exclusions`, `Markdown templates`, `Export modal behavior`) without changing any setting behavior.

## [1.6.0] - 2026-03-05

### Added

- New traversal exclusion setting `Hide notes with tags` (comma-separated tag patterns, for example `archive*, #draft, projects/*/old`)
- New traversal exclusion setting `Hide notes with property rules` (comma-separated `key` / `key=value` rules, for example `status=done, published=true, archived`)
- New note filter utility module for tag/property matching (`src/utils/noteFilters.ts`) with dedicated test coverage (`tests/utils/noteFilters.test.ts`)
- Expanded traversal test coverage for tag/property-based exclusions (`tests/engine/BFSTraversal.test.ts`)

### Changed

- Traversal exclusion now supports folders, tags, and property rules in all link modes (`outgoing`, `incoming`, `both`)
- Export tree cache keys now include serialized ignored tag patterns and property rules to prevent stale tree reuse across filter changes
- Exclusion documentation now covers folder/tag/property rule behavior in one place (`docs/exclude-folders.md`)

## [1.5.1] - 2026-03-05

### Added

- Folder path autocomplete in settings for `Markdown template folder`

### Changed

- `Markdown template folder` now supports typeahead selection inspired by Templater-style folder picking
- `Ignored folders` now uses a comma-separated input with wildcard/path pattern support (for example `assets*`, `/*/temp`, `/projects/*`)
- Folder matcher internals now use explicit matcher naming (`compileFolderFilterMatchers`, `pathMatchesFolderFilterMatchers`) to clarify regex-based behavior
- Leading `/` in an ignored-folder rule is now treated as a root anchor (remove `/` to match folder names in any segment)
- `Markdown template folder` autocomplete suggestions now use cached results with vault-change invalidation to avoid rebuilding/sorting on every keystroke while typing

## [1.5.0] - 2026-03-04

### Added

- Directory-based custom Markdown template loading from a vault folder (default `smart-templates`)
- Placeholder-based LLM Markdown template rendering (`{{metadata_yaml}}`, `{{note_contents_section}}`, metadata placeholders, and more)
- Copyable built-in template pack in `templates/llm-markdown/` (`default` and `compact`)
- New setting `Markdown template folder` with a direct link to the template placeholder docs
- New unified `Output` dropdown in the export modal to choose XML/print-friendly outputs or built-in/custom Markdown templates
- New `Default output` setting that supports built-in and custom Markdown templates (with docs link)
- Settings and modal `Output` now show only built-in `LLM-ready` plus custom templates (`compact` remains as a docs/example template)

### Changed

- LLM Markdown export now supports selecting among multiple templates and falls back safely to built-in `default`
- Built-in LLM Markdown templates are now centralized in shared constants so resolver and exporter use the same source of truth
- Export format dispatch is now explicit and exhaustive to prevent silent fallback behavior for future formats
- Template ids are now normalized with trimming across settings load, modal selection, and resolver lookup
- Template docs URL is centralized in shared constants to keep settings and modal links in sync
- Template option listing now avoids unnecessary template file reads while building dropdown options
- Documentation now clarifies explicit-template resolution behavior for modal/quick export flows and no-template fallback behavior
- Settings copy for `Markdown template folder` now clearly states that all `.md` files in the folder are available as template options

### Fixed

- `{{note_structure_description}}` is now populated with the expected default description content instead of an empty string

## [1.4.0] - 2026-03-03

### Added

- New command `Smart Export: Quick export current note` to export from the active note using default settings and copy directly to clipboard

## [1.3.0] - 2026-02-16

### Added

- Global folder exclusion setting (`Ignored folders`) to exclude notes from traversal/export across all link modes (outgoing, incoming, both)
- New folder filter utility module (`src/utils/folderFilters.ts`) for shared path normalization and prefix matching
- Expanded traversal test coverage for folder exclusions:
  - outgoing mode
  - incoming mode
  - both mode
  - root note kept even if located in an excluded folder
- New utility test suite for folder filter normalization and matching (`tests/utils/folderFilters.test.ts`)
- New release/versioning runbook (`docs/versioning-and-releases.md`)
- New Obsidian plugin review checklist for maintainer release checks
- New contributor/maintainer guide for local development workflows
- New startup lifecycle documentation page with phase-based flow and Mermaid diagram (`docs/startup-process.md`)

### Changed

- Simplified folder filtering model to a single exclusion list (removed direction-specific folder filtering complexity)
- Updated export tree cache key generation to serialize excluded folders with `JSON.stringify(...)` to avoid delimiter-based key collisions
- Refactored duplicated folder normalization logic to shared utilities used by settings and traversal
- Folder filter path normalization now uses Obsidian `normalizePath()` for vault-consistent behavior (including slash normalization and Unicode-safe path cleanup)
- Updated README structure with numbered sections and reduced duplication (installation, quick start, docs, settings, troubleshooting)
- Standardized docs naming from "incoming link folder filters" to "excluded folders" (`docs/exclude-folders.md`)
- Expanded folder filter tests to cover NBSP normalization and blank-input handling
- Added explicit documentation scope guidance to keep architecture documentation proportional to plugin complexity
- Updated contribution/release guidance:
  - explicit no-`v` version/tag format (`X.Y.Z`)
  - prerelease tag conventions (`beta` / `alpha` / `canary`)
  - changelog header must match release tag exactly

## [1.2.7] - 2026-02-15

### Changed

- Updated public-facing project headers/titles to avoid reserved first-party naming patterns (removed "Obsidian ... Plugin" style naming)

## [1.2.6] - 2026-02-15

### Changed

- LLM Markdown exporter now serializes frontmatter via Obsidian `stringifyYaml()` instead of manually constructing YAML

## [1.2.5] - 2026-02-06

### Added

- Dedicated benchmark suite for traversal/export throughput on large synthetic note graphs (`pnpm benchmark`)

### Changed

- Improved traversal performance by loading note content with bounded concurrency instead of sequential reads
- Reduced token estimation overhead in the export modal by estimating directly from the export tree without serializing full output on each update
- Reduced tree rerender overhead by caching the content-only display tree and per-node token labels
- Improved tree interaction performance by updating selection/collapse UI in place instead of rebuilding the full tree on each click
- Added lazy child rendering for collapsed branches so deep trees do less DOM work
- Optimized exporter internals for large trees by replacing `queue.shift()` loops with head-index queues
- Improved print-friendly export string construction by using chunked joins instead of repeated string concatenation

### Performance snapshot

- Benchmark run on synthetic graph (1,365 notes) showed ~57.5ms median traversal with an estimated ~7.4x speedup vs serialized reads

## [1.2.4] - 2026-02-06

### Fixed

- Newly visible notes are now selected by default when increasing traversal depth
- Manual note deselections are now preserved across depth shrink/expand cycles
- Depth-based selection reconciliation now avoids re-selecting notes explicitly deselected by the user

## [1.2.3] - 2026-02-06

### Changed

- Made Content depth and Title depth slider ranges consistent to reduce confusion
- Updated default Title depth settings range to match Content depth (1-20)
- Added settings normalization so previously saved depth values are clamped to valid ranges

## [1.2.2] - 2026-02-06

### Changed

- Improved export modal usability for large traversals by using a wider responsive modal layout
- Improved note tree readability at high depths with horizontal scrolling and non-wrapping labels
- Refined traversal depth helper text in the modal info box for clearer non-technical wording

## [1.2.1] - 2026-02-06

### Changed

- Updated traversal depth help text to be clearer for non-technical users
- Kept depth guidance in the modal info box while removing confusing comparison wording
- Added a matching emoji to the "Export settings" section title in the export modal

## [1.2.0] - 2026-02-06

### Added

- Link direction traversal modes: outgoing, incoming (backlinks), and outgoing + incoming
- Backlink discovery support in BFS traversal for exporting notes that are referenced by other notes
- Default link direction setting in plugin settings

### Changed

- Link direction labels and descriptions now clarify:
  - Outgoing follows wikilinks in note text
  - Outgoing + incoming helps find possible links between notes
- Export modal now initializes link direction from plugin settings

## [1.1.2] - 2026-02-06

### Changed

- Improved export modal hierarchy with stronger headings and spacing
- Centered and refined the modal header styling

## [1.1.1] - 2026-02-06

### Changed

- Simplified export modal copy and reduced emoji usage for a cleaner UI

## [1.1.0] - 2026-02-05

### Added

- Interactive note tree with content selection, bulk actions, and token estimates
- Content-only selection behavior while always including titles
- Shift-click toggle for subtree content selection
- Cached traversal to avoid recomputation when switching depths

## [1.0.9] - 2026-02-05

### Added

- Include frontmatter (properties) links during traversal

## [1.0.8] - 2026-02-05

### Added

- Setting to close the export modal after a successful export

## [1.0.5] - 2025-11-04

- Removed `obsidian` from the `id` and `description`

## [1.0.3] - 2025-11-04

### Fixed

- No more overwritten core styles
- Removed unused `.slider` CSS class
- Removed `console.log` statements from production code
- Adapted texts to sentence case
- Removed the heading in the settings to adhere to Obsidian UI guidelines
- Migrated from `public getTFile(path: string): TFile | null {` to `Vault.getFileByPath()`
- Made `isDesktopOnly` to return `false` to allow mobile installation

## [1.0.0] - 2025-01-25 - 🎉 **MVP RELEASE**

### 🎯 **MVP Complete**

The core Smart Export functionality is now feature-complete and ready for production use!

### Added

- **📚 Comprehensive Documentation**: Complete rewrite of README.md with:

  - **Feature Overview**: Clear explanation of all capabilities
  - **Installation Guide**: Both community plugin and manual installation steps
  - **Quick Start Tutorial**: Step-by-step guide for new users
  - **Export Format Examples**: Sample outputs for XML and Markdown formats
  - **Use Cases & Prompts**: Real-world examples for Research, Content Creation, Knowledge Discovery
  - **Advanced Tips**: Token optimization and export strategies
  - **Troubleshooting Guide**: Solutions for common issues
  - **Contributing Guidelines**: Development setup and contribution workflow

- **⚙️ Production-Ready Settings Panel**: Fully implemented plugin configuration with:

  - **Default Content Depth**: Configurable starting depth for full content (1-20)
  - **Default Title Depth**: Configurable starting depth for titles only (1-30)
  - **Default Export Format**: Choose preferred output format (XML/LLM Markdown/Print-Friendly)
  - **Auto-select Current Note**: Toggle automatic selection of active note as root
  - **Smart Validation**: Automatic enforcement of Title Depth ≥ Content Depth rule
  - **Real-time Updates**: Settings changes immediately reflected in export dialog

- **🔗 Settings Integration**: Export modal now uses plugin settings as intelligent defaults:

  - **Consistent Experience**: User preferences respected across all export sessions
  - **Smart Auto-selection**: Respects user preference for current note selection
  - **Format Persistence**: Remembers preferred export format between sessions

- **🚀 Professional GitHub Repository Setup**: Complete CI/CD and community infrastructure:
  - **GitHub Actions Workflow**: Automated testing, building, and release process
  - **Issue Templates**: Structured bug reports and feature requests with auto-assignment
  - **Pull Request Template**: Comprehensive checklist for code contributions
  - **Contributing Guidelines**: Detailed guide for development setup and contribution process
  - **Security Policy**: Clear vulnerability reporting process and security best practices
  - **Funding Configuration**: GitHub Sponsors integration for community support

### Improved

- **🎨 Enhanced User Experience**: Settings-driven defaults provide consistent, personalized workflow
- **📋 Export Dialog**: Now initializes with user-configured preferences instead of hardcoded values
- **⚡ Version Bump**: Updated to v1.0.0 to reflect MVP completion status

### Fixed

- **🔧 Template Settings Removal**: Eliminated placeholder "secret setting" from template code
- **📝 Documentation Gap**: Replaced generic template README with comprehensive plugin documentation

### 🏆 **MVP Achievement Status**

**✅ COMPLETE:**

- ✅ BFS Traversal Engine with dual-depth controls
- ✅ Modern UI with root note picker and depth sliders
- ✅ XML Export with structured metadata
- ✅ Token counting with LLM context warnings
- ✅ Comprehensive settings panel with user preferences
- ✅ Complete documentation and user guides

**🎁 BONUS FEATURES (Beyond MVP):**

- ✅ Multiple export formats (LLM Markdown, Print-Friendly)
- ✅ Advanced UI with card-based design and smart help
- ✅ Robust error handling and missing note tracking
- ✅ Comprehensive test suite (60/60 tests passing)

**📈 Ready for:**

- ✅ Community plugin submission
- ✅ User testing and feedback
- ✅ Production deployment

### Added

- **Comprehensive XML Export Test Suite**: Significantly enhanced test coverage for the XMLExporter
  - **Complex Hierarchies**: Tests for deep nested note structures and multiple children at same depth
  - **Content Sanitization**: Verification of proper XML escaping for special characters in titles and CDATA content
  - **Missing Notes Tracking**: Tests for various missing note scenarios including high counts and edge cases
  - **Metadata Validation**: Tests for timestamp formats, BFS processing order, and XML structure integrity
  - **Real-world Scenarios**: Tests with actual wikilink content, complex vault paths, and realistic note structures
  - **Edge Cases**: Handling of undefined content, single character inputs, and circular references
    - **ESLint Configuration**: Added `tsconfig.eslint.json` to properly include test files in linting process

### Improved

- **Test Organization**: Restructured XMLExporter tests into logical groups for better maintainability
- **Test Coverage**: Achieved comprehensive coverage of XMLExporter functionality with 19 detailed test cases

### Fixed

- **ESLint Parser Errors**: Resolved TypeScript parser issues with test files by creating dedicated ESLint configuration

- Major UI improvements:
  - **Modern Card-Based Layout**: Replaced dividing lines with clean, organized sections.
  - **Enhanced Visual Hierarchy**: Added clear section headers with descriptive emojis.
  - **Smart Help System**: Added informative tooltips and help text throughout the interface.
  - **Token Awareness**: Added smart warnings for LLM context limits (GPT-4, Claude).
  - **Improved Status Feedback**: Added visual indicators for operations (✅, ❌, 🔄).
  - **Better Export Format Descriptions**: Added clear explanations for each export type.
  - **Responsive Design**: Added layout adjustments for better usability.
  - **Enhanced Typography**: Improved font sizes, weights, and spacing.
  - **Modern Button Styling**: Added hover effects and better visual feedback.
- Split Markdown export into two formats:
  - **LLM-Optimized Markdown**: A detailed format with metadata and structure, similar to the XML export.
  - **Print-Friendly Markdown**: A simple, clean format containing only the note content.
- Added a dropdown menu to select the export format (XML or Markdown).
- Implemented a `MarkdownExporter` for plain text export.
- Improved error handling with a `try...catch` block around the export process.
- Implemented XML Export System:
  - The export functionality now generates a structured XML output instead of Markdown.
  - The XML includes metadata for each note, such as path, depth, and modification date.
  - Content is sanitized and wrapped in CDATA sections to ensure a well-formed output.
- Implemented BFS Traversal Engine:
  - Breadth-first search algorithm for note traversal.
  - Wikilink parsing and extraction.
  - Depth-based controls for content and title-only inclusion.
  - Circular reference detection to prevent infinite loops.
  - Caching layer to optimize performance for repeated traversals.
- Implemented core data structures (`ExportNode`, `VaultContext`, `ExportConfiguration`).
- Created placeholder classes for Obsidian API integration and metadata extraction.
- Implemented dual depth sliders for content and title depth with descriptive tooltips.
- Added a root note picker with a fuzzy search UI to the export modal.
- Implemented a basic token counter to estimate export size.
- Added export to clipboard functionality with a clear call-to-action button.
- Added a ribbon icon with a brain symbol to open the main export modal.
- Created the basic structure for the main export modal.
- Configured plugin metadata in `manifest.json`.
- Initial project setup
- Product Requirements Document
- Development roadmap and task breakdown

## [0.1.1] - 2025-06-23

### Added

- Implemented a comprehensive test suite using Vitest.
- Created mock data and Obsidian API stubs for isolated testing.
- Added unit tests for the `BFSTraversal` engine, covering:
  - Correct graph traversal logic.
  - Content and title depth limits.
  - Graceful handling of circular references.
  - Correctly ignoring missing notes or unresolved links.
- Configured code coverage reporting with `@vitest/coverage-v8`.
- Resolved module resolution issues for the `obsidian` package in a test environment.
- **Missing Notes Tracking**:
  - Enhanced `BFSTraversal` engine to track unresolved wikilinks as missing notes.
  - Updated `XMLExporter` and `LlmMarkdownExporter` to include missing notes count in metadata.
  - Added tests to verify missing notes are properly tracked and reported.
  - Integrated missing notes tracking into the main export workflow.

## [0.1.0] - 2025-06-22

### Added

- Project initialization
- Core architecture planning
