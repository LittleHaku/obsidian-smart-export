import {
	App,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	DropdownComponent,
	debounce,
} from "obsidian";
import { BFSTraversal } from "./engine/BFSTraversal";
import { buildExportOutput, normalizeExportFormat } from "./engine/exportOutput";
import { ObsidianAPI } from "./obsidian-api";
import { ExportModal } from "./ui/ExportModal";
import { FolderPathSuggest } from "./ui/FolderPathSuggest";
import { ExportTarget, LinkTraversalMode, SmartExportSettings } from "./types";
import { TEMPLATE_DOCS_URL } from "./constants/templateDocs";
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
	LLM_MARKDOWN_TEMPLATE_DIRECTORY,
	LlmMarkdownTemplateOption,
	listLlmMarkdownTemplateOptions,
	normalizeTemplateDirectoryPath,
	resolveLlmMarkdownTemplate,
} from "./utils/llmMarkdownTemplateResolver";
import {
	DEFAULT_PRINT_FRIENDLY_MARKDOWN_OPTIONS,
	getPrintFriendlyMarkdownOptions,
	normalizePrintFriendlyMarkdownOption,
} from "./utils/printFriendlyMarkdownOptions";
import {
	DEFAULT_REDACTION_DELIMITER,
	DEFAULT_REDACTION_REPLACEMENT,
	DEFAULT_REGEX_REDACTION_REPLACEMENT,
	getContentRedactionOptions,
	normalizeRegexRedactionReplacement,
	normalizeRedactionDelimiter,
	normalizeRedactionReplacement,
	normalizeRedactionRegexPatterns,
	redactMarkedContent,
} from "./utils/contentRedaction";
import {
	compareVersions,
	getLatestReleaseNotes,
	getReleaseNotesBetweenVersions,
	isReleaseAutoDisplayEnabled,
	normalizeStoredPluginVersion,
	shouldAutoDisplayReleaseNotesForUpdate,
} from "./utils/releaseNotes";

const DEFAULT_OUTPUT_CHOICE_XML = "format:xml";
const DEFAULT_OUTPUT_CHOICE_PRINT_FRIENDLY = "format:print-friendly-markdown";
const DEFAULT_OUTPUT_CHOICE_LLM_PREFIX = "template:";
const DEFAULT_REDACTION_REGEX_PATTERNS = [
	"\\[\\^[^\\]]+\\]",
	"!\\[\\[[^\\]]+\\]\\]",
	"\\]\\([^\\)]+\\)",
	"https?:\\/\\/\\S+",
	"\\[\\[[^\\]|]+\\|",
	"\\[\\[|\\]\\]|\\[|\\]",
];
const DEFAULT_REDACTION_REGEX_SAMPLE_TEXT = [
	"1. This is a footnote [^1]",
	"2. See the image ![[vault_pic.png]]",
	"3. [Link Label](https://obsidian.md)",
	"4. Visit https://google.com for info",
	"5. [[Private_Note_Path|Public Alias]]",
	"6. [Stray] [[Brackets]]",
	"7. Marked private text :::thing:::",
].join("\n");

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
		return isRecord(storedData.settings)
			? (storedData.settings as Partial<SmartExportSettings>)
			: null;
	}

	return storedData as Partial<SmartExportSettings>;
}

function extractStoredLastSeenVersion(storedData: unknown): string | null {
	if (!isRecord(storedData)) {
		return null;
	}

	return normalizeStoredPluginVersion((storedData as StoredPluginData).lastSeenVersion);
}

/**
 * Converts settings input into a normalized folder filter list.
 * Supports comma and newline separators for compatibility.
 */
function parseFolderFilterText(text: string): string[] {
	return normalizeFolderFilterList([text]);
}

/**
 * Converts settings input into a normalized tag filter list.
 * Supports comma and newline separators for compatibility.
 */
function parseTagFilterText(text: string): string[] {
	return normalizeTagFilterList([text]);
}

/**
 * Converts settings input into a normalized property-rule filter list.
 * Supports comma and newline separators for compatibility.
 */
function parsePropertyRuleText(text: string): string[] {
	return normalizePropertyFilterList([text]);
}

/**
 * Converts settings input into a normalized regex redaction list.
 * Regex rules are newline-separated because many valid expressions contain commas.
 */
function parseRedactionRegexText(text: string): string[] {
	return normalizeRedactionRegexPatterns(text);
}

function renderRedactionPreview(sampleText: string, settings: SmartExportSettings): string {
	return redactMarkedContent(sampleText, getContentRedactionOptions(settings));
}

