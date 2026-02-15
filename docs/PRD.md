# Smart Export Plugin - Product Requirements Document

## Overview

The Smart Export plugin enables users to intelligently export interconnected notes for Large Language Model consumption. Using Breadth-First Search (BFS) traversal of wikilinks, it creates structured XML exports with configurable depth and content granularity, plus optional vault-wide context for enhanced LLM understanding.

## Core Value Proposition

- **Smart Context Gathering**: Automatically discovers and includes related notes through wikilink traversal
- **Vault-Wide Context**: Optional inclusion of all vault notes for LLM connection discovery and knowledge gap analysis
- **Flexible Depth Control**: Different depth settings for full content vs. title-only inclusion
- **Token-Aware**: Helps users stay within LLM context limits
- **Export Flexibility**: Multiple output formats optimized for different LLM workflows

## Monetization & Sustainability

### Community Support Model

Since Obsidian plugins are difficult to monetize directly, focus on community-driven sustainability:

**Support Options**

- **Buy Me a Coffee**: Simple donation link in plugin settings and README
- **GitHub Sponsors**: Monthly/one-time sponsorship tiers
- **Ko-fi**: Alternative donation platform with goal tracking

**Sponsor Benefits** (Non-exclusive, appreciation-based)

- **Recognition**: Sponsor names in plugin credits (with permission)
- **Early Access**: Beta features before public release
- **Priority Support**: Faster response to bug reports and feature requests
- **Input on Roadmap**: Quarterly sponsor surveys for feature priorities

**Community Engagement**

- **Open Source**: Full transparency builds trust and attracts contributors
- **Documentation**: Comprehensive docs encourage adoption and reduce support burden
- **Community Templates**: User-contributed prompt templates increase value
- **Regular Updates**: Consistent development shows ongoing commitment

### Value Proposition for Donations

- **Time Savings**: Saves hours of manual note compilation
- **Workflow Enhancement**: Seamlessly bridges Obsidian → LLM workflows
- **Open Source**: No vendor lock-in, full transparency
- **Privacy-First**: All processing happens locally
- **Active Development**: Regular updates and new features

## Core Features

### 🎯 Main Export Dialog

### Visual Note Selector Interface

**Root Note Picker**

- Dropdown/search field to select starting note
- Default: Currently active note
- Recent notes history for quick selection
- Fuzzy search with note preview

**Dual Depth Control System**

- **Content Depth Slider** (1-20): Levels to include full note content
- **Title Depth Slider** (1-30): Additional levels to include titles only
- Real-time validation: Title depth must be ≥ Content depth
- Visual indicators showing the relationship between depths

**🗂️ Vault Context Options**

- **Include Vault Context Toggle**: Enable/disable vault-wide note context
- **Context Type Selector**:
  - **Note List Only**: Comprehensive list of all vault note titles
  - **Note List + Tags**: Note titles with their tags for categorization
  - **Note List + Metadata**: Titles, tags, creation dates, and folder structure
  - **Smart Context**: AI-curated list of potentially relevant notes based on content similarity
- **Max Context Notes**: Slider to limit vault context size (50-1000 notes)
- **Context Token Counter**: Real-time estimation of vault context token usage

### 📈 Dynamic Preview Panel

**Tree Visualization**

- Hierarchical tree showing note relationships
- Visual depth indicators (different colors/indentation per level)
- Icons differentiating content vs. title-only inclusion
- Expandable/collapsible branches

**Vault Context Preview**

- **Context Panel**: Expandable section showing selected vault context notes
- **Context Statistics**: Number of context notes, token usage, coverage percentage
- **Context Filtering**: Quick filters for folders, tags, date ranges
- **Context Exclusions**: Per-note checkboxes to exclude from context

**Smart Analytics**

- **Token Counter**: Per-note, vault context, and total token estimates
- **Context Window Warnings**: Non-intrusive alerts for common LLMs
  - GPT-4: 128k tokens
  - Claude: 200k tokens
  - Custom limits
- **Note Statistics**: Total notes, content notes, title-only notes, context notes

**Interactive Controls**

