import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
import { ExportModal } from "./ui/ExportModal";
import { SmartExportSettings } from "./types";

const DEFAULT_SETTINGS: SmartExportSettings = {
	defaultContentDepth: 3,
	defaultTitleDepth: 6,
	defaultExportFormat: "xml",
	autoSelectCurrentNote: true,
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
			id: "open-smart-export-modal",
			name: "Open smart export",
			callback: () => {
				new ExportModal(this.app, this.settings).open();
			},
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SmartExportSettingTab(this.app, this));
	}

	/**
	 * This method is called when the plugin is unloaded.
	 * It's used to clean up any resources created by the plugin.
	 */
	onunload() {
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
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

		containerEl.empty();

		containerEl.createEl("h2", { text: "Smart export settings" });

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
			.setDesc("Default number of additional levels to include titles only (1-30)")
			.addSlider((slider) =>
				slider
					.setLimits(1, 30, 1)
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
					.addOption("llm-markdown", "LLM Markdown - optimized for AI consumption")
					.addOption("print-friendly-markdown", "Print-friendly - clean, readable format")
					.setValue(this.plugin.settings.defaultExportFormat)
					.onChange(async (value: "xml" | "llm-markdown" | "print-friendly-markdown") => {
						this.plugin.settings.defaultExportFormat = value;
						await this.plugin.saveSettings();
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
	}
}
