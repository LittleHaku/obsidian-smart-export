# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
- New Obsidian plugin review checklist (`docs/obsidian-plugin-guidelines.md`)
- New contributor guide file (`AGENTS.md`)
- New startup lifecycle documentation page with phase-based flow and Mermaid diagram (`docs/startup-process.md`)

### Changed

- Simplified folder filtering model to a single exclusion list (removed direction-specific folder filtering complexity)
- Updated export tree cache key generation to serialize excluded folders with `JSON.stringify(...)` to avoid delimiter-based key collisions
- Refactored duplicated folder normalization logic to shared utilities used by settings and traversal
- Folder filter path normalization now uses Obsidian `normalizePath()` for vault-consistent behavior (including slash normalization and Unicode-safe path cleanup)
- Updated README structure with numbered sections and reduced duplication (installation, quick start, docs, settings, troubleshooting)
- Standardized docs naming from "incoming link folder filters" to "excluded folders" (`docs/exclude-folders.md`)
- Expanded folder filter tests to cover NBSP normalization and blank-input handling
- Added explicit docs scope guidance in `AGENTS.md` to keep architecture documentation proportional to plugin complexity
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
