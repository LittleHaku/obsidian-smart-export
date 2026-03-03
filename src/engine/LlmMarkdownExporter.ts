import { stringifyYaml } from "obsidian";
import { ExportNode } from "../types";

const DEFAULT_PROCESSING_ORDER = "BFS (Breadth-First Search)";
const DEFAULT_LLM_MARKDOWN_TEMPLATE = `{{metadata_yaml}}

## Note Structure

**Description**:
This export contains a knowledge graph of interconnected Obsidian notes.
Notes are presented in breadth-first order starting from the root note.
Links between notes are preserved as [[wiki-style links]].
Missing notes (referenced but not found) are listed separately.

**Included Notes**:
{{included_notes}}

## Note Contents

{{note_contents}}`;
const TEMPLATE_PLACEHOLDER_REGEX = /{{\s*([a-z0-9_]+)\s*}}/g;

interface LlmMarkdownMetadata {
	export_timestamp: string;
	vault_path: string;
	starting_note: string;
	total_notes_exported: number;
	missing_notes_count: number;
	max_depth_used: number;
	processing_order: string;
}

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
	 * @param template Optional user template with placeholders.
	 * @returns A string containing the Markdown representation of the note tree.
	 */
	public export(
		rootNode: ExportNode,
		vaultPath: string,
		missingNotes: number = 0,
		template?: string
	): string {
		const allNotes = this.flattenTree(rootNode);
		const maxDepth = allNotes.reduce((max, note) => Math.max(max, note.depth), 0);
		const context = this.buildTemplateContext(
			rootNode,
			vaultPath,
			allNotes,
			missingNotes,
			maxDepth
		);
		const templateSource =
			typeof template === "string" && template.trim().length > 0
				? template
				: DEFAULT_LLM_MARKDOWN_TEMPLATE;

		return this.renderTemplate(templateSource, context);
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
	): LlmMarkdownMetadata {
		const timestamp = new Date().toISOString();
		return {
			export_timestamp: timestamp,
			vault_path: vaultPath,
			starting_note: rootNode.title,
			total_notes_exported: totalNotes,
			missing_notes_count: missingNotes,
			max_depth_used: maxDepth,
			processing_order: DEFAULT_PROCESSING_ORDER,
		};
	}

	private buildMetadataYaml(metadata: LlmMarkdownMetadata): string {
		return `---\n${stringifyYaml(metadata)}---`;
	}

	private buildIncludedNotes(allNotes: ExportNode[]): string {
		return allNotes.map((note, index) => `- Note ${index + 1}: "${note.title}"`).join("\n");
	}

	private buildNoteStructureSection(includedNotes: string): string {
		return `## Note Structure\n\n**Included Notes**:\n${includedNotes}`;
	}

	private buildNoteContentsBlocks(allNotes: ExportNode[]): string {
		return allNotes
			.map((note, index) => `## Note ${index + 1}: "${note.title}"\n\n${note.content ?? ""}`)
			.join("\n\n---\n\n");
	}

	private buildTemplateContext(
		rootNode: ExportNode,
		vaultPath: string,
		allNotes: ExportNode[],
		missingNotes: number,
		maxDepth: number
	): Record<string, string> {
		const metadata = this.buildMetadata(
			rootNode,
			vaultPath,
			allNotes.length,
			missingNotes,
			maxDepth
		);
		const metadataYaml = this.buildMetadataYaml(metadata);
		const includedNotes = this.buildIncludedNotes(allNotes);
		const noteStructureSection = this.buildNoteStructureSection(includedNotes);
		const noteContents = this.buildNoteContentsBlocks(allNotes);
		const noteContentsSection = `## Note Contents\n\n${noteContents}`;

		return {
			export_timestamp: metadata.export_timestamp,
			vault_path: metadata.vault_path,
			starting_note: metadata.starting_note,
			total_notes_exported: String(metadata.total_notes_exported),
			total_notes: String(metadata.total_notes_exported),
			missing_notes_count: String(metadata.missing_notes_count),
			missing_notes: String(metadata.missing_notes_count),
			max_depth_used: String(metadata.max_depth_used),
			max_depth: String(metadata.max_depth_used),
			processing_order: metadata.processing_order,
			metadata_yaml: metadataYaml,
			note_structure_description: "",
			included_notes: includedNotes,
			note_structure_section: noteStructureSection,
			note_contents: noteContents,
			note_contents_section: noteContentsSection,
		};
	}

	private renderTemplate(template: string, context: Record<string, string>): string {
		return template.replace(TEMPLATE_PLACEHOLDER_REGEX, (match, rawKey: string) => {
			const key = rawKey.trim();
			return Object.prototype.hasOwnProperty.call(context, key) ? context[key] : match;
		});
	}
}
