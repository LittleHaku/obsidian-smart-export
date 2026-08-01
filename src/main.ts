import { Plugin, TFile } from "obsidian";
import { quickExportCurrentNote } from "./engine/quickExport";
import { ObsidianAPI } from "./obsidian-api";
import { ExportModal } from "./ui/ExportModal";
import { SmartExportSettingTab } from "./ui/settings";
import { SmartExportSettings } from "./types";
import { ReleaseNotesEntry } from "./constants/releaseNotes";
import { ReleaseNotesModal } from "./ui/ReleaseNotesModal";
import { coordinateAutomaticReleaseNotes } from "./ui/releaseNotesCoordinator";
import { normalizeFundingUrl } from "./utils/fundingUrl";
import { loadPluginData, savePluginData as createStoredPluginData } from "./settings/pluginData";
import { TagDiscoveryService } from "./tagDiscovery";

/**
 * The main class for the Smart Export plugin.
 * This class is responsible for loading the plugin, adding UI elements,
 * and unloading the plugin when it's disabled.
 */
export default class SmartExportPlugin extends Plugin {
	settings!: SmartExportSettings;
	private hasPersistedData = false;
	private lastSeenVersion: string | null = null;
	private tagDiscovery!: TagDiscoveryService;

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
		const loadedData = loadPluginData(await this.loadData());
		this.hasPersistedData = loadedData.hasPersistedData;
		this.lastSeenVersion = loadedData.lastSeenVersion;
		this.settings = loadedData.settings;
	}

	async saveSettings() {
		await this.savePluginData();
	}

	private async savePluginData(): Promise<void> {
		await this.saveData(createStoredPluginData(this.settings, this.lastSeenVersion));
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
		await coordinateAutomaticReleaseNotes({
			manifestVersion: this.manifest.version,
			lastSeenVersion: this.lastSeenVersion,
			hasPersistedData: this.hasPersistedData,
			fundingUrl: normalizeFundingUrl((this.manifest as { fundingUrl?: unknown }).fundingUrl),
			setLastSeenVersion: (version) => {
				this.lastSeenVersion = version;
			},
			persist: () => this.savePluginData(),
			open: (notes, currentVersion, fundingUrl) => {
				this.openReleaseNotesModal(notes, currentVersion, fundingUrl);
			},
		});
	}

	private async quickExportCurrentNote(rootFile: TFile): Promise<void> {
		await quickExportCurrentNote(this.app, this.settings, rootFile);
	}
}
