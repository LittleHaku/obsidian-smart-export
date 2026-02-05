import {
	App,
	Modal,
	Setting,
	TFile,
	SliderComponent,
	Notice,
	debounce,
	setTooltip,
} from "obsidian";
import { RootNoteSuggestModal } from "./RootNoteSuggestModal";
import { BFSTraversal } from "../engine/BFSTraversal";
import { ObsidianAPI } from "../obsidian-api";
import { ExportNode, SmartExportSettings } from "../types";
import { XMLExporter } from "../engine/XMLExporter";
import { LlmMarkdownExporter } from "../engine/LlmMarkdownExporter";
import { PrintFriendlyMarkdownExporter } from "../engine/PrintFriendlyMarkdownExporter";
import { applyContentSelection } from "./treeContentSelection";
import {
	deselectSubtree,
	enforceAncestorSelection,
	selectAncestors,
	selectNode,
	selectSubtree,
} from "./treeSelection";

/**
 * The main modal for configuring and triggering a smart export.
 * It allows users to select a root note, adjust traversal depth,
 * and export the resulting note tree to the clipboard.
 */
export class ExportModal extends Modal {
	private static readonly MAX_TREE_CACHE_ENTRIES = 5;
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
	/** Cached export trees by depth to avoid recomputation. */
	private exportTreeCache: Map<string, { tree: ExportNode; missingNotes: number }> = new Map();
	/** Cache key for the current export tree. */
	private exportTreeCacheKey: string | null = null;
	/** Missing notes count from the last traversal. */
	private missingNotesCount = 0;
	/** Selected node ids for export. */
	private selectedNodeIds: Set<string> = new Set();
	/** Collapsed node ids for the tree visualization. */
	private collapsedNodeIds: Set<string> = new Set();
	/** Whether the current tree is stale and awaiting rebuild. */
	private treeIsStale = false;
	/** Whether to apply the default collapsed state on the next tree build. */
	private shouldApplyDefaultCollapse = true;
	/** Whether to select all nodes on the next tree build. */
	private shouldSelectAllOnBuild = false;
	/** Container element for the tree visualization. */
	private treeContainerEl: HTMLElement;
	/** Summary element for selected notes count. */
	private treeSummaryEl: HTMLElement;
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
		treeSection.createDiv({
			cls: "smart-export-section-description",
			text: "Pick which notes to include content for. Titles are always included up to the title depth.",
		});
		const treeInfo = treeSection.createDiv({ cls: "smart-export-info-box" });
		treeInfo.createEl("strong", { text: "Tip: " });
		treeInfo.createEl("span", {
			text: "Shift-click a checkbox to select or deselect content for all notes in that branch.",
		});
		const treeControls = treeSection.createDiv({ cls: "smart-export-tree-controls" });
		const expandAllButton = treeControls.createEl("button", {
			text: "Expand all",
			cls: "smart-export-tree-control",
		});
		expandAllButton.setAttr("type", "button");
		expandAllButton.addEventListener("click", () => {
			if (!this.exportTree) {
				return;
			}
			this.collapsedNodeIds.clear();
			this.renderExportTree();
		});
		const collapseAllButton = treeControls.createEl("button", {
			text: "Collapse all",
			cls: "smart-export-tree-control",
		});
		collapseAllButton.setAttr("type", "button");
		collapseAllButton.addEventListener("click", () => {
			if (!this.exportTree) {
				return;
			}
			this.collapsedNodeIds.clear();
			this.collapseAllNodes(this.exportTree);
			this.renderExportTree();
		});
		this.treeSummaryEl = treeSection.createDiv({ cls: "smart-export-tree-summary" });
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
		const adjustedTree = applyContentSelection(exportTree, this.selectedNodeIds);
		const output = this.buildExportOutput(adjustedTree);
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
		const adjustedTree = applyContentSelection(exportTree, this.selectedNodeIds);
		const output = this.buildExportOutput(adjustedTree);
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
		this.invalidateExportTree({ resetSelection: true });
		this.debouncedTokenUpdate();
	}

	/**
	 * Invalidates the current export tree and selection state.
	 * @private
	 */
	private invalidateExportTree(options: { resetSelection?: boolean } = {}) {
		this.treeIsStale = true;
		this.exportTreePromise = null;
		this.missingNotesCount = 0;
		if (options.resetSelection) {
			this.selectedNodeIds.clear();
			this.collapsedNodeIds.clear();
			this.shouldApplyDefaultCollapse = true;
			this.shouldSelectAllOnBuild = true;
			this.exportTreeCache.clear();
		}
		this.exportTreeCacheKey = null;
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

		const cacheKey = this.getTreeCacheKey();
		if (this.exportTree && !this.treeIsStale && this.exportTreeCacheKey === cacheKey) {
			return this.exportTree;
		}
		if (this.exportTreePromise) {
			return this.exportTreePromise;
		}
		const cached = this.exportTreeCache.get(cacheKey);
		if (cached) {
			this.exportTree = cached.tree;
			this.missingNotesCount = cached.missingNotes;
			this.exportTreeCacheKey = cacheKey;
			this.treeIsStale = false;
			this.reconcileSelection(this.exportTree);
			this.reconcileCollapsed(this.exportTree);
			this.renderExportTree();
			return this.exportTree;
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

		try {
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
			this.treeIsStale = false;
			this.missingNotesCount = traversal.getMissingNotes().length;
			this.exportTreePromise = null;
			this.exportTreeCacheKey = this.getTreeCacheKey();
			this.exportTreeCache.set(this.exportTreeCacheKey, {
				tree: exportTree,
				missingNotes: this.missingNotesCount,
			});
			this.enforceCacheLimit();

			this.reconcileSelection(exportTree);
			this.reconcileCollapsed(exportTree);
			if (this.shouldSelectAllOnBuild || this.selectedNodeIds.size === 0) {
				this.selectAllNodes(exportTree);
				this.shouldSelectAllOnBuild = false;
			}
			if (this.shouldApplyDefaultCollapse && this.collapsedNodeIds.size === 0) {
				this.collapseRootOnly(exportTree);
			}
			this.shouldApplyDefaultCollapse = false;

			this.renderExportTree();
			return exportTree;
		} catch (error) {
			console.error("Failed to build export tree", error);
			this.exportTree = null;
			this.missingNotesCount = 0;
			this.exportTreePromise = null;
			new Notice("Failed to build export tree. See console for details.");
			this.renderExportTree();
			return null;
		}
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
	 * Selects all nodes in the tree.
	 * @private
	 */
	private selectAllNodes(node: ExportNode) {
		if (node.includeContent) {
			this.selectedNodeIds.add(node.id);
		}
		for (const child of node.children) {
			this.selectAllNodes(child);
		}
	}

	/**
	 * Reconciles selection with the current tree after depth changes.
	 * @private
	 */
	private reconcileSelection(node: ExportNode) {
		if (node.includeContent) {
			this.selectedNodeIds.add(node.id);
		}
		enforceAncestorSelection(this.selectedNodeIds, node, true);
	}

	/**
	 * Reconciles collapsed state with the current tree after depth changes.
	 * @private
	 */
	private reconcileCollapsed(node: ExportNode) {
		if (this.collapsedNodeIds.size === 0 && this.shouldApplyDefaultCollapse) {
			this.collapseRootOnly(node);
		}
	}

	/**
	 * Builds a cache key for the current tree.
	 * @private
	 */
	private getTreeCacheKey(): string {
		const rootPath = this.selectedFile?.path ?? "unknown";
		return `${rootPath}|content:${this.contentDepth}|title:${this.titleDepth}`;
	}

	/**
	 * Keeps the export tree cache bounded.
	 * @private
	 */
	private enforceCacheLimit() {
		while (this.exportTreeCache.size > ExportModal.MAX_TREE_CACHE_ENTRIES) {
			const firstKey = this.exportTreeCache.keys().next().value as string | undefined;
			if (!firstKey) {
				break;
			}
			this.exportTreeCache.delete(firstKey);
		}
	}

	/**
	 * Collapses all nodes in the tree by default.
	 * @private
	 */
	private collapseRootOnly(node: ExportNode) {
		if (node.children.length > 0) {
			this.collapsedNodeIds.add(node.id);
		}
	}

	/**
	 * Collapses all nodes in the tree.
	 * @private
	 */
	private collapseAllNodes(node: ExportNode) {
		if (node.children.length > 0) {
			this.collapsedNodeIds.add(node.id);
			for (const child of node.children) {
				this.collapseAllNodes(child);
			}
		}
	}

	/**
	 * Expands all nodes in the tree.
	 * @private
	 */
	private expandAllNodes(node: ExportNode) {
		this.collapsedNodeIds.delete(node.id);
		for (const child of node.children) {
			this.expandAllNodes(child);
		}
	}
	/**
	 * Renders the export tree visualization.
	 * @private
	 */
	private renderExportTree() {
		if (!this.treeContainerEl) return;
		this.treeContainerEl.empty();
		if (this.treeSummaryEl && !this.exportTree) {
			this.treeSummaryEl.setText("");
		}

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

		this.selectedNodeIds.add(this.exportTree.id);
		const displayTree = this.buildContentDisplayTree(this.exportTree);
		if (!displayTree) {
			this.treeContainerEl.createDiv({
				cls: "smart-export-tree-placeholder",
				text: "No notes with content at the current depth.",
			});
			return;
		}
		if (this.treeIsStale) {
			this.treeSummaryEl.setText("Updating note tree...");
		} else {
			const counts = this.countTreeNodes(displayTree);
			this.treeSummaryEl.setText(
				`Content selected for ${counts.selected} of ${counts.total} notes`
			);
		}

		const listEl = this.treeContainerEl.createEl("ul", { cls: "smart-export-tree" });
		this.renderExportTreeNode(displayTree, listEl, true, true, []);
	}

	/**
	 * Renders a single tree node and its children.
	 * @private
	 */
	private renderExportTreeNode(
		node: ExportNode,
		containerEl: HTMLElement,
		parentSelected: boolean,
		isRoot: boolean = false,
		ancestorIds: string[] = []
	) {
		const ancestorIdsSnapshot = ancestorIds.slice();
		const itemEl = containerEl.createEl("li", { cls: "smart-export-tree-item" });
		const rowEl = itemEl.createDiv({ cls: "smart-export-tree-row" });

		if (isRoot) {
			this.selectedNodeIds.add(node.id);
		}
		const isSelected = isRoot || this.selectedNodeIds.has(node.id);
		const isExcluded = !parentSelected || (!isRoot && !isSelected);
		if (isExcluded) {
			rowEl.addClass("smart-export-tree-row--disabled");
		}

		const hasChildren = node.children.length > 0;
		const isCollapsed = this.collapsedNodeIds.has(node.id);

		if (hasChildren) {
			const toggleEl = rowEl.createEl("button", {
				text: isCollapsed ? "▸" : "▾",
				cls: "smart-export-tree-toggle",
			});
			toggleEl.setAttr("aria-label", isCollapsed ? "Expand note" : "Collapse note");
			toggleEl.addEventListener("click", (event) => {
				event.preventDefault();
				event.stopPropagation();
				if (this.collapsedNodeIds.has(node.id)) {
					this.collapsedNodeIds.delete(node.id);
				} else {
					this.collapsedNodeIds.add(node.id);
				}
				this.renderExportTree();
			});
		} else {
			rowEl.createSpan({ cls: "smart-export-tree-toggle-placeholder" });
		}

		if (isRoot) {
			const rootLabel = rowEl.createSpan({
				text: node.title,
				cls: "smart-export-tree-label smart-export-tree-root",
			});
			if (this.settings.showTokenEstimatesInTree) {
				const tokenText = this.formatNodeTokenEstimate(node);
				rootLabel.createSpan({ text: tokenText, cls: "smart-export-tree-token" });
			}
			if (hasChildren) {
				rootLabel.addClass("smart-export-tree-root--toggle");
				setTooltip(
					rootLabel,
					"Click to expand or collapse. Shift-click to toggle between this note and all notes."
				);
				rootLabel.addEventListener("click", (event) => {
					event.preventDefault();
					event.stopPropagation();
					if (!this.exportTree) {
						return;
					}
					const shiftPressed = event.shiftKey;
					if (shiftPressed) {
						const counts = this.countTreeNodes(this.exportTree);
						const allSelected = counts.selected === counts.total;
						this.selectedNodeIds.clear();
						if (!allSelected) {
							this.selectAllNodes(this.exportTree);
						} else {
							this.selectedNodeIds.add(node.id);
						}
						this.renderExportTree();
						this.debouncedTokenUpdate();
						return;
					}
					if (this.collapsedNodeIds.has(node.id)) {
						this.collapsedNodeIds.delete(node.id);
					} else {
						this.collapsedNodeIds.add(node.id);
					}
					this.renderExportTree();
				});
			}
		} else {
			const labelEl = rowEl.createEl("label", { cls: "smart-export-tree-label" });
			const checkboxEl = labelEl.createEl("input", {
				type: "checkbox",
				cls: "smart-export-tree-checkbox",
			});
			setTooltip(labelEl, "Shift-click to toggle content for all notes in this branch.");

			checkboxEl.checked = isSelected;
			labelEl.createSpan({ text: node.title, cls: "smart-export-tree-label-text" });
			if (this.settings.showTokenEstimatesInTree) {
				const tokenText = this.formatNodeTokenEstimate(node);
				labelEl.createSpan({ text: tokenText, cls: "smart-export-tree-token" });
			}
			checkboxEl.addEventListener("click", (event) => {
				const shiftPressed = event.shiftKey;
				if (shiftPressed) {
					const subtreeCounts = this.countTreeNodes(node);
					const allSelected = subtreeCounts.selected === subtreeCounts.total;
					if (allSelected) {
						deselectSubtree(this.selectedNodeIds, node);
					} else {
						selectAncestors(this.selectedNodeIds, ancestorIdsSnapshot);
						selectSubtree(this.selectedNodeIds, node);
					}
					this.renderExportTree();
					this.debouncedTokenUpdate();
					return;
				}
				if (checkboxEl.checked) {
					selectAncestors(this.selectedNodeIds, ancestorIdsSnapshot);
					selectNode(this.selectedNodeIds, node.id);
				} else {
					deselectSubtree(this.selectedNodeIds, node);
				}
				this.renderExportTree();
				this.debouncedTokenUpdate();
			});
		}

		if (hasChildren) {
			const childListEl = itemEl.createEl("ul", { cls: "smart-export-tree" });
			if (!this.collapsedNodeIds.has(node.id)) {
				ancestorIds.push(node.id);
				for (const child of node.children) {
					this.renderExportTreeNode(child, childListEl, isSelected, false, ancestorIds);
				}
				ancestorIds.pop();
			}
		}
	}

	/**
	 * Formats an approximate token estimate for a single node.
	 * @private
	 */
	private formatNodeTokenEstimate(node: ExportNode): string {
		const content = node.includeContent ? (node.content ?? "") : "";
		const text = node.title + (content ? `\n${content}` : "");
		const tokens = this.estimateTokens(text);
		return `~${tokens.toLocaleString()} tokens`;
	}

	/**
	 * Builds a tree that only includes nodes with content at the current depth.
	 * @private
	 */
	private buildContentDisplayTree(node: ExportNode): ExportNode | null {
		if (!node.includeContent) {
			return null;
		}

		const children = node.children
			.map((child) => this.buildContentDisplayTree(child))
			.filter((child): child is ExportNode => !!child);

		return {
			...node,
			children,
		};
	}

	/**
	 * Counts total and selected nodes in the tree.
	 * @private
	 */
	private countTreeNodes(node: ExportNode): { total: number; selected: number } {
		let total = node.includeContent ? 1 : 0;
		let selected = node.includeContent && this.selectedNodeIds.has(node.id) ? 1 : 0;

		for (const child of node.children) {
			const childCounts = this.countTreeNodes(child);
			total += childCounts.total;
			selected += childCounts.selected;
		}

		return { total, selected };
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
