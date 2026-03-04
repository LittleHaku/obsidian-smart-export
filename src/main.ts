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
import { LinkTraversalMode, SmartExportSettings } from "./types";
import { TEMPLATE_DOCS_URL } from "./constants/templateDocs";
import { normalizeFolderFilterList } from "./utils/folderFilters";
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

function normalizeTemplateDirectorySetting(path: string): string {
	const normalized = normalizeTemplateDirectoryPath(path);
	return normalized.length > 0 ? normalized : LLM_MARKDOWN_TEMPLATE_DIRECTORY;
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
	defaultLlmTemplateId: DEFAULT_BUILTIN_LLM_TEMPLATE_ID,
	defaultLinkTraversalMode: "outgoing",
	autoSelectCurrentNote: true,
	closeModalAfterExport: false,
	showTokenEstimatesInTree: false,
	ignoredTraversalFolders: [],
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
		this.settings.defaultExportFormat = normalizeExportFormat(
			(storedSettings as { defaultExportFormat?: unknown } | null)?.defaultExportFormat ??
				this.settings.defaultExportFormat
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
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	/**
	 * Exports from the active note using default settings and copies the output to clipboard.
	 */
	private async quickExportCurrentNote(rootFile: TFile): Promise<void> {
		try {
			if (rootFile.extension !== "md") {
				new Notice("Quick export only supports Markdown notes.");
				return;
			}
			if (!navigator.clipboard?.writeText) {
				new Notice("Clipboard is not available in this environment.");
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
			await navigator.clipboard.writeText(output);
			new Notice("Quick export copied to clipboard.");
		} catch (error) {
			console.error("Quick export failed", error);
			new Notice("Quick export failed. See console for details.");
		}
	}
}

class SmartExportSettingTab extends PluginSettingTab {
	plugin: SmartExportPlugin;

	constructor(app: App, plugin: SmartExportPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		let defaultOutputDropdown: DropdownComponent | null = null;
		let defaultOutputTemplateOptions: LlmMarkdownTemplateOption[] = [];
		const debouncedSaveIgnoredFolders = debounce(
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

		containerEl.empty();

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
						debouncedSaveIgnoredFolders();
					})
			);

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
				new FolderPathSuggest(this.app, text.inputEl);
				return text;
			});

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
			.setDesc("Close the export dialog after copying to clipboard")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.closeModalAfterExport).onChange(async (value) => {
					this.plugin.settings.closeModalAfterExport = value;
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
}
