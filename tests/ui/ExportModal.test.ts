import { App, TFile } from "obsidian";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { noticeMessages } from "../mocks/obsidian";
import { DEFAULT_SETTINGS } from "../../src/settings/defaultSettings";
import { TagDiscoveryService } from "../../src/tagDiscovery";
import { ExportNode, SmartExportSettings } from "../../src/types";
import { LlmMarkdownTemplateOption } from "../../src/utils/llmMarkdownTemplateResolver";

type TraversalResult =
	ExportNode | null | Error | (() => ExportNode | null | Promise<ExportNode | null>);
type TraversalPlan = {
	traverse?: TraversalResult;
	traverseTag?: TraversalResult;
	missing?: string[];
};

const mocks = vi.hoisted(() => ({
	traversalPlans: [] as TraversalPlan[],
	traversalArguments: [] as unknown[][],
	traverseCalls: [] as string[],
	traverseTagCalls: [] as string[],
	getNoteContent: vi.fn<(path: string) => Promise<string>>(),
	listTemplateOptions: vi.fn(),
	resolveTemplate: vi.fn(),
	buildExportOutput: vi.fn(),
	estimatePrintFriendly: vi.fn(),
	createExportNote: vi.fn(),
	rootPickerCallbacks: [] as Array<(file: TFile) => void>,
	rootPickerOpen: vi.fn(),
	tagPickerCallbacks: [] as Array<(tag: string) => void>,
	tagPickerOpen: vi.fn(),
	destinationArguments: [] as unknown[][],
	destinationOpen: vi.fn(),
}));

async function resolveTraversalResult(
	result: TraversalResult | undefined
): Promise<ExportNode | null> {
	if (result instanceof Error) {
		throw result;
	}
	if (typeof result === "function") {
		return result();
	}
	return result ?? null;
}

vi.mock("../../src/engine/BFSTraversal", () => ({
	BFSTraversal: class MockBFSTraversal {
		private readonly plan: TraversalPlan;

		constructor(...args: unknown[]) {
			mocks.traversalArguments.push(args);
			this.plan = mocks.traversalPlans.shift() ?? {};
		}

		async traverse(path: string): Promise<ExportNode | null> {
			mocks.traverseCalls.push(path);
			return resolveTraversalResult(this.plan.traverse);
		}

		async traverseTag(tag: string): Promise<ExportNode | null> {
			mocks.traverseTagCalls.push(tag);
			return resolveTraversalResult(this.plan.traverseTag);
		}

		getMissingNotes(): string[] {
			return this.plan.missing ?? [];
		}
	},
}));

vi.mock("../../src/obsidian-api", () => ({
	ObsidianAPI: class MockObsidianAPI {
		async getNoteContent(path: string): Promise<string> {
			return mocks.getNoteContent(path);
		}
	},
}));

vi.mock("../../src/utils/llmMarkdownTemplateResolver", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../src/utils/llmMarkdownTemplateResolver")>()),
	listLlmMarkdownTemplateOptions: mocks.listTemplateOptions,
	resolveLlmMarkdownTemplate: mocks.resolveTemplate,
}));

vi.mock("../../src/engine/exportOutput", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../src/engine/exportOutput")>()),
	buildExportOutput: mocks.buildExportOutput,
}));

vi.mock("../../src/utils/printFriendlyMarkdownEstimate", () => ({
	estimatePrintFriendlyMarkdownCharacterCount: mocks.estimatePrintFriendly,
}));

vi.mock("../../src/utils/exportNote", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../src/utils/exportNote")>()),
	createExportNote: mocks.createExportNote,
}));

vi.mock("../../src/ui/RootNoteSuggestModal", () => ({
	RootNoteSuggestModal: class MockRootNoteSuggestModal {
		constructor(_app: App, callback: (file: TFile) => void) {
			mocks.rootPickerCallbacks.push(callback);
		}

		open(): void {
			mocks.rootPickerOpen();
		}
	},
}));

vi.mock("../../src/ui/TagSuggestModal", () => ({
	TagSuggestModal: class MockTagSuggestModal {
		constructor(_app: App, _tagDiscovery: TagDiscoveryService, callback: (tag: string) => void) {
			mocks.tagPickerCallbacks.push(callback);
		}

		open(): void {
			mocks.tagPickerOpen();
		}
	},
}));

vi.mock("../../src/ui/ExportNoteDestinationModal", () => ({
	ExportNoteDestinationModal: class MockExportNoteDestinationModal {
		constructor(...args: unknown[]) {
			mocks.destinationArguments.push(args);
		}

		open(): void {
			mocks.destinationOpen();
		}
	},
}));

import { ExportModal } from "../../src/ui/ExportModal";

type AddedItem =
	{ kind: "note"; file: TFile; mode: "single-note" | "extra-root" } | { kind: "tag"; tag: string };

type PreparedOutput = {
	rootFile: TFile | null;
	sourceName: string;
	output: string;
	tokenCount: number;
};

