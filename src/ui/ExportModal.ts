import { App, Modal, Setting, TFile, SliderComponent, Notice, debounce } from "obsidian";
import { RootNoteSuggestModal } from "./RootNoteSuggestModal";
import { BFSTraversal } from "../engine/BFSTraversal";
import { ObsidianAPI } from "../obsidian-api";
import { SmartExportSettings } from "../types";
import { XMLExporter } from "../engine/XMLExporter";
import { LlmMarkdownExporter } from "../engine/LlmMarkdownExporter";
import { PrintFriendlyMarkdownExporter } from "../engine/PrintFriendlyMarkdownExporter";

/**
 * The main modal for configuring and triggering a smart export.
 * It allows users to select a root note, adjust traversal depth,
 * and export the resulting note tree to the clipboard.
 */
export class ExportModal extends Modal {
	/** The currently selected file to be used as the root of the export. */
	private selectedFile: TFile | null = null;
	/** The HTML element that displays the name of the selected file. */
	private selectedFileEl: HTMLElement;
	/** The depth for including full note content. */
	private contentDepth: number;
	/** The depth for including only note titles. */
	private titleDepth: number;
	/** The selected export format. */
	private exportFormat: "xml" | "llm-markdown" | "print-friendly-markdown";
	/** The HTML element that displays the estimated token count. */
	private tokenCountEl: HTMLElement;
	/** A debounced function to update the token count dynamically. */
	private debouncedTokenUpdate = debounce(() => this.calculateAndDisplayTokens(), 500, true);
	/** Plugin settings for default values. */
	private settings: SmartExportSettings;

	constructor(app: App, settings: SmartExportSettings) {
		super(app);
		this.settings = settings;
		this.contentDepth = settings.defaultContentDepth;
		this.titleDepth = settings.defaultTitleDepth;
		this.exportFormat = settings.defaultExportFormat;
	}

	/**
	 * Called when the modal is opened. Sets up the UI components.
	 */
	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("smart-export-modal");

		// Header section with title and description
		const headerEl = contentEl.createDiv({ cls: "smart-export-header" });
		headerEl.createEl("h1", {
			text: "Smart export",
			cls: "smart-export-title",
		});
		headerEl.createEl("p", {
			text: "Export interconnected notes by following wikilinks to a configurable depth for readable summaries and AI-ready context.",
			cls: "smart-export-description",
		});

		// Root note selection section
		const rootSection = contentEl.createDiv({ cls: "smart-export-section" });
		rootSection.createEl("h3", { text: "📝 root note", cls: "smart-export-section-title" });

		new Setting(rootSection)
			.setName("Starting point")
			.setDesc("Choose the note to start traversing from. Default: current active note")
			.addButton((button) => {
				button.setButtonText("Select").onClick(() => {
					new RootNoteSuggestModal(this.app, (file: TFile) => {
						this.selectedFile = file;
						this.updateSelectedFile();
					}).open();
				});
			});

		this.selectedFileEl = rootSection.createEl("div", {
			text: "❌ no file selected",
			cls: "smart-export-selected-file",
		});

		// Auto-select active file if available and enabled in settings
		if (this.settings.autoSelectCurrentNote) {
			const activeFile = this.app.workspace.getActiveFile();
			if (activeFile) {
				this.selectedFile = activeFile;
			}
		}
		this.updateSelectedFile();

		// Depth configuration section
		const depthSection = contentEl.createDiv({ cls: "smart-export-section" });
		depthSection.createEl("h3", { text: "🌊 traversal depth", cls: "smart-export-section-title" });

		const depthInfo = depthSection.createDiv({ cls: "smart-export-info-box" });
		depthInfo.createEl("span", { text: "💡 " });
		depthInfo.createEl("strong", { text: "How it works: " });
		depthInfo.createEl("span", {
			text: "Content depth includes full note text, title depth adds linked note titles only. Title depth must be ≥ content depth.",
		});

		let contentSlider: SliderComponent | null = null;
		let titleSlider: SliderComponent | null = null;

		new Setting(depthSection)
			.setName("Content depth")
			.setDesc("📄 levels of linked notes to include full content (text, images, etc.)")
			.addSlider((slider) => {
				contentSlider = slider;
				slider
					.setLimits(1, 20, 1)
					.setValue(this.contentDepth)
					.setDynamicTooltip()
					.onChange((value) => {
						this.contentDepth = value;
						if (this.titleDepth < this.contentDepth) {
							this.titleDepth = this.contentDepth;
							titleSlider?.setValue(this.titleDepth);
						}
						this.debouncedTokenUpdate();
					});
			});

		new Setting(depthSection)
			.setName("Title depth")
			.setDesc("🏷️ additional levels to include titles only (for context and navigation)")
			.addSlider((slider) => {
				titleSlider = slider;
				slider
					.setLimits(1, 30, 1)
					.setValue(this.titleDepth)
					.setDynamicTooltip()
					.onChange((value) => {
						this.titleDepth = value;
						if (this.titleDepth < this.contentDepth) {
							this.contentDepth = this.titleDepth;
							contentSlider?.setValue(this.contentDepth);
						}
						this.debouncedTokenUpdate();
					});
			});

		// Export configuration section
		const exportSection = contentEl.createDiv({ cls: "smart-export-section" });
		exportSection.createEl("h3", { text: "📤 export settings", cls: "smart-export-section-title" });

