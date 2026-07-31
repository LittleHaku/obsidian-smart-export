import { Notice, Plugin, TFile } from "obsidian";
import { BFSTraversal } from "./engine/BFSTraversal";
import { buildExportOutput, normalizeExportFormat } from "./engine/exportOutput";
import { ObsidianAPI } from "./obsidian-api";
import { ExportModal } from "./ui/ExportModal";
import { SmartExportSettingTab } from "./ui/SmartExportSettingTab";
import { ExportTarget, SmartExportSettings } from "./types";
import { ReleaseNotesEntry } from "./constants/releaseNotes";
import { ReleaseNotesModal } from "./ui/ReleaseNotesModal";
import { normalizeFolderFilterList } from "./utils/folderFilters";
import { normalizeFundingUrl } from "./utils/fundingUrl";
import { normalizePropertyFilterList, normalizeTagFilterList } from "./utils/noteFilters";
import {
	createExportNote,
	getAvailableExportNoteDestination,
	getDefaultExportNoteDestination,
	normalizeExportNoteFolderPath,
} from "./utils/exportNote";
import {
	DEFAULT_BUILTIN_LLM_TEMPLATE_ID,
	resolveLlmMarkdownTemplate,
} from "./utils/llmMarkdownTemplateResolver";
import {
	DEFAULT_PRINT_FRIENDLY_MARKDOWN_OPTIONS,
	getPrintFriendlyMarkdownOptions,
	normalizePrintFriendlyMarkdownOption,
} from "./utils/printFriendlyMarkdownOptions";
import {
	getContentRedactionOptions,
	normalizeRegexRedactionReplacement,
	normalizeRedactionDelimiter,
	normalizeRedactionReplacement,
	normalizeRedactionRegexPatterns,
} from "./utils/contentRedaction";
import {
	compareVersions,
	getLatestReleaseNotes,
	getReleaseNotesBetweenVersions,
	isReleaseAutoDisplayEnabled,
	normalizeStoredPluginVersion,
	shouldAutoDisplayReleaseNotesForUpdate,
} from "./utils/releaseNotes";
import { DEFAULT_SETTINGS, normalizeTemplateDirectorySetting } from "./settings/defaultSettings";
import { TagDiscoveryService } from "./tagDiscovery";

interface StoredPluginData {
	settings?: Partial<SmartExportSettings>;
	lastSeenVersion?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function extractStoredSettings(storedData: unknown): Partial<SmartExportSettings> | null {
	if (!isRecord(storedData)) {
		return null;
	}

	if ("settings" in storedData) {
		return isRecord(storedData.settings) ? storedData.settings : null;
	}

	return storedData;
}

function extractStoredLastSeenVersion(storedData: unknown): string | null {
	if (!isRecord(storedData)) {
		return null;
	}

	return normalizeStoredPluginVersion(storedData.lastSeenVersion);
}

function normalizeExportTarget(value: unknown): ExportTarget {
	return value === "new-note" ? "new-note" : "clipboard";
}

/**
 * The main class for the Smart Export plugin.
 * This class is responsible for loading the plugin, adding UI elements,
 * and unloading the plugin when it's disabled.
 */
export default class SmartExportPlugin extends Plugin {
	settings: SmartExportSettings;
	private hasPersistedData = false;
	private lastSeenVersion: string | null = null;
	private tagDiscovery: TagDiscoveryService;

