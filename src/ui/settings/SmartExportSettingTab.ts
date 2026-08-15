import {
	App,
	debounce,
	DropdownComponent,
	Plugin,
	PluginSettingTab,
	Setting,
	SettingDefinitionItem,
	SliderComponent,
} from "obsidian";
import { TEMPLATE_DOCS_URL } from "../../constants/templateDocs";
import {
	DEFAULT_REDACTION_REGEX_PATTERNS,
	DEFAULT_SETTINGS,
	normalizeTemplateDirectorySetting,
} from "../../settings/defaultSettings";
import { ExportTarget, LinkTraversalMode, SmartExportSettings } from "../../types";
import {
	DEFAULT_REDACTION_DELIMITER,
	DEFAULT_REDACTION_REPLACEMENT,
	getContentRedactionOptions,
	normalizeRegexRedactionReplacement,
	normalizeRedactionDelimiter,
	normalizeRedactionReplacement,
	normalizeRedactionRegexPatterns,
	redactMarkedContent,
} from "../../utils/contentRedaction";
import { normalizeExportNoteFolderPath } from "../../utils/exportNote";
import { normalizeFolderFilterList } from "../../utils/folderFilters";
import {
	DEFAULT_BUILTIN_LLM_TEMPLATE_ID,
	LLM_MARKDOWN_TEMPLATE_DIRECTORY,
	LlmMarkdownTemplateOption,
	listLlmMarkdownTemplateOptions,
} from "../../utils/llmMarkdownTemplateResolver";
import { createLinkedDescription } from "../../utils/linkedDescription";
import { normalizePropertyFilterList, normalizeTagFilterList } from "../../utils/noteFilters";

const DEFAULT_OUTPUT_CHOICE_XML = "format:xml";
const DEFAULT_OUTPUT_CHOICE_PRINT_FRIENDLY = "format:print-friendly-markdown";
const DEFAULT_OUTPUT_CHOICE_MERMAID = "format:mermaid";
const DEFAULT_OUTPUT_CHOICE_LLM_PREFIX = "template:";
const TRAVERSAL_EXCLUSIONS_SAVE_DELAY_MS = 300;
const REDACTION_REGEX_SAVE_DELAY_MS = 500;
const TEMPLATE_DIRECTORY_UPDATE_DELAY_MS = 300;
const DEFAULT_OUTPUT_DESCRIPTION =
	"Choose your default output: XML, Mermaid, print-friendly Markdown, or a Markdown template. ";
const TEMPLATE_DIRECTORY_DESCRIPTION =
	"Vault-relative folder for custom Markdown templates. The folder must be visible inside Obsidian. Every .md file in this folder is available as a custom template option.";
const DEFAULT_REDACTION_REGEX_SAMPLE_TEXT = [
	"1. This is a footnote [^1]",
	"2. See the image ![[vault_pic.png]]",
	"3. [Link Label](https://obsidian.md)",
	"4. Visit https://google.com for info",
	"5. [[Private_Note_Path|Public Alias]]",
	"6. [Stray] [[Brackets]]",
	"7. Marked private text :::thing:::",
].join("\n");

type SmartExportSettingKey = keyof SmartExportSettings;

export type SmartExportSettingsPlugin = Plugin & {
	settings: SmartExportSettings;
	saveSettings(): Promise<void>;
};

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
	if (settings.defaultExportFormat === "mermaid") {
		return DEFAULT_OUTPUT_CHOICE_MERMAID;
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
	if (value === DEFAULT_OUTPUT_CHOICE_MERMAID) {
		settings.defaultExportFormat = "mermaid";
		return;
	}
	if (value.startsWith(DEFAULT_OUTPUT_CHOICE_LLM_PREFIX)) {
		const templateId = value.slice(DEFAULT_OUTPUT_CHOICE_LLM_PREFIX.length);
		settings.defaultExportFormat = "llm-markdown";
		settings.defaultLlmTemplateId =
			templateId.length > 0 ? templateId : DEFAULT_BUILTIN_LLM_TEMPLATE_ID;
	}
}

