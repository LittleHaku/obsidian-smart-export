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
 * Defines the settings for the Smart Export plugin.
 */
export interface SmartExportSettings {
	/** The default depth for including full note content. */
	defaultContentDepth: number;
	/** The default depth for including only note titles. */
	defaultTitleDepth: number;
	/** The default format for the exported output. */
	defaultExportFormat: "xml" | "llm-markdown" | "print-friendly-markdown";
	/** Whether to automatically select the currently active note as the root for export. */
	autoSelectCurrentNote: boolean;
	/** Whether to close the export modal after a successful export. */
	closeModalAfterExport: boolean;
}
