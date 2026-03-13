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
import { normalizeFolderFilterList } from "./utils/folderFilters";
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

const DEFAULT_OUTPUT_CHOICE_XML = "format:xml";
const DEFAULT_OUTPUT_CHOICE_PRINT_FRIENDLY = "format:print-friendly-markdown";
const DEFAULT_OUTPUT_CHOICE_LLM_PREFIX = "template:";

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
	llmMarkdownTemplateDirectory: LLM_MARKDOWN_TEMPLATE_DIRECTORY,
};

/**
 * The main class for the Smart Export plugin.
 * This class is responsible for loading the plugin, adding UI elements,
 * and unloading the plugin when it's disabled.
 */
export default class SmartExportPlugin extends Plugin {
	settings: SmartExportSettings;

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
	}

	/**
	 * This method is called when the plugin is unloaded.
	 * It's used to clean up any resources created by the plugin.
	 */
	onunload() {}

	async loadSettings() {
		const storedSettings = (await this.loadData()) as Partial<SmartExportSettings> | null;
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
	}

	async saveSettings() {
		await this.saveData(this.settings);
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
