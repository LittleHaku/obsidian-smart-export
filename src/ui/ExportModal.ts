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
import { TagSuggestModal } from "./TagSuggestModal";
import { ExportNode, LinkTraversalMode, SmartExportSettings } from "../types";
import {
	DEFAULT_BUILTIN_LLM_TEMPLATE_ID,
	LlmMarkdownTemplateOption,
	listLlmMarkdownTemplateOptions,
} from "../utils/llmMarkdownTemplateResolver";
import { TEMPLATE_DOCS_URL } from "../constants/templateDocs";
import {
	deselectSubtree,
	reconcileContentSelectionState,
	selectAncestors,
	selectNode,
	selectSubtree,
} from "./treeSelection";
import { createExportNote } from "../utils/exportNote";
import { ExportNoteDestinationModal } from "./ExportNoteDestinationModal";
import { normalizeNoteTag } from "../utils/noteFilters";
import { createLinkedDescription } from "../utils/linkedDescription";
import { TagDiscoveryService } from "../tagDiscovery";
import { serializeSelectedExport } from "./exportExecution";
import { buildExportTreeFromSelection } from "./exportTreeController";
import {
	AddedExportItem,
	AddedNoteMode,
	applyExportChoiceSelection as selectExportChoice,
	buildContentDisplayTree as createContentDisplayTree,
	clearNodeIdsInSubtree,
	collapseAllNodes as collapseTree,
	collapseRootOnly as collapseTreeRoot,
	countTreeNodes as countTreeContentNodes,
	estimateExportCharacterCount as estimateTreeExportCharacters,
	estimateTokensFromCharacterCount,
	expandAllNodes as expandTree,
	ExportSourceMode,
	EXPORT_CHOICE_LLM_PREFIX,
	EXPORT_CHOICE_PRINT_FRIENDLY,
	EXPORT_CHOICE_XML,
	flattenExportTree as flattenTree,
	formatTokenCountMessage as formatTokenEstimate,
	getAddedItemPathText as getExportItemPathText,
	getAddedItemScopeText as getExportItemScopeText,
	getAddedItemTitle as getExportItemTitle,
	getAvailableLlmTemplateOptions as getTemplateOptions,
	getCurrentExportChoiceValue as getExportChoiceValue,
	getDomSafeId as createDomSafeId,
	getExportSourceName as createExportSourceName,
	getExportTreeFailureMessage as createExportTreeFailureMessage,
	getSelectedTag as normalizeSelectedTag,
	getTreeCacheKey as createTreeCacheKey,
	hasExportSource as sourceIsSelected,
	markUserDeselectedSubtree as markDeselectedTree,
	MAX_TREE_CACHE_ENTRIES,
	selectAllNodes as selectTree,
} from "./exportModalState";

interface PreparedExportOutput {
	rootFile: TFile | null;
	sourceName: string;
	output: string;
	tokenCount: number;
}

/**
 * The main modal for configuring and triggering a smart export.
 * It allows users to select a root note, adjust traversal depth,
 * and export the resulting note tree to the clipboard or a new note.
 */
export class ExportModal extends Modal {
	/** The currently selected file to be used as the root of the export. */
	private selectedFile: TFile | null = null;
	/** Which source type is used for this export. */
	private sourceMode: ExportSourceMode = "note";
	/** Selected tag used when exporting from matching notes. */
	private selectedTag = "";
	/** Dropdown used to switch export source modes. */
	private sourceModeDropdown: DropdownComponent | null = null;
	/** Container for source-specific controls. */
	private sourceControlsEl!: HTMLElement;
	/** The HTML element that displays the name of the selected file. */
	private selectedFileEl!: HTMLElement;
	/** Session-only notes and tags manually added to the export. */
	private addedNotes: AddedExportItem[] = [];
	/** Container for manually added note/tag rows. */
	private addedNotesListEl!: HTMLElement;
	/** Description for extra-note context that reflects the selected root note. */
	private addedNotesDescriptionEl!: HTMLElement;
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
	private tokenCountEl!: HTMLElement;
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
	private treeContainerEl!: HTMLElement;
	/** Summary element for selected notes count. */
	private treeSummaryEl!: HTMLElement;
	/** Incremented on each tree invalidation to discard stale builds. */
	private treeBuildId = 0;
	/** Incremented on each token calculation to discard stale UI updates. */
	private tokenCalculationId = 0;
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
	/** Shared lazy tag cache used by both tag pickers. */
	private readonly tagDiscovery: TagDiscoveryService;

