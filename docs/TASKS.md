# Development Tasks - Smart Export Plugin

> **Note**: This file serves as a development roadmap and implementation guide. It breaks down the PRD into concrete, actionable tasks for systematic development.

## Architecture Overview

### Core Components

- **BFS Traversal Engine**: Graph traversal algorithm for note discovery
- **Vault Context Analyzer**: Note indexing and similarity calculation system
- **Export Engine**: XML/text generation with template support
- **UI Components**: React-based interface for configuration and preview
- **Token Calculator**: Estimation system for various LLM context limits

---

## Phase 1: MVP Foundation

### 1.1 Core Data Structures

- [x] `ExportNode` interface implementation
- [x] `VaultContext` and `VaultContextNote` interfaces
- [x] `ExportConfiguration` state management (defined interface)
- [x] Obsidian API integration layer (created placeholder class)
- [x] Note metadata extraction utilities (created placeholder class)

### 1.2 BFS Traversal Engine

- [x] Implement breadth-first search algorithm
- [x] Wikilink parsing and extraction
- [x] Depth-based content filtering logic
- [x] Circular reference detection and handling

### 1.3 Basic UI Framework

- [x] Main export dialog component structure
- [x] Root note picker with fuzzy search
- [x] Dual depth control sliders with validation
- [x] Basic token counter implementation
- [x] Export to clipboard functionality

### 1.4 XML Export System

- [x] XML structure design and schema
- [x] Content sanitization for XML output
- [x] Metadata inclusion handling
- [x] Template variable substitution
- [x] Export validation and error handling
- [x] Missing notes tracking and reporting

---

## Phase 2: Core Features

### 2.1 Advanced UI Components

- [x] Basic UI modernization
  - [x] Card-based layout implementation
  - [x] Enhanced visual hierarchy
  - [x] Smart help system integration
  - [x] Token awareness improvements
  - [x] Status feedback system
  - [x] Responsive design
- [ ] Tree visualization component
  - [ ] Hierarchical note display
  - [ ] Depth-based visual indicators
  - [ ] Expandable/collapsible nodes
  - [ ] Real-time updates on configuration changes
- [ ] Dynamic preview panel
  - [ ] Live content preview
  - [ ] Token usage breakdown visualization
  - [ ] Performance metrics display
- [ ] Additional UI enhancements
  - [ ] Dark/light theme optimizations
  - [ ] Accessibility improvements (ARIA labels, keyboard navigation)
  - [ ] Animation and transitions
  - [ ] Custom theme support
  - [ ] Interactive help tour

### 2.2 Per-Note Control System

- [ ] Individual note inclusion checkboxes
- [ ] Content level selector (Full/Title+Para/Title Only)
- [ ] Custom excerpt functionality
- [ ] Bulk selection operations
- [ ] Note priority system implementation

### 2.3 Settings & Configuration

- [ ] Plugin settings panel integration
- [ ] Default configuration management
- [ ] Export preset system (save/load configurations)
- [ ] Hotkey assignment interface
- [ ] Migration system for settings updates

### 2.4 Enhanced Export Options

- [x] Multiple output formats
  - [x] XML
  - [x] LLM-Optimized Markdown
  - [x] Print-Friendly Markdown
- [ ] File export functionality
  - [ ] File location selection:
    - [ ] Current folder support
    - [ ] Dedicated exports folder creation and management
    - [ ] Custom location picker
  - [ ] File naming system:
    - [ ] Default naming patterns implementation
    - [ ] Custom name template support
    - [ ] Timestamp formatting options
  - [ ] Format-specific extensions:
    - [ ] XML export with `.xml` extension
    - [ ] Markdown export with `.md` extension
    - [ ] Plain text export with `.txt` extension
  - [ ] File system integration:
    - [ ] File existence checks
    - [ ] Overwrite protection dialog
    - [ ] Error handling for write operations
  - [ ] Progress indicators and success/failure notifications
- [ ] New note creation with exports
- [ ] Batch export capabilities
- [ ] Export logging and analytics

---

## Phase 3: Vault Context System

### 3.1 Vault Indexing Engine

- [ ] Complete vault note scanning
- [ ] Metadata extraction (tags, dates, folders)
- [ ] Ignore pattern implementation (`.llmexportignore` support)
- [ ] Incremental index updates
- [ ] Performance optimization for large vaults

### 3.2 Context Generation Algorithms

- [ ] **Note List Only**: Simple title collection
- [ ] **Note List + Tags**: Tag aggregation and formatting
- [ ] **Note List + Metadata**: Full metadata inclusion
- [ ] **Smart Context**: Relevance scoring implementation
  - [ ] TF-IDF similarity calculation
  - [ ] Tag overlap analysis
  - [ ] Link density scoring
  - [ ] Recent activity weighting

### 3.3 Context UI Components

- [ ] Vault context toggle and configuration
- [ ] Context type selector interface
- [ ] Max notes slider with real-time preview
- [ ] Context preview panel with filtering
- [ ] Manual context note selection interface

### 3.4 Context Management

- [ ] Context exclusion patterns
- [ ] Manual context additions
- [ ] Context budget allocation
- [ ] Context refresh mechanisms

---

## Phase 4: Advanced Features

### 4.1 Template System

