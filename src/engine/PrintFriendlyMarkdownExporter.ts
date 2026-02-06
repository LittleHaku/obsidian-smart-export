import { ExportNode } from "../types";

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
		const chunks: string[] = [];
		this.buildNode(rootNode, 0, chunks);
		return chunks.join("");
	}

	/**
	 * Recursively builds the Markdown string for a single node and its children.
	 *
	 * @param node The ExportNode to process.
	 * @param depth The current depth in the tree, used for heading levels.
	 * @returns A formatted markdown string.
	 */
	private buildNode(node: ExportNode, depth: number, chunks: string[]) {
		const prefix = "#".repeat(depth + 1);
		chunks.push(`${prefix} ${node.title}\n\n`);

		if (node.content && node.includeContent) {
			chunks.push(`${node.content}\n\n`);
		}

		for (const child of node.children) {
			this.buildNode(child, depth + 1, chunks);
		}
	}
}