- Per-note checkboxes for inclusion/exclusion
- Quick actions: "Select All", "Content Only", "Titles Only", "Include Context"
- View toggle: Tree view ↔ Flat list with sorting/filtering

### ✏️ Advanced Edit Mode

### Granular Control Panel

**Enhanced Note Management**

- **Checklist View**: All discovered notes with tri-state checkboxes
  - ✅ Include full content
  - 📄 Include title only
  - ❌ Exclude
- **Content Level Selector**: Per-note dropdown
  - Full Content
  - Title + First Paragraph
  - Title Only
  - Custom Excerpt (user-defined)

**Vault Context Management**

- **Context Type Configuration**: Detailed options for each context level
- **Smart Context Settings**: Similarity thresholds, relevance scoring
- **Context Filtering Rules**: Advanced pattern matching for inclusion/exclusion
- **Context Preview**: Searchable, sortable list of all context notes
- **Manual Context Additions**: Search interface to manually add specific notes to context

**Manual Curation Tools**

- **Manual Additions**: Search interface to add unconnected notes
- **Link Override**: Temporarily treat notes as connected for export
- **Ignore Patterns**: VS Code-style ignore rules
  - `.llmexportignore` file support in vault root
  - Glob patterns: `.excalidraw`, `Templates/*`, `#private`
  - Quick ignore buttons in preview (right-click → "Add to ignore patterns")
  - Temporary session ignores vs. permanent vault-wide ignores

### Token Budget Management

- **Budget Slider**: Set maximum token limit
- **Budget Allocation**: Visual breakdown of tokens (content vs. context)
- **Manual Adjustment Tools**: When over budget, highlight which notes to consider excluding
  - GPT-4: 128k tokens
  - Claude: 200k tokens
  - Custom limits
- **Priority System**: Mark high-priority notes that should never be excluded
- **Context Budget Control**: Separate limits for vault context vs. main content
- **Simple Reduction Options**:
  - Remove metadata/frontmatter
  - Strip formatting (markdown, HTML)
  - Exclude notes by file size threshold
  - Reduce vault context detail level

### **📤 Output Options**

- **Export Destinations**:
  - **Copy to Clipboard**: Formatted for immediate LLM pasting
  - **File Export**: Save as `.xml`, `.md`, or `.txt` with configurable options:
    - **File Location**: Choose between:
      - Current folder
      - Dedicated exports folder
      - Custom location
    - **File Naming**: Options for:
      - `[root-note]-export-[timestamp]`
      - `llm-export-[timestamp]`
      - Custom name template
    - **File Format**: Matching the selected export format:
      - `.xml` for XML exports
      - `.md` for Markdown exports
      - `.txt` for plain text exports
    - **Overwrite Protection**: Prompt if file exists
  - **New Note Creation**: Create "LLM Export - [timestamp]" note
- **Template System**
  - **Connection Discovery**: "Analyze these notes and suggest connections to other notes in my vault..."
  - **Knowledge Gap Analysis**: "Based on these notes and my vault structure, identify potential knowledge gaps..."
  - **Conversation Starter**: "Analyze these interconnected notes about [topic]..."
  - **Research Assistant**: "Use these notes as reference material for..."
  - **Creative Writing**: "Draw inspiration from these connected ideas..."
  - **Custom Templates**: User-defined prompt templates with variables

---

## Technical Architecture

### BFS Traversal Algorithm

```
1. Start from root note
2. Queue all wikilinked notes at current depth
3. For each note in queue:
   - If depth ≤ content_depth: Include full content
   - If depth ≤ title_depth: Include title only
   - Add its wikilinks to next depth queue
4. Continue until title_depth reached or no more links
5. If vault context enabled: Collect additional vault notes based on context type
```

### Vault Context Generation

```
Vault Context Algorithm:
1. Scan all notes in vault (excluding ignored patterns)
2. Apply context type filters:
   - Note List Only: Collect titles
   - + Tags: Add tag metadata
   - + Metadata: Add creation dates, folders, modification times
   - Smart Context: Calculate relevance scores using:
     * TF-IDF similarity to exported content
     * Tag overlap analysis
     * Link density in vault graph
     * Recent activity weighting
3. Sort by relevance (for Smart Context) or alphabetically
4. Apply max notes limit
5. Calculate token usage
```