type ExportModalInternals = {
	selectedFile: TFile | null;
	sourceMode: "note" | "tag";
	selectedTag: string;
	sourceControlsEl: HTMLElement;
	selectedFileEl: HTMLElement;
	addedNotes: AddedItem[];
	addedNotesListEl: HTMLElement;
	addedNotesDescriptionEl: HTMLElement;
	contentDepth: number;
	titleDepth: number;
	linkTraversalMode: "outgoing" | "incoming" | "both";
	exportFormat: "xml" | "llm-markdown" | "print-friendly-markdown";
	selectedLlmTemplateId: string;
	llmTemplateOptions: LlmMarkdownTemplateOption[];
	tokenCountEl: HTMLElement;
	exportTree: ExportNode | null;
	exportTreePromise: Promise<ExportNode | null> | null;
	exportTreeCache: Map<string, { tree: ExportNode; missingNotes: number }>;
	exportTreeCacheKey: string | null;
	missingNotesCount: number;
	selectedNodeIds: Set<string>;
	knownContentNodeIds: Set<string>;
	userDeselectedNodeIds: Set<string>;
	collapsedNodeIds: Set<string>;
	treeIsStale: boolean;
	shouldApplyDefaultCollapse: boolean;
	shouldSelectAllOnBuild: boolean;
	treeContainerEl: HTMLElement;
	treeSummaryEl: HTMLElement;
	treeBuildId: number;
	tokenCalculationId: number;
	cachedDisplayTree: ExportNode | null;
	cachedDisplayTreeSource: ExportNode | null;
	renderedDisplayTree: ExportNode | null;
	renderedRowElements: Map<string, HTMLElement>;
	renderedCheckboxElements: Map<string, HTMLInputElement>;
	renderedToggleElements: Map<string, HTMLButtonElement>;
	renderedChildListElements: Map<string, HTMLElement>;
	renderedAncestorIds: Map<string, string[]>;
	calculateAndDisplayTokens(): Promise<void>;
	reloadLlmTemplateOptions(): Promise<void>;
	getAvailableLlmTemplateOptions(): LlmMarkdownTemplateOption[];
	getCurrentExportChoiceValue(): string;
	applyExportChoiceOptions(): void;
	applyExportChoiceSelection(value: string): void;
	prepareExportOutput(): Promise<PreparedOutput | null>;
	onExportToClipboard(): Promise<void>;
	onExportToNewNote(): Promise<void>;
	estimateTokens(text: string): number;
	estimateTokensFromCharacterCount(count: number): number;
	estimateExportTokens(root: ExportNode): number;
	estimateExportCharacterCount(root: ExportNode): number;
	flattenExportTree(root: ExportNode): ExportNode[];
	getSelectedTag(): string;
	hasExportSource(): boolean;
	getExportSourceName(): string;
	getExportTreeFailureMessage(): string;
	renderSourceControls(): void;
	updateSelectedFile(): void;
	updateAddedNotesDescription(): void;
	openAddedNotePicker(mode: "single-note" | "extra-root"): void;
	openAddedTagPicker(): void;
	addExportNote(file: TFile, mode: "single-note" | "extra-root"): void;
	addExportTag(tag: string): void;
	renderAddedNotesList(): void;
	getAddedItemTitle(item: AddedItem): string;
	getAddedItemPathText(item: AddedItem): string;
	getAddedItemScopeText(item: AddedItem): string;
	invalidateExportTree(options?: { resetSelection?: boolean }): void;
	ensureExportTree(): Promise<ExportNode | null>;
	buildExportTree(buildId: number): Promise<ExportNode | null>;
	selectAllNodes(node: ExportNode): void;
	reconcileSelection(node: ExportNode): void;
	reconcileCollapsed(node: ExportNode): void;
	markUserDeselectedSubtree(node: ExportNode): void;
	clearUserDeselectedSubtree(node: ExportNode): void;
	clearUserDeselectedAncestors(ids: string[]): void;
	getTreeCacheKey(): string;
	enforceCacheLimit(): void;
	collapseRootOnly(node: ExportNode): void;
	collapseAllNodes(node: ExportNode): void;
	expandAllNodes(node: ExportNode): void;
	clearRenderedTreeState(): void;
	getLockedRootNodeIds(): Set<string>;
	isPrimaryRootNode(node: ExportNode): boolean;
	enforceLockedRootSelection(): void;
	getNodeParentSelectedState(nodeId: string): boolean;
	renderNodeChildrenIfNeeded(node: ExportNode): void;
	updateCollapseUI(node: ExportNode): void;
	refreshRenderedSelectionUI(): void;
	refreshRenderedSelectionNode(node: ExportNode, parentSelected: boolean, isRoot: boolean): void;
	updateTreeSummary(tree: ExportNode): void;
	renderExportTree(): void;
	renderExportTreeNode(
		node: ExportNode,
		container: HTMLElement,
		parentSelected: boolean,
		isRoot?: boolean,
		ancestorIds?: string[]
	): void;
	formatNodeTokenEstimate(node: ExportNode): string;
	formatTokenCountMessage(count: number): string;
	getDomSafeId(value: string): string;
	getNodeChildrenListId(value: string): string;
	getContentDisplayTree(node: ExportNode): ExportNode | null;
	buildContentDisplayTree(node: ExportNode): ExportNode | null;
	countTreeNodes(node: ExportNode): { total: number; selected: number };
};

function createFile(path: string): TFile {
	const file = new TFile();
	file.path = path;
	file.name = path.split("/").pop() ?? path;
	file.basename = file.name.replace(/\.md$/i, "");
	file.extension = "md";
	file.stat = { ctime: 1, mtime: 1, size: 1 };
	file.parent = null;
	return file;
}

function createNode(
	id: string,
	children: ExportNode[] = [],
	options: Partial<ExportNode> = {}
): ExportNode {
	return {
		id,
		title: id.replace(/\.md$/, ""),
		depth: 0,
		includeContent: true,
		content: `${id} content`,
		children,
		tokenCount: 0,
		lastModified: new Date(0),
		...options,
	};
}