	constructor(app: App, settings: SmartExportSettings, tagDiscovery: TagDiscoveryService) {
		super(app);
		this.settings = settings;
		this.tagDiscovery = tagDiscovery;
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

		// Export source selection section
		const rootSection = contentEl.createDiv({ cls: "smart-export-section" });
		rootSection.createDiv({ text: "📝 Starting point", cls: "smart-export-section-title" });

		new Setting(rootSection)
			.setName("Source")
			.setDesc("Start from one note, or from every note matching a tag.")
			.addDropdown((dropdown) => {
				this.sourceModeDropdown = dropdown;
				dropdown
					.addOption("note", "Root note")
					.addOption("tag", "Tag")
					.setValue(this.sourceMode)
					.onChange((value) => {
						this.sourceMode = value === "tag" ? "tag" : "note";
						this.renderSourceControls();
						this.updateSelectedFile();
					});
			});

		this.sourceControlsEl = rootSection.createDiv();
		this.renderSourceControls();

		this.selectedFileEl = rootSection.createDiv({
			text: "No source selected",
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

		const addedNotesSection = contentEl.createDiv({ cls: "smart-export-section" });
		addedNotesSection.createDiv({
			text: "➕ Include more notes",
			cls: "smart-export-section-title",
		});
		this.addedNotesDescriptionEl = addedNotesSection.createDiv({
			cls: "smart-export-section-description",
		});
		new Setting(addedNotesSection)
			.setName("Add extra notes")
			.setDesc(
				"Single note includes one note. New root starts another export tree. Tag adds matching notes as roots."
			)
			.addButton((button) => {
				button.setButtonText("Add single note").onClick(() => {
					this.openAddedNotePicker("single-note");
				});
			})
			.addButton((button) => {
				button.setButtonText("Add new root").onClick(() => {
					this.openAddedNotePicker("extra-root");
				});
			})
			.addButton((button) => {
				button.setButtonText("Add tag").onClick(() => {
					this.openAddedTagPicker();
				});
			});
		this.addedNotesListEl = addedNotesSection.createDiv({
			cls: "smart-export-added-notes-list",
		});
		this.updateAddedNotesDescription();
		this.renderAddedNotesList();

		// Depth configuration section
		const depthSection = contentEl.createDiv({ cls: "smart-export-section" });
		depthSection.createDiv({
			text: "🌊 Traversal depth",
			cls: "smart-export-section-title",
		});
		const depthInfo = depthSection.createDiv({ cls: "smart-export-info-box" });
		depthInfo.createEl("strong", { text: "How depth works: " });
		depthInfo.createSpan({
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
					.onChange((value) => {
						this.linkTraversalMode = value === "incoming" || value === "both" ? value : "outgoing";
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

		const outputDesc = createLinkedDescription(exportSection, {
			text: "Choose XML, print-friendly Markdown, or a Markdown template (built-in or custom). ",
			linkText: "Template docs",
			href: TEMPLATE_DOCS_URL,
		});

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
		treeInfo.createSpan({
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

		this.tokenCountEl = exportActionSection.createDiv({
			text: "Token estimate: not available",
			cls: "smart-export-token-count",
		});

		const tokenInfo = exportActionSection.createDiv({ cls: "smart-export-token-info" });
		tokenInfo.createSpan({
			text: "Token estimates help you stay within common context limits (~128k, ~200k).",
		});

		new Setting(exportActionSection)
			.setName("Ready to export?")
			.setDesc("Generate the export and copy it to clipboard or create a new note")
			.addButton((button) => {
				const isDefaultTarget = this.settings.defaultExportTarget === "new-note";
				button.setButtonText("Export to new note");
				if (isDefaultTarget) {
					button.setCta();
				}
				button.onClick(() => {
					void this.onExportToNewNote();
				});
			})
			.addButton((button) => {
				const isDefaultTarget = this.settings.defaultExportTarget === "clipboard";
				button.setButtonText("Export to clipboard");
				if (isDefaultTarget) {
					button.setCta();
				}
				button.onClick(() => {
					void this.onExportToClipboard();
				});
			});
	}

	/**
	 * Calculates the token count for the current settings and updates the UI.
	 * @private
	 */
	private async calculateAndDisplayTokens() {
		const calculationId = ++this.tokenCalculationId;
		if (!this.hasExportSource()) {
			this.tokenCountEl.setText("Token estimate: not available");
			return;
		}

		this.tokenCountEl.setText("Calculating token estimate...");
		const exportTree = await this.ensureExportTree();
		if (calculationId !== this.tokenCalculationId) {
			return;
		}
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
		return getTemplateOptions(this.llmTemplateOptions);
	}

	private getCurrentExportChoiceValue(): string {
		return getExportChoiceValue(
			{ format: this.exportFormat, templateId: this.selectedLlmTemplateId },
			this.llmTemplateOptions
		);
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
		const state = selectExportChoice(
			{ format: this.exportFormat, templateId: this.selectedLlmTemplateId },
			value
		);
		this.exportFormat = state.format;
		this.selectedLlmTemplateId = state.templateId;
	}

	/**
	 * Handles the main export action when the user clicks the export button.
	 * @private
	 */
	private async prepareExportOutput(): Promise<PreparedExportOutput | null> {
		if (!this.hasExportSource()) {
			new Notice("Please select a root note or tag first.");
			return null;
		}

		const rootFile = this.sourceMode === "note" ? this.selectedFile : null;
		const sourceName = this.getExportSourceName();
		this.tokenCountEl.setText("Exporting...");
		const exportTree = await this.ensureExportTree();
		if (!exportTree) {
			this.tokenCountEl.setText("Export failed");
			new Notice(this.getExportTreeFailureMessage());
			return null;
		}
		this.enforceLockedRootSelection();
		const serialized = await serializeSelectedExport({
			app: this.app,
			settings: this.settings,
			rootNode: exportTree,
			selectedNodeIds: this.selectedNodeIds,
			format: this.exportFormat,
			selectedLlmTemplateId: this.selectedLlmTemplateId,
			missingNotesCount: this.missingNotesCount,
			onInvalidFormat: () => {
				new Notice("Unknown export format selected; falling back to XML.");
			},
		});
		const { output, tokenCount } = serialized;
		this.tokenCountEl.setText(this.formatTokenCountMessage(tokenCount));

		return {
			rootFile,
			sourceName,
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

		new ExportNoteDestinationModal(
			this.app,
			preparedExport.rootFile,
			this.settings.defaultExportNoteFolderPath,
			async (destination) => {
				try {
					const createdFile = await createExportNote(this.app, preparedExport.output, destination, {
						openAfterCreate: this.settings.openCreatedExportNote,
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
			},
			preparedExport.sourceName
		).open();
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
		return estimateTokensFromCharacterCount(characterCount);
	}

	private estimateExportTokens(rootNode: ExportNode): number {
		const characterCount = this.estimateExportCharacterCount(rootNode);
		return this.estimateTokensFromCharacterCount(characterCount);
	}

	private estimateExportCharacterCount(rootNode: ExportNode): number {
		return estimateTreeExportCharacters(
			rootNode,
			this.selectedNodeIds,
			this.exportFormat,
			this.settings,
			this.app.vault.getName(),
			this.missingNotesCount
		);
	}

	private flattenExportTree(rootNode: ExportNode): ExportNode[] {
		return flattenTree(rootNode);
	}

	private getSelectedTag(): string {
		return normalizeSelectedTag(this.selectedTag);
	}

	private hasExportSource(): boolean {
		return sourceIsSelected(this.sourceMode, this.selectedFile, this.selectedTag);
	}

	private getExportSourceName(): string {
		return createExportSourceName(this.sourceMode, this.selectedFile, this.selectedTag);
	}

	private getExportTreeFailureMessage(): string {
		return createExportTreeFailureMessage(this.sourceMode);
	}

	private renderSourceControls(): void {
		if (!this.sourceControlsEl) {
			return;
		}

		this.sourceControlsEl.empty();
		if (this.sourceMode === "tag") {
			new Setting(this.sourceControlsEl)
				.setName("Tag")
				.setDesc("Choose the tag to use as the export source.")
				.addButton((button) => {
					button.setButtonText("Select tag").onClick(() => {
						new TagSuggestModal(this.app, this.tagDiscovery, (tag) => {
							this.selectedTag = tag;
							this.updateSelectedFile();
						}).open();
					});
				});
			return;
		}

		new Setting(this.sourceControlsEl)
			.setName("Root note")
			.setDesc("Choose the note to start traversing from. Default: current active note")
			.addButton((button) => {
				button.setButtonText("Select").onClick(() => {
					new RootNoteSuggestModal(this.app, (file: TFile) => {
						this.selectedFile = file;
						this.updateSelectedFile();
					}).open();
				});
			});
	}

	/**
	 * Updates the UI to reflect the currently selected file.
	 * @private
	 */
	private updateSelectedFile() {
		this.sourceModeDropdown?.setValue(this.sourceMode);
		if (this.sourceMode === "tag") {
			const tag = this.getSelectedTag();
			this.selectedFileEl.setText(tag ? `Selected tag: #${tag}` : "No tag selected");
		} else if (this.selectedFile) {
			this.selectedFileEl.setText(`Selected: ${this.selectedFile.basename}`);
			this.addedNotes = this.addedNotes.filter(
				(addedNote) => addedNote.kind !== "note" || addedNote.file.path !== this.selectedFile?.path
			);
			this.renderAddedNotesList();
		} else {
			this.selectedFileEl.setText("No source selected");
		}
		this.updateAddedNotesDescription();
		this.invalidateExportTree({ resetSelection: true });
		this.debouncedTokenUpdate();
	}

	private updateAddedNotesDescription() {
		if (!this.addedNotesDescriptionEl) {
			return;
		}
		const startingPoint = this.hasExportSource()
			? this.getExportSourceName()
			: "the selected source";
		this.addedNotesDescriptionEl.setText(
			`Add notes or tags that are not reached from ${startingPoint}. They are used only for this export.`
		);
	}

	private openAddedNotePicker(mode: AddedNoteMode) {
		new RootNoteSuggestModal(this.app, (file: TFile) => {
			this.addExportNote(file, mode);
		}).open();
	}

	private openAddedTagPicker() {
		new TagSuggestModal(this.app, this.tagDiscovery, (tag) => {
			this.addExportTag(tag);
		}).open();
	}

	private addExportNote(file: TFile, mode: AddedNoteMode) {
		if (this.sourceMode === "note" && this.selectedFile?.path === file.path) {
			new Notice("That note is already the root note.");
			return;
		}
		if (this.addedNotes.some((note) => note.kind === "note" && note.file.path === file.path)) {
			new Notice("That note is already added.");
			return;
		}

		this.addedNotes.push({ kind: "note", file, mode });
		this.renderAddedNotesList();
		this.invalidateExportTree();
		void this.calculateAndDisplayTokens();
	}

	private addExportTag(tag: string) {
		const normalizedTag = normalizeNoteTag(tag);
		if (!normalizedTag) {
			new Notice("That tag could not be added.");
			return;
		}
		if (this.sourceMode === "tag" && this.getSelectedTag() === normalizedTag) {
			new Notice("That tag is already the export source.");
			return;
		}
		if (
			this.addedNotes.some(
				(note) => note.kind === "tag" && normalizeNoteTag(note.tag) === normalizedTag
			)
		) {
			new Notice("That tag is already added.");
			return;
		}

		this.addedNotes.push({ kind: "tag", tag: normalizedTag });
		this.renderAddedNotesList();
		this.invalidateExportTree();
		void this.calculateAndDisplayTokens();
	}

	private renderAddedNotesList() {
		if (!this.addedNotesListEl) {
			return;
		}

		this.addedNotesListEl.empty();
		if (this.addedNotes.length === 0) {
			this.addedNotesListEl.createDiv({
				cls: "smart-export-added-notes-empty",
				text: "No extra notes included.",
			});
			return;
		}

		for (const [index, addedNote] of this.addedNotes.entries()) {
			const rowEl = this.addedNotesListEl.createDiv({ cls: "smart-export-added-note-row" });
			const noteLabelEl = rowEl.createDiv({ cls: "smart-export-added-note-label" });
			noteLabelEl.createDiv({
				cls: "smart-export-added-note-title",
				text: this.getAddedItemTitle(addedNote),
			});
			noteLabelEl.createDiv({
				cls: "smart-export-added-note-path",
				text: this.getAddedItemPathText(addedNote),
			});
			noteLabelEl.createDiv({
				cls: "smart-export-added-note-scope",
				text: this.getAddedItemScopeText(addedNote),
			});

			const actionGroupEl = rowEl.createDiv({ cls: "smart-export-added-note-actions" });
			if (addedNote.kind === "note") {
				const toggleModeButtonEl = actionGroupEl.createEl("button", {
					text: addedNote.mode === "single-note" ? "Use as new root" : "Use as single note",
					cls: "smart-export-added-note-action",
				});
				toggleModeButtonEl.setAttr("type", "button");
				toggleModeButtonEl.addEventListener("click", () => {
					const mode = addedNote.mode === "single-note" ? "extra-root" : "single-note";
					this.addedNotes[index] = { ...addedNote, mode };
					this.renderAddedNotesList();
					this.invalidateExportTree();
					void this.calculateAndDisplayTokens();
				});
			}

			const removeButtonEl = actionGroupEl.createEl("button", {
				text: "Remove",
				cls: "smart-export-added-note-action smart-export-added-note-remove",
			});
			removeButtonEl.setAttr("type", "button");
			removeButtonEl.addEventListener("click", () => {
				this.addedNotes.splice(index, 1);
				this.renderAddedNotesList();
				this.invalidateExportTree();
				void this.calculateAndDisplayTokens();
			});
		}
	}

	private getAddedItemTitle(item: AddedExportItem): string {
		return getExportItemTitle(item);
	}

	private getAddedItemPathText(item: AddedExportItem): string {
		return getExportItemPathText(item);
	}

	private getAddedItemScopeText(item: AddedExportItem): string {
		return getExportItemScopeText(item);
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
		if (!this.hasExportSource()) {
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
		if (!this.hasExportSource()) {
			this.exportTreePromise = null;
			return null;
		}

		try {
			const result = await buildExportTreeFromSelection({
				app: this.app,
				settings: this.settings,
				sourceMode: this.sourceMode,
				selectedFilePath: this.sourceMode === "note" ? this.selectedFile!.path : null,
				selectedTag: this.selectedTag,
				addedNotes: this.addedNotes,
				contentDepth: this.contentDepth,
				titleDepth: this.titleDepth,
				linkTraversalMode: this.linkTraversalMode,
				isCurrent: () => buildId === this.treeBuildId,
			});

			if (result.status === "stale") {
				this.exportTreePromise = null;
				return null;
			}

			if (result.status === "empty") {
				this.exportTree = null;
				this.missingNotesCount = 0;
				this.exportTreePromise = null;
				this.cachedDisplayTree = null;
				this.cachedDisplayTreeSource = null;
				this.renderExportTree();
				return null;
			}

			const exportTree = result.tree;

			this.exportTree = exportTree;
			this.treeIsStale = false;
			this.missingNotesCount = result.missingNotesCount;
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
		selectTree(node, this.selectedNodeIds);
	}

	/**
	 * Reconciles selection with the current tree after depth changes.
	 * @private
	 */
	private reconcileSelection(node: ExportNode) {
		reconcileContentSelectionState(
			this.selectedNodeIds,
			this.knownContentNodeIds,
			this.userDeselectedNodeIds,
			node,
			this.getLockedRootNodeIds()
		);
		this.enforceLockedRootSelection();
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
		markDeselectedTree(node, this.userDeselectedNodeIds, this.getLockedRootNodeIds());
	}

	/**
	 * Clears explicit user deselection for a node and its descendants.
	 * @private
	 */
	private clearUserDeselectedSubtree(node: ExportNode) {
		clearNodeIdsInSubtree(node, this.userDeselectedNodeIds);
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
		return createTreeCacheKey({
			sourceMode: this.sourceMode,
			selectedFile: this.selectedFile,
			selectedTag: this.selectedTag,
			addedNotes: this.addedNotes,
			contentDepth: this.contentDepth,
			titleDepth: this.titleDepth,
			linkTraversalMode: this.linkTraversalMode,
			settings: this.settings,
		});
	}

	/**
	 * Keeps the export tree cache bounded.
	 * @private
	 */
	private enforceCacheLimit() {
		while (this.exportTreeCache.size > MAX_TREE_CACHE_ENTRIES) {
			const firstKey = this.exportTreeCache.keys().next().value!;
			this.exportTreeCache.delete(firstKey);
		}
	}

	/**
	 * Collapses all nodes in the tree by default.
	 * @private
	 */
	private collapseRootOnly(node: ExportNode) {
		collapseTreeRoot(node, this.collapsedNodeIds);
	}

	/**
	 * Collapses all nodes in the tree.
	 * @private
	 */
	private collapseAllNodes(node: ExportNode) {
		collapseTree(node, this.collapsedNodeIds);
	}

	/**
	 * Expands all nodes in the tree.
	 * @private
	 */
	private expandAllNodes(node: ExportNode) {
		expandTree(node, this.collapsedNodeIds);
	}

	private clearRenderedTreeState() {
		this.renderedDisplayTree = null;
		this.renderedRowElements.clear();
		this.renderedCheckboxElements.clear();
		this.renderedToggleElements.clear();
		this.renderedChildListElements.clear();
		this.renderedAncestorIds.clear();
	}

	private getLockedRootNodeIds(): Set<string> {
		return this.sourceMode === "note" && this.selectedFile
			? new Set([this.selectedFile.path])
			: new Set();
	}

	private isPrimaryRootNode(node: ExportNode): boolean {
		return this.sourceMode === "note" && this.selectedFile?.path === node.id;
	}

	private enforceLockedRootSelection() {
		if (this.sourceMode !== "note" || !this.selectedFile) {
			return;
		}
		this.selectedNodeIds.add(this.selectedFile.path);
		this.userDeselectedNodeIds.delete(this.selectedFile.path);
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

		const currentAncestorIds = this.renderedAncestorIds.get(node.id) ?? [];
		const childAncestorIds = node.includeContent
			? [...currentAncestorIds, node.id]
			: currentAncestorIds;
		const parentSelected =
			this.getNodeParentSelectedState(node.id) &&
			(!node.includeContent || this.selectedNodeIds.has(node.id));
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
		this.enforceLockedRootSelection();
		this.refreshRenderedSelectionNode(this.renderedDisplayTree, true, true);
		this.updateTreeSummary(this.renderedDisplayTree);
	}

	private refreshRenderedSelectionNode(node: ExportNode, parentSelected: boolean, isRoot: boolean) {
		const isPrimaryRootNode = this.isPrimaryRootNode(node);
		const isLockedRoot = isRoot || isPrimaryRootNode;
		if (isLockedRoot && node.includeContent) {
			this.selectedNodeIds.add(node.id);
			this.userDeselectedNodeIds.delete(node.id);
		}
		const isSelected = !node.includeContent || isLockedRoot || this.selectedNodeIds.has(node.id);
		const isExcluded = !parentSelected || (node.includeContent && !isLockedRoot && !isSelected);

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

		const nextParentSelected = parentSelected && isSelected;
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

		if (!this.hasExportSource()) {
			this.treeContainerEl.createDiv({
				cls: "smart-export-tree-placeholder",
				text: "Select a root note or tag to preview the export tree.",
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
		this.enforceLockedRootSelection();
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

		const isPrimaryRootNode = this.isPrimaryRootNode(node);
		const isLockedRoot = isRoot || isPrimaryRootNode;
		if (isLockedRoot) {
			this.selectedNodeIds.add(node.id);
			this.userDeselectedNodeIds.delete(node.id);
		}
		const isSelected = !node.includeContent || isLockedRoot || this.selectedNodeIds.has(node.id);
		const isExcluded = !parentSelected || (node.includeContent && !isLockedRoot && !isSelected);
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

		if (isLockedRoot || !node.includeContent) {
			const rootLabel = rowEl.createSpan({
				text: node.title,
				cls: "smart-export-tree-label smart-export-tree-root",
			});
			if (node.includeContent && this.settings.showTokenEstimatesInTree) {
				const tokenText = this.formatNodeTokenEstimate(node);
				rootLabel.createSpan({ text: tokenText, cls: "smart-export-tree-token" });
			}
			if (hasChildren && isRoot) {
				rootLabel.addClass("smart-export-tree-root--toggle");
				setTooltip(
					rootLabel,
					"Click to expand or collapse. Shift-click to toggle between this note and all notes."
				);
				rootLabel.addEventListener("click", (event) => {
					event.preventDefault();
					event.stopPropagation();
					if (!this.exportTree || !isRoot) {
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
						this.enforceLockedRootSelection();
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
				const childAncestorIds = node.includeContent
					? [...ancestorIdsSnapshot, node.id]
					: ancestorIdsSnapshot;
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
		return formatTokenEstimate(tokenCount);
	}

	/**
	 * Creates a DOM-safe id from an arbitrary string.
	 * @private
	 */
	private getDomSafeId(value: string): string {
		return createDomSafeId(value);
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
		return createContentDisplayTree(node);
	}

	/**
	 * Counts total and selected nodes in the tree.
	 * @private
	 */
	private countTreeNodes(node: ExportNode): { total: number; selected: number } {
		return countTreeContentNodes(node, this.selectedNodeIds);
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