### Performance Considerations

- **Incremental Loading**: Load note content and vault context on-demand in preview
- **Background Processing**: Run BFS traversal and vault analysis in web worker
- **Memory Management**: Limit concurrent note loading and context processing
- **Smart Context Optimization**: Cache similarity calculations and update incrementally

### Data Structure

```tsx
interface ExportNode {
	id: string;
	title: string;
	depth: number;
	includeContent: boolean;
	content?: string;
	children: ExportNode[];
	tokenCount: number;
	lastModified: Date;
	maxTokens?: number;
}

interface VaultContext {
	type: "none" | "titles" | "titles_tags" | "titles_metadata" | "smart";
	maxNotes: number;
	notes: VaultContextNote[];
	tokenCount: number;
	excludePatterns: string[];
}

interface VaultContextNote {
	title: string;
	tags?: string[];
	folder?: string;
	created?: Date;
	modified?: Date;
	relevanceScore?: number; // for smart context
	included: boolean;
}

interface ExportConfiguration {
	rootNote: string;
	contentDepth: number;
	titleDepth: number;
	vaultContext: VaultContext;
	excludedNotes: string[];
	customInclusions: string[];
	templateId: string;
	maxTokens?: number;
}
```

### Export Format Example (XML)

```xml
<obsidian_export>
  <metadata>
    <export_timestamp>2025-05-25T19:55:57.175Z</export_timestamp>
    <vault_path>.</vault_path>
    <starting_note>Machine Learning</starting_note>
    <total_notes_exported>5</total_notes_exported>
    <missing_notes_count>0</missing_notes_count>
    <max_depth_used>2</max_depth_used>
    <processing_order>BFS (Breadth-First Search)</processing_order>
  </metadata>
  <note_structure>
    <description>
      This export contains a knowledge graph of interconnected Obsidian notes.
      Notes are presented in breadth-first order starting from the root note.
      Links between notes are preserved as [[wiki-style links]].
      Missing notes (referenced but not found) are listed separately.
    </description>
    <included_notes>
      <note id="1" name="Machine Learning" />
      <note id="2" name="Artificial Intelligence" />
      <note id="3" name="Cross-Entropy Loss" />
      <note id="4" name="k-NN Nearest Neighbours" />
      <note id="5" name="Decision Trees" />
    </included_notes>
  </note_structure>
  <note_contents>
    <note id="1" name="Machine Learning">
---
tags:
aliases:
  - Aprendizaje Automático
type: note
status: sprout
created: 2022-12-01
rating:
---


- `Status:` #📝/⭐ #note
Tags: [[]]
Links: [[Artificial Intelligence|Inteligencia Artificial]]

---


# Machine Learning
# Conceptos Generales
- **Atributo**: característica que describe parcialmente a los elementos (columna de una tabla)
- **Instancia**: un elemento definido por los valores de sus atributos (fila de una tabla)
- **Clase**: Subconjuntos disjuntos (categorías) en los que se quiere dividir el conjunto de instancias (una de las columnas)
#### Binary Entropy
[[Cross-Entropy Loss]]
$H(X)=H_b(p)=-p\log_2p-q\log_2q$ (in bits)
#### Entropy for a discrete r.v.
$H(X)=-\sum P(X=x_i)\log_2P(X=x_i)$ (in bits)
#### Conditional Entropy
$H(Y|X)=-\sum P(X=x_i)*H(Y|X=x_i)$
# [[k-NN Nearest Neighbours]]
# [[Decision Trees]]


Created: 2022-12-01 20:12
    </note>
    <note id="2" name="Artificial Intelligence">
---
aliases: []
tags: area
created: 2024-04-02
link: "[[02 - My Areas Database]]"
---


---


# Artificial Intelligence



Created: 2024-04-02 23:04
    </note>
  </note_contents>
</obsidian_export>
```

---

## User Experience Flow

### Quick Export (Default Path)

