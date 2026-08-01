import { App, Notice, TFile } from "obsidian";
import { SmartExportSettings } from "../types";
import { getContentRedactionOptions } from "../utils/contentRedaction";
import {
	createExportNote,
	getAvailableExportNoteDestination,
	getDefaultExportNoteDestination,
} from "../utils/exportNote";
import { resolveLlmMarkdownTemplate } from "../utils/llmMarkdownTemplateResolver";
import { getPrintFriendlyMarkdownOptions } from "../utils/printFriendlyMarkdownOptions";
import { ObsidianAPI } from "../obsidian-api";
import { BFSTraversal } from "./BFSTraversal";
import { buildExportOutput } from "./exportOutput";

/** Executes the command-only export flow without coupling it to plugin lifecycle code. */
export async function quickExportCurrentNote(
	app: App,
	settings: SmartExportSettings,
	rootFile: TFile
): Promise<void> {
	try {
		if (rootFile.extension !== "md") {
			new Notice("Quick export only supports Markdown notes.");
			return;
		}

		const traversal = new BFSTraversal(
			new ObsidianAPI(app),
			settings.defaultContentDepth,
			settings.defaultTitleDepth,
			settings.defaultLinkTraversalMode,
			{
				ignoredTraversalFolders: settings.ignoredTraversalFolders,
				ignoredTraversalTagPatterns: settings.ignoredTraversalTagPatterns,
				ignoredTraversalPropertyRules: settings.ignoredTraversalPropertyRules,
			}
		);
		const exportTree = await traversal.traverse(rootFile.path);
		if (!exportTree) {
			new Notice("Quick export failed. Could not load the current note.");
			return;
		}
		const llmMarkdownTemplate =
			settings.defaultExportFormat === "llm-markdown"
				? (
						await resolveLlmMarkdownTemplate(
							app,
							settings.llmMarkdownTemplateDirectory,
							settings.defaultLlmTemplateId
						)
					).template
				: null;

		const output = buildExportOutput({
			rootNode: exportTree,
			vaultPath: app.vault.getName(),
			format: settings.defaultExportFormat,
			llmMarkdownTemplate,
			printFriendlyMarkdownOptions: getPrintFriendlyMarkdownOptions(settings),
			contentRedactionOptions: getContentRedactionOptions(settings),
			missingNotesCount: traversal.getMissingNotes().length,
			onInvalidFormat: () => {
				new Notice("Unknown export format in settings; falling back to XML.");
			},
		});

		if (settings.defaultExportTarget === "clipboard") {
			if (!navigator.clipboard?.writeText) {
				new Notice("Clipboard is not available in this environment.");
				return;
			}

			await navigator.clipboard.writeText(output);
			new Notice("Quick export copied to clipboard.");
			return;
		}

		const defaultDestination = getDefaultExportNoteDestination(
			rootFile,
			settings.defaultExportNoteFolderPath
		);
		const availableDestination = getAvailableExportNoteDestination(app, defaultDestination);
		const createdFile = await createExportNote(app, output, availableDestination, {
			openAfterCreate: settings.openCreatedExportNote,
		});
		new Notice(`Quick export note created: ${createdFile.path}`);
	} catch (error) {
		console.error("Quick export failed", error);
		new Notice("Quick export failed. See console for details.");
	}
}
