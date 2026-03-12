import {
	App,
	Modal,
	Setting,
	TFile,
	SliderComponent,
	DropdownComponent,
	Notice,
	debounce,
	setTooltip,
} from "obsidian";
import { RootNoteSuggestModal } from "./RootNoteSuggestModal";
import { BFSTraversal } from "../engine/BFSTraversal";
import { buildExportOutput } from "../engine/exportOutput";
import { ObsidianAPI } from "../obsidian-api";
import { ExportNode, LinkTraversalMode, SmartExportSettings } from "../types";
import { applyContentSelection } from "./treeContentSelection";
import {
	DEFAULT_BUILTIN_LLM_TEMPLATE_ID,
	LlmMarkdownTemplateOption,
	listLlmMarkdownTemplateOptions,
	resolveLlmMarkdownTemplate,
} from "../utils/llmMarkdownTemplateResolver";
import { TEMPLATE_DOCS_URL } from "../constants/templateDocs";
import {
	deselectSubtree,
	enforceAncestorSelection,
	selectAncestors,
	selectNode,
	selectSubtree,
} from "./treeSelection";
import { createExportNote } from "../utils/exportNote";
import { ExportNoteDestinationModal } from "./ExportNoteDestinationModal";

const EXPORT_CHOICE_XML = "format:xml";
const EXPORT_CHOICE_PRINT_FRIENDLY = "format:print-friendly-markdown";
const EXPORT_CHOICE_LLM_PREFIX = "template:";

interface PreparedExportOutput {
	rootFile: TFile;
	output: string;
	tokenCount: number;
}