1. User opens plugin from command palette or ribbon
2. Current note auto-selected as root
3. Default depths applied (Content: 3, Title: 6)
4. Vault context disabled by default
5. One-click "Export to Clipboard"
6. Success notification with token count breakdown

### Context-Enhanced Export

1. User opens plugin and enables "Include Vault Context"
2. Select context type (default: Note List + Tags)
3. Preview shows both note tree and context preview
4. Adjust max context notes if needed
5. Use context-aware template (e.g., "Connection Discovery")
6. Export with detailed analytics including context usage

### Advanced Export

1. User clicks "Advanced Options"
2. Customize root note, depths, exclusions
3. Configure vault context settings
4. Preview panel updates in real-time
5. Fine-tune individual note and context inclusion
6. Select export format and destination
7. Export with detailed analytics

### Power User Features

1. Save export configurations as presets (including context settings)
2. Hotkey assignments for common exports
3. Batch export multiple root notes with consistent context
4. Integration with other Obsidian plugins (Dataview, Templater)
5. Smart context learning from user feedback

---

## Settings & Configuration

### Plugin Settings Panel

**Default Behavior**

- Default content depth (1-20, default: 3)
- Default title depth (1-30, default: 6)
- Auto-select current note as root
- Default export format

**Vault Context Defaults**

- Default context type: [None/Note List/Note List + Tags/Note List + Metadata/Smart Context]
- Default max context notes: (50-1000, default: 500)
- Auto-refresh context on vault changes: [Yes/No]
- Smart context similarity threshold: [Low/Medium/High]

**Context Exclusion Patterns**

- Global exclude patterns: `Templates/*`, `*.excalidraw`, `Private/*`
- Custom ignore patterns (glob syntax)
- Respect `.llmexportignore` files: [Yes/No]
- Exclude archived notes: [Yes/No]

**Token Limits & Warnings**

- Custom token limits per LLM
- Warning thresholds (80%, 90%, 100%)
- Token counting method (character-based estimate vs. actual tokenization)
- Context token allocation percentage (default: 20% of total budget)

**Advanced Options**

- BFS traversal limits (max notes, timeout)
- Custom XML/template formatting
- Smart context algorithm parameters

---

## Future Enhancements

### Phase 2 Features

- **Enhanced Filtering**: Include notes by tags, folders, creation/modification dates
- **Manual Summarization Tools**: UI helpers for users to create their own note summaries
- **Collaborative Exports**: Share export configurations with team
- **Version Control**: Track changes in exported note sets over time
- **Context Learning**: Machine learning to improve smart context recommendations based on user selections

### Phase 3 Features

- **Advanced Pattern Matching**: Rule-based note inclusion/exclusion
- **Export Analytics**: Track export patterns and frequently used configurations
- **Integration Marketplace**: Pre-built configurations for popular LLM use cases
- **Mobile Support**: Export functionality in Obsidian mobile apps (future consideration)
- **Semantic Search**: Use embeddings for more sophisticated content similarity
- **Dynamic Context**: Real-time context suggestions based on LLM conversation history

---

## Implementation Priority

### MVP (Minimum Viable Product)

1. ✅ Basic BFS traversal with dual-depth system
2. ✅ Simple UI with root note picker and depth sliders
3. ✅ XML export to clipboard
4. ✅ Token counting and basic warnings

### Phase 1 (Core Features)

1. 🎯 Advanced preview panel with tree visualization
2. 🎯 Per-note inclusion controls
3. 🎯 Settings panel with defaults
4. 🆕 Basic vault context (Note List Only and Note List + Tags)
5. 🆕 Context token counting and budget management

### Phase 2 (Enhanced Context & Polish)

1. 📈 Template system with context-aware prompts
2. 📈 Export presets and hotkeys
3. 📈 Advanced exclusion rules
4. 📈 File export options
5. 🆕 Full metadata context and smart context (Phase 1)
6. 🆕 Advanced context filtering and management
7. 🆕 Context performance optimizations

### Phase 3 (Advanced Features)

1. 🚀 Smart context machine learning improvements
2. 🚀 Context analytics and learning
3. 🚀 Advanced vault analysis features
4. 🚀 Integration with external knowledge bases
