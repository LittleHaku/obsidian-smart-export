import { ExportNode, PrintFriendlyMarkdownOptions } from "../types";
import {
	buildExportedMarkdownLinkIndex,
	rewriteMarkdownLinksForExport,
} from "../utils/exportMarkdownLinks";
import { DEFAULT_PRINT_FRIENDLY_MARKDOWN_OPTIONS } from "../utils/printFriendlyMarkdownOptions";
import {
	buildPrintFriendlyMarkdownStructure,
	escapePrintFriendlyWikiLinkValue,
	getPrintFriendlySectionSeparator,
	PRINT_FRIENDLY_TABLE_OF_CONTENTS_HEADING,
} from "../utils/printFriendlyMarkdownStructure";

/**
 * A class to handle the export of note trees to a structured Markdown format.
 */
export class PrintFriendlyMarkdownExporter {
	/**
	 * Converts an ExportNode tree into a single Markdown string.
	 *
	 * @param rootNode The root node of the export tree.
	 * @returns A string containing the Markdown representation of the note tree.
	 */
	public export(rootNode: ExportNode, options?: PrintFriendlyMarkdownOptions): string {
		const resolvedOptions = {
			...DEFAULT_PRINT_FRIENDLY_MARKDOWN_OPTIONS,
			...(options ?? {}),
		};
		const { allNotes, headingLabels } = buildPrintFriendlyMarkdownStructure(
			rootNode,
			resolvedOptions
		);
		const linkIndex = buildExportedMarkdownLinkIndex(
			allNotes,
			(note) => headingLabels.get(note.id)!
		);
		const chunks: string[] = [];
		if (resolvedOptions.includeTableOfContents) {
			chunks.push(this.buildTableOfContents(rootNode, headingLabels));
		}
		this.buildNode(
			rootNode,
			0,
			chunks,
			linkIndex,
			headingLabels,
			new Set<string>(),
			resolvedOptions
		);
		return chunks.join("");
	}

	private buildTableOfContents(rootNode: ExportNode, headingLabels: Map<string, string>): string {
		const chunks = [PRINT_FRIENDLY_TABLE_OF_CONTENTS_HEADING];
		this.buildTableOfContentsEntries(rootNode, 0, chunks, headingLabels, new Set<string>());
		chunks.push("\n");
		return chunks.join("");
	}

	private buildTableOfContentsEntries(
		node: ExportNode,
		depth: number,
		chunks: string[],
		headingLabels: Map<string, string>,
		visited: Set<string>
	): void {
		if (visited.has(node.id)) {
			return;
		}
		visited.add(node.id);

		const indent = "  ".repeat(depth);
		const headingLabel = headingLabels.get(node.id)!;
		const escapedHeadingLabel = escapePrintFriendlyWikiLinkValue(headingLabel);
		chunks.push(`${indent}- [[#${escapedHeadingLabel}|${escapedHeadingLabel}]]\n`);

		for (const child of node.children) {
			this.buildTableOfContentsEntries(child, depth + 1, chunks, headingLabels, visited);
		}
	}

	/**
	 * Recursively builds the Markdown string for a single node and its children.
	 *
	 * @param node The ExportNode to process.
	 * @param depth The current depth in the tree, used for heading levels.
	 * @returns A formatted markdown string.
	 */
	private buildNode(
		node: ExportNode,
		depth: number,
		chunks: string[],
		linkIndex: ReturnType<typeof buildExportedMarkdownLinkIndex>,
		headingLabels: Map<string, string>,
		visited: Set<string>,
		options: PrintFriendlyMarkdownOptions
	) {
		if (visited.has(node.id)) {
			return;
		}
		visited.add(node.id);

		const prefix = "#".repeat(depth + 1);
		const headingLabel = headingLabels.get(node.id)!;
		if (chunks.length > 0) {
			chunks.push(getPrintFriendlySectionSeparator(options));
		}
		chunks.push(`${prefix} ${headingLabel}\n\n`);

		if (node.content && node.includeContent) {
			chunks.push(`${rewriteMarkdownLinksForExport(node.content, linkIndex, node.id)}\n\n`);
		}

		for (const child of node.children) {
			this.buildNode(child, depth + 1, chunks, linkIndex, headingLabels, visited, options);
		}
	}
}