function normalizeTemplateDirectorySetting(path: string): string {
	const normalized = normalizeTemplateDirectoryPath(path);
	return normalized.length > 0 ? normalized : LLM_MARKDOWN_TEMPLATE_DIRECTORY;
}

function normalizeExportTarget(value: unknown): ExportTarget {
	return value === "new-note" ? "new-note" : "clipboard";
}

function getAvailableTemplateOptions(
	templateOptions: LlmMarkdownTemplateOption[]
): LlmMarkdownTemplateOption[] {
	if (templateOptions.length > 0) {
		return templateOptions;
	}
	return [
		{
			id: DEFAULT_BUILTIN_LLM_TEMPLATE_ID,
			label: "LLM-ready",
			source: "builtin",
		},
	];
}

function getCurrentDefaultOutputChoice(
	settings: SmartExportSettings,
	templateOptions: LlmMarkdownTemplateOption[]
): string {
	if (settings.defaultExportFormat === "xml") {
		return DEFAULT_OUTPUT_CHOICE_XML;
	}
	if (settings.defaultExportFormat === "print-friendly-markdown") {
		return DEFAULT_OUTPUT_CHOICE_PRINT_FRIENDLY;
	}
	const options = getAvailableTemplateOptions(templateOptions);
	const hasSelectedTemplate = options.some((option) => option.id === settings.defaultLlmTemplateId);
	const templateId = hasSelectedTemplate
		? settings.defaultLlmTemplateId
		: DEFAULT_BUILTIN_LLM_TEMPLATE_ID;
	return `${DEFAULT_OUTPUT_CHOICE_LLM_PREFIX}${templateId}`;
}

function applyDefaultOutputChoiceToSettings(settings: SmartExportSettings, value: string): void {
	if (value === DEFAULT_OUTPUT_CHOICE_XML) {
		settings.defaultExportFormat = "xml";
		return;
	}
	if (value === DEFAULT_OUTPUT_CHOICE_PRINT_FRIENDLY) {
		settings.defaultExportFormat = "print-friendly-markdown";
		return;
	}
	if (value.startsWith(DEFAULT_OUTPUT_CHOICE_LLM_PREFIX)) {
		const templateId = value.slice(DEFAULT_OUTPUT_CHOICE_LLM_PREFIX.length);
		settings.defaultExportFormat = "llm-markdown";
		settings.defaultLlmTemplateId =
			templateId.length > 0 ? templateId : DEFAULT_BUILTIN_LLM_TEMPLATE_ID;
	}
}

const DEFAULT_SETTINGS: SmartExportSettings = {
	defaultContentDepth: 3,
	defaultTitleDepth: 6,
	defaultExportFormat: "xml",
	defaultExportTarget: "clipboard",
	defaultLlmTemplateId: DEFAULT_BUILTIN_LLM_TEMPLATE_ID,
	defaultLinkTraversalMode: "outgoing",
	defaultExportNoteFolderPath: "",
	openCreatedExportNote: true,
	autoSelectCurrentNote: true,
	closeModalAfterExport: false,
	showTokenEstimatesInTree: false,
	ignoredTraversalFolders: [],
	ignoredTraversalTagPatterns: [],
	ignoredTraversalPropertyRules: [],
	redactMarkedSections: false,
	redactionDelimiter: DEFAULT_REDACTION_DELIMITER,
	redactionReplacement: DEFAULT_REDACTION_REPLACEMENT,
	redactRegexMatches: false,
	redactionRegexReplacement: DEFAULT_REGEX_REDACTION_REPLACEMENT,
	redactionRegexPatterns: DEFAULT_REDACTION_REGEX_PATTERNS,
	llmMarkdownTemplateDirectory: LLM_MARKDOWN_TEMPLATE_DIRECTORY,
	printFriendlyIncludeTableOfContents:
		DEFAULT_PRINT_FRIENDLY_MARKDOWN_OPTIONS.includeTableOfContents,
	printFriendlyNumberHeadings: DEFAULT_PRINT_FRIENDLY_MARKDOWN_OPTIONS.numberHeadings,
	printFriendlyInsertSectionDividers: DEFAULT_PRINT_FRIENDLY_MARKDOWN_OPTIONS.insertSectionDividers,
	printFriendlyInsertPageBreaks:
		DEFAULT_PRINT_FRIENDLY_MARKDOWN_OPTIONS.insertPageBreaksBetweenSections,
	printFriendlyNormalizeContentHeadings:
		DEFAULT_PRINT_FRIENDLY_MARKDOWN_OPTIONS.normalizeContentHeadings,
};

