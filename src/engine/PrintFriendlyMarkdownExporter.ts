import { ExportNode, PrintFriendlyMarkdownOptions } from "../types";
import {
	buildExportedMarkdownLinkIndex,
	buildExportedHeadingLabels,
	rewriteMarkdownLinksForExport,
} from "../utils/exportMarkdownLinks";
import { DEFAULT_PRINT_FRIENDLY_MARKDOWN_OPTIONS } from "../utils/printFriendlyMarkdownOptions";

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
		const allNotes = this.flattenTree(rootNode);
		const baseHeadingLabels = buildExportedHeadingLabels(allNotes);
		const headingLabels = resolvedOptions.numberHeadings
			? this.buildNumberedHeadingLabels(rootNode, baseHeadingLabels)
			: baseHeadingLabels;
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

	private flattenTree(rootNode: ExportNode): ExportNode[] {
		const queue: ExportNode[] = [rootNode];
		const notes: ExportNode[] = [];
		const visited = new Set<string>();
		let head = 0;

		while (head < queue.length) {
			const note = queue[head++];
			if (visited.has(note.id)) {
				continue;
			}
			visited.add(note.id);
			notes.push(note);
			for (const child of note.children) {
				queue.push(child);
			}
		}

		return notes;
	}

	private buildNumberedHeadingLabels(
		rootNode: ExportNode,
		baseHeadingLabels: Map<string, string>
	): Map<string, string> {
		const numberedHeadingLabels = new Map<string, string>();
		this.assignSectionNumbers(
			rootNode,
			[1],
			baseHeadingLabels,
			numberedHeadingLabels,
			new Set<string>()
		);
		return numberedHeadingLabels;
	}

	private assignSectionNumbers(
		node: ExportNode,
		sectionNumber: number[],
		baseHeadingLabels: Map<string, string>,
		numberedHeadingLabels: Map<string, string>,
		visited: Set<string>
	): void {
		visited.add(node.id);

		const baseHeadingLabel = baseHeadingLabels.get(node.id)!;
		numberedHeadingLabels.set(
			node.id,
			`${this.formatSectionNumber(sectionNumber)} ${baseHeadingLabel}`
		);

		let childIndex = 0;
		for (const child of node.children) {
			if (visited.has(child.id)) {
				continue;
			}
			childIndex += 1;
			this.assignSectionNumbers(
				child,
				[...sectionNumber, childIndex],
				baseHeadingLabels,
				numberedHeadingLabels,
				visited
			);
		}
	}

	private formatSectionNumber(sectionNumber: number[]): string {
		const joinedNumber = sectionNumber.join(".");
		return sectionNumber.length === 1 ? `${joinedNumber}.` : joinedNumber;
	}

	private buildTableOfContents(rootNode: ExportNode, headingLabels: Map<string, string>): string {
		const chunks = ["# Table of contents\n\n"];
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
		const escapedHeadingLabel = this.escapeWikiLinkValue(headingLabel);
		chunks.push(`${indent}- [[#${escapedHeadingLabel}|${escapedHeadingLabel}]]\n`);

		for (const child of node.children) {
			this.buildTableOfContentsEntries(child, depth + 1, chunks, headingLabels, visited);
		}
	}

	private escapeWikiLinkValue(value: string): string {
		return value.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\]/g, "\\]");
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
		if (options.insertSectionDividers && chunks.length > 0) {
			chunks.push("---\n\n");
		}
		chunks.push(`${prefix} ${headingLabel}\n\n`);

		if (node.content && node.includeContent) {
			chunks.push(`${rewriteMarkdownLinksForExport(node.content, linkIndex)}\n\n`);
		}

		for (const child of node.children) {
			this.buildNode(child, depth + 1, chunks, linkIndex, headingLabels, visited, options);
		}
	}
}
