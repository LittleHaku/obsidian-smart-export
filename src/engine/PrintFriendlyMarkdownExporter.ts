import { ExportNode } from "../types";
import {
	buildExportedMarkdownLinkIndex,
	buildExportedHeadingLabels,
	rewriteMarkdownLinksForExport,
} from "../utils/exportMarkdownLinks";

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
	public export(rootNode: ExportNode): string {
		const allNotes = this.flattenTree(rootNode);
		const headingLabels = buildExportedHeadingLabels(allNotes);
		const linkIndex = buildExportedMarkdownLinkIndex(
			allNotes,
			(note) => headingLabels.get(note.id)!
		);
		const chunks: string[] = [];
		this.buildNode(rootNode, 0, chunks, linkIndex, headingLabels);
		return chunks.join("");
	}

	private flattenTree(rootNode: ExportNode): ExportNode[] {
		const queue: ExportNode[] = [rootNode];
		const notes: ExportNode[] = [];
		let head = 0;

		while (head < queue.length) {
			const note = queue[head++];
			notes.push(note);
			for (const child of note.children) {
				queue.push(child);
			}
		}

		return notes;
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
		headingLabels: Map<string, string>
	) {
		const prefix = "#".repeat(depth + 1);
		const headingLabel = headingLabels.get(node.id)!;
		chunks.push(`${prefix} ${headingLabel}\n\n`);

		if (node.content && node.includeContent) {
			chunks.push(`${rewriteMarkdownLinksForExport(node.content, linkIndex)}\n\n`);
		}

		for (const child of node.children) {
			this.buildNode(child, depth + 1, chunks, linkIndex, headingLabels);
		}
	}
}
