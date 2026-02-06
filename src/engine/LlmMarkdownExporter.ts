import { ExportNode } from "../types";

/**
 * A class to handle the export of note trees to a structured, LLM-optimized Markdown format.
 */
export class LlmMarkdownExporter {
	/**
	 * Converts an ExportNode tree into a well-formed Markdown string for LLMs.
	 *
	 * @param rootNode The root node of the export tree.
	 * @param vaultPath The path of the vault.
	 * @param missingNotes The number of missing notes encountered during traversal.
	 * @returns A string containing the Markdown representation of the note tree.
	 */
	public export(rootNode: ExportNode, vaultPath: string, missingNotes: number = 0): string {
		const allNotes = this.flattenTree(rootNode);
		const maxDepth = allNotes.reduce((max, note) => Math.max(max, note.depth), 0);

		const metadata = this.buildMetadata(
			rootNode,
			vaultPath,
			allNotes.length,
			missingNotes,
			maxDepth
		);
		const noteStructure = this.buildNoteStructure(allNotes);
		const noteContents = this.buildNoteContents(allNotes);

		return `${metadata}\n\n${noteStructure}\n\n${noteContents}`;
	}

	private flattenTree(node: ExportNode): ExportNode[] {
		const queue: ExportNode[] = [node];
		const result: ExportNode[] = [];
		const visited = new Set<string>();
		let head = 0;

		while (head < queue.length) {
			const currentNode = queue[head++];
			if (!currentNode || visited.has(currentNode.id)) {
				continue;
			}
			visited.add(currentNode.id);
			result.push(currentNode);
			for (const child of currentNode.children) {
				queue.push(child);
			}
		}
		return result;
	}

	private buildMetadata(
		rootNode: ExportNode,
		vaultPath: string,
		totalNotes: number,
		missingNotes: number,
		maxDepth: number
	): string {
		const timestamp = new Date().toISOString();
		return `---
export_timestamp: ${timestamp}
vault_path: "${vaultPath}"
starting_note: "${rootNode.title}"
total_notes_exported: ${totalNotes}
missing_notes_count: ${missingNotes}
max_depth_used: ${maxDepth}
processing_order: BFS (Breadth-First Search)
---`;
	}

	private buildNoteStructure(allNotes: ExportNode[]): string {
		const description = `This export contains a knowledge graph of interconnected Obsidian notes.
Notes are presented in breadth-first order starting from the root note.
Links between notes are preserved as [[wiki-style links]].
Missing notes (referenced but not found) are listed separately.`;

		const includedNotes = allNotes
			.map((note, index) => `- Note ${index + 1}: "${note.title}"`)
			.join("\n");

		return `## Note Structure\n\n**Description**:\n${description}\n\n**Included Notes**:\n${includedNotes}`;
	}

	private buildNoteContents(allNotes: ExportNode[]): string {
		const notesMd = allNotes
			.map((note, index) => `## Note ${index + 1}: "${note.title}"\n\n${note.content ?? ""}`)
			.join("\n\n---\n\n");

		return `## Note Contents\n\n${notesMd}`;
	}
}
