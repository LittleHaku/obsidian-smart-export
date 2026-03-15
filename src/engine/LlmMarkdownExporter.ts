import { stringifyYaml } from "obsidian";
import { ExportNode } from "../types";
import {
	DEFAULT_BUILTIN_LLM_TEMPLATE_CONTENT,
	DEFAULT_NOTE_STRUCTURE_DESCRIPTION,
} from "../constants/llmMarkdownTemplates";
import {
	buildExportedMarkdownLinkIndex,
	buildExportedHeadingLabels,
	rewriteMarkdownLinksForExport,
} from "../utils/exportMarkdownLinks";

const DEFAULT_PROCESSING_ORDER = "BFS (Breadth-First Search)";
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
				: DEFAULT_BUILTIN_LLM_TEMPLATE_CONTENT;

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

	private buildIncludedNotes(allNotes: ExportNode[], headingLabels: Map<string, string>): string {
		return allNotes
			.map((note, index) => `- Note ${index + 1}: "${headingLabels.get(note.id)!}"`)
			.join("\n");
	}

	private buildNoteStructureSection(
		noteStructureDescription: string,
		includedNotes: string
	): string {
		return `## Note Structure\n\n**Description**:\n${noteStructureDescription}\n\n**Included Notes**:\n${includedNotes}`;
	}

	private buildNoteContentsBlocks(
		allNotes: ExportNode[],
		headingLabels: Map<string, string>
	): string {
		const linkIndex = buildExportedMarkdownLinkIndex(
			allNotes,
			(note) => headingLabels.get(note.id)!
		);
		return allNotes
			.map((note) => {
				const rewrittenContent = rewriteMarkdownLinksForExport(note.content ?? "", linkIndex);
				const headingLabel = headingLabels.get(note.id)!;
				return `## ${headingLabel}\n\n${rewrittenContent}`;
			})
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
		const headingLabels = buildExportedHeadingLabels(allNotes);
		const noteStructureDescription = DEFAULT_NOTE_STRUCTURE_DESCRIPTION;
		const includedNotes = this.buildIncludedNotes(allNotes, headingLabels);
		const noteStructureSection = this.buildNoteStructureSection(
			noteStructureDescription,
			includedNotes
		);
		const noteContents = this.buildNoteContentsBlocks(allNotes, headingLabels);
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
			note_structure_description: noteStructureDescription,
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