/**
 * The main class for the Smart Export plugin.
 * This class is responsible for loading the plugin, adding UI elements,
 * and unloading the plugin when it's disabled.
 */
export default class SmartExportPlugin extends Plugin {
	settings: SmartExportSettings;
	private hasPersistedData = false;
	private lastSeenVersion: string | null = null;

	/**
	 * This method is called when the plugin is first loaded.
	 * It sets up the ribbon icon and the command for opening the export modal.
	 */
	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		this.addRibbonIcon("brain-circuit", "Smart export", (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new ExportModal(this.app, this.settings).open();
		});

		// This adds a command that can be triggered anywhere
		this.addCommand({
			id: "open-export-modal",
			name: "Open export",
			callback: () => {
				new ExportModal(this.app, this.settings).open();
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
			| StoredPluginData
			| Partial<SmartExportSettings>
			| null;
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

class SmartExportSettingTab extends PluginSettingTab {
	plugin: SmartExportPlugin;
	private templateFolderSuggest: FolderPathSuggest | null = null;
	private exportNoteFolderSuggest: FolderPathSuggest | null = null;

	constructor(app: App, plugin: SmartExportPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		let defaultOutputDropdown: DropdownComponent | null = null;
		let defaultOutputTemplateOptions: LlmMarkdownTemplateOption[] = [];
		const debouncedSaveTraversalExclusions = debounce(
			() => {
				void this.plugin.saveSettings();
			},
			300,
			true
		);
		const applyTemplateDirectorySetting = async (value: string): Promise<void> => {
			const normalizedDirectory = normalizeTemplateDirectorySetting(value);
			if (this.plugin.settings.llmMarkdownTemplateDirectory === normalizedDirectory) {
				return;
			}

			this.plugin.settings.llmMarkdownTemplateDirectory = normalizedDirectory;
			await this.plugin.saveSettings();
			void reloadDefaultOutputOptions();
		};

		const applyDefaultOutputOptions = () => {
			if (!defaultOutputDropdown) {
				return;
			}
			const templateOptions = getAvailableTemplateOptions(defaultOutputTemplateOptions);
			defaultOutputDropdown.selectEl.empty();
			defaultOutputDropdown.addOption(
				DEFAULT_OUTPUT_CHOICE_XML,
				"XML - structured format with metadata"
			);
			defaultOutputDropdown.addOption(
				DEFAULT_OUTPUT_CHOICE_PRINT_FRIENDLY,
				"Print-friendly Markdown - clean, readable format"
			);
			for (const option of templateOptions) {
				defaultOutputDropdown.addOption(
					`${DEFAULT_OUTPUT_CHOICE_LLM_PREFIX}${option.id}`,
					`Markdown - ${option.label}`
				);
			}
			defaultOutputDropdown.setValue(
				getCurrentDefaultOutputChoice(this.plugin.settings, templateOptions)
			);
		};

		const reloadDefaultOutputOptions = async () => {
			defaultOutputTemplateOptions = await listLlmMarkdownTemplateOptions(
				this.app,
				this.plugin.settings.llmMarkdownTemplateDirectory,
				{ includeCompactBuiltin: false }
			);
			const availableOptions = getAvailableTemplateOptions(defaultOutputTemplateOptions);
			if (
				this.plugin.settings.defaultExportFormat === "llm-markdown" &&
				!availableOptions.some((option) => option.id === this.plugin.settings.defaultLlmTemplateId)
			) {
				this.plugin.settings.defaultLlmTemplateId = DEFAULT_BUILTIN_LLM_TEMPLATE_ID;
				await this.plugin.saveSettings();
			}
			applyDefaultOutputOptions();
		};

		this.templateFolderSuggest?.destroy();
		this.templateFolderSuggest = null;
		this.exportNoteFolderSuggest?.destroy();
		this.exportNoteFolderSuggest = null;
		containerEl.empty();

		new Setting(containerEl).setName("Export defaults").setHeading();

		new Setting(containerEl)
			.setName("Default content depth")
			.setDesc("Default number of levels to include full note content (1-20)")
			.addSlider((slider) =>
				slider
					.setLimits(1, 20, 1)
					.setValue(this.plugin.settings.defaultContentDepth)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.defaultContentDepth = value;
						// Ensure title depth is not less than content depth
						if (this.plugin.settings.defaultTitleDepth < value) {
							this.plugin.settings.defaultTitleDepth = value;
						}
						await this.plugin.saveSettings();
						this.display(); // Refresh the display
					})
			);

		new Setting(containerEl)
			.setName("Default title depth")
			.setDesc("Default number of additional levels to include titles only (1-20)")
			.addSlider((slider) =>
				slider
					.setLimits(1, 20, 1)
					.setValue(this.plugin.settings.defaultTitleDepth)
					.setDynamicTooltip()
					.onChange(async (value) => {
						// Ensure title depth is not less than content depth
						if (value < this.plugin.settings.defaultContentDepth) {
							value = this.plugin.settings.defaultContentDepth;
						}
						this.plugin.settings.defaultTitleDepth = value;
						await this.plugin.saveSettings();
						this.display(); // Refresh the display
					})
			);

		const defaultOutputDesc = document.createDocumentFragment();
		defaultOutputDesc.append(
			"Choose your default output: XML, print-friendly Markdown, or a Markdown template. "
		);
		const defaultOutputDocsLink = document.createElement("a");
		defaultOutputDocsLink.href = TEMPLATE_DOCS_URL;
		defaultOutputDocsLink.textContent = "Template docs";
		defaultOutputDocsLink.target = "_blank";
		defaultOutputDocsLink.rel = "noopener noreferrer";
		defaultOutputDesc.append(defaultOutputDocsLink);

		new Setting(containerEl)
			.setName("Default output")
			.setDesc(defaultOutputDesc)
			.addDropdown((dropdown) => {
				defaultOutputDropdown = dropdown;
				dropdown.onChange(async (value) => {
					applyDefaultOutputChoiceToSettings(this.plugin.settings, value);
					await this.plugin.saveSettings();
				});
				applyDefaultOutputOptions();
			});
		void reloadDefaultOutputOptions();

		new Setting(containerEl)
			.setName("Default export target")
			.setDesc(
				"Choose whether quick export and the modal primary action default to copying to clipboard or creating a new note."
			)
			.addDropdown((dropdown) =>
				dropdown
					.addOption("clipboard", "Clipboard")
					.addOption("new-note", "New note")
					.setValue(this.plugin.settings.defaultExportTarget)
					.onChange(async (value: ExportTarget) => {
						this.plugin.settings.defaultExportTarget = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Default export note folder")
			.setDesc(
				"Vault-relative folder used when exporting to a new note. Leave empty to default to the source note folder."
			)
			.addText((text) => {
				text
					.setPlaceholder("Exports")
					.setValue(this.plugin.settings.defaultExportNoteFolderPath)
					.onChange(async (value) => {
						this.plugin.settings.defaultExportNoteFolderPath = normalizeExportNoteFolderPath(value);
						await this.plugin.saveSettings();
					});
				this.exportNoteFolderSuggest = new FolderPathSuggest(this.app, text.inputEl);
				return text;
			});

		new Setting(containerEl)
			.setName("Default link direction")
			.setDesc(
				"Outgoing follows wikilinks in note text. Incoming follows backlinks. Outgoing + incoming helps find possible links between notes."
			)
			.addDropdown((dropdown) =>
				dropdown
					.addOption("outgoing", "Outgoing (wikilinks in text)")
					.addOption("incoming", "Incoming (backlinks)")
					.addOption("both", "Outgoing + incoming")
					.setValue(this.plugin.settings.defaultLinkTraversalMode)
					.onChange(async (value: LinkTraversalMode) => {
						this.plugin.settings.defaultLinkTraversalMode = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl).setName("Traversal exclusions").setHeading();

		new Setting(containerEl)
			.setName("Ignored folders")
			.setDesc(
				"Optional comma-separated folders or patterns to exclude from traversal, for example: templates, assets*, attachments*, /archive, /res*, /*/temp, /projects/*."
			)
			.addText((text) =>
				text
					.setPlaceholder("Templates, assets*, attachments*")
					.setValue(this.plugin.settings.ignoredTraversalFolders.join(", "))
					.onChange((value) => {
						this.plugin.settings.ignoredTraversalFolders = parseFolderFilterText(value);
						debouncedSaveTraversalExclusions();
					})
			);

		new Setting(containerEl)
			.setName("Hide notes with tags")
			.setDesc(
				"Optional comma-separated tag patterns to exclude from traversal, for example: archive*, #draft, projects/*/old. Use archive for tag+descendants or archive/* for descendants only."
			)
			.addText((text) =>
				text
					.setPlaceholder("Archive*, #draft, projects/*/old")
					.setValue(this.plugin.settings.ignoredTraversalTagPatterns.join(", "))
					.onChange((value) => {
						this.plugin.settings.ignoredTraversalTagPatterns = parseTagFilterText(value);
						debouncedSaveTraversalExclusions();
					})
			);

		new Setting(containerEl)
			.setName("Hide notes with property rules")
			.setDesc(
				"Optional comma-separated rules using key or key=value, for example: status=done, published=true, archived."
			)
			.addText((text) =>
				text
					.setPlaceholder("Status=done, published=true, archived")
					.setValue(this.plugin.settings.ignoredTraversalPropertyRules.join(", "))
					.onChange((value) => {
						this.plugin.settings.ignoredTraversalPropertyRules = parsePropertyRuleText(value);
						debouncedSaveTraversalExclusions();
					})
			);

		new Setting(containerEl).setName("Content redaction").setHeading();

		new Setting(containerEl)
			.setName("Redact marked sections")
			.setDesc(
				"Replace text between matching delimiters during export. This only changes the exported output, not the source notes."
			)
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.redactMarkedSections).onChange(async (value) => {
					this.plugin.settings.redactMarkedSections = value;
					updateRedactionPreview();
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Redaction delimiter")
			.setDesc("Exact marker used at the start and end of private text, for example :::private:::.")
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_REDACTION_DELIMITER)
					.setValue(this.plugin.settings.redactionDelimiter)
					.onChange(async (value) => {
						this.plugin.settings.redactionDelimiter = normalizeRedactionDelimiter(value);
						updateRedactionPreview();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Marked section replacement")
			.setDesc("Text inserted in exported notes where a marked section was removed.")
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_REDACTION_REPLACEMENT)
					.setValue(this.plugin.settings.redactionReplacement)
					.onChange(async (value) => {
						this.plugin.settings.redactionReplacement = normalizeRedactionReplacement(value);
						updateRedactionPreview();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Apply regular expression redaction rules")
			.setDesc(
				"Replace text matching regular expression rules during export. This only changes the exported output, not the source notes."
			)
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.redactRegexMatches).onChange(async (value) => {
					this.plugin.settings.redactRegexMatches = value;
					updateRedactionPreview();
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Regular expression replacement")
			.setDesc(
				"Text inserted in exported notes where regular expression rules match. Leave blank to remove matches."
			)
			.addText((text) =>
				text
					.setPlaceholder("Remove matches")
					.setValue(this.plugin.settings.redactionRegexReplacement)
					.onChange(async (value) => {
						this.plugin.settings.redactionRegexReplacement =
							normalizeRegexRedactionReplacement(value);
						updateRedactionPreview();
						await this.plugin.saveSettings();
					})
			);

		const debouncedSaveRedactionRegexPatterns = debounce(
			() => void this.plugin.saveSettings(),
			500,
			true
		);

		new Setting(containerEl)
			.setName("Regular expression redaction rules")
			.setDesc(
				"Optional regular expression rules, one per line. Matches are replaced during export without editing source notes."
			)
			.addTextArea((text) =>
				text
					.setPlaceholder(DEFAULT_REDACTION_REGEX_PATTERNS.join("\n"))
					.setValue(this.plugin.settings.redactionRegexPatterns.join("\n"))
					.onChange((value) => {
						this.plugin.settings.redactionRegexPatterns = parseRedactionRegexText(value);
						updateRedactionPreview();
						debouncedSaveRedactionRegexPatterns();
					})
			);

		const previewContainer = containerEl.createDiv({
			cls: "smart-export-redaction-preview",
		});
		new Setting(previewContainer)
			.setName("Test content redaction")
			.setDesc(
				"Preview marked-section and regular expression redaction with the same settings used during export."
			)
			.setHeading();

		const previewGrid = previewContainer.createDiv({
			cls: "smart-export-redaction-preview__grid",
		});
		const previewInputGroup = previewGrid.createDiv({
			cls: "smart-export-redaction-preview__group",
		});
		previewInputGroup.createEl("label", {
			text: "Input text",
			cls: "smart-export-redaction-preview__label",
			attr: { for: "smart-export-redaction-preview-input" },
		});
		const previewInput = previewInputGroup.createEl("textarea", {
			cls: "smart-export-redaction-preview__textarea",
			attr: {
				id: "smart-export-redaction-preview-input",
				spellcheck: "false",
			},
		});
		previewInput.value = DEFAULT_REDACTION_REGEX_SAMPLE_TEXT;

		const previewOutputGroup = previewGrid.createDiv({
			cls: "smart-export-redaction-preview__group",
		});
		previewOutputGroup.createEl("label", {
			text: "Redacted result",
			cls: "smart-export-redaction-preview__label",
			attr: { for: "smart-export-redaction-preview-output" },
		});
		const previewOutput = previewOutputGroup.createEl("textarea", {
			cls: "smart-export-redaction-preview__textarea",
			attr: {
				id: "smart-export-redaction-preview-output",
				readonly: "true",
				spellcheck: "false",
			},
		});

		const updateRedactionPreview = (): void => {
			previewOutput.value = renderRedactionPreview(previewInput.value, this.plugin.settings);
		};

		previewInput.addEventListener("input", updateRedactionPreview);
		updateRedactionPreview();

		new Setting(containerEl).setName("Markdown templates").setHeading();

		const templateDirectoryDesc = document.createDocumentFragment();
		templateDirectoryDesc.append(
			"Vault-relative folder for custom Markdown templates. Every .md file in this folder is available as a custom template option. "
		);
		const templateDocsLink = document.createElement("a");
		templateDocsLink.href = TEMPLATE_DOCS_URL;
		templateDocsLink.textContent = "Template placeholder docs";
		templateDocsLink.target = "_blank";
		templateDocsLink.rel = "noopener noreferrer";
		templateDirectoryDesc.append(templateDocsLink);

		new Setting(containerEl)
			.setName("Markdown template folder")
			.setDesc(templateDirectoryDesc)
			.addText((text) => {
				text
					.setPlaceholder(LLM_MARKDOWN_TEMPLATE_DIRECTORY)
					.setValue(this.plugin.settings.llmMarkdownTemplateDirectory)
					.onChange((value) => {
						void applyTemplateDirectorySetting(value);
					});
				this.templateFolderSuggest = new FolderPathSuggest(this.app, text.inputEl);
				return text;
			});

		new Setting(containerEl).setName("Print-friendly Markdown").setHeading();

		new Setting(containerEl)
			.setName("Include table of contents")
			.setDesc("Add a linked table of contents at the top of print-friendly exports.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.printFriendlyIncludeTableOfContents)
					.onChange(async (value) => {
						this.plugin.settings.printFriendlyIncludeTableOfContents = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Number headings")
			.setDesc(
				"Prefix print-friendly note headings with section numbers such as 1., 1.1, and 1.1.1."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.printFriendlyNumberHeadings)
					.onChange(async (value) => {
						this.plugin.settings.printFriendlyNumberHeadings = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Insert section dividers")
			.setDesc("Add divider lines between exported note sections in print-friendly Markdown.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.printFriendlyInsertSectionDividers)
					.onChange(async (value) => {
						this.plugin.settings.printFriendlyInsertSectionDividers = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Insert page breaks")
			.setDesc(
				"Start each exported note section after the first on a new page. When enabled, page breaks replace section dividers."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.printFriendlyInsertPageBreaks)
					.onChange(async (value) => {
						this.plugin.settings.printFriendlyInsertPageBreaks = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Normalize content headings")
			.setDesc("Shift headings inside included notes below the exported note title heading.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.printFriendlyNormalizeContentHeadings)
					.onChange(async (value) => {
						this.plugin.settings.printFriendlyNormalizeContentHeadings = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl).setName("Export modal behavior").setHeading();

		new Setting(containerEl)
			.setName("Auto-select current note")
			.setDesc(
				"Automatically select the currently active note as the root when opening the export dialog"
			)
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.autoSelectCurrentNote).onChange(async (value) => {
					this.plugin.settings.autoSelectCurrentNote = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Close modal after export")
			.setDesc("Close the export dialog after a successful export")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.closeModalAfterExport).onChange(async (value) => {
					this.plugin.settings.closeModalAfterExport = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Open created export note")
			.setDesc("Open the new export note immediately after creating it")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.openCreatedExportNote).onChange(async (value) => {
					this.plugin.settings.openCreatedExportNote = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Show per-note token estimates")
			.setDesc("Display approximate token counts next to each note in the tree")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.showTokenEstimatesInTree).onChange(async (value) => {
					this.plugin.settings.showTokenEstimatesInTree = value;
					await this.plugin.saveSettings();
				})
			);
	}

	hide(): void {
		this.templateFolderSuggest?.destroy();
		this.templateFolderSuggest = null;
		this.exportNoteFolderSuggest?.destroy();
		this.exportNoteFolderSuggest = null;
		super.hide();
	}
}