		new Setting(exportSection)
			.setName("Output format")
			.setDesc("Choose the format optimized for your workflow")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("xml", "📋 XML - structured format with metadata")
					.addOption("llm-markdown", "🤖 Markdown for AI tools - optimized for model input")
					.addOption("print-friendly-markdown", "🖨️ print-friendly - clean, readable format")
					.setValue(this.exportFormat)
					.onChange((value: "xml" | "llm-markdown" | "print-friendly-markdown") => {
						this.exportFormat = value;
						this.debouncedTokenUpdate();
					});
			});

		// Token count and export section
		const exportActionSection = contentEl.createDiv({ cls: "smart-export-action-section" });

		this.tokenCountEl = exportActionSection.createEl("div", {
			text: "Token count: not available",
			cls: "smart-export-token-count",
		});

		const tokenInfo = exportActionSection.createDiv({ cls: "smart-export-token-info" });
		tokenInfo.createEl("span", {
			text: "📊 token estimates help you stay within common AI context limits (~128k, ~200k)",
		});

		new Setting(exportActionSection)
			.setName("Ready to export?")
			.setDesc("Generate your smart export and copy it to clipboard")
			.addButton((button) => {
				button
					.setButtonText("🚀 export to clipboard")
					.setCta()
					.onClick(() => {
						void this.onExport();
					});
			});
	}

	/**
	 * Retrieves the export data by traversing the note graph.
	 * @private
	 * @returns {Promise<{ output: string, tokenCount: number } | null>} An object containing the formatted output and token count, or null on failure.
	 */
	private async getExportData(): Promise<{ output: string; tokenCount: number } | null> {
		if (!this.selectedFile) {
			return null;
		}
		try {
			const obsidianAPI = new ObsidianAPI(this.app);
			const traversal = new BFSTraversal(obsidianAPI, this.contentDepth, this.titleDepth);

			const exportTree = await traversal.traverse(this.selectedFile.path);

			if (!exportTree) {
				return null;
			}

			const missingNotesCount = traversal.getMissingNotes().length;
			let output: string;
			const vaultPath = this.app.vault.getName();

			switch (this.exportFormat) {
				case "xml":
					output = new XMLExporter().export(exportTree, vaultPath, missingNotesCount);
					break;
				case "llm-markdown":
					output = new LlmMarkdownExporter().export(exportTree, vaultPath, missingNotesCount);
					break;
				case "print-friendly-markdown":
					output = new PrintFriendlyMarkdownExporter().export(exportTree);
					break;
			}
			const tokenCount = this.estimateTokens(output);

			return { output, tokenCount };
		} catch (error) {
			console.error("Smart Export failed:", error);
			new Notice("Failed to generate export. See console for details.");
			return null;
		}
	}

	/**
	 * Calculates the token count for the current settings and updates the UI.
	 * @private
	 */
	private async calculateAndDisplayTokens() {
		if (!this.selectedFile) {
			this.tokenCountEl.setText("Token count: not available");
			return;
		}

		this.tokenCountEl.setText("🔄 calculating tokens...");
		const data = await this.getExportData();

		if (data) {
			const tokenCount = data.tokenCount;
			let tokenText = `📊 ~${tokenCount.toLocaleString()} tokens`;

			// Add context warnings for common LLMs
			if (tokenCount > 200000) {
				tokenText += " ⚠️ exceeds most AI limits";
			} else if (tokenCount > 128000) {
				tokenText += " ⚠️ may exceed common AI limits";
			} else if (tokenCount > 100000) {
				tokenText += " ⚡ large export";
			}

			this.tokenCountEl.setText(tokenText);
		} else {
			this.tokenCountEl.setText("❌ token count: error");
		}
	}

	/**
	 * Handles the main export action when the user clicks the export button.
	 * @private
	 */
	private async onExport() {
		if (!this.selectedFile) {
			new Notice("Please select a root note first.");
			return;
		}

		this.tokenCountEl.setText("🚀 exporting...");
		const data = await this.getExportData();

		if (data) {
			const tokenCount = data.tokenCount;
			let tokenText = `📊 ~${tokenCount.toLocaleString()} tokens`;

			// Add context warnings for common LLMs
			if (tokenCount > 200000) {
				tokenText += " ⚠️ exceeds most AI limits";
			} else if (tokenCount > 128000) {
				tokenText += " ⚠️ may exceed common AI limits";
			} else if (tokenCount > 100000) {
				tokenText += " ⚡ large export";
			}

			this.tokenCountEl.setText(tokenText);
			await navigator.clipboard.writeText(data.output);
			new Notice("✅ export copied to clipboard! Ready to paste into your AI tool.");
		} else {
			this.tokenCountEl.setText("❌ export failed");
		}
	}

	/**
	 * Estimates the number of tokens in a given string.
	 * A rough approximation where 1 token is about 4 characters.
	 * @private
	 * @param {string} text - The text to estimate tokens for.
	 * @returns {number} The estimated token count.
	 */
	private estimateTokens(text: string): number {
		// Rough approximation: 1 token ≈ 4 characters for English
		return Math.ceil(text.length / 4);
	}

	/**
	 * Updates the UI to reflect the currently selected file.
	 * @private
	 */
	private updateSelectedFile() {
		if (this.selectedFile) {
			this.selectedFileEl.setText(`✅ Selected: ${this.selectedFile.basename}`);
		} else {
			this.selectedFileEl.setText("❌ no file selected");
		}
		this.debouncedTokenUpdate();
	}

	/**
	 * Called when the modal is closed. Clears the content.
	 */
	onClose() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.removeClass("smart-export-modal");
	}
}