function isExportTarget(value: unknown): value is ExportTarget {
	return value === "clipboard" || value === "new-note";
}

function isLinkTraversalMode(value: unknown): value is LinkTraversalMode {
	return value === "outgoing" || value === "incoming" || value === "both";
}

function clampDepth(value: number): number {
	return Math.min(20, Math.max(1, value));
}

export class SmartExportSettingTab extends PluginSettingTab {
	plugin: SmartExportSettingsPlugin;
	private defaultOutputTemplateOptions = getAvailableTemplateOptions([]);
	private defaultOutputDropdown: DropdownComponent | null = null;
	private titleDepthSlider: SliderComponent | null = null;
	private templateOptionsDirectory: string | null = null;
	private templateOptionsRequest = 0;
	private redactionPreviewUpdater: (() => void) | null = null;
	private readonly debouncedSaveTraversalExclusions = debounce(
		() => {
			void this.plugin.saveSettings();
		},
		TRAVERSAL_EXCLUSIONS_SAVE_DELAY_MS,
		true
	);
	private readonly debouncedSaveRedactionRegexPatterns = debounce(
		() => {
			void this.plugin.saveSettings();
		},
		REDACTION_REGEX_SAVE_DELAY_MS,
		true
	);
	private readonly debouncedUpdateTemplateDirectory = debounce(
		() => {
			void this.persistTemplateDirectoryAndRefreshOptions();
		},
		TEMPLATE_DIRECTORY_UPDATE_DELAY_MS,
		true
	);