/**
 * The main modal for configuring and triggering a smart export.
 * It allows users to select a root note, adjust traversal depth,
 * and export the resulting note tree to the clipboard or a new note.
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
	/** Which link directions are followed when building the tree. */
	private linkTraversalMode: LinkTraversalMode = "outgoing";
	/** The selected export format. */
	private exportFormat: "xml" | "llm-markdown" | "print-friendly-markdown";
	/** The selected LLM template id for markdown exports. */
	private selectedLlmTemplateId: string = DEFAULT_BUILTIN_LLM_TEMPLATE_ID;
	/** Available built-in and custom template options. */
	private llmTemplateOptions: LlmMarkdownTemplateOption[] = [];
	/** Dropdown used to select format/template options in one control. */
	private exportChoiceDropdown: DropdownComponent | null = null;
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
	/** Nodes that have ever been content-eligible in this modal session. */
	private knownContentNodeIds: Set<string> = new Set();
	/** Nodes explicitly deselected by the user and preserved across depth changes. */
	private userDeselectedNodeIds: Set<string> = new Set();
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
	/** Cached content-only display tree for the current export tree object. */
	private cachedDisplayTree: ExportNode | null = null;
	/** Source tree object tied to cachedDisplayTree. */
	private cachedDisplayTreeSource: ExportNode | null = null;
	/** Per-node token label cache to avoid recomputing large string lengths on rerender. */
	private nodeTokenEstimateCache: WeakMap<ExportNode, string> = new WeakMap();
	/** Currently rendered content-only tree root. */
	private renderedDisplayTree: ExportNode | null = null;
	/** Row elements by node id for in-place UI updates. */
	private renderedRowElements: Map<string, HTMLElement> = new Map();
	/** Checkbox elements by node id for in-place selection updates. */
	private renderedCheckboxElements: Map<string, HTMLInputElement> = new Map();
	/** Toggle button elements by node id for in-place collapse updates. */
	private renderedToggleElements: Map<string, HTMLButtonElement> = new Map();
	/** Child list elements by node id for lazy rendering expanded branches. */
	private renderedChildListElements: Map<string, HTMLElement> = new Map();
	/** Ancestor id snapshots by node id. */
	private renderedAncestorIds: Map<string, string[]> = new Map();

	constructor(app: App, settings: SmartExportSettings) {
		super(app);
		this.settings = settings;
		this.contentDepth = settings.defaultContentDepth;
		this.titleDepth = settings.defaultTitleDepth;
		this.linkTraversalMode = settings.defaultLinkTraversalMode;
		this.exportFormat = settings.defaultExportFormat;
		const defaultTemplateId = settings.defaultLlmTemplateId?.trim();
		this.selectedLlmTemplateId =
			defaultTemplateId && defaultTemplateId.length > 0
				? defaultTemplateId
				: DEFAULT_BUILTIN_LLM_TEMPLATE_ID;
	}

	/**
	 * Called when the modal is opened. Sets up the UI components.
	 */
	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		this.modalEl.addClass("smart-export-modal-shell");
		contentEl.addClass("smart-export-modal");

		// Header section with title and description
		const headerEl = contentEl.createDiv({ cls: "smart-export-header" });
		headerEl.createDiv({
			text: "Smart export",
			cls: "smart-export-title",
		});
		headerEl.createEl("p", {
			text: "Export interconnected notes by following wikilinks to a configurable depth for readable summaries and sharing.",
			cls: "smart-export-description",
		});

		// Root note selection section
		const rootSection = contentEl.createDiv({ cls: "smart-export-section" });
		rootSection.createDiv({ text: "📝 Root note", cls: "smart-export-section-title" });

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
			text: "No file selected",
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
		depthSection.createDiv({
			text: "🌊 Traversal depth",
			cls: "smart-export-section-title",
		});
		const depthInfo = depthSection.createDiv({ cls: "smart-export-info-box" });
		depthInfo.createEl("strong", { text: "How depth works: " });
		depthInfo.createEl("span", {
			text: "Think of depth as how many link steps away from your starting note you want to go. Content depth includes the full text of those notes. Title depth can go farther and includes only note names for extra context.",
		});

		let contentSlider: SliderComponent | null = null;
		let titleSlider: SliderComponent | null = null;

		new Setting(depthSection)
			.setName("Content depth")
			.setDesc("Levels of linked notes to include full content (text, images, etc.)")
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
			.setDesc("Additional levels to include titles only (for context and navigation)")
			.addSlider((slider) => {
				titleSlider = slider;
				slider
					.setLimits(1, 20, 1)
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

		new Setting(depthSection)
			.setName("Link direction")
			.setDesc(
				"Outgoing follows wikilinks in this note. Incoming follows backlinks. Outgoing + incoming helps find possible links between notes."
			)
			.addDropdown((dropdown) => {
				dropdown
					.addOption("outgoing", "Outgoing (wikilinks in text)")
					.addOption("incoming", "Incoming (backlinks)")
					.addOption("both", "Outgoing + incoming")
					.setValue(this.linkTraversalMode)
					.onChange((value: LinkTraversalMode) => {
						this.linkTraversalMode = value;
						this.invalidateExportTree();
						this.debouncedTokenUpdate();
					});
			});

		// Export configuration section
		const exportSection = contentEl.createDiv({ cls: "smart-export-section" });
		exportSection.createDiv({
			text: "⚙️ Export settings",
			cls: "smart-export-section-title",
		});

		const outputDesc = document.createDocumentFragment();
		outputDesc.append(
			"Choose XML, print-friendly Markdown, or a Markdown template (built-in or custom). "
		);
		const templateDocsLink = document.createElement("a");
		templateDocsLink.href = TEMPLATE_DOCS_URL;
		templateDocsLink.textContent = "Template docs";
		templateDocsLink.target = "_blank";
		templateDocsLink.rel = "noopener noreferrer";
		outputDesc.append(templateDocsLink);

		new Setting(exportSection)
			.setName("Output")
			.setDesc(outputDesc)
			.addDropdown((dropdown) => {
				this.exportChoiceDropdown = dropdown;
				dropdown.onChange((value) => {
					this.applyExportChoiceSelection(value);
					this.debouncedTokenUpdate();
				});
				this.applyExportChoiceOptions();
			});
		void this.reloadLlmTemplateOptions();

		// Notes visualization section
		const treeSection = contentEl.createDiv({ cls: "smart-export-section" });
		treeSection.createDiv({ text: "🌳 Notes to export", cls: "smart-export-section-title" });
		treeSection.createDiv({
			cls: "smart-export-section-description",
			text: "Pick which notes to include content for. The root note is always included. Titles are always included up to the title depth.",
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
			if (!this.renderedDisplayTree) {
				this.renderExportTree();
				return;
			}
			this.expandAllNodes(this.renderedDisplayTree);
			this.updateCollapseUI(this.renderedDisplayTree);
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
			if (!this.renderedDisplayTree) {
				this.renderExportTree();
				return;
			}
			this.updateCollapseUI(this.renderedDisplayTree);
		});
		this.treeSummaryEl = treeSection.createDiv({ cls: "smart-export-tree-summary" });
		this.treeContainerEl = treeSection.createDiv({ cls: "smart-export-tree-container" });
		this.renderExportTree();

		// Token count and export section
		const exportActionSection = contentEl.createDiv({ cls: "smart-export-action-section" });

		this.tokenCountEl = exportActionSection.createEl("div", {
			text: "Token estimate: not available",
			cls: "smart-export-token-count",
		});

		const tokenInfo = exportActionSection.createDiv({ cls: "smart-export-token-info" });
		tokenInfo.createEl("span", {
			text: "Token estimates help you stay within common context limits (~128k, ~200k).",
		});

		new Setting(exportActionSection)
			.setName("Ready to export?")
			.setDesc("Generate the export and copy it to clipboard or create a new note")
			.addButton((button) => {
				button.setButtonText("Export to new note").onClick(() => {
					void this.onExportToNewNote();
				});
			})
			.addButton((button) => {
				button
					.setButtonText("Export to clipboard")
					.setCta()
					.onClick(() => {
						void this.onExportToClipboard();
					});
			});
	}

	/**
	 * Calculates the token count for the current settings and updates the UI.
	 * @private
	 */
	private async calculateAndDisplayTokens() {
		if (!this.selectedFile) {
			this.tokenCountEl.setText("Token estimate: not available");
			return;
		}

		this.tokenCountEl.setText("Calculating token estimate...");
		const exportTree = await this.ensureExportTree();
		if (!exportTree) {
			this.tokenCountEl.setText("Token estimate: error");
			return;
		}
		const tokenCount = this.estimateExportTokens(exportTree);
		this.tokenCountEl.setText(this.formatTokenCountMessage(tokenCount));
	}

	private async reloadLlmTemplateOptions(): Promise<void> {
		this.llmTemplateOptions = await listLlmMarkdownTemplateOptions(
			this.app,
			this.settings.llmMarkdownTemplateDirectory,
			{ includeCompactBuiltin: false }
		);
		if (
			!this.llmTemplateOptions.some((option) => option.id === this.selectedLlmTemplateId) &&
			this.exportFormat === "llm-markdown"
		) {
			this.selectedLlmTemplateId = DEFAULT_BUILTIN_LLM_TEMPLATE_ID;
		}
		this.applyExportChoiceOptions();
	}

	private getAvailableLlmTemplateOptions(): LlmMarkdownTemplateOption[] {
		if (this.llmTemplateOptions.length > 0) {
			return this.llmTemplateOptions;
		}
		return [
			{
				id: DEFAULT_BUILTIN_LLM_TEMPLATE_ID,
				label: "LLM-ready",
				source: "builtin",
			},
		];
	}

	private getCurrentExportChoiceValue(): string {
		if (this.exportFormat === "xml") {
			return EXPORT_CHOICE_XML;
		}
		if (this.exportFormat === "print-friendly-markdown") {
			return EXPORT_CHOICE_PRINT_FRIENDLY;
		}
		const hasSelectedTemplate = this.getAvailableLlmTemplateOptions().some(
			(option) => option.id === this.selectedLlmTemplateId
		);
		const selectedTemplateId = hasSelectedTemplate
			? this.selectedLlmTemplateId
			: DEFAULT_BUILTIN_LLM_TEMPLATE_ID;
		return `${EXPORT_CHOICE_LLM_PREFIX}${selectedTemplateId}`;
	}

	private applyExportChoiceOptions(): void {
		if (!this.exportChoiceDropdown) {
			return;
		}
		this.exportChoiceDropdown.selectEl.empty();
		this.exportChoiceDropdown.addOption(EXPORT_CHOICE_XML, "XML - structured format with metadata");
		this.exportChoiceDropdown.addOption(
			EXPORT_CHOICE_PRINT_FRIENDLY,
			"Print-friendly Markdown - clean, readable format"
		);
		for (const option of this.getAvailableLlmTemplateOptions()) {
			this.exportChoiceDropdown.addOption(
				`${EXPORT_CHOICE_LLM_PREFIX}${option.id}`,
				`Markdown - ${option.label}`
			);
		}
		this.exportChoiceDropdown.setValue(this.getCurrentExportChoiceValue());
	}

	private applyExportChoiceSelection(value: string): void {
		if (value === EXPORT_CHOICE_XML) {
			this.exportFormat = "xml";
			return;
		}
		if (value === EXPORT_CHOICE_PRINT_FRIENDLY) {
			this.exportFormat = "print-friendly-markdown";
			return;
		}
		if (value.startsWith(EXPORT_CHOICE_LLM_PREFIX)) {
			const templateId = value.slice(EXPORT_CHOICE_LLM_PREFIX.length);
			this.exportFormat = "llm-markdown";
			this.selectedLlmTemplateId =
				templateId.length > 0 ? templateId : DEFAULT_BUILTIN_LLM_TEMPLATE_ID;
		}
	}

	/**
	 * Handles the main export action when the user clicks the export button.
	 * @private
	 */
	private async prepareExportOutput(): Promise<PreparedExportOutput | null> {
		if (!this.selectedFile) {
			new Notice("Please select a root note first.");
			return null;
		}

		const rootFile = this.selectedFile;
		this.tokenCountEl.setText("Exporting...");
		const exportTree = await this.ensureExportTree();
		if (!exportTree) {
			this.tokenCountEl.setText("Export failed");
			new Notice("Failed to generate export. See console for details.");
			return null;
		}
		const adjustedTree = applyContentSelection(exportTree, this.selectedNodeIds);
		const llmMarkdownTemplate =
			this.exportFormat === "llm-markdown"
				? (
						await resolveLlmMarkdownTemplate(
							this.app,
							this.settings.llmMarkdownTemplateDirectory,
							this.selectedLlmTemplateId
						)
					).template
				: null;
		const output = buildExportOutput({
			rootNode: adjustedTree,
			vaultPath: this.app.vault.getName(),
			format: this.exportFormat,
			llmMarkdownTemplate,
			missingNotesCount: this.missingNotesCount,
			onInvalidFormat: () => {
				new Notice("Unknown export format selected; falling back to XML.");
			},
		});
		const tokenCount = this.estimateTokens(output);
		this.tokenCountEl.setText(this.formatTokenCountMessage(tokenCount));

		return {
			rootFile,
			output,
			tokenCount,
		};
	}

	private async onExportToClipboard() {
		const preparedExport = await this.prepareExportOutput();
		if (!preparedExport) {
			return;
		}

		if (!navigator.clipboard?.writeText) {
			new Notice("Clipboard is not available in this environment.");
			return;
		}
		try {
			await navigator.clipboard.writeText(preparedExport.output);
		} catch (error) {
			console.error("Failed to copy export to clipboard", error);
			this.tokenCountEl.setText(this.formatTokenCountMessage(preparedExport.tokenCount));
			new Notice("Failed to copy export to clipboard.");
			return;
		}
		new Notice("Export copied to clipboard.");
		if (this.settings.closeModalAfterExport) {
			this.close();
		}
	}

	private async onExportToNewNote() {
		const preparedExport = await this.prepareExportOutput();
		if (!preparedExport) {
			return;
		}

		new ExportNoteDestinationModal(this.app, preparedExport.rootFile, async (destination) => {
			try {
				const createdFile = await createExportNote(this.app, preparedExport.output, destination, {
					openAfterCreate: true,
				});
				new Notice(`Export note created: ${createdFile.path}`);
			} catch (error) {
				console.error("Failed to create export note", error);
				this.tokenCountEl.setText(this.formatTokenCountMessage(preparedExport.tokenCount));
				new Notice(error instanceof Error ? error.message : "Failed to create export note.");
				return false;
			}

			if (this.settings.closeModalAfterExport) {
				this.close();
			}
		}).open();
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
		return this.estimateTokensFromCharacterCount(text.length);
	}

	private estimateTokensFromCharacterCount(characterCount: number): number {
		return Math.ceil(characterCount / 4);
	}

	private estimateExportTokens(rootNode: ExportNode): number {
		const characterCount = this.estimateExportCharacterCount(rootNode);
		return this.estimateTokensFromCharacterCount(characterCount);
	}

	private estimateExportCharacterCount(rootNode: ExportNode): number {
		const notes = this.flattenExportTree(rootNode);
		let maxDepth = 0;
		let titleChars = 0;
		let selectedContentChars = 0;

		for (const note of notes) {
			maxDepth = Math.max(maxDepth, note.depth);
			titleChars += note.title.length;
			if (note.includeContent && this.selectedNodeIds.has(note.id)) {
				selectedContentChars += note.content?.length ?? 0;
			}
		}

		const vaultPathLength = this.app.vault.getName().length;
		const metadataChars =
			240 +
			vaultPathLength +
			rootNode.title.length +
			String(notes.length).length +
			String(this.missingNotesCount).length +
			String(maxDepth).length;

		switch (this.exportFormat) {
			case "xml":
				return metadataChars + titleChars * 2 + selectedContentChars + notes.length * 120;
			case "llm-markdown":
				return metadataChars + titleChars * 2 + selectedContentChars + notes.length * 80;
			case "print-friendly-markdown":
				return notes.reduce((total, note) => {
					const headingChars = note.depth + 4 + note.title.length;
					const contentChars =
						note.includeContent && this.selectedNodeIds.has(note.id)
							? (note.content?.length ?? 0) + 2
							: 0;
					return total + headingChars + contentChars;
				}, 0);
			default:
				return titleChars + selectedContentChars;
		}
	}

	private flattenExportTree(rootNode: ExportNode): ExportNode[] {
		const notes: ExportNode[] = [];
		const queue: ExportNode[] = [rootNode];
		let head = 0;

		while (head < queue.length) {
			const node = queue[head++];
			notes.push(node);
			for (const child of node.children) {
				queue.push(child);
			}
		}

		return notes;
	}

	/**
	 * Updates the UI to reflect the currently selected file.
	 * @private
	 */
	private updateSelectedFile() {
		if (this.selectedFile) {
			this.selectedFileEl.setText(`Selected: ${this.selectedFile.basename}`);
		} else {
			this.selectedFileEl.setText("No file selected");
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
		this.cachedDisplayTree = null;
		this.cachedDisplayTreeSource = null;
		this.clearRenderedTreeState();
		if (options.resetSelection) {
			this.selectedNodeIds.clear();
			this.knownContentNodeIds.clear();
			this.userDeselectedNodeIds.clear();
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
			const traversal = new BFSTraversal(
				obsidianAPI,
				this.contentDepth,
				this.titleDepth,
				this.linkTraversalMode,
				{
					ignoredTraversalFolders: this.settings.ignoredTraversalFolders,
					ignoredTraversalTagPatterns: this.settings.ignoredTraversalTagPatterns,
					ignoredTraversalPropertyRules: this.settings.ignoredTraversalPropertyRules,
				}
			);
			const exportTree = await traversal.traverse(this.selectedFile.path);

			if (buildId !== this.treeBuildId) {
				this.exportTreePromise = null;
				return null;
			}

			if (!exportTree) {
				this.exportTree = null;
				this.missingNotesCount = 0;
				this.exportTreePromise = null;
				this.cachedDisplayTree = null;
				this.cachedDisplayTreeSource = null;
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
			this.cachedDisplayTree = null;
			this.cachedDisplayTreeSource = null;
			new Notice("Failed to build export tree. See console for details.");
			this.renderExportTree();
			return null;
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
		this.reconcileNodeSelection(node, true, true);
		enforceAncestorSelection(this.selectedNodeIds, node, true);
	}

	/**
	 * Reconciles a node and its descendants while auto-selecting only newly content-eligible nodes.
	 * @private
	 */
	private reconcileNodeSelection(node: ExportNode, parentSelected: boolean, isRoot: boolean) {
		if (!node.includeContent) {
			this.selectedNodeIds.delete(node.id);
			this.knownContentNodeIds.delete(node.id);
		} else {
			const wasKnown = this.knownContentNodeIds.has(node.id);
			if (!parentSelected) {
				this.selectedNodeIds.delete(node.id);
			} else if (isRoot) {
				this.selectedNodeIds.add(node.id);
				this.userDeselectedNodeIds.delete(node.id);
			} else if (this.userDeselectedNodeIds.has(node.id)) {
				this.selectedNodeIds.delete(node.id);
			} else if (!wasKnown) {
				// New content-eligible nodes default to selected.
				this.selectedNodeIds.add(node.id);
			}
			this.knownContentNodeIds.add(node.id);
		}

		const nodeSelected = node.includeContent && this.selectedNodeIds.has(node.id);
		for (const child of node.children) {
			this.reconcileNodeSelection(child, nodeSelected, false);
		}
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
	 * Marks a node and its descendants as explicitly deselected by the user.
	 * @private
	 */
	private markUserDeselectedSubtree(node: ExportNode) {
		if (node.includeContent) {
			this.userDeselectedNodeIds.add(node.id);
		}
		for (const child of node.children) {
			this.markUserDeselectedSubtree(child);
		}
	}

	/**
	 * Clears explicit user deselection for a node and its descendants.
	 * @private
	 */
	private clearUserDeselectedSubtree(node: ExportNode) {
		this.userDeselectedNodeIds.delete(node.id);
		for (const child of node.children) {
			this.clearUserDeselectedSubtree(child);
		}
	}

	/**
	 * Clears explicit user deselection for specific ancestor ids.
	 * @private
	 */
	private clearUserDeselectedAncestors(ancestorIds: string[]) {
		for (const id of ancestorIds) {
			this.userDeselectedNodeIds.delete(id);
		}
	}

	/**
	 * Builds a cache key for the current tree.
	 * @private
	 */
	private getTreeCacheKey(): string {
		const rootPath = this.selectedFile?.path ?? "unknown";
		const ignoredTraversalFolders = JSON.stringify(this.settings.ignoredTraversalFolders);
		const ignoredTraversalTagPatterns = JSON.stringify(this.settings.ignoredTraversalTagPatterns);
		const ignoredTraversalPropertyRules = JSON.stringify(
			this.settings.ignoredTraversalPropertyRules
		);
		return `${rootPath}|content:${this.contentDepth}|title:${this.titleDepth}|mode:${this.linkTraversalMode}|traversalIgnored:${ignoredTraversalFolders}|traversalIgnoredTags:${ignoredTraversalTagPatterns}|traversalIgnoredProperties:${ignoredTraversalPropertyRules}`;
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

	private clearRenderedTreeState() {
		this.renderedDisplayTree = null;
		this.renderedRowElements.clear();
		this.renderedCheckboxElements.clear();
		this.renderedToggleElements.clear();
		this.renderedChildListElements.clear();
		this.renderedAncestorIds.clear();
	}

	private getNodeParentSelectedState(nodeId: string): boolean {
		const ancestorIds = this.renderedAncestorIds.get(nodeId) ?? [];
		for (const ancestorId of ancestorIds) {
			if (!this.selectedNodeIds.has(ancestorId)) {
				return false;
			}
		}
		return true;
	}

	private renderNodeChildrenIfNeeded(node: ExportNode) {
		if (node.children.length === 0) {
			return;
		}

		const childListEl = this.renderedChildListElements.get(node.id);
		if (!childListEl || childListEl.childElementCount > 0) {
			return;
		}

		const childAncestorIds = [...(this.renderedAncestorIds.get(node.id) ?? []), node.id];
		const parentSelected =
			this.getNodeParentSelectedState(node.id) && this.selectedNodeIds.has(node.id);
		for (const child of node.children) {
			this.renderExportTreeNode(child, childListEl, parentSelected, false, childAncestorIds);
		}
	}

	private updateCollapseUI(node: ExportNode) {
		const hasChildren = node.children.length > 0;
		if (hasChildren) {
			const isCollapsed = this.collapsedNodeIds.has(node.id);
			const toggleEl = this.renderedToggleElements.get(node.id);
			if (toggleEl) {
				toggleEl.setText(isCollapsed ? "▸" : "▾");
				toggleEl.setAttr("aria-label", isCollapsed ? "Expand note" : "Collapse note");
				toggleEl.setAttr("aria-controls", this.getNodeChildrenListId(node.id));
				toggleEl.setAttr("aria-expanded", (!isCollapsed).toString());
			}

			const childListEl = this.renderedChildListElements.get(node.id);
			if (childListEl) {
				if (!isCollapsed) {
					this.renderNodeChildrenIfNeeded(node);
				}
				if (isCollapsed) {
					childListEl.addClass("smart-export-tree--collapsed");
				} else {
					childListEl.removeClass("smart-export-tree--collapsed");
				}
			}
		}

		if (this.collapsedNodeIds.has(node.id)) {
			return;
		}

		for (const child of node.children) {
			this.updateCollapseUI(child);
		}
	}

	private refreshRenderedSelectionUI() {
		if (!this.renderedDisplayTree) {
			return;
		}

		this.selectedNodeIds.add(this.renderedDisplayTree.id);
		this.refreshRenderedSelectionNode(this.renderedDisplayTree, true, true);
		this.updateTreeSummary(this.renderedDisplayTree);
	}

	private refreshRenderedSelectionNode(node: ExportNode, parentSelected: boolean, isRoot: boolean) {
		const isSelected = isRoot || this.selectedNodeIds.has(node.id);
		const isExcluded = !parentSelected || (!isRoot && !isSelected);

		const rowEl = this.renderedRowElements.get(node.id);
		if (rowEl) {
			if (isExcluded) {
				rowEl.addClass("smart-export-tree-row--disabled");
			} else {
				rowEl.removeClass("smart-export-tree-row--disabled");
			}
		}

		const checkboxEl = this.renderedCheckboxElements.get(node.id);
		if (checkboxEl) {
			checkboxEl.checked = isSelected;
		}

		const nextParentSelected = isSelected;
		for (const child of node.children) {
			this.refreshRenderedSelectionNode(child, nextParentSelected, false);
		}
	}

	private updateTreeSummary(displayTree: ExportNode) {
		if (this.treeIsStale) {
			this.treeSummaryEl.setText("Updating note tree...");
			return;
		}

		const counts = this.countTreeNodes(displayTree);
		this.treeSummaryEl.setText(`Content selected for ${counts.selected} of ${counts.total} notes`);
	}

	/**
	 * Renders the export tree visualization.
	 * @private
	 */
	private renderExportTree() {
		if (!this.treeContainerEl) return;
		this.treeContainerEl.empty();
		this.clearRenderedTreeState();
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
		const displayTree = this.getContentDisplayTree(this.exportTree);
		if (!displayTree) {
			this.treeContainerEl.createDiv({
				cls: "smart-export-tree-placeholder",
				text: "No notes with content at the current depth.",
			});
			return;
		}
		this.renderedDisplayTree = displayTree;
		this.updateTreeSummary(displayTree);

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
		this.renderedAncestorIds.set(node.id, ancestorIdsSnapshot);

		const itemEl = containerEl.createEl("li", { cls: "smart-export-tree-item" });
		const rowEl = itemEl.createDiv({ cls: "smart-export-tree-row" });
		this.renderedRowElements.set(node.id, rowEl);

		if (isRoot) {
			this.selectedNodeIds.add(node.id);
		}
		const isSelected = isRoot || this.selectedNodeIds.has(node.id);
		const isExcluded = !parentSelected || (!isRoot && !isSelected);
		if (isExcluded) {
			rowEl.addClass("smart-export-tree-row--disabled");
		} else {
			rowEl.removeClass("smart-export-tree-row--disabled");
		}

		const hasChildren = node.children.length > 0;
		const isCollapsed = this.collapsedNodeIds.has(node.id);

		if (hasChildren) {
			const childListId = this.getNodeChildrenListId(node.id);
			const toggleEl = rowEl.createEl("button", {
				text: isCollapsed ? "▸" : "▾",
				cls: "smart-export-tree-toggle",
			});
			this.renderedToggleElements.set(node.id, toggleEl);
			toggleEl.setAttr("aria-label", isCollapsed ? "Expand note" : "Collapse note");
			toggleEl.setAttr("aria-controls", childListId);
			toggleEl.setAttr("aria-expanded", (!isCollapsed).toString());
			toggleEl.addEventListener("click", (event) => {
				event.preventDefault();
				event.stopPropagation();
				if (this.collapsedNodeIds.has(node.id)) {
					this.collapsedNodeIds.delete(node.id);
				} else {
					this.collapsedNodeIds.add(node.id);
				}
				this.updateCollapseUI(node);
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

					if (event.shiftKey) {
						const counts = this.countTreeNodes(this.exportTree);
						const allSelected = counts.selected === counts.total;
						this.selectedNodeIds.clear();
						if (!allSelected) {
							this.userDeselectedNodeIds.clear();
							this.selectAllNodes(this.exportTree);
						} else {
							this.selectedNodeIds.add(node.id);
							this.userDeselectedNodeIds.clear();
							for (const child of this.exportTree.children) {
								this.markUserDeselectedSubtree(child);
							}
						}
						this.refreshRenderedSelectionUI();
						this.debouncedTokenUpdate();
						return;
					}

					if (this.collapsedNodeIds.has(node.id)) {
						this.collapsedNodeIds.delete(node.id);
					} else {
						this.collapsedNodeIds.add(node.id);
					}
					this.updateCollapseUI(node);
				});
			}
		} else {
			const labelEl = rowEl.createEl("label", { cls: "smart-export-tree-label" });
			const checkboxEl = labelEl.createEl("input", {
				type: "checkbox",
				cls: "smart-export-tree-checkbox",
			});
			this.renderedCheckboxElements.set(node.id, checkboxEl);
			setTooltip(labelEl, "Shift-click to toggle content for all notes in this branch.");

			checkboxEl.checked = isSelected;
			const labelTextSpan = labelEl.createSpan({
				text: node.title,
				cls: "smart-export-tree-label-text",
			});
			const labelId = this.getDomSafeId(`smart-export-tree-label-${node.id}`);
			labelTextSpan.id = labelId;
			checkboxEl.setAttribute("aria-labelledby", labelId);
			if (this.settings.showTokenEstimatesInTree) {
				const tokenText = this.formatNodeTokenEstimate(node);
				labelEl.createSpan({ text: tokenText, cls: "smart-export-tree-token" });
			}
			checkboxEl.addEventListener("click", (event) => {
				if (event.shiftKey) {
					const subtreeCounts = this.countTreeNodes(node);
					const allSelected = subtreeCounts.selected === subtreeCounts.total;
					if (allSelected) {
						deselectSubtree(this.selectedNodeIds, node);
						this.markUserDeselectedSubtree(node);
					} else {
						selectAncestors(this.selectedNodeIds, ancestorIdsSnapshot);
						selectSubtree(this.selectedNodeIds, node);
						this.clearUserDeselectedAncestors(ancestorIdsSnapshot);
						this.clearUserDeselectedSubtree(node);
					}
					this.refreshRenderedSelectionUI();
					this.debouncedTokenUpdate();
					return;
				}

				if (checkboxEl.checked) {
					selectAncestors(this.selectedNodeIds, ancestorIdsSnapshot);
					selectNode(this.selectedNodeIds, node.id);
					this.clearUserDeselectedAncestors(ancestorIdsSnapshot);
					this.userDeselectedNodeIds.delete(node.id);
				} else {
					deselectSubtree(this.selectedNodeIds, node);
					this.markUserDeselectedSubtree(node);
				}
				this.refreshRenderedSelectionUI();
				this.debouncedTokenUpdate();
			});
		}

		if (hasChildren) {
			const childListEl = itemEl.createEl("ul", { cls: "smart-export-tree" });
			childListEl.id = this.getNodeChildrenListId(node.id);
			this.renderedChildListElements.set(node.id, childListEl);
			if (isCollapsed) {
				childListEl.addClass("smart-export-tree--collapsed");
			} else {
				const childAncestorIds = [...ancestorIdsSnapshot, node.id];
				for (const child of node.children) {
					this.renderExportTreeNode(child, childListEl, isSelected, false, childAncestorIds);
				}
			}
		}
	}

	/**
	 * Formats an approximate token estimate for a single node.
	 */
	private formatNodeTokenEstimate(node: ExportNode): string {
		const cached = this.nodeTokenEstimateCache.get(node);
		if (cached) {
			return cached;
		}

		const content = node.includeContent ? (node.content ?? "") : "";
		const text = node.title + (content ? `\n${content}` : "");
		const tokens = this.estimateTokens(text);
		const formatted = `~${tokens.toLocaleString()} tokens`;
		this.nodeTokenEstimateCache.set(node, formatted);
		return formatted;
	}

	/**
	 * Formats the token count message with warning thresholds.
	 * @private
	 */
	private formatTokenCountMessage(tokenCount: number): string {
		let tokenText = `Estimated tokens: ~${tokenCount.toLocaleString()}`;

		if (tokenCount > 200000) {
			tokenText += " — exceeds most context limits";
		} else if (tokenCount > 128000) {
			tokenText += " — may exceed common context limits";
		} else if (tokenCount > 100000) {
			tokenText += " — large export";
		}

		return tokenText;
	}

	/**
	 * Creates a DOM-safe id from an arbitrary string.
	 * @private
	 */
	private getDomSafeId(value: string): string {
		return value.replace(/[^a-zA-Z0-9_-]+/g, "-");
	}

	private getNodeChildrenListId(nodeId: string): string {
		return this.getDomSafeId(`smart-export-tree-children-${nodeId}`);
	}

	private getContentDisplayTree(node: ExportNode): ExportNode | null {
		if (this.cachedDisplayTreeSource === node) {
			return this.cachedDisplayTree;
		}

		this.cachedDisplayTreeSource = node;
		this.cachedDisplayTree = this.buildContentDisplayTree(node);
		return this.cachedDisplayTree;
	}

	/**
	 * Builds a tree that only includes nodes with content at the current depth.
	 * @private
	 */
	private buildContentDisplayTree(node: ExportNode): ExportNode | null {
		if (!node.includeContent) {
			return null;
		}

		const children: ExportNode[] = [];
		for (const child of node.children) {
			const displayChild = this.buildContentDisplayTree(child);
			if (displayChild) {
				children.push(displayChild);
			}
		}

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
		this.modalEl.removeClass("smart-export-modal-shell");
		this.clearRenderedTreeState();
	}
}
