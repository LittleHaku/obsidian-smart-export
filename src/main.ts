import { App, Notice, Plugin, PluginSettingTab, Setting, TFile, debounce } from "obsidian";
import { BFSTraversal } from "./engine/BFSTraversal";
import { LlmMarkdownExporter } from "./engine/LlmMarkdownExporter";
import { PrintFriendlyMarkdownExporter } from "./engine/PrintFriendlyMarkdownExporter";
import { XMLExporter } from "./engine/XMLExporter";
import { ObsidianAPI } from "./obsidian-api";
import { ExportModal } from "./ui/ExportModal";
import { ExportNode, LinkTraversalMode, SmartExportSettings } from "./types";
import { normalizeFolderFilterList } from "./utils/folderFilters";

const VALID_EXPORT_FORMATS = new Set(["xml", "llm-markdown", "print-friendly-markdown"]);

/**
 * Converts textarea input (one folder path per line) into a normalized list.
 */
function parseFolderFilterText(text: string): string[] {
	const lines = text.split("\n").map((line) => line.trim());
	return normalizeFolderFilterList(lines);
}

function normalizeExportFormat(value: unknown): SmartExportSettings["defaultExportFormat"] {
	if (typeof value === "string" && VALID_EXPORT_FORMATS.has(value)) {
		return value as SmartExportSettings["defaultExportFormat"];
	}
	return "xml";
}

const DEFAULT_SETTINGS: SmartExportSettings = {
	defaultContentDepth: 3,
	defaultTitleDepth: 6,
	defaultExportFormat: "xml",
	defaultLinkTraversalMode: "outgoing",
	autoSelectCurrentNote: true,
	closeModalAfterExport: false,
	showTokenEstimatesInTree: false,
	ignoredTraversalFolders: [],
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
				if (!activeFile) {
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
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	/**
	 * Exports from the active note using default settings and copies the output to clipboard.
	 */
	private async quickExportCurrentNote(rootFile: TFile): Promise<void> {
		try {
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

			const output = this.buildExportOutput(exportTree, traversal.getMissingNotes().length);
			await navigator.clipboard.writeText(output);
			new Notice("Quick export copied to clipboard.");
		} catch (error) {
			console.error("Quick export failed", error);
			new Notice("Quick export failed. See console for details.");
		}
	}

	/**
	 * Builds export output using the default format selected in settings.
	 */
	private buildExportOutput(rootNode: ExportNode, missingNotesCount: number): string {
		const vaultPath = this.app.vault.getName();
		const rawExportFormat = this.settings.defaultExportFormat;
		const exportFormat = normalizeExportFormat(rawExportFormat);
		if (rawExportFormat !== exportFormat) {
			new Notice("Unknown export format in settings; falling back to XML.");
		}

		switch (exportFormat) {
			case "xml":
				return new XMLExporter().export(rootNode, vaultPath, missingNotesCount);
			case "llm-markdown":
				return new LlmMarkdownExporter().export(rootNode, vaultPath, missingNotesCount);
			case "print-friendly-markdown":
				return new PrintFriendlyMarkdownExporter().export(rootNode);
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
		const debouncedSaveIgnoredFolders = debounce(
			() => {
				void this.plugin.saveSettings();
			},
			300,
			true
		);

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

		new Setting(containerEl)
			.setName("Default export format")
			.setDesc("Choose your preferred export format")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("xml", "XML - structured format with metadata")
					.addOption("llm-markdown", "Markdown for AI tools - optimized for model input")
					.addOption("print-friendly-markdown", "Print-friendly - clean, readable format")
					.setValue(this.plugin.settings.defaultExportFormat)
					.onChange(async (value: "xml" | "llm-markdown" | "print-friendly-markdown") => {
						this.plugin.settings.defaultExportFormat = value;
						await this.plugin.saveSettings();
					})
			);

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
				"Optional. One folder path per line. Notes in these folders are excluded from traversal and won't appear in the export tree."
			)
			.addTextArea((textArea) =>
				textArea
					.setValue(this.plugin.settings.ignoredTraversalFolders.join("\n"))
					.onChange((value) => {
						this.plugin.settings.ignoredTraversalFolders = parseFolderFilterText(value);
						debouncedSaveIgnoredFolders();
					})
			);

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
