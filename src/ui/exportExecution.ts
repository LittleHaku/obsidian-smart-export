import { App } from "obsidian";
import { buildExportOutput } from "../engine/exportOutput";
import { ExportNode, SmartExportSettings } from "../types";
import { getContentRedactionOptions } from "../utils/contentRedaction";
import { resolveLlmMarkdownTemplate } from "../utils/llmMarkdownTemplateResolver";
import { getPrintFriendlyMarkdownOptions } from "../utils/printFriendlyMarkdownOptions";
import { applyContentSelection } from "./treeContentSelection";
import { estimateTokensFromCharacterCount, ExportFormat } from "./exportModalState";

export interface SerializeSelectedExportOptions {
	app: App;
	settings: SmartExportSettings;
	rootNode: ExportNode;
	selectedNodeIds: Set<string>;
	format: ExportFormat;
	selectedLlmTemplateId: string;
	missingNotesCount: number;
	onInvalidFormat: () => void;
}

export interface SerializedExport {
	output: string;
	tokenCount: number;
}

/** Resolves format dependencies and serializes the selected content tree. */
export async function serializeSelectedExport(
	options: SerializeSelectedExportOptions
): Promise<SerializedExport> {
	const selectedTree = applyContentSelection(options.rootNode, options.selectedNodeIds);
	const llmMarkdownTemplate =
		options.format === "llm-markdown"
			? (
					await resolveLlmMarkdownTemplate(
						options.app,
						options.settings.llmMarkdownTemplateDirectory,
						options.selectedLlmTemplateId
					)
				).template
			: null;
	const output = buildExportOutput({
		rootNode: selectedTree,
		vaultPath: options.app.vault.getName(),
		format: options.format,
		llmMarkdownTemplate,
		printFriendlyMarkdownOptions: getPrintFriendlyMarkdownOptions(options.settings),
		contentRedactionOptions: getContentRedactionOptions(options.settings),
		missingNotesCount: options.missingNotesCount,
		onInvalidFormat: options.onInvalidFormat,
	});
	return { output, tokenCount: estimateTokensFromCharacterCount(output.length) };
}
