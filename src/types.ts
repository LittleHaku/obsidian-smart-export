/**
 * Represents a single node in the exported note tree.
 */
export interface ExportNode {
	/** A unique identifier for the node, typically the file path. */
	id: string;
	/** The title of the note. */
	title: string;
	/** The depth of the node in the traversal tree, starting from 0. */
	depth: number;
	/** Whether the full content of the note should be included. */
	includeContent: boolean;
	/** The full content of the note, if included. */
	content?: string;
	/** An array of child nodes representing outgoing links. */
	children: ExportNode[];
	/** An estimated token count for the node's content. */
	tokenCount: number;
	/** The last modification date of the note file. */
	lastModified: Date;
}

/**
 * Defines which link directions should be traversed when exploring notes.
 */
export type LinkTraversalMode = "outgoing" | "incoming" | "both";

/**
 * Defines where an export should be delivered by default.
 */
export type ExportTarget = "clipboard" | "new-note";

/**
 * Defines formatting options for print-friendly Markdown exports.
 */
export interface PrintFriendlyMarkdownOptions {
	/** Whether to prepend a linked table of contents. */
	includeTableOfContents: boolean;
	/** Whether to prefix note headings with hierarchical section numbers. */
	numberHeadings: boolean;
	/** Whether to insert thematic breaks between exported note sections. */
	insertSectionDividers: boolean;
	/** Whether to insert HTML page breaks between exported note sections. */
	insertPageBreaksBetweenSections: boolean;
	/** Whether included note content headings should be shifted below exported note headings. */
	normalizeContentHeadings: boolean;
}

/**
 * Defines content redaction behavior applied to exported note content.
 */
export interface ContentRedactionOptions {
	/** Whether marked content sections should be redacted during export. */
	markedSectionsEnabled: boolean;
	/** Exact delimiter that marks the start and end of a redacted section. */
	delimiter: string;
	/** Text inserted in place of each marked section. */
	markedSectionReplacement: string;
	/** Whether regular expression rules should be applied during export. */
	regexRulesEnabled: boolean;
	/** Text inserted in place of each regular expression match. */
	regexReplacement: string;
	/** Regex patterns whose matches should be redacted during export. */
	regexPatterns?: string[];
}

/**
 * Defines the settings for the Smart Export plugin.
 */
export interface SmartExportSettings {
	/** The default depth for including full note content. */
	defaultContentDepth: number;
	/** The default depth for including only note titles. */
	defaultTitleDepth: number;
	/** The default format for the exported output. */
	defaultExportFormat: "xml" | "llm-markdown" | "print-friendly-markdown";
	/** The default delivery target used by quick export and the modal CTA. */
	defaultExportTarget: ExportTarget;
	/** The default LLM template id used when defaultExportFormat is llm-markdown. */
	defaultLlmTemplateId: string;
	/** The default link direction mode used when exploring related notes. */
	defaultLinkTraversalMode: LinkTraversalMode;
	/** Vault-relative folder used as the default destination for export notes. */
	defaultExportNoteFolderPath: string;
	/** Whether newly created export notes should be opened immediately. */
	openCreatedExportNote: boolean;
	/** Whether to automatically select the currently active note as the root for export. */
	autoSelectCurrentNote: boolean;
	/** Whether to close the export modal after a successful export. */
	closeModalAfterExport: boolean;
	/** Whether to show per-note token estimates in the tree visualization. */
	showTokenEstimatesInTree: boolean;
	/** Folders excluded from traversal in all link directions. */
	ignoredTraversalFolders: string[];
	/** Tag patterns that exclude notes from traversal in all link directions. */
	ignoredTraversalTagPatterns: string[];
	/** Frontmatter rules that exclude notes from traversal in all link directions. */
	ignoredTraversalPropertyRules: string[];
	/** Whether marked content sections should be redacted during export. */
	redactMarkedSections: boolean;
	/** Exact delimiter that marks the start and end of a redacted section. */
	redactionDelimiter: string;
	/** Text inserted in place of each marked section. */
	redactionReplacement: string;
	/** Whether regular expression redaction rules should be applied during export. */
	redactRegexMatches: boolean;
	/** Text inserted in place of each regular expression match. */
	redactionRegexReplacement: string;
	/** Regex patterns whose matches should be redacted during export. */
	redactionRegexPatterns: string[];
	/** Vault-relative folder used to resolve custom LLM Markdown templates. */
	llmMarkdownTemplateDirectory: string;
	/** Whether print-friendly exports should include a table of contents. */
	printFriendlyIncludeTableOfContents: boolean;
	/** Whether print-friendly exports should number note headings. */
	printFriendlyNumberHeadings: boolean;
	/** Whether print-friendly exports should insert dividers between note sections. */
	printFriendlyInsertSectionDividers: boolean;
	/** Whether print-friendly exports should insert page breaks between note sections. */
	printFriendlyInsertPageBreaks: boolean;
	/** Whether print-friendly exports should normalize included note content headings. */
	printFriendlyNormalizeContentHeadings: boolean;
}