	constructor(app: App, plugin: SmartExportSettingsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions(): SettingDefinitionItem<SmartExportSettingKey>[] {
		return [
			{
				type: "group",
				heading: "Export defaults",
				items: [
					{
						name: "Default content depth",
						desc: "Default number of levels to include full note content (1–20).",
						control: {
							type: "slider",
							key: "defaultContentDepth",
							defaultValue: DEFAULT_SETTINGS.defaultContentDepth,
							min: 1,
							max: 20,
							step: 1,
						},
					},
					{
						name: "Default title depth",
						desc: "Default number of additional levels to include titles only (1–20).",
						render: (setting) => this.renderTitleDepth(setting),
					},
					{
						name: "Default output",
						desc: `${DEFAULT_OUTPUT_DESCRIPTION}Template docs.`,
						render: (setting) => this.renderDefaultOutput(setting),
					},
					{
						name: "Default export target",
						desc: "Choose whether quick export and the modal primary action default to copying to clipboard or creating a new note.",
						control: {
							type: "dropdown",
							key: "defaultExportTarget",
							defaultValue: DEFAULT_SETTINGS.defaultExportTarget,
							options: {
								clipboard: "Clipboard",
								"new-note": "New note",
							},
						},
					},
					{
						name: "Default export note folder",
						desc: "Vault-relative folder used when exporting to a new note. Leave empty to default to the source note folder.",
						control: {
							type: "folder",
							key: "defaultExportNoteFolderPath",
							defaultValue: DEFAULT_SETTINGS.defaultExportNoteFolderPath,
							placeholder: "Exports",
						},
					},
					{
						name: "Default link direction",
						desc: "Outgoing follows wikilinks in note text. Incoming follows backlinks. Outgoing + incoming helps find possible links between notes.",
						control: {
							type: "dropdown",
							key: "defaultLinkTraversalMode",
							defaultValue: DEFAULT_SETTINGS.defaultLinkTraversalMode,
							options: {
								outgoing: "Outgoing (wikilinks in text)",
								incoming: "Incoming (backlinks)",
								both: "Outgoing + incoming",
							},
						},
					},
				],
			},
			{
				type: "group",
				heading: "Traversal exclusions",
				items: [
					{
						name: "Ignored folders",
						desc: "Optional comma-separated folders or patterns to exclude from traversal, for example: templates, assets*, attachments*, /archive, /res*, /*/temp, /projects/*.",
						control: {
							type: "text",
							key: "ignoredTraversalFolders",
							defaultValue: DEFAULT_SETTINGS.ignoredTraversalFolders.join(", "),
							placeholder: "Templates, assets*, attachments*",
						},
					},
					{
						name: "Hide notes with tags",
						desc: "Optional comma-separated tag patterns to exclude from traversal, for example: archive*, #draft, projects/*/old. Use archive for tag+descendants or archive/* for descendants only.",
						control: {
							type: "text",
							key: "ignoredTraversalTagPatterns",
							defaultValue: DEFAULT_SETTINGS.ignoredTraversalTagPatterns.join(", "),
							placeholder: "Archive*, #draft, projects/*/old",
						},
					},
					{
						name: "Hide notes with property rules",
						desc: "Optional comma-separated rules using key or key=value, for example: status=done, published=true, archived.",
						control: {
							type: "text",
							key: "ignoredTraversalPropertyRules",
							defaultValue: DEFAULT_SETTINGS.ignoredTraversalPropertyRules.join(", "),
							placeholder: "Status=done, published=true, archived",
						},
					},
				],
			},
			{
				type: "group",
				heading: "Content redaction",
				items: [
					{
						name: "Redact marked sections",
						desc: "Replace text between matching delimiters during export. This only changes the exported output, not the source notes.",
						aliases: ["Redaction delimiter", "Marked section replacement"],
						control: {
							type: "toggle",
							key: "redactMarkedSections",
							defaultValue: DEFAULT_SETTINGS.redactMarkedSections,
						},
					},
					{
						name: "Redaction delimiter",
						desc: "Exact marker used at the start and end of private text, for example :::private:::.",
						visible: () => this.plugin.settings.redactMarkedSections,
						control: {
							type: "text",
							key: "redactionDelimiter",
							defaultValue: DEFAULT_SETTINGS.redactionDelimiter,
							placeholder: DEFAULT_REDACTION_DELIMITER,
						},
					},
					{
						name: "Marked section replacement",
						desc: "Text inserted in exported notes where a marked section was removed.",
						visible: () => this.plugin.settings.redactMarkedSections,
						control: {
							type: "text",
							key: "redactionReplacement",
							defaultValue: DEFAULT_SETTINGS.redactionReplacement,
							placeholder: DEFAULT_REDACTION_REPLACEMENT,
						},
					},
					{
						name: "Apply regular expression redaction rules",
						desc: "Replace text matching regular expression rules during export. This only changes the exported output, not the source notes.",
						aliases: ["Regular expression replacement", "Regular expression redaction rules"],
						control: {
							type: "toggle",
							key: "redactRegexMatches",
							defaultValue: DEFAULT_SETTINGS.redactRegexMatches,
						},
					},
					{
						name: "Regular expression replacement",
						desc: "Text inserted in exported notes where regular expression rules match. Leave blank to remove matches.",
						visible: () => this.plugin.settings.redactRegexMatches,
						control: {
							type: "text",
							key: "redactionRegexReplacement",
							defaultValue: DEFAULT_SETTINGS.redactionRegexReplacement,
							placeholder: "Remove matches",
						},
					},
					{
						name: "Regular expression redaction rules",
						desc: "Optional regular expression rules, one per line. Matches are replaced during export without editing source notes.",
						visible: () => this.plugin.settings.redactRegexMatches,
						control: {
							type: "textarea",
							key: "redactionRegexPatterns",
							defaultValue: DEFAULT_SETTINGS.redactionRegexPatterns.join("\n"),
							placeholder: DEFAULT_REDACTION_REGEX_PATTERNS.join("\n"),
							rows: 7,
						},
					},
					{
						name: "Test content redaction",
						desc: "Preview marked-section and regular expression redaction with the same settings used during export.",
						render: (setting) => this.renderRedactionPreview(setting),
					},
				],
			},
			{
				type: "group",
				heading: "Markdown templates",
				items: [
					{
						name: "Markdown template folder",
						desc: TEMPLATE_DIRECTORY_DESCRIPTION,
						aliases: ["Template placeholder docs"],
						control: {
							type: "folder",
							key: "llmMarkdownTemplateDirectory",
							defaultValue: DEFAULT_SETTINGS.llmMarkdownTemplateDirectory,
							placeholder: LLM_MARKDOWN_TEMPLATE_DIRECTORY,
						},
					},
					{
						name: "Template documentation",
						desc: "Learn how to use placeholders in custom Markdown templates.",
						aliases: ["Template placeholder docs"],
						render: (setting) => this.renderTemplateDocumentation(setting),
					},
				],
			},
			{
				type: "group",
				heading: "Print-friendly Markdown",
				items: [
					{
						name: "Include table of contents",
						desc: "Add a linked table of contents at the top of print-friendly exports.",
						control: {
							type: "toggle",
							key: "printFriendlyIncludeTableOfContents",
							defaultValue: DEFAULT_SETTINGS.printFriendlyIncludeTableOfContents,
						},
					},
					{
						name: "Number headings",
						desc: "Prefix print-friendly note headings with section numbers such as 1., 1.1, and 1.1.1.",
						control: {
							type: "toggle",
							key: "printFriendlyNumberHeadings",
							defaultValue: DEFAULT_SETTINGS.printFriendlyNumberHeadings,
						},
					},
					{
						name: "Insert section dividers",
						desc: "Add divider lines between exported note sections in print-friendly Markdown.",
						control: {
							type: "toggle",
							key: "printFriendlyInsertSectionDividers",
							defaultValue: DEFAULT_SETTINGS.printFriendlyInsertSectionDividers,
						},
					},
					{
						name: "Insert page breaks",
						desc: "Start each exported note section after the first on a new page. When enabled, page breaks replace section dividers.",
						control: {
							type: "toggle",
							key: "printFriendlyInsertPageBreaks",
							defaultValue: DEFAULT_SETTINGS.printFriendlyInsertPageBreaks,
						},
					},
					{
						name: "Normalize content headings",
						desc: "Shift headings inside included notes below the exported note title heading.",
						control: {
							type: "toggle",
							key: "printFriendlyNormalizeContentHeadings",
							defaultValue: DEFAULT_SETTINGS.printFriendlyNormalizeContentHeadings,
						},
					},
				],
			},
			{
				type: "group",
				heading: "Export modal behavior",
				items: [
					{
						name: "Auto-select current note",
						desc: "Automatically select the currently active note as the root when opening the export dialog.",
						control: {
							type: "toggle",
							key: "autoSelectCurrentNote",
							defaultValue: DEFAULT_SETTINGS.autoSelectCurrentNote,
						},
					},
					{
						name: "Close modal after export",
						desc: "Close the export dialog after a successful export.",
						control: {
							type: "toggle",
							key: "closeModalAfterExport",
							defaultValue: DEFAULT_SETTINGS.closeModalAfterExport,
						},
					},
					{
						name: "Open created export note",
						desc: "Open the new export note immediately after creating it.",
						control: {
							type: "toggle",
							key: "openCreatedExportNote",
							defaultValue: DEFAULT_SETTINGS.openCreatedExportNote,
						},
					},
					{
						name: "Show per-note token estimates",
						desc: "Display approximate token counts next to each note in the tree.",
						control: {
							type: "toggle",
							key: "showTokenEstimatesInTree",
							defaultValue: DEFAULT_SETTINGS.showTokenEstimatesInTree,
						},
					},
				],
			},
		];
	}

	getControlValue(key: string): unknown {
		switch (key) {
			case "ignoredTraversalFolders":
				return this.plugin.settings.ignoredTraversalFolders.join(", ");
			case "ignoredTraversalTagPatterns":
				return this.plugin.settings.ignoredTraversalTagPatterns.join(", ");
			case "ignoredTraversalPropertyRules":
				return this.plugin.settings.ignoredTraversalPropertyRules.join(", ");
			case "redactionRegexPatterns":
				return this.plugin.settings.redactionRegexPatterns.join("\n");
			default:
				return Object.prototype.hasOwnProperty.call(this.plugin.settings, key)
					? this.plugin.settings[key as SmartExportSettingKey]
					: undefined;
		}
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		let shouldRefreshVisibility = false;
		let deferredSave: "traversal-exclusions" | "redaction-regex" | "template-directory" | null =
			null;

		switch (key) {
			case "defaultContentDepth":
				if (typeof value !== "number") return;
				this.plugin.settings.defaultContentDepth = clampDepth(value);
				if (this.plugin.settings.defaultTitleDepth < this.plugin.settings.defaultContentDepth) {
					this.plugin.settings.defaultTitleDepth = this.plugin.settings.defaultContentDepth;
				}
				this.titleDepthSlider?.setValue(this.plugin.settings.defaultTitleDepth);
				break;
			case "defaultTitleDepth":
				if (typeof value !== "number") return;
				this.plugin.settings.defaultTitleDepth = Math.max(
					this.plugin.settings.defaultContentDepth,
					clampDepth(value)
				);
				this.titleDepthSlider?.setValue(this.plugin.settings.defaultTitleDepth);
				break;
			case "defaultExportTarget":
				if (!isExportTarget(value)) return;
				this.plugin.settings.defaultExportTarget = value;
				break;
			case "defaultExportNoteFolderPath":
				if (typeof value !== "string") return;
				this.plugin.settings.defaultExportNoteFolderPath = normalizeExportNoteFolderPath(value);
				break;
			case "defaultLinkTraversalMode":
				if (!isLinkTraversalMode(value)) return;
				this.plugin.settings.defaultLinkTraversalMode = value;
				break;
			case "ignoredTraversalFolders":
				if (typeof value !== "string") return;
				this.plugin.settings.ignoredTraversalFolders = normalizeFolderFilterList([value]);
				deferredSave = "traversal-exclusions";
				break;
			case "ignoredTraversalTagPatterns":
				if (typeof value !== "string") return;
				this.plugin.settings.ignoredTraversalTagPatterns = normalizeTagFilterList([value]);
				deferredSave = "traversal-exclusions";
				break;
			case "ignoredTraversalPropertyRules":
				if (typeof value !== "string") return;
				this.plugin.settings.ignoredTraversalPropertyRules = normalizePropertyFilterList([value]);
				deferredSave = "traversal-exclusions";
				break;
			case "redactMarkedSections":
			case "redactRegexMatches":
				if (typeof value !== "boolean") return;
				this.plugin.settings[key] = value;
				shouldRefreshVisibility = true;
				break;
			case "redactionDelimiter":
				if (typeof value !== "string") return;
				this.plugin.settings.redactionDelimiter = normalizeRedactionDelimiter(value);
				break;
			case "redactionReplacement":
				if (typeof value !== "string") return;
				this.plugin.settings.redactionReplacement = normalizeRedactionReplacement(value);
				break;
			case "redactionRegexReplacement":
				if (typeof value !== "string") return;
				this.plugin.settings.redactionRegexReplacement = normalizeRegexRedactionReplacement(value);
				break;
			case "redactionRegexPatterns":
				if (typeof value !== "string") return;
				this.plugin.settings.redactionRegexPatterns = normalizeRedactionRegexPatterns(value);
				deferredSave = "redaction-regex";
				break;
			case "llmMarkdownTemplateDirectory": {
				if (typeof value !== "string") return;
				const normalizedDirectory = normalizeTemplateDirectorySetting(value);
				if (this.plugin.settings.llmMarkdownTemplateDirectory === normalizedDirectory) {
					return;
				}
				this.plugin.settings.llmMarkdownTemplateDirectory = normalizedDirectory;
				this.templateOptionsDirectory = null;
				deferredSave = "template-directory";
				break;
			}
			case "printFriendlyIncludeTableOfContents":
			case "printFriendlyNumberHeadings":
			case "printFriendlyInsertSectionDividers":
			case "printFriendlyInsertPageBreaks":
			case "printFriendlyNormalizeContentHeadings":
			case "autoSelectCurrentNote":
			case "closeModalAfterExport":
			case "openCreatedExportNote":
			case "showTokenEstimatesInTree":
				if (typeof value !== "boolean") return;
				this.plugin.settings[key] = value;
				break;
			default:
				return;
		}

		this.redactionPreviewUpdater?.();
		if (deferredSave === "traversal-exclusions") {
			this.debouncedSaveTraversalExclusions();
			return;
		}
		if (deferredSave === "redaction-regex") {
			this.debouncedSaveRedactionRegexPatterns();
			return;
		}
		if (deferredSave === "template-directory") {
			this.debouncedUpdateTemplateDirectory();
			return;
		}

		await this.plugin.saveSettings();
		if (shouldRefreshVisibility) {
			this.refreshDomState();
		}
	}

	hide(): void {
		this.debouncedSaveTraversalExclusions.run();
		this.debouncedSaveRedactionRegexPatterns.run();
		this.debouncedUpdateTemplateDirectory.run();
		this.defaultOutputDropdown = null;
		this.titleDepthSlider = null;
		this.templateOptionsDirectory = null;
		this.templateOptionsRequest += 1;
		this.redactionPreviewUpdater = null;
		super.hide();
	}

	private renderTitleDepth(setting: Setting): () => void {
		let slider: SliderComponent | null = null;

		setting.controlEl.empty();
		setting.addSlider((component) => {
			slider = component;
			this.titleDepthSlider = component;
			component
				.setLimits(1, 20, 1)
				.setValue(this.plugin.settings.defaultTitleDepth)
				.onChange((value) => {
					void this.setControlValue("defaultTitleDepth", value);
				});
		});

		return () => {
			if (this.titleDepthSlider === slider) {
				this.titleDepthSlider = null;
			}
			setting.controlEl.empty();
		};
	}

	private renderDefaultOutput(setting: Setting): () => void {
		let dropdown: DropdownComponent | null = null;
		let active = true;

		setting.setDesc(
			createLinkedDescription(setting.settingEl, {
				text: DEFAULT_OUTPUT_DESCRIPTION,
				linkText: "Template docs",
				href: TEMPLATE_DOCS_URL,
			})
		);
		setting.controlEl.empty();
		setting.addDropdown((component) => {
			dropdown = component;
			this.defaultOutputDropdown = component;
			this.populateDefaultOutputDropdown(component, this.defaultOutputTemplateOptions);
			component.onChange(async (value) => {
				applyDefaultOutputChoiceToSettings(this.plugin.settings, value);
				await this.plugin.saveSettings();
			});
		});

		void this.loadDefaultOutputTemplateOptions().then((options) => {
			if (active && dropdown) {
				this.populateDefaultOutputDropdown(dropdown, options);
			}
		});

		return () => {
			active = false;
			dropdown?.selectEl.remove();
			if (this.defaultOutputDropdown === dropdown) {
				this.defaultOutputDropdown = null;
			}
		};
	}

	private renderTemplateDocumentation(setting: Setting): void {
		setting.setDesc(
			createLinkedDescription(setting.settingEl, {
				text: "Learn how to use placeholders in custom Markdown templates. ",
				linkText: "Template placeholder docs",
				href: TEMPLATE_DOCS_URL,
			})
		);
	}

	private populateDefaultOutputDropdown(
		dropdown: DropdownComponent,
		templateOptions: LlmMarkdownTemplateOption[]
	): void {
		const availableOptions = getAvailableTemplateOptions(templateOptions);
		dropdown.selectEl.empty();
		dropdown.addOption(DEFAULT_OUTPUT_CHOICE_XML, "XML - structured format with metadata");
		dropdown.addOption(
			DEFAULT_OUTPUT_CHOICE_PRINT_FRIENDLY,
			"Print-friendly Markdown - clean, readable format"
		);
		dropdown.addOption(DEFAULT_OUTPUT_CHOICE_MERMAID, "Mermaid - directed note graph");
		for (const option of availableOptions) {
			dropdown.addOption(
				`${DEFAULT_OUTPUT_CHOICE_LLM_PREFIX}${option.id}`,
				`Markdown - ${option.label}`
			);
		}
		dropdown.setValue(getCurrentDefaultOutputChoice(this.plugin.settings, availableOptions));
	}

	private async loadDefaultOutputTemplateOptions(): Promise<LlmMarkdownTemplateOption[]> {
		const directory = this.plugin.settings.llmMarkdownTemplateDirectory;
		if (this.templateOptionsDirectory === directory) {
			return this.defaultOutputTemplateOptions;
		}

		const request = ++this.templateOptionsRequest;
		const loadedOptions = await listLlmMarkdownTemplateOptions(this.app, directory, {
			includeCompactBuiltin: false,
		});
		const availableOptions = getAvailableTemplateOptions(loadedOptions);
		if (
			request !== this.templateOptionsRequest ||
			directory !== this.plugin.settings.llmMarkdownTemplateDirectory
		) {
			return this.defaultOutputTemplateOptions;
		}

		this.templateOptionsDirectory = directory;
		this.defaultOutputTemplateOptions = availableOptions;
		if (
			this.plugin.settings.defaultExportFormat === "llm-markdown" &&
			!availableOptions.some((option) => option.id === this.plugin.settings.defaultLlmTemplateId)
		) {
			this.plugin.settings.defaultLlmTemplateId = DEFAULT_BUILTIN_LLM_TEMPLATE_ID;
			await this.plugin.saveSettings();
		}
		return availableOptions;
	}

	private async persistTemplateDirectoryAndRefreshOptions(): Promise<void> {
		await this.plugin.saveSettings();
		const directory = this.plugin.settings.llmMarkdownTemplateDirectory;
		const options = await this.loadDefaultOutputTemplateOptions();
		if (
			this.defaultOutputDropdown &&
			this.templateOptionsDirectory === directory &&
			this.plugin.settings.llmMarkdownTemplateDirectory === directory
		) {
			this.populateDefaultOutputDropdown(this.defaultOutputDropdown, options);
		}
	}

	private renderRedactionPreview(setting: Setting): () => void {
		setting.setHeading();
		setting.settingEl.addClass("smart-export-redaction-preview");
		const existingGrids = setting.settingEl.getElementsByClassName(
			"smart-export-redaction-preview__grid"
		);
		let existingGrid = existingGrids.item(0);
		while (existingGrid) {
			existingGrid.remove();
			existingGrid = existingGrids.item(0);
		}
		const previewGrid = setting.settingEl.createDiv({
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

		const updatePreview = (): void => {
			previewOutput.value = redactMarkedContent(
				previewInput.value,
				getContentRedactionOptions(this.plugin.settings)
			);
		};
		this.redactionPreviewUpdater = updatePreview;
		previewInput.addEventListener("input", updatePreview);
		updatePreview();

		return () => {
			previewInput.removeEventListener("input", updatePreview);
			previewGrid.remove();
			if (this.redactionPreviewUpdater === updatePreview) {
				this.redactionPreviewUpdater = null;
			}
		};
	}
}