	/**
	 * This method is called when the plugin is first loaded.
	 * It sets up the ribbon icon and the command for opening the export modal.
	 */
	async onload() {
		await this.loadSettings();
		this.tagDiscovery = new TagDiscoveryService(new ObsidianAPI(this.app));
		const invalidateTagDiscovery = () => this.tagDiscovery.invalidate();
		this.registerEvent(this.app.metadataCache.on("changed", invalidateTagDiscovery));
		this.registerEvent(this.app.metadataCache.on("deleted", invalidateTagDiscovery));
		this.registerEvent(this.app.vault.on("delete", invalidateTagDiscovery));
		this.registerEvent(this.app.vault.on("rename", invalidateTagDiscovery));

		// This creates an icon in the left ribbon.
		this.addRibbonIcon("brain-circuit", "Smart export", (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new ExportModal(this.app, this.settings, this.tagDiscovery).open();
		});

		// This adds a command that can be triggered anywhere
		this.addCommand({
			id: "open-export-modal",
			name: "Open export",
			callback: () => {
				new ExportModal(this.app, this.settings, this.tagDiscovery).open();
			},
		});

		// Quick command that exports from the current note without opening the modal.
		this.addCommand({
			id: "quick-export-current-note",
			name: "Quick export current note",
			checkCallback: (checking: boolean) => {
				const activeFile = this.app.workspace.getActiveFile();
				if (!activeFile || activeFile.extension !== "md") {
					return false;
				}
				if (!checking) {
					void this.quickExportCurrentNote(activeFile);
				}
				return true;
			},
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SmartExportSettingTab(this.app, this));

		this.app.workspace.onLayoutReady(() => {
			this.registerEvent(this.app.vault.on("create", invalidateTagDiscovery));
			void this.maybeShowReleaseNotes();
		});
	}

	/**
	 * This method is called when the plugin is unloaded.
	 * It's used to clean up any resources created by the plugin.
	 */
	onunload() {}

	async loadSettings() {
		const storedData = (await this.loadData()) as
			StoredPluginData | Partial<SmartExportSettings> | null;
		this.hasPersistedData = storedData !== null;
		this.lastSeenVersion = extractStoredLastSeenVersion(storedData);
		const storedSettings = extractStoredSettings(storedData);
		this.settings = { ...DEFAULT_SETTINGS, ...(storedSettings ?? {}) };
		this.settings.defaultContentDepth = Math.min(
			20,
			Math.max(1, this.settings.defaultContentDepth)
		);
		this.settings.defaultTitleDepth = Math.min(20, Math.max(1, this.settings.defaultTitleDepth));
		if (this.settings.defaultTitleDepth < this.settings.defaultContentDepth) {
			this.settings.defaultTitleDepth = this.settings.defaultContentDepth;
		}
		this.settings.ignoredTraversalFolders = normalizeFolderFilterList(
			this.settings.ignoredTraversalFolders
		);
		this.settings.ignoredTraversalTagPatterns = normalizeTagFilterList(
			this.settings.ignoredTraversalTagPatterns
		);
		this.settings.ignoredTraversalPropertyRules = normalizePropertyFilterList(
			this.settings.ignoredTraversalPropertyRules
		);
		this.settings.redactMarkedSections =
			(storedSettings as { redactMarkedSections?: unknown } | null)?.redactMarkedSections === true;
		this.settings.redactionDelimiter = normalizeRedactionDelimiter(
			(storedSettings as { redactionDelimiter?: unknown } | null)?.redactionDelimiter ??
				this.settings.redactionDelimiter
		);
		this.settings.redactionReplacement = normalizeRedactionReplacement(
			(storedSettings as { redactionReplacement?: unknown } | null)?.redactionReplacement ??
				this.settings.redactionReplacement
		);
		this.settings.redactRegexMatches =
			(storedSettings as { redactRegexMatches?: unknown } | null)?.redactRegexMatches === true;
		this.settings.redactionRegexReplacement = normalizeRegexRedactionReplacement(
			(storedSettings as { redactionRegexReplacement?: unknown } | null)
				?.redactionRegexReplacement ?? this.settings.redactionRegexReplacement
		);
		this.settings.redactionRegexPatterns = normalizeRedactionRegexPatterns(
			(storedSettings as { redactionRegexPatterns?: unknown } | null)?.redactionRegexPatterns ??
				this.settings.redactionRegexPatterns
		);
		this.settings.defaultExportFormat = normalizeExportFormat(
			(storedSettings as { defaultExportFormat?: unknown } | null)?.defaultExportFormat ??
				this.settings.defaultExportFormat
		);
		this.settings.defaultExportTarget = normalizeExportTarget(
			(storedSettings as { defaultExportTarget?: unknown } | null)?.defaultExportTarget
		);
		const storedDefaultLlmTemplateId = (storedSettings as { defaultLlmTemplateId?: unknown } | null)
			?.defaultLlmTemplateId;
		this.settings.defaultLlmTemplateId =
			typeof storedDefaultLlmTemplateId === "string" && storedDefaultLlmTemplateId.trim().length > 0
				? storedDefaultLlmTemplateId.trim()
				: DEFAULT_BUILTIN_LLM_TEMPLATE_ID;
		const storedTemplateDirectory = (
			storedSettings as { llmMarkdownTemplateDirectory?: unknown } | null
		)?.llmMarkdownTemplateDirectory;
		const templateDirectoryValue =
			typeof storedTemplateDirectory === "string"
				? storedTemplateDirectory
				: this.settings.llmMarkdownTemplateDirectory;
		this.settings.llmMarkdownTemplateDirectory =
			normalizeTemplateDirectorySetting(templateDirectoryValue);
		const storedExportNoteFolderPath = (
			storedSettings as { defaultExportNoteFolderPath?: unknown } | null
		)?.defaultExportNoteFolderPath;
		this.settings.defaultExportNoteFolderPath = normalizeExportNoteFolderPath(
			typeof storedExportNoteFolderPath === "string"
				? storedExportNoteFolderPath
				: this.settings.defaultExportNoteFolderPath
		);
		const storedOpenCreatedExportNote = (
			storedSettings as { openCreatedExportNote?: unknown } | null
		)?.openCreatedExportNote;
		this.settings.openCreatedExportNote =
			typeof storedOpenCreatedExportNote === "boolean"
				? storedOpenCreatedExportNote
				: this.settings.openCreatedExportNote;
		const storedPrintFriendlyIncludeTableOfContents = (
			storedSettings as { printFriendlyIncludeTableOfContents?: unknown } | null
		)?.printFriendlyIncludeTableOfContents;
		this.settings.printFriendlyIncludeTableOfContents = normalizePrintFriendlyMarkdownOption(
			storedPrintFriendlyIncludeTableOfContents,
			DEFAULT_PRINT_FRIENDLY_MARKDOWN_OPTIONS.includeTableOfContents
		);
		const storedPrintFriendlyNumberHeadings = (
			storedSettings as { printFriendlyNumberHeadings?: unknown } | null
		)?.printFriendlyNumberHeadings;
		this.settings.printFriendlyNumberHeadings = normalizePrintFriendlyMarkdownOption(
			storedPrintFriendlyNumberHeadings,
			DEFAULT_PRINT_FRIENDLY_MARKDOWN_OPTIONS.numberHeadings
		);
		const storedPrintFriendlyInsertSectionDividers = (
			storedSettings as { printFriendlyInsertSectionDividers?: unknown } | null
		)?.printFriendlyInsertSectionDividers;
		this.settings.printFriendlyInsertSectionDividers = normalizePrintFriendlyMarkdownOption(
			storedPrintFriendlyInsertSectionDividers,
			DEFAULT_PRINT_FRIENDLY_MARKDOWN_OPTIONS.insertSectionDividers
		);
		const storedPrintFriendlyInsertPageBreaks = (
			storedSettings as { printFriendlyInsertPageBreaks?: unknown } | null
		)?.printFriendlyInsertPageBreaks;
		this.settings.printFriendlyInsertPageBreaks = normalizePrintFriendlyMarkdownOption(
			storedPrintFriendlyInsertPageBreaks,
			DEFAULT_PRINT_FRIENDLY_MARKDOWN_OPTIONS.insertPageBreaksBetweenSections
		);
		const storedPrintFriendlyNormalizeContentHeadings = (
			storedSettings as { printFriendlyNormalizeContentHeadings?: unknown } | null
		)?.printFriendlyNormalizeContentHeadings;
		this.settings.printFriendlyNormalizeContentHeadings = normalizePrintFriendlyMarkdownOption(
			storedPrintFriendlyNormalizeContentHeadings,
			DEFAULT_PRINT_FRIENDLY_MARKDOWN_OPTIONS.normalizeContentHeadings
		);
	}

	async saveSettings() {
		await this.savePluginData();
	}

	private async savePluginData(): Promise<void> {
		await this.saveData({
			settings: this.settings,
			lastSeenVersion: this.lastSeenVersion,
		});
		this.hasPersistedData = true;
	}

	private openReleaseNotesModal(
		releaseNotes: ReleaseNotesEntry[],
		currentVersion: string,
		fundingUrl?: string
	): void {
		new ReleaseNotesModal(this.app, releaseNotes, {
			fundingUrl,
			pluginName: this.manifest.name,
			onClose: () => {
				void (async () => {
					this.lastSeenVersion = currentVersion;
					try {
						await this.savePluginData();
					} catch (error) {
						console.error("Failed to persist release notes seen state", error);
					}
				})();
			},
		}).open();
	}

	private async maybeShowReleaseNotes(): Promise<void> {
		try {
			const currentVersion = normalizeStoredPluginVersion(this.manifest.version);
			if (!currentVersion) {
				return;
			}
			const fundingUrl = normalizeFundingUrl(
				(this.manifest as { fundingUrl?: unknown }).fundingUrl
			);

			if (!this.hasPersistedData) {
				this.lastSeenVersion = currentVersion;
				await this.savePluginData();
				return;
			}

			if (!this.lastSeenVersion) {
				if (!isReleaseAutoDisplayEnabled(currentVersion)) {
					this.lastSeenVersion = currentVersion;
					await this.savePluginData();
					return;
				}

				this.openReleaseNotesModal(getLatestReleaseNotes(), currentVersion, fundingUrl);
				return;
			}

			if (this.lastSeenVersion === currentVersion) {
				return;
			}

			const versionComparison = compareVersions(currentVersion, this.lastSeenVersion);
			const isUpgrade = versionComparison > 0;
			if (isUpgrade) {
				if (!shouldAutoDisplayReleaseNotesForUpdate(this.lastSeenVersion, currentVersion)) {
					this.lastSeenVersion = currentVersion;
					await this.savePluginData();
					return;
				}
			} else if (versionComparison < 0 || !isReleaseAutoDisplayEnabled(currentVersion)) {
				this.lastSeenVersion = currentVersion;
				await this.savePluginData();
				return;
			}

			const releaseNotes = isUpgrade
				? getReleaseNotesBetweenVersions(this.lastSeenVersion, currentVersion)
				: getLatestReleaseNotes();
			if (releaseNotes.length === 0) {
				this.lastSeenVersion = currentVersion;
				await this.savePluginData();
				return;
			}

			this.openReleaseNotesModal(releaseNotes, currentVersion, fundingUrl);
		} catch (error) {
			console.error("Failed to prepare release notes", error);
		}
	}

	private async quickExportCurrentNote(rootFile: TFile): Promise<void> {
		try {
			if (rootFile.extension !== "md") {
				new Notice("Quick export only supports Markdown notes.");
				return;
			}

			const obsidianAPI = new ObsidianAPI(this.app);
			const traversal = new BFSTraversal(
				obsidianAPI,
				this.settings.defaultContentDepth,
				this.settings.defaultTitleDepth,
				this.settings.defaultLinkTraversalMode,
				{
					ignoredTraversalFolders: this.settings.ignoredTraversalFolders,
					ignoredTraversalTagPatterns: this.settings.ignoredTraversalTagPatterns,
					ignoredTraversalPropertyRules: this.settings.ignoredTraversalPropertyRules,
				}
			);
			const exportTree = await traversal.traverse(rootFile.path);
			if (!exportTree) {
				new Notice("Quick export failed. Could not load the current note.");
				return;
			}
			const llmMarkdownTemplate =
				this.settings.defaultExportFormat === "llm-markdown"
					? (
							await resolveLlmMarkdownTemplate(
								this.app,
								this.settings.llmMarkdownTemplateDirectory,
								this.settings.defaultLlmTemplateId
							)
						).template
					: null;

			const output = buildExportOutput({
				rootNode: exportTree,
				vaultPath: this.app.vault.getName(),
				format: this.settings.defaultExportFormat,
				llmMarkdownTemplate,
				printFriendlyMarkdownOptions: getPrintFriendlyMarkdownOptions(this.settings),
				contentRedactionOptions: getContentRedactionOptions(this.settings),
				missingNotesCount: traversal.getMissingNotes().length,
				onInvalidFormat: () => {
					new Notice("Unknown export format in settings; falling back to XML.");
				},
			});

			if (this.settings.defaultExportTarget === "clipboard") {
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
				this.settings.defaultExportNoteFolderPath
			);
			const availableDestination = getAvailableExportNoteDestination(this.app, defaultDestination);
			const createdFile = await createExportNote(this.app, output, availableDestination, {
				openAfterCreate: this.settings.openCreatedExportNote,
			});
			new Notice(`Quick export note created: ${createdFile.path}`);
		} catch (error) {
			console.error("Quick export failed", error);
			new Notice("Quick export failed. See console for details.");
		}
	}
}