function createSettings(overrides: Partial<SmartExportSettings> = {}): SmartExportSettings {
	return {
		...DEFAULT_SETTINGS,
		ignoredTraversalFolders: [...DEFAULT_SETTINGS.ignoredTraversalFolders],
		ignoredTraversalTagPatterns: [...DEFAULT_SETTINGS.ignoredTraversalTagPatterns],
		ignoredTraversalPropertyRules: [...DEFAULT_SETTINGS.ignoredTraversalPropertyRules],
		redactionRegexPatterns: [...DEFAULT_SETTINGS.redactionRegexPatterns],
		...overrides,
	};
}

function createApp(activeFile: TFile | null = null): App {
	const app = new App();
	Object.assign(app, {
		workspace: {
			getActiveFile: vi.fn(() => activeFile),
		},
		vault: {
			getName: vi.fn(() => "Test vault"),
		},
	});
	return app;
}

function createModal(
	settings: Partial<SmartExportSettings> = {},
	activeFile: TFile | null = null
): { modal: ExportModal; internals: ExportModalInternals } {
	const tagDiscovery = {
		getAvailableTags: vi.fn(() => ["project"]),
	} as unknown as TagDiscoveryService;
	const modal = new ExportModal(createApp(activeFile), createSettings(settings), tagDiscovery);
	return { modal, internals: modal as unknown as ExportModalInternals };
}

function findButton(container: HTMLElement, text: string): HTMLButtonElement {
	const button = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
		(candidate) => candidate.textContent === text
	);
	if (!button) {
		throw new Error(`Missing button: ${text}`);
	}
	return button;
}

