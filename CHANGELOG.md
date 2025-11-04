# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.4] - 2025-11-04

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