- [ ] Template engine architecture
- [ ] Built-in template library
  - [ ] Connection Discovery template
  - [ ] Knowledge Gap Analysis template
  - [ ] Research Assistant template
  - [ ] Creative Writing template
- [ ] Custom template editor
- [ ] Template variable system
- [ ] Template sharing/import functionality

### 4.2 Smart Context Enhancements

- [ ] Machine learning model integration
- [ ] User feedback collection system
- [ ] Context recommendation improvement
- [ ] Semantic similarity using embeddings
- [ ] Dynamic context suggestions

### 4.3 Performance & Scalability

- [ ] Web Worker implementation for heavy computations
- [ ] Lazy loading for large note sets
- [ ] Memory usage optimization
- [ ] Background processing for context generation

### 4.4 Integration Features

- [ ] Dataview plugin compatibility
- [ ] Templater plugin integration
- [ ] Calendar plugin note filtering
- [ ] Graph view integration
- [ ] Mobile app compatibility (future consideration)

---

## Technical Implementation Notes

### Token Calculation Strategy

```typescript
// Approximate token calculation
const estimateTokens = (text: string): number => {
	// Rough approximation: 1 token ≈ 4 characters for English
	return Math.ceil(text.length / 4);
};

// More accurate calculation using tiktoken library (future enhancement)
const calculateTokensAccurate = async (text: string, model: string): Promise<number> => {
	// Implementation with tiktoken for precise token counting
};
```

### Smart Context Scoring

```typescript
interface RelevanceFactors {
	contentSimilarity: number; // TF-IDF similarity score
	tagOverlap: number; // Shared tags coefficient
	linkDensity: number; // Graph connectivity score
	recencyBoost: number; // Recent activity multiplier
	userFeedback: number; // Historical user selections
}

const calculateRelevance = (note: VaultContextNote, exportedContent: string[]): number => {
	// Weighted combination of relevance factors
};
```

---

## Testing Strategy

### Unit Tests

- [x] BFS traversal algorithm correctness
- [x] Missing notes detection and tracking
- [x] XML export comprehensive test suite
  - [x] Complex note hierarchies with multiple depths
  - [x] Content sanitization for XML special characters
  - [x] Missing notes tracking accuracy
  - [x] Metadata validation and structure
  - [x] Real-world scenarios with wikilinks
  - [x] Edge cases and error handling
  - [x] Circular reference handling
- [ ] Token calculation accuracy
- [ ] Context generation algorithms
- [ ] Cache invalidation logic

### Integration Tests

- [ ] Obsidian API interactions
- [ ] Plugin settings persistence
- [ ] Export workflow end-to-end
- [ ] Performance benchmarks
- [ ] Error handling scenarios

### User Testing

- [ ] Usability testing with target users
- [ ] Performance testing with large vaults
- [ ] Cross-platform compatibility
- [ ] Edge case validation
- [ ] Accessibility compliance

---

## Documentation Tasks

### Developer Documentation

- [ ] API reference documentation
- [ ] Architecture decision records
- [ ] Contributing guidelines
- [ ] Code style guide
- [ ] Testing documentation

### User Documentation

- [ ] Installation instructions
- [ ] Quick start guide
- [ ] Advanced usage examples
- [ ] Troubleshooting guide
- [ ] FAQ compilation

### Community Resources

- [ ] Example export configurations
- [ ] Template library documentation
- [ ] Integration guides
- [ ] Video tutorials (community-created)
- [ ] Best practices guide

---

## Quality Assurance

### Code Quality

- [ ] TypeScript strict mode compliance
- [ ] ESLint configuration and enforcement
- [ ] Prettier code formatting
- [ ] Pre-commit hooks setup
- [ ] Continuous integration pipeline

### Performance Monitoring

- [ ] Bundle size optimization
- [ ] Memory leak detection
- [ ] Large vault performance testing
- [ ] UI responsiveness metrics
- [ ] Export speed benchmarking

### Security Considerations

- [ ] Input sanitization for XML output
- [ ] Path traversal protection
- [ ] Malicious content handling
- [ ] Privacy-first design validation
- [ ] Local processing verification

---

## Release Planning

### Version 1.0.0 (MVP)

- Core BFS traversal
- Basic UI with depth controls
- XML export functionality
- Settings panel
- Documentation

### Version 1.1.0 (Enhanced UI)

- Tree visualization
- Per-note controls
- Export presets
- Performance improvements

### Version 1.2.0 (Vault Context)

- Basic vault context (titles + tags)
- Context budget management
- Enhanced templates
- Advanced filtering

### Version 1.3.0 (Smart Features)

- Smart context with relevance scoring
- Machine learning integration
- Advanced analytics
- Mobile support (future consideration)

---

## Notes for Development

### Architectural Decisions

- **React for UI**: Leverages Obsidian's existing React integration
- **TypeScript**: Ensures type safety and better developer experience
- **Modular Design**: Enables independent testing and feature development
- **Local Processing**: Maintains privacy and performance
- **Extensible Templates**: Allows community contributions

### Performance Targets

- **Large Vault Support**: 10,000+ notes without UI lag
- **Export Speed**: <5 seconds for typical exports (100 notes)
- **Memory Usage**: <100MB for normal operations
- **Startup Time**: <2 seconds for plugin initialization
- **UI Responsiveness**: <100ms for all user interactions