describe("ExportModal", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
		noticeMessages.length = 0;
		mocks.traversalPlans.length = 0;
		mocks.traversalArguments.length = 0;
		mocks.traverseCalls.length = 0;
		mocks.traverseTagCalls.length = 0;
		mocks.rootPickerCallbacks.length = 0;
		mocks.tagPickerCallbacks.length = 0;
		mocks.destinationArguments.length = 0;
		mocks.getNoteContent.mockResolvedValue("standalone content");
		mocks.listTemplateOptions.mockResolvedValue([
			{ id: "builtin:default", label: "LLM-ready", source: "builtin" },
			{ id: "user:Templates/custom.md", label: "custom", source: "user" },
		]);
		mocks.resolveTemplate.mockResolvedValue({ template: "CUSTOM TEMPLATE" });
		mocks.buildExportOutput.mockReturnValue("OUTPUT");
		mocks.estimatePrintFriendly.mockReturnValue(321);
		mocks.createExportNote.mockResolvedValue({ path: "Exports/result.md" });
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: undefined,
		});
	});

	afterEach(() => {
		vi.clearAllTimers();
		vi.useRealTimers();
	});

	it("renders all controls, auto-selects the active note, and enforces depth invariants", async () => {
		const activeFile = createFile("Folder/Root.md");
		const { modal, internals } = createModal({}, activeFile);
		const calculateTokens = vi.spyOn(internals, "calculateAndDisplayTokens").mockResolvedValue();

		modal.onOpen();
		await Promise.resolve();
		expect(modal.contentEl.textContent).toContain("Smart export");
		expect(internals.selectedFile).toBe(activeFile);
		expect(internals.selectedFileEl.textContent).toBe("Selected: Root");
		expect(findButton(modal.contentEl, "Export to clipboard").classList).toContain("mod-cta");

		const sliders = modal.contentEl.querySelectorAll<HTMLInputElement>('input[type="range"]');
		sliders.item(0).value = "10";
		sliders.item(0).dispatchEvent(new Event("input"));
		expect(internals.contentDepth).toBe(10);
		expect(internals.titleDepth).toBe(10);
		sliders.item(1).value = "4";
		sliders.item(1).dispatchEvent(new Event("input"));
		expect(internals.contentDepth).toBe(4);
		expect(internals.titleDepth).toBe(4);
		sliders.item(0).value = "3";
		sliders.item(0).dispatchEvent(new Event("input"));
		sliders.item(1).value = "5";
		sliders.item(1).dispatchEvent(new Event("input"));
		expect(internals.contentDepth).toBe(3);
		expect(internals.titleDepth).toBe(5);
		vi.advanceTimersByTime(500);
		await Promise.resolve();
		expect(calculateTokens).toHaveBeenCalled();

		const selects = modal.contentEl.querySelectorAll("select");
		const linkDirection = selects.item(1);
		for (const value of ["incoming", "both", "invalid"]) {
			linkDirection.value = value;
			linkDirection.dispatchEvent(new Event("change"));
		}
		expect(internals.linkTraversalMode).toBe("outgoing");
		const outputChoice = selects.item(2);
		outputChoice.value = "format:print-friendly-markdown";
		outputChoice.dispatchEvent(new Event("change"));
		expect(internals.exportFormat).toBe("print-friendly-markdown");

		findButton(modal.contentEl, "Expand all").click();
		findButton(modal.contentEl, "Collapse all").click();
		modal.onClose();
		expect(modal.contentEl.childElementCount).toBe(0);

		const noteDefault = createModal({
			autoSelectCurrentNote: false,
			defaultExportTarget: "new-note",
		});
		noteDefault.modal.onOpen();
		expect(findButton(noteDefault.modal.contentEl, "Export to new note").classList).toContain(
			"mod-cta"
		);

		const emptyAutoSelection = createModal();
		emptyAutoSelection.modal.onOpen();
		expect(emptyAutoSelection.internals.selectedFile).toBeNull();
	});

	it("supports both source pickers and all extra-note row actions", async () => {
		const root = createFile("Root.md");
		const extra = createFile("Folder/Extra.md");
		const other = createFile("Folder/Other.md");
		const { modal, internals } = createModal({ autoSelectCurrentNote: false });
		modal.onOpen();

		findButton(modal.contentEl, "Select").click();
		mocks.rootPickerCallbacks[0]?.(root);
		expect(internals.selectedFile).toBe(root);
		internals.openAddedNotePicker("single-note");
		mocks.rootPickerCallbacks[1]?.(extra);
		internals.openAddedTagPicker();
		mocks.tagPickerCallbacks[0]?.(" #Project ");
		await Promise.resolve();
		expect(internals.addedNotes).toHaveLength(2);
		expect(internals.getAddedItemTitle(internals.addedNotes[1])).toBe("#project");
		expect(internals.getAddedItemPathText(internals.addedNotes[1])).toBe("Tag");
		expect(internals.getAddedItemScopeText(internals.addedNotes[1])).toContain("Tag:");
		expect(internals.getAddedItemScopeText(internals.addedNotes[0])).toContain("Single note:");

		internals.addExportNote(root, "single-note");
		internals.addExportNote(extra, "extra-root");
		internals.addExportTag(" ");
		expect(noticeMessages).toEqual(
			expect.arrayContaining([
				"That note is already the root note.",
				"That note is already added.",
				"That tag could not be added.",
			])
		);

		findButton(internals.addedNotesListEl, "Use as new root").click();
		expect(internals.getAddedItemScopeText(internals.addedNotes[0])).toContain("New root:");
		findButton(internals.addedNotesListEl, "Use as single note").click();
		findButton(internals.addedNotesListEl, "Remove").click();

		const sourceDropdown = modal.contentEl.querySelectorAll("select").item(0);
		sourceDropdown.value = "tag";
		sourceDropdown.dispatchEvent(new Event("change"));
		findButton(modal.contentEl, "Select tag").click();
		mocks.tagPickerCallbacks[mocks.tagPickerCallbacks.length - 1]?.("project");
		expect(internals.selectedFileEl.textContent).toBe("Selected tag: #project");
		internals.addExportTag("project");
		internals.addExportTag("other");
		internals.addExportTag("#other");
		expect(noticeMessages).toEqual(
			expect.arrayContaining([
				"That tag is already the export source.",
				"That tag is already added.",
			])
		);

		sourceDropdown.value = "unexpected";
		sourceDropdown.dispatchEvent(new Event("change"));
		internals.addExportNote(other, "extra-root");
		internals.selectedFile = other;
		internals.updateSelectedFile();
		expect(internals.addedNotes.some((item) => item.kind === "note" && item.file === other)).toBe(
			false
		);
	});

	it("wires action buttons and reports token states without a source, errors, and stale work", async () => {
		const unopened = createModal({ defaultLlmTemplateId: " " });
		unopened.internals.renderSourceControls();
		expect(unopened.internals.selectedLlmTemplateId).toBe("builtin:default");

		const { modal, internals } = createModal({ autoSelectCurrentNote: false });
		modal.onOpen();
		findButton(modal.contentEl, "Add single note").click();
		findButton(modal.contentEl, "Add new root").click();
		findButton(modal.contentEl, "Add tag").click();
		expect(mocks.rootPickerOpen).toHaveBeenCalledTimes(2);
		expect(mocks.tagPickerOpen).toHaveBeenCalledOnce();

		findButton(modal.contentEl, "Export to clipboard").click();
		findButton(modal.contentEl, "Export to new note").click();
		await Promise.resolve();
		expect(noticeMessages).toContain("Please select a root note or tag first.");

		await internals.calculateAndDisplayTokens();
		expect(internals.tokenCountEl.textContent).toBe("Token estimate: not available");

		const tree = createNode("Root.md");
		internals.selectedFile = createFile("Root.md");
		internals.ensureExportTree = vi
			.fn<() => Promise<ExportNode | null>>()
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce(tree);
		await internals.calculateAndDisplayTokens();
		expect(internals.tokenCountEl.textContent).toBe("Token estimate: error");
		internals.selectedNodeIds.add("Root.md");
		await internals.calculateAndDisplayTokens();
		expect(internals.tokenCountEl.textContent).toContain("Estimated tokens:");

		let resolveTree: ((tree: ExportNode) => void) | undefined;
		const pendingTree = new Promise<ExportNode>((resolve) => {
			resolveTree = resolve;
		});
		internals.ensureExportTree = vi.fn(() => pendingTree);
		const calculation = internals.calculateAndDisplayTokens();
		internals.tokenCalculationId += 1;
		resolveTree?.(tree);
		await calculation;
	});

	it("manages template choices and token estimation helpers", async () => {
		const { modal, internals } = createModal({
			autoSelectCurrentNote: false,
			defaultLlmTemplateId: "missing",
			defaultExportFormat: "llm-markdown",
		});
		internals.applyExportChoiceOptions();
		expect(internals.getAvailableLlmTemplateOptions()).toEqual([
			{ id: "builtin:default", label: "LLM-ready", source: "builtin" },
		]);

		modal.onOpen();
		await internals.reloadLlmTemplateOptions();
		expect(internals.selectedLlmTemplateId).toBe("builtin:default");
		expect(internals.getAvailableLlmTemplateOptions()).toHaveLength(2);
		internals.applyExportChoiceSelection("format:xml");
		expect(internals.getCurrentExportChoiceValue()).toBe("format:xml");
		internals.applyExportChoiceSelection("format:print-friendly-markdown");
		expect(internals.getCurrentExportChoiceValue()).toBe("format:print-friendly-markdown");
		internals.applyExportChoiceSelection("template:");
		expect(internals.selectedLlmTemplateId).toBe("builtin:default");
		internals.applyExportChoiceSelection("template:user:Templates/custom.md");
		expect(internals.getCurrentExportChoiceValue()).toBe("template:user:Templates/custom.md");
		internals.applyExportChoiceSelection("unknown");

		expect(internals.estimateTokens("12345")).toBe(2);
		expect(internals.estimateTokensFromCharacterCount(0)).toBe(0);
		expect(internals.formatTokenCountMessage(1)).toBe("Estimated tokens: ~1");
		expect(internals.formatTokenCountMessage(100_001)).toContain("large export");
		expect(internals.formatTokenCountMessage(128_001)).toContain("may exceed");
		expect(internals.formatTokenCountMessage(200_001)).toContain("exceeds most");
		expect(internals.getDomSafeId("a path/#heading")).toBe("a-path-heading");
		expect(internals.getNodeChildrenListId("a/b")).toBe("smart-export-tree-children-a-b");
	});

	it("builds and caches a composed tree with tag, extra-root, and standalone additions", async () => {
		const rootFile = createFile("Root.md");
		const extraFile = createFile("Extra.md");
		const singleFile = createFile("Single.md");
		const primary = createNode("Root.md", [createNode("Child.md", [], { depth: 1 })]);
		const tagTree = createNode("tag:project", [createNode("Tagged.md")], { synthetic: true });
		const extraTree = createNode("Extra.md");
		mocks.traversalPlans.push(
			{ traverse: primary, missing: ["missing-a"] },
			{ traverseTag: tagTree, missing: ["missing-b"] },
			{ traverse: extraTree, missing: ["missing-a", "missing-c"] }
		);
		const { modal, internals } = createModal({ autoSelectCurrentNote: false });
		modal.onOpen();
		internals.selectedFile = rootFile;
		internals.addedNotes = [
			{ kind: "tag", tag: "project" },
			{ kind: "note", file: extraFile, mode: "extra-root" },
			{ kind: "note", file: singleFile, mode: "single-note" },
		];
		internals.treeBuildId = 7;

		const tree = await internals.buildExportTree(7);

		expect(tree?.synthetic).toBe(true);
		expect(mocks.traverseCalls).toEqual(["Root.md", "Extra.md"]);
		expect(mocks.traverseTagCalls).toEqual(["project"]);
		expect(mocks.getNoteContent).toHaveBeenCalledWith("Single.md");
		expect(internals.missingNotesCount).toBe(3);
		expect(internals.exportTreeCache.size).toBe(1);
		expect(internals.selectedNodeIds.size).toBeGreaterThan(0);
		expect(internals.collapsedNodeIds.size).toBeGreaterThan(0);

		const cacheKey = internals.getTreeCacheKey();
		expect(cacheKey).toContain('added:[["tag","project"],["note","Extra.md","extra-root"]');
		internals.treeIsStale = false;
		internals.exportTreeCacheKey = cacheKey;
		await expect(internals.ensureExportTree()).resolves.toBe(tree);
		internals.exportTree = null;
		internals.treeIsStale = true;
		await expect(internals.ensureExportTree()).resolves.toBe(tree);
	});

	it("continues when an extra traversal has no root tree", async () => {
		const rootFile = createFile("Root.md");
		const extraFile = createFile("Missing extra.md");
		const primary = createNode("Root.md");
		mocks.traversalPlans.push({ traverse: primary }, { traverse: null });
		const { modal, internals } = createModal({ autoSelectCurrentNote: false });
		modal.onOpen();
		internals.selectedFile = rootFile;
		internals.addedNotes = [{ kind: "note", file: extraFile, mode: "extra-root" }];
		internals.treeBuildId = 8;

		await expect(internals.buildExportTree(8)).resolves.toBe(primary);
		expect(mocks.traverseCalls).toEqual(["Root.md", "Missing extra.md"]);
	});

	it("handles missing, stale, and failed tree builds", async () => {
		const root = createFile("Root.md");
		const { modal, internals } = createModal({ autoSelectCurrentNote: false });
		modal.onOpen();
		await expect(internals.ensureExportTree()).resolves.toBeNull();
		await expect(internals.buildExportTree(0)).resolves.toBeNull();

		internals.selectedFile = root;
		internals.treeBuildId = 2;
		mocks.traversalPlans.push({ traverse: createNode("Root.md") });
		await expect(internals.buildExportTree(1)).resolves.toBeNull();

		mocks.traversalPlans.push({ traverse: null });
		await expect(internals.buildExportTree(2)).resolves.toBeNull();

		mocks.traversalPlans.push({ traverse: new Error("traversal failed") });
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		await expect(internals.buildExportTree(2)).resolves.toBeNull();
		expect(noticeMessages).toContain("Failed to build export tree. See console for details.");
		expect(error).toHaveBeenCalled();
		error.mockRestore();

		const pending = Promise.resolve(createNode("Pending.md"));
		internals.exportTreePromise = pending;
		await expect(internals.ensureExportTree()).resolves.toEqual(createNode("Pending.md"));
	});

	it("discards stale tag, extra-root, and standalone work and preserves an existing selection", async () => {
		const rootFile = createFile("Root.md");
		const extraFile = createFile("Extra.md");
		const singleFile = createFile("Single.md");
		const primary = createNode("Root.md");
		const { modal, internals } = createModal({ autoSelectCurrentNote: false });
		modal.onOpen();
		internals.selectedFile = rootFile;

		internals.treeBuildId = 10;
		internals.addedNotes = [{ kind: "tag", tag: "project" }];
		mocks.traversalPlans.push(
			{ traverse: primary },
			{
				traverseTag: () => {
					internals.treeBuildId += 1;
					return createNode("tag:project", [], { synthetic: true });
				},
			}
		);
		await expect(internals.buildExportTree(10)).resolves.toBeNull();

		internals.treeBuildId = 20;
		internals.addedNotes = [{ kind: "note", file: extraFile, mode: "extra-root" }];
		mocks.traversalPlans.push(
			{ traverse: primary },
			{
				traverse: () => {
					internals.treeBuildId += 1;
					return createNode("Extra.md");
				},
			}
		);
		await expect(internals.buildExportTree(20)).resolves.toBeNull();

		internals.treeBuildId = 30;
		internals.addedNotes = [{ kind: "note", file: singleFile, mode: "single-note" }];
		mocks.traversalPlans.push({ traverse: primary });
		mocks.getNoteContent.mockImplementationOnce(async () => {
			internals.treeBuildId += 1;
			return "content";
		});
		await expect(internals.buildExportTree(30)).resolves.toBeNull();

		internals.treeBuildId = 40;
		internals.addedNotes = [];
		internals.shouldSelectAllOnBuild = false;
		internals.shouldApplyDefaultCollapse = false;
		internals.selectedNodeIds = new Set(["kept"]);
		mocks.traversalPlans.push({ traverse: primary });
		await expect(internals.buildExportTree(40)).resolves.toBe(primary);
		expect(internals.selectedNodeIds.has("kept")).toBe(true);
		expect(internals.selectedNodeIds.has("Root.md")).toBe(true);
	});

	it("bounds cache state and reconciles recursive selection and collapse state", () => {
		const leaf = createNode("Leaf.md");
		const child = createNode("Child.md", [leaf]);
		const root = createNode("Root.md", [child]);
		const { modal, internals } = createModal({ autoSelectCurrentNote: false });
		modal.onOpen();
		internals.selectedFile = createFile("Root.md");
		internals.selectAllNodes(root);
		expect(internals.countTreeNodes(root)).toEqual({ total: 3, selected: 3 });
		internals.markUserDeselectedSubtree(root);
		expect(internals.userDeselectedNodeIds.has("Root.md")).toBe(false);
		expect(internals.userDeselectedNodeIds.has("Child.md")).toBe(true);
		internals.clearUserDeselectedAncestors(["Child.md"]);
		internals.clearUserDeselectedSubtree(root);
		expect(internals.userDeselectedNodeIds.size).toBe(0);

		internals.collapseRootOnly(root);
		internals.collapseRootOnly(leaf);
		internals.collapseAllNodes(root);
		expect(internals.collapsedNodeIds).toEqual(new Set(["Root.md", "Child.md"]));
		internals.expandAllNodes(root);
		expect(internals.collapsedNodeIds.size).toBe(0);
		internals.shouldApplyDefaultCollapse = true;
		internals.reconcileCollapsed(root);
		internals.reconcileCollapsed(root);
		internals.reconcileSelection(root);

		for (let index = 0; index < 7; index += 1) {
			internals.exportTreeCache.set(`key-${index}`, { tree: root, missingNotes: index });
		}
		internals.enforceCacheLimit();
		expect([...internals.exportTreeCache.keys()]).toEqual([
			"key-2",
			"key-3",
			"key-4",
			"key-5",
			"key-6",
		]);
	});

	it("renders lazy tree branches and supports mouse and shift selection", () => {
		const leaf = createNode("Leaf.md", [], { depth: 2, includeContent: false });
		const child = createNode("Child.md", [leaf], { depth: 1 });
		const sibling = createNode("Sibling.md", [], { depth: 1, content: undefined });
		const root = createNode("Root.md", [child, sibling]);
		const { modal, internals } = createModal({
			autoSelectCurrentNote: false,
			showTokenEstimatesInTree: true,
		});
		modal.onOpen();
		internals.selectedFile = createFile("Root.md");
		internals.exportTree = root;
		internals.treeIsStale = false;
		internals.selectAllNodes(root);
		internals.collapsedNodeIds.add("Root.md");
		internals.renderExportTree();
		expect(internals.treeSummaryEl.textContent).toContain("3 of 3");
		expect(internals.renderedChildListElements.get("Root.md")?.childElementCount).toBe(0);

		internals.renderedToggleElements.get("Root.md")?.click();
		expect(internals.renderedChildListElements.get("Root.md")?.childElementCount).toBe(2);
		internals.renderedToggleElements.get("Root.md")?.click();
		internals.renderedToggleElements.get("Root.md")?.click();
		const childCheckbox = internals.renderedCheckboxElements.get("Child.md");
		if (!childCheckbox) throw new Error("Missing child checkbox");
		childCheckbox.checked = true;
		childCheckbox.click();
		expect(internals.userDeselectedNodeIds.has("Child.md")).toBe(true);
		childCheckbox.click();
		expect(internals.selectedNodeIds.has("Child.md")).toBe(true);
		childCheckbox.dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true }));
		childCheckbox.dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true }));

		const rootLabel = internals.renderedRowElements
			.get("Root.md")
			?.querySelector<HTMLElement>(".smart-export-tree-root--toggle");
		internals.exportTree = null;
		rootLabel?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		internals.exportTree = root;
		rootLabel?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		rootLabel?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		rootLabel?.dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true }));
		rootLabel?.dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true }));

		findButton(modal.contentEl, "Collapse all").click();
		findButton(modal.contentEl, "Expand all").click();
		expect(internals.formatNodeTokenEstimate(child)).toBe(internals.formatNodeTokenEstimate(child));
		expect(internals.formatNodeTokenEstimate(leaf)).toContain("tokens");

		internals.renderedAncestorIds.set("orphan", ["not-selected"]);
		expect(internals.getNodeParentSelectedState("orphan")).toBe(false);
		internals.renderedAncestorIds.set("selected-child", ["Root.md"]);
		expect(internals.getNodeParentSelectedState("selected-child")).toBe(true);
		expect(internals.getNodeParentSelectedState("unknown")).toBe(true);
		internals.renderNodeChildrenIfNeeded(leaf);
		internals.renderNodeChildrenIfNeeded(child);
		internals.renderedChildListElements.delete("Child.md");
		internals.renderNodeChildrenIfNeeded(child);
		internals.refreshRenderedSelectionNode(child, false, false);
		expect(internals.renderedRowElements.get("Child.md")?.classList).toContain(
			"smart-export-tree-row--disabled"
		);

		const detachedList = document.body.createEl("ul");
		internals.renderExportTreeNode(createNode("Disabled.md"), detachedList, false);
		internals.renderExportTreeNode(
			createNode("Group", [createNode("Nested.md")], { includeContent: false }),
			detachedList,
			true
		);
		internals.renderExportTreeNode(
			createNode("Expanded.md", [createNode("Expanded child.md")]),
			detachedList,
			true
		);
		const lazyGroup = createNode("Lazy group", [createNode("Lazy child.md")], {
			includeContent: false,
		});
		internals.renderedChildListElements.set("Lazy group", document.body.createEl("ul"));
		internals.renderedAncestorIds.delete("Lazy group");
		internals.renderNodeChildrenIfNeeded(lazyGroup);

		internals.renderedToggleElements.delete("Child.md");
		internals.renderedChildListElements.delete("Child.md");
		internals.updateCollapseUI(child);

		const noEstimateModal = createModal({
			autoSelectCurrentNote: false,
			showTokenEstimatesInTree: false,
		});
		noEstimateModal.modal.onOpen();
		const noEstimateList = document.body.createEl("ul");
		noEstimateModal.internals.renderExportTreeNode(
			createNode("No estimate.md"),
			noEstimateList,
			true
		);
		expect(noEstimateList.querySelector(".smart-export-tree-token")).toBeNull();
	});

	it("renders every tree placeholder and content-only projection", () => {
		const { modal, internals } = createModal({ autoSelectCurrentNote: false });
		internals.renderExportTree();
		modal.onOpen();
		expect(internals.treeContainerEl.textContent).toContain("Select a root note or tag");
		expect(internals.getExportSourceName()).toBe("Smart export");
		expect(internals.getTreeCacheKey()).toContain("note:unknown");
		expect(internals.getLockedRootNodeIds()).toEqual(new Set());
		internals.enforceLockedRootSelection();
		internals.refreshRenderedSelectionUI();

		internals.selectedFile = createFile("Root.md");
		internals.exportTreePromise = Promise.resolve(null);
		internals.renderExportTree();
		expect(internals.treeContainerEl.textContent).toContain("Loading note tree");
		internals.exportTreePromise = null;
		internals.renderExportTree();
		expect(internals.treeContainerEl.textContent).toContain("Note tree will appear");

		const titleOnly = createNode("Title.md", [], { includeContent: false });
		internals.renderNodeChildrenIfNeeded(titleOnly);
		internals.exportTree = titleOnly;
		internals.treeIsStale = false;
		internals.renderExportTree();
		expect(internals.treeContainerEl.textContent).toContain("No notes with content");
		findButton(modal.contentEl, "Expand all").click();
		findButton(modal.contentEl, "Collapse all").click();
		expect(internals.getContentDisplayTree(titleOnly)).toBeNull();
		expect(internals.getContentDisplayTree(titleOnly)).toBeNull();

		const mixed = createNode("Synthetic", [createNode("Content.md")], {
			includeContent: false,
			synthetic: true,
		});
		expect(internals.buildContentDisplayTree(mixed)?.children).toHaveLength(1);
		internals.treeIsStale = true;
		internals.updateTreeSummary(mixed);
		expect(internals.treeSummaryEl.textContent).toBe("Updating note tree...");
	});

	it("prepares note and tag exports and covers all character-estimation formats", async () => {
		const child = createNode("Child.md", [], { depth: 1 });
		const titleOnly = createNode("Title.md", [], { depth: 2, includeContent: false });
		const root = createNode("Root.md", [child, titleOnly]);
		mocks.traversalPlans.push({ traverse: root });
		const rootFile = createFile("Root.md");
		const { modal, internals } = createModal({ autoSelectCurrentNote: false });
		modal.onOpen();
		internals.selectedFile = rootFile;
		internals.selectedNodeIds.add("Root.md");
		internals.selectedNodeIds.add("Child.md");

		mocks.buildExportOutput.mockImplementationOnce((options: { onInvalidFormat(): void }) => {
			options.onInvalidFormat();
			return "12345";
		});
		const prepared = await internals.prepareExportOutput();
		expect(prepared).toEqual({
			rootFile,
			sourceName: "Root",
			output: "12345",
			tokenCount: 2,
		});
		expect(noticeMessages).toContain("Unknown export format selected; falling back to XML.");
		internals.exportFormat = "llm-markdown";
		await internals.prepareExportOutput();
		expect(mocks.resolveTemplate).toHaveBeenCalledWith(
			modal.app,
			DEFAULT_SETTINGS.llmMarkdownTemplateDirectory,
			"builtin:default"
		);

		for (const format of ["xml", "llm-markdown", "print-friendly-markdown"] as const) {
			internals.exportFormat = format;
			expect(internals.estimateExportCharacterCount(root)).toBeGreaterThan(0);
		}
		internals.selectedNodeIds.add("Title.md");
		expect(internals.estimateExportTokens(root)).toBeGreaterThan(0);
		const emptyContent = createNode("Empty.md", [], { content: undefined });
		internals.selectedNodeIds.add("Empty.md");
		expect(internals.estimateExportCharacterCount(emptyContent)).toBeGreaterThan(0);
		internals.exportFormat = "invalid" as "xml";
		expect(internals.estimateExportCharacterCount(root)).toBeGreaterThan(0);
		expect(internals.flattenExportTree(createNode("Bundle", [root], { synthetic: true }))).toEqual([
			root,
			child,
			titleOnly,
		]);

		internals.sourceMode = "tag";
		internals.selectedTag = " #Project ";
		expect(internals.hasExportSource()).toBe(true);
		expect(internals.getExportSourceName()).toBe("Tag #project");
		expect(internals.getExportTreeFailureMessage()).toContain("No notes matched");
		internals.selectedTag = "";
		expect(internals.getExportSourceName()).toBe("Tag export");
	});

	it("handles missing sources and failed note/tag preparation", async () => {
		const { modal, internals } = createModal({ autoSelectCurrentNote: false });
		modal.onOpen();
		await expect(internals.prepareExportOutput()).resolves.toBeNull();
		expect(noticeMessages).toContain("Please select a root note or tag first.");

		internals.selectedFile = createFile("Root.md");
		mocks.traversalPlans.push({ traverse: null });
		await expect(internals.prepareExportOutput()).resolves.toBeNull();
		expect(internals.tokenCountEl.textContent).toBe("Export failed");

		internals.sourceMode = "tag";
		internals.selectedTag = "project";
		mocks.traversalPlans.push({ traverseTag: null });
		await expect(internals.prepareExportOutput()).resolves.toBeNull();
		expect(noticeMessages).toContain("No notes matched the selected tag after exclusions.");
	});

	it("exports to clipboard across unavailable, rejected, and successful states", async () => {
		const root = createNode("Root.md");
		const rootFile = createFile("Root.md");
		const { modal, internals } = createModal({ autoSelectCurrentNote: false });
		modal.onOpen();
		internals.selectedFile = rootFile;
		internals.exportTree = root;
		internals.treeIsStale = false;
		internals.exportTreeCacheKey = internals.getTreeCacheKey();

		await internals.onExportToClipboard();
		expect(noticeMessages).toContain("Clipboard is not available in this environment.");

		const writeText = vi
			.fn()
			.mockRejectedValueOnce(new Error("denied"))
			.mockResolvedValue(undefined);
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: { writeText },
		});
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		await internals.onExportToClipboard();
		expect(noticeMessages).toContain("Failed to copy export to clipboard.");
		await internals.onExportToClipboard();
		expect(noticeMessages).toContain("Export copied to clipboard.");

		const closing = createModal({ autoSelectCurrentNote: false, closeModalAfterExport: true });
		closing.modal.onOpen();
		closing.internals.selectedFile = rootFile;
		closing.internals.exportTree = root;
		closing.internals.treeIsStale = false;
		closing.internals.exportTreeCacheKey = closing.internals.getTreeCacheKey();
		await closing.internals.onExportToClipboard();
		expect(closing.modal.contentEl.childElementCount).toBe(0);
		error.mockRestore();
	});

	it("opens the destination flow and handles creation success and both error shapes", async () => {
		const root = createNode("Root.md");
		const rootFile = createFile("Root.md");
		const { modal, internals } = createModal({ autoSelectCurrentNote: false });
		modal.onOpen();
		internals.selectedFile = rootFile;
		internals.exportTree = root;
		internals.treeIsStale = false;
		internals.exportTreeCacheKey = internals.getTreeCacheKey();

		await internals.onExportToNewNote();
		expect(mocks.destinationOpen).toHaveBeenCalledOnce();
		const submit = mocks.destinationArguments[0]?.[3] as (destination: {
			folderPath: string;
			noteName: string;
		}) => Promise<boolean | void>;
		await expect(submit({ folderPath: "Exports", noteName: "result" })).resolves.toBeUndefined();
		expect(noticeMessages).toContain("Export note created: Exports/result.md");

		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		mocks.createExportNote.mockRejectedValueOnce(new Error("Destination exists"));
		await expect(submit({ folderPath: "Exports", noteName: "result" })).resolves.toBe(false);
		expect(noticeMessages).toContain("Destination exists");
		mocks.createExportNote.mockRejectedValueOnce("unknown");
		await expect(submit({ folderPath: "Exports", noteName: "result" })).resolves.toBe(false);
		expect(noticeMessages).toContain("Failed to create export note.");

		const closing = createModal({ autoSelectCurrentNote: false, closeModalAfterExport: true });
		closing.modal.onOpen();
		closing.internals.selectedFile = rootFile;
		closing.internals.exportTree = root;
		closing.internals.treeIsStale = false;
		closing.internals.exportTreeCacheKey = closing.internals.getTreeCacheKey();
		await closing.internals.onExportToNewNote();
		const closeSubmit = mocks.destinationArguments[
			mocks.destinationArguments.length - 1
		]?.[3] as (destination: { folderPath: string; noteName: string }) => Promise<void>;
		await closeSubmit({ folderPath: "", noteName: "result" });
		expect(closing.modal.contentEl.childElementCount).toBe(0);
		error.mockRestore();
	});
});
