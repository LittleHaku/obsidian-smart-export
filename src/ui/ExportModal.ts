import { App, Modal, Setting, TFile, SliderComponent, Notice, debounce } from "obsidian";
import { RootNoteSuggestModal } from "./RootNoteSuggestModal";
import { BFSTraversal } from "../engine/BFSTraversal";
import { ObsidianAPI } from "../obsidian-api";
import { ExportNode, SmartExportSettings } from "../types";
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
	/** Cached export tree for the current selection and depth settings. */
	private exportTree: ExportNode | null = null;
	/** In-flight export tree build promise. */
	private exportTreePromise: Promise<ExportNode | null> | null = null;
	/** Missing notes count from the last traversal. */
	private missingNotesCount = 0;
	/** Selected node ids for export. */
	private selectedNodeIds: Set<string> = new Set();
	/** Container element for the tree visualization. */
	private treeContainerEl: HTMLElement;
	/** Incremented on each tree invalidation to discard stale builds. */
	private treeBuildId = 0;

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
						this.invalidateExportTree();
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
						this.invalidateExportTree();
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

		// Notes visualization section
		const treeSection = contentEl.createDiv({ cls: "smart-export-section" });
		treeSection.createEl("h3", { text: "🌳 notes to export", cls: "smart-export-section-title" });
		const treeInfo = treeSection.createDiv({ cls: "smart-export-info-box" });
		treeInfo.createEl("span", { text: "✅ " });
		treeInfo.createEl("strong", { text: "Tip: " });
		treeInfo.createEl("span", {
			text: "Uncheck a note to exclude it and all of its children from the export.",
		});
		this.treeContainerEl = treeSection.createDiv({ cls: "smart-export-tree-container" });
		this.renderExportTree();

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
	 * Calculates the token count for the current settings and updates the UI.
	 * @private
	 */
	private async calculateAndDisplayTokens() {
		if (!this.selectedFile) {
			this.tokenCountEl.setText("Token count: not available");
			return;
		}

		this.tokenCountEl.setText("🔄 calculating tokens...");
		const exportTree = await this.ensureExportTree();
		if (!exportTree) {
			this.tokenCountEl.setText("❌ token count: error");
			return;
		}

		const filteredTree = this.filterExportTree(exportTree);
		if (!filteredTree) {
			this.tokenCountEl.setText("⚪ no notes selected");
			return;
		}

		const output = this.buildExportOutput(filteredTree);
		const tokenCount = this.estimateTokens(output);
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
		const exportTree = await this.ensureExportTree();
		if (!exportTree) {
			this.tokenCountEl.setText("❌ export failed");
			new Notice("Failed to generate export. See console for details.");
			return;
		}

		const filteredTree = this.filterExportTree(exportTree);
		if (!filteredTree) {
			this.tokenCountEl.setText("⚪ no notes selected");
			new Notice("No notes selected. Please select at least one note to export.");
			return;
		}

		const output = this.buildExportOutput(filteredTree);
		const tokenCount = this.estimateTokens(output);
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
		await navigator.clipboard.writeText(output);
		new Notice("✅ export copied to clipboard! Ready to paste into your AI tool.");
		if (this.settings.closeModalAfterExport) {
			this.close();
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
		this.invalidateExportTree();
		this.debouncedTokenUpdate();
	}

	/**
	 * Invalidates the current export tree and selection state.
	 * @private
	 */
	private invalidateExportTree() {
		this.exportTree = null;
		this.exportTreePromise = null;
		this.missingNotesCount = 0;
		this.selectedNodeIds.clear();
		this.treeBuildId += 1;
		this.renderExportTree();
	}

	/**
	 * Ensures the export tree is built and cached.
	 * @private
	 */
	private async ensureExportTree(): Promise<ExportNode | null> {
		if (!this.selectedFile) {
			return null;
		}
		if (this.exportTree) {
			return this.exportTree;
		}
		if (this.exportTreePromise) {
			return this.exportTreePromise;
		}

		const currentBuildId = this.treeBuildId;
		this.exportTreePromise = this.buildExportTree(currentBuildId);
		this.renderExportTree();
		return this.exportTreePromise;
	}

	/**
	 * Builds the export tree for the current selection.
	 * @private
	 */
	private async buildExportTree(buildId: number): Promise<ExportNode | null> {
		if (!this.selectedFile) {
			this.exportTreePromise = null;
			return null;
		}

		const obsidianAPI = new ObsidianAPI(this.app);
		const traversal = new BFSTraversal(obsidianAPI, this.contentDepth, this.titleDepth);
		const exportTree = await traversal.traverse(this.selectedFile.path);

		if (buildId !== this.treeBuildId) {
			this.exportTreePromise = null;
			return null;
		}

		if (!exportTree) {
			this.exportTree = null;
			this.missingNotesCount = 0;
			this.exportTreePromise = null;
			this.renderExportTree();
			return null;
		}

		this.exportTree = exportTree;
		this.missingNotesCount = traversal.getMissingNotes().length;
		this.exportTreePromise = null;

		if (this.selectedNodeIds.size === 0) {
			this.selectAllNodes(exportTree);
		}

		this.renderExportTree();
		return exportTree;
	}

	/**
	 * Builds the export output string for a filtered tree.
	 * @private
	 */
	private buildExportOutput(rootNode: ExportNode): string {
		const vaultPath = this.app.vault.getName();

		switch (this.exportFormat) {
			case "xml":
				return new XMLExporter().export(rootNode, vaultPath, this.missingNotesCount);
			case "llm-markdown":
				return new LlmMarkdownExporter().export(rootNode, vaultPath, this.missingNotesCount);
			case "print-friendly-markdown":
				return new PrintFriendlyMarkdownExporter().export(rootNode);
			default:
				return "";
		}
	}

	/**
	 * Filters the export tree based on selected node ids.
	 * @private
	 */
	private filterExportTree(node: ExportNode): ExportNode | null {
		if (!this.selectedNodeIds.has(node.id)) {
			return null;
		}

		const filteredChildren = node.children
			.map((child) => this.filterExportTree(child))
			.filter((child): child is ExportNode => !!child);

		return {
			...node,
			children: filteredChildren,
		};
	}

	/**
	 * Gets a filtered export tree ready for export.
	 * @private
	 */
	/**
	 * Selects all nodes in the tree.
	 * @private
	 */
	private selectAllNodes(node: ExportNode) {
		this.selectedNodeIds.add(node.id);
		for (const child of node.children) {
			this.selectAllNodes(child);
		}
	}

	/**
	 * Sets selection state for a node and all its descendants.
	 * @private
	 */
	private setSelectionForSubtree(node: ExportNode, selected: boolean) {
		if (selected) {
			this.selectedNodeIds.add(node.id);
		} else {
			this.selectedNodeIds.delete(node.id);
		}

		for (const child of node.children) {
			this.setSelectionForSubtree(child, selected);
		}
	}

	/**
	 * Renders the export tree visualization.
	 * @private
	 */
	private renderExportTree() {
		if (!this.treeContainerEl) return;
		this.treeContainerEl.empty();

		if (!this.selectedFile) {
			this.treeContainerEl.createDiv({
				cls: "smart-export-tree-placeholder",
				text: "Select a root note to preview the export tree.",
			});
			return;
		}

		if (this.exportTreePromise) {
			this.treeContainerEl.createDiv({
				cls: "smart-export-tree-placeholder",
				text: "Loading note tree...",
			});
			return;
		}

		if (!this.exportTree) {
			this.treeContainerEl.createDiv({
				cls: "smart-export-tree-placeholder",
				text: "Note tree will appear here after calculating.",
			});
			return;
		}

		const listEl = this.treeContainerEl.createEl("ul", { cls: "smart-export-tree" });
		this.renderExportTreeNode(this.exportTree, listEl, true);
	}

	/**
	 * Renders a single tree node and its children.
	 * @private
	 */
	private renderExportTreeNode(
		node: ExportNode,
		containerEl: HTMLElement,
		parentSelected: boolean
	) {
		const itemEl = containerEl.createEl("li", { cls: "smart-export-tree-item" });
		const rowEl = itemEl.createDiv({ cls: "smart-export-tree-row" });
		if (!parentSelected) {
			rowEl.addClass("smart-export-tree-row--disabled");
		}

		const checkboxEl = rowEl.createEl("input", {
			type: "checkbox",
			cls: "smart-export-tree-checkbox",
		}) as HTMLInputElement;

		const isSelected = parentSelected && this.selectedNodeIds.has(node.id);
		checkboxEl.checked = isSelected;
		checkboxEl.disabled = !parentSelected;

		rowEl.createSpan({ text: node.title, cls: "smart-export-tree-label" });

		checkboxEl.addEventListener("change", () => {
			this.setSelectionForSubtree(node, checkboxEl.checked);
			this.renderExportTree();
			this.debouncedTokenUpdate();
		});

		if (node.children.length > 0) {
			const childListEl = itemEl.createEl("ul", { cls: "smart-export-tree" });
			for (const child of node.children) {
				this.renderExportTreeNode(child, childListEl, isSelected);
			}
		}
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
