import { ExportNode } from "../types";

/**
 * A class to handle the export of note trees to a structured XML format.
 * This format is designed for easy parsing by external tools and LLMs.
 */
export class XMLExporter {
	/**
	 * Converts an ExportNode tree into a well-formed XML string.
	 *
	 * @param rootNode The root node of the export tree.
	 * @param vaultPath The path of the vault.
	 * @param missingNotes The number of missing notes encountered during traversal.
	 * @returns A string containing the XML representation of the note tree.
	 */
	public export(rootNode: ExportNode, vaultPath: string, missingNotes: number = 0): string {
		const allNotes = this.flattenTree(rootNode);
		const maxDepth = allNotes.reduce((max, note) => Math.max(max, note.depth), 0);

		const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>';
		const metadata = this.buildMetadata(
			rootNode,
			vaultPath,
			allNotes.length,
			missingNotes,
			maxDepth
		);
		const noteStructure = this.buildNoteStructure(allNotes);
		const noteContents = this.buildNoteContents(allNotes);

		return `${xmlHeader}\n<obsidian_export>\n${metadata}\n${noteStructure}\n${noteContents}\n</obsidian_export>`;
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
		return `  <metadata>
    <export_timestamp>${timestamp}</export_timestamp>
    <vault_path>${this.sanitize(vaultPath)}</vault_path>
    <starting_note>${this.sanitize(rootNode.title)}</starting_note>
    <total_notes_exported>${totalNotes}</total_notes_exported>
    <missing_notes_count>${missingNotes}</missing_notes_count>
    <max_depth_used>${maxDepth}</max_depth_used>
    <processing_order>BFS (Breadth-First Search)</processing_order>
  </metadata>`;
	}

	private buildNoteStructure(allNotes: ExportNode[]): string {
		const description = `This export contains a knowledge graph of interconnected Obsidian notes.
    Notes are presented in breadth-first order starting from the root note.
    Links between notes are preserved as [[wiki-style links]].
    Missing notes (referenced but not found) are listed separately.`;

		const includedNotes = allNotes
			.map((note, index) => `      <note id="${index + 1}" name="${this.sanitize(note.title)}" />`)
			.join("\n");

		return `  <note_structure>
    <description>${description}</description>
    <included_notes>\n${includedNotes}\n    </included_notes>
  </note_structure>`;
	}

	private buildNoteContents(allNotes: ExportNode[]): string {
		const notesXml = allNotes
			.map(
				(note, index) =>
					`  <note id="${index + 1}" name="${this.sanitize(note.title)}">
    <![CDATA[${this.sanitizeContent(note.content ?? "")}]]>
  </note>`
			)
			.join("\n");

		return `  <note_contents>\n${notesXml}\n  </note_contents>`;
	}

	private sanitize(text: string): string {
		return text
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&apos;");
	}

	private sanitizeContent(text: string): string {
		return text.replace(/]]>/g, "]]&gt;");
	}
}
