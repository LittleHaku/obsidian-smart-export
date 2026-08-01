import { App, TFile } from "obsidian";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { noticeMessages } from "./mocks/obsidian";
import { DEFAULT_SETTINGS } from "../src/settings/defaultSettings";
import { ReleaseNotesEntry } from "../src/constants/releaseNotes";
import { SmartExportSettings } from "../src/types";

const mocks = vi.hoisted(() => ({
	exportModalOpen: vi.fn(),
	exportModalArguments: [] as unknown[][],
	releaseModalOpen: vi.fn(),
	releaseModalArguments: [] as unknown[][],
	traversalArguments: [] as unknown[][],
	traverse: vi.fn(),
	getMissingNotes: vi.fn(),
	buildExportOutput: vi.fn(),
	resolveLlmMarkdownTemplate: vi.fn(),
	createExportNote: vi.fn(),
	getAvailableExportNoteDestination: vi.fn(),
	getDefaultExportNoteDestination: vi.fn(),
	compareVersions: vi.fn(),
	getLatestReleaseNotes: vi.fn(),
	getReleaseNotesBetweenVersions: vi.fn(),
	isReleaseAutoDisplayEnabled: vi.fn(),
	normalizeStoredPluginVersion: vi.fn(),
	shouldAutoDisplayReleaseNotesForUpdate: vi.fn(),
}));

vi.mock("../src/ui/ExportModal", () => ({
	ExportModal: class MockExportModal {
		constructor(...args: unknown[]) {
			mocks.exportModalArguments.push(args);
		}

		open(): void {
			mocks.exportModalOpen();
		}
	},
}));

vi.mock("../src/ui/ReleaseNotesModal", () => ({
	ReleaseNotesModal: class MockReleaseNotesModal {
		constructor(...args: unknown[]) {
			mocks.releaseModalArguments.push(args);
		}

		open(): void {
			mocks.releaseModalOpen();
		}
	},
}));

vi.mock("../src/engine/BFSTraversal", () => ({
	BFSTraversal: class MockBFSTraversal {
		constructor(...args: unknown[]) {
			mocks.traversalArguments.push(args);
		}

		traverse = mocks.traverse;
		getMissingNotes = mocks.getMissingNotes;
	},
}));

vi.mock("../src/engine/exportOutput", async (importOriginal) => ({
	...(await importOriginal<typeof import("../src/engine/exportOutput")>()),
	buildExportOutput: mocks.buildExportOutput,
}));

vi.mock("../src/utils/llmMarkdownTemplateResolver", async (importOriginal) => ({
	...(await importOriginal<typeof import("../src/utils/llmMarkdownTemplateResolver")>()),
	resolveLlmMarkdownTemplate: mocks.resolveLlmMarkdownTemplate,
}));

vi.mock("../src/utils/exportNote", async (importOriginal) => ({
	...(await importOriginal<typeof import("../src/utils/exportNote")>()),
	createExportNote: mocks.createExportNote,
	getAvailableExportNoteDestination: mocks.getAvailableExportNoteDestination,
	getDefaultExportNoteDestination: mocks.getDefaultExportNoteDestination,
}));

vi.mock("../src/utils/releaseNotes", () => ({
	compareVersions: mocks.compareVersions,
	getLatestReleaseNotes: mocks.getLatestReleaseNotes,
	getReleaseNotesBetweenVersions: mocks.getReleaseNotesBetweenVersions,
	isReleaseAutoDisplayEnabled: mocks.isReleaseAutoDisplayEnabled,
	normalizeStoredPluginVersion: mocks.normalizeStoredPluginVersion,
	shouldAutoDisplayReleaseNotesForUpdate: mocks.shouldAutoDisplayReleaseNotesForUpdate,
}));

import SmartExportPlugin from "../src/main";

type CommandRegistration = {
	id: string;
	callback?: () => void;
	checkCallback?: (checking: boolean) => boolean;
};

type ReleaseModalOptions = {
	fundingUrl?: string;
	pluginName: string;
	onClose(): void;
};

type MainInternals = {
	hasPersistedData: boolean;
	lastSeenVersion: string | null;
	maybeShowReleaseNotes(): Promise<void>;
	openReleaseNotesModal(
		releaseNotes: ReleaseNotesEntry[],
		currentVersion: string,
		fundingUrl?: string
	): void;
	quickExportCurrentNote(rootFile: TFile): Promise<void>;
	savePluginData(): Promise<void>;
};

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

function createFile(path: string, extension = "md"): TFile {
	const file = new TFile();
	file.path = path;
	file.extension = extension;
	file.name = path.split("/").pop() ?? path;
	file.basename = file.name.replace(/\.[^.]+$/, "");
	file.stat = { ctime: 1, mtime: 1, size: 1 };
	file.parent = null;
	return file;
}

function createApp(activeFile: TFile | null = null): {
	app: App;
	layoutCallbacks: Array<() => void>;
	eventCallbacks: Array<() => void>;
	startupReads: {
		cachedRead: ReturnType<typeof vi.fn>;
		getCache: ReturnType<typeof vi.fn>;
		getFiles: ReturnType<typeof vi.fn>;
		getMarkdownFiles: ReturnType<typeof vi.fn>;
	};
} {
	const layoutCallbacks: Array<() => void> = [];
	const eventCallbacks: Array<() => void> = [];
	const cachedRead = vi.fn(async () => "");
	const getCache = vi.fn(() => null);
	const getFiles = vi.fn(() => []);
	const getMarkdownFiles = vi.fn(() => []);
	const app = new App();
	Object.assign(app, {
		metadataCache: {
			on: vi.fn((name: string, callback: () => void) => {
				eventCallbacks.push(callback);
				return { name };
			}),
			getCache,
		},
		vault: {
			on: vi.fn((name: string, callback: () => void) => {
				eventCallbacks.push(callback);
				return { name };
			}),
			cachedRead,
			getFiles,
			getName: vi.fn(() => "Test vault"),
			getFileByPath: vi.fn(() => null),
			getMarkdownFiles,
		},
		workspace: {
			getActiveFile: vi.fn(() => activeFile),
			onLayoutReady: vi.fn((callback: () => void) => {
				layoutCallbacks.push(callback);
			}),
		},
	});
	return {
		app,
		layoutCallbacks,
		eventCallbacks,
		startupReads: { cachedRead, getCache, getFiles, getMarkdownFiles },
	};
}

function createPlugin(app = createApp().app): SmartExportPlugin {
	const PluginConstructor = SmartExportPlugin as unknown as new (app: App) => SmartExportPlugin;
	const plugin = new PluginConstructor(app);
	plugin.settings = createSettings();
	Object.assign(plugin.manifest, {
		name: "Smart Export",
		version: "1.16.2",
	});
	return plugin;
}

function getInternals(plugin: SmartExportPlugin): MainInternals {
	return plugin as unknown as MainInternals;
}

describe("SmartExportPlugin lifecycle", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		noticeMessages.length = 0;
		mocks.exportModalArguments.length = 0;
		mocks.releaseModalArguments.length = 0;
		mocks.traversalArguments.length = 0;
		mocks.traverse.mockResolvedValue({
			id: "Root.md",
			title: "Root",
			depth: 0,
			includeContent: true,
			children: [],
			tokenCount: 0,
			lastModified: new Date(0),
		});
		mocks.getMissingNotes.mockReturnValue([]);
		mocks.buildExportOutput.mockReturnValue("OUTPUT");
		mocks.resolveLlmMarkdownTemplate.mockResolvedValue({ template: "CUSTOM" });
		mocks.getDefaultExportNoteDestination.mockReturnValue({
			folderPath: "Exports",
			noteName: "Smart export - Root",
		});
		mocks.getAvailableExportNoteDestination.mockReturnValue({
			folderPath: "Exports",
			noteName: "Smart export - Root 2",
		});
		mocks.createExportNote.mockResolvedValue({ path: "Exports/Smart export - Root 2.md" });
		mocks.normalizeStoredPluginVersion.mockImplementation((value: unknown) =>
			typeof value === "string" && value.trim().length > 0 ? value.trim() : null
		);
		mocks.compareVersions.mockReturnValue(1);
		mocks.isReleaseAutoDisplayEnabled.mockReturnValue(true);
		mocks.shouldAutoDisplayReleaseNotesForUpdate.mockReturnValue(true);
		mocks.getLatestReleaseNotes.mockReturnValue([{ version: "1.16.2", date: "2026-08-01" }]);
		mocks.getReleaseNotesBetweenVersions.mockReturnValue([
			{ version: "1.16.2", date: "2026-08-01" },
		]);
	});

	it("registers lifecycle-safe events, entry points, settings, and deferred work", async () => {
		const activeFile = createFile("Root.md");
		const { app, layoutCallbacks, eventCallbacks, startupReads } = createApp(activeFile);
		const plugin = createPlugin(app);
		const loadSettings = vi.spyOn(plugin, "loadSettings").mockResolvedValue();
		const ribbonCallbacks: Array<(event: MouseEvent) => void> = [];
		const commands: CommandRegistration[] = [];
		const registerEvent = vi.spyOn(plugin, "registerEvent");
		const addSettingTab = vi.spyOn(plugin, "addSettingTab");
		vi.spyOn(plugin, "addRibbonIcon").mockImplementation((_icon, _title, callback) => {
			ribbonCallbacks.push(callback);
			return document.body.createDiv();
		});
		vi.spyOn(plugin, "addCommand").mockImplementation((command) => {
			commands.push(command as CommandRegistration);
			return command;
		});
		const internals = getInternals(plugin);
		const quickExport = vi.fn(async () => {});
		const maybeShowReleaseNotes = vi.fn(async () => {});
		internals.quickExportCurrentNote = quickExport;
		internals.maybeShowReleaseNotes = maybeShowReleaseNotes;

		await plugin.onload();
		expect(loadSettings).toHaveBeenCalledOnce();
		expect(startupReads.getFiles).not.toHaveBeenCalled();
		expect(startupReads.getMarkdownFiles).not.toHaveBeenCalled();
		expect(startupReads.cachedRead).not.toHaveBeenCalled();
		expect(startupReads.getCache).not.toHaveBeenCalled();
		expect(registerEvent).toHaveBeenCalledTimes(4);
		expect(addSettingTab).toHaveBeenCalledOnce();
		expect(layoutCallbacks).toHaveLength(1);
		for (const callback of eventCallbacks) {
			callback();
		}

		ribbonCallbacks[0]?.(new MouseEvent("click"));
		commands.find((command) => command.id === "open-export-modal")?.callback?.();
		expect(mocks.exportModalOpen).toHaveBeenCalledTimes(2);

		const quickCommand = commands.find((command) => command.id === "quick-export-current-note");
		expect(quickCommand?.checkCallback?.(true)).toBe(true);
		expect(quickExport).not.toHaveBeenCalled();
		expect(quickCommand?.checkCallback?.(false)).toBe(true);
		expect(quickExport).toHaveBeenCalledWith(activeFile);

		layoutCallbacks[0]?.();
		expect(startupReads.getFiles).not.toHaveBeenCalled();
		expect(startupReads.getMarkdownFiles).not.toHaveBeenCalled();
		expect(startupReads.cachedRead).not.toHaveBeenCalled();
		expect(startupReads.getCache).not.toHaveBeenCalled();
		expect(registerEvent).toHaveBeenCalledTimes(5);
		expect(maybeShowReleaseNotes).toHaveBeenCalledOnce();
		plugin.onunload();
	});

	it("disables quick export when there is no active Markdown note", async () => {
		for (const activeFile of [null, createFile("Canvas.canvas", "canvas")]) {
			const { app } = createApp(activeFile);
			const plugin = createPlugin(app);
			vi.spyOn(plugin, "loadSettings").mockResolvedValue();
			const commands: CommandRegistration[] = [];
			vi.spyOn(plugin, "addCommand").mockImplementation((command) => {
				commands.push(command as CommandRegistration);
				return command;
			});

			await plugin.onload();
			const quickCommand = commands.find((command) => command.id === "quick-export-current-note");
			expect(quickCommand?.checkCallback?.(false)).toBe(false);
		}
	});

	it("loads legacy and nested settings while normalizing every persisted boundary", async () => {
		const plugin = createPlugin();
		vi.spyOn(plugin, "loadData").mockResolvedValue({
			settings: {
				defaultContentDepth: 99,
				defaultTitleDepth: -4,
				ignoredTraversalFolders: [" Templates ", "Archive"],
				ignoredTraversalTagPatterns: [" #Draft "],
				ignoredTraversalPropertyRules: [" status=done "],
				redactMarkedSections: true,
				redactionDelimiter: " ",
				redactionReplacement: "",
				redactRegexMatches: true,
				redactionRegexReplacement: 42,
				redactionRegexPatterns: "secret\naccount",
				defaultExportFormat: "unsupported",
				defaultExportTarget: "new-note",
				defaultLlmTemplateId: " user:Templates/custom.md ",
				llmMarkdownTemplateDirectory: " /Templates\\LLM/ ",
				defaultExportNoteFolderPath: " /Exports\\Generated/ ",
				openCreatedExportNote: false,
				printFriendlyIncludeTableOfContents: false,
				printFriendlyNumberHeadings: false,
				printFriendlyInsertSectionDividers: false,
				printFriendlyInsertPageBreaks: true,
				printFriendlyNormalizeContentHeadings: false,
			},
			lastSeenVersion: " 1.15.0 ",
		});

		await plugin.loadSettings();

		expect(plugin.settings.defaultContentDepth).toBe(20);
		expect(plugin.settings.defaultTitleDepth).toBe(20);
		expect(plugin.settings.ignoredTraversalFolders).toEqual(["Templates", "Archive"]);
		expect(plugin.settings.ignoredTraversalTagPatterns).toEqual(["draft"]);
		expect(plugin.settings.ignoredTraversalPropertyRules).toEqual(["status=done"]);
		expect(plugin.settings.redactMarkedSections).toBe(true);
		expect(plugin.settings.redactRegexMatches).toBe(true);
		expect(plugin.settings.defaultExportFormat).toBe("xml");
		expect(plugin.settings.defaultExportTarget).toBe("new-note");
		expect(plugin.settings.defaultLlmTemplateId).toBe("user:Templates/custom.md");
		expect(plugin.settings.llmMarkdownTemplateDirectory).toBe("Templates/LLM");
		expect(plugin.settings.defaultExportNoteFolderPath).toBe("Exports/Generated");
		expect(plugin.settings.openCreatedExportNote).toBe(false);
		expect(getInternals(plugin).lastSeenVersion).toBe("1.15.0");
	});

	it("falls back safely for absent, legacy, and malformed persisted shapes", async () => {
		for (const storedData of [
			null,
			"invalid",
			[],
			{ settings: "invalid", lastSeenVersion: 5 },
			{
				defaultContentDepth: -2,
				defaultTitleDepth: 50,
				redactMarkedSections: false,
				redactRegexMatches: false,
				defaultExportTarget: "invalid",
				defaultLlmTemplateId: " ",
			},
		]) {
			const plugin = createPlugin();
			vi.spyOn(plugin, "loadData").mockResolvedValue(storedData);
			await plugin.loadSettings();
			expect(plugin.settings.defaultTitleDepth).toBeGreaterThanOrEqual(
				plugin.settings.defaultContentDepth
			);
			expect(["clipboard", "new-note"]).toContain(plugin.settings.defaultExportTarget);
			expect(plugin.settings.defaultLlmTemplateId.length).toBeGreaterThan(0);
		}
	});

	it("persists normalized settings and release-note state", async () => {
		const plugin = createPlugin();
		const saveData = vi.spyOn(plugin, "saveData").mockResolvedValue();
		const internals = getInternals(plugin);
		internals.lastSeenVersion = "1.16.2";

		await plugin.saveSettings();
		expect(saveData).toHaveBeenCalledWith({
			settings: plugin.settings,
			lastSeenVersion: "1.16.2",
		});
		expect(internals.hasPersistedData).toBe(true);
	});

	it("marks release notes seen on close and reports persistence failures", async () => {
		const plugin = createPlugin();
		const internals = getInternals(plugin);
		const saveData = vi.spyOn(plugin, "saveData").mockResolvedValueOnce();
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const notes = [{ version: "1.16.2", date: "2026-08-01" }];

		internals.openReleaseNotesModal(notes, "1.16.2", "https://example.com/support");
		expect(mocks.releaseModalOpen).toHaveBeenCalledOnce();
		const firstOptions = mocks.releaseModalArguments[0]?.[2] as ReleaseModalOptions;
		firstOptions.onClose();
		await vi.waitFor(() => expect(saveData).toHaveBeenCalledOnce());
		expect(internals.lastSeenVersion).toBe("1.16.2");

		saveData.mockRejectedValueOnce(new Error("disk full"));
		internals.openReleaseNotesModal(notes, "1.16.3");
		const secondOptions = mocks.releaseModalArguments[1]?.[2] as ReleaseModalOptions;
		secondOptions.onClose();
		await vi.waitFor(() =>
			expect(error).toHaveBeenCalledWith(
				"Failed to persist release notes seen state",
				expect.any(Error)
			)
		);
		error.mockRestore();
	});

	it("handles every automatic release-note decision", async () => {
		const notes = [{ version: "1.16.2", date: "2026-08-01" }];

		const invalidVersion = createPlugin();
		invalidVersion.manifest.version = "invalid";
		mocks.normalizeStoredPluginVersion.mockReturnValueOnce(null);
		await getInternals(invalidVersion).maybeShowReleaseNotes();

		const firstInstall = createPlugin();
		const firstInstallSave = vi.spyOn(firstInstall, "saveData").mockResolvedValue();
		await getInternals(firstInstall).maybeShowReleaseNotes();
		expect(firstInstallSave).toHaveBeenCalledOnce();

		const legacyPrerelease = createPlugin();
		const legacyPrereleaseInternals = getInternals(legacyPrerelease);
		legacyPrereleaseInternals.hasPersistedData = true;
		legacyPrereleaseInternals.lastSeenVersion = null;
		mocks.isReleaseAutoDisplayEnabled.mockReturnValueOnce(false);
		await legacyPrereleaseInternals.maybeShowReleaseNotes();

		const legacyStable = createPlugin();
		const legacyStableInternals = getInternals(legacyStable);
		legacyStableInternals.hasPersistedData = true;
		legacyStableInternals.lastSeenVersion = null;
		await legacyStableInternals.maybeShowReleaseNotes();
		expect(mocks.getLatestReleaseNotes).toHaveBeenCalled();

		const unchanged = createPlugin();
		const unchangedInternals = getInternals(unchanged);
		unchangedInternals.hasPersistedData = true;
		unchangedInternals.lastSeenVersion = "1.16.2";
		await unchangedInternals.maybeShowReleaseNotes();

		const skippedUpgrade = createPlugin();
		const skippedUpgradeInternals = getInternals(skippedUpgrade);
		skippedUpgradeInternals.hasPersistedData = true;
		skippedUpgradeInternals.lastSeenVersion = "1.15.0";
		mocks.shouldAutoDisplayReleaseNotesForUpdate.mockReturnValueOnce(false);
		await skippedUpgradeInternals.maybeShowReleaseNotes();

		const downgrade = createPlugin();
		const downgradeInternals = getInternals(downgrade);
		downgradeInternals.hasPersistedData = true;
		downgradeInternals.lastSeenVersion = "2.0.0";
		mocks.compareVersions.mockReturnValueOnce(-1);
		await downgradeInternals.maybeShowReleaseNotes();

		const equalButDifferent = createPlugin();
		const equalInternals = getInternals(equalButDifferent);
		equalInternals.hasPersistedData = true;
		equalInternals.lastSeenVersion = "1.16.2.0";
		mocks.compareVersions.mockReturnValueOnce(0);
		await equalInternals.maybeShowReleaseNotes();

		const noNotes = createPlugin();
		const noNotesInternals = getInternals(noNotes);
		noNotesInternals.hasPersistedData = true;
		noNotesInternals.lastSeenVersion = "1.15.0";
		mocks.getReleaseNotesBetweenVersions.mockReturnValueOnce([]);
		await noNotesInternals.maybeShowReleaseNotes();

		const upgrade = createPlugin();
		const upgradeInternals = getInternals(upgrade);
		upgradeInternals.hasPersistedData = true;
		upgradeInternals.lastSeenVersion = "1.15.0";
		mocks.getReleaseNotesBetweenVersions.mockReturnValueOnce(notes);
		await upgradeInternals.maybeShowReleaseNotes();
		expect(mocks.releaseModalOpen).toHaveBeenCalled();
	});

	it("contains release-note preparation failures", async () => {
		const plugin = createPlugin();
		mocks.normalizeStoredPluginVersion.mockImplementationOnce(() => {
			throw new Error("bad manifest");
		});
		const error = vi.spyOn(console, "error").mockImplementation(() => {});

		await getInternals(plugin).maybeShowReleaseNotes();

		expect(error).toHaveBeenCalledWith("Failed to prepare release notes", expect.any(Error));
		error.mockRestore();
	});
});

describe("SmartExportPlugin quick export", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		noticeMessages.length = 0;
		mocks.traversalArguments.length = 0;
		mocks.traverse.mockResolvedValue({
			id: "Root.md",
			title: "Root",
			depth: 0,
			includeContent: true,
			children: [],
			tokenCount: 0,
			lastModified: new Date(0),
		});
		mocks.getMissingNotes.mockReturnValue(["Missing"]);
		mocks.buildExportOutput.mockReturnValue("OUTPUT");
		mocks.resolveLlmMarkdownTemplate.mockResolvedValue({ template: "CUSTOM" });
		mocks.getDefaultExportNoteDestination.mockReturnValue({ folderPath: "", noteName: "Root" });
		mocks.getAvailableExportNoteDestination.mockReturnValue({
			folderPath: "Exports",
			noteName: "Root",
		});
		mocks.createExportNote.mockResolvedValue({ path: "Exports/Root.md" });
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: undefined,
		});
	});

	it("rejects non-Markdown files and missing traversal roots", async () => {
		const plugin = createPlugin();
		await getInternals(plugin).quickExportCurrentNote(createFile("Canvas.canvas", "canvas"));
		expect(noticeMessages).toContain("Quick export only supports Markdown notes.");

		mocks.traverse.mockResolvedValueOnce(null);
		await getInternals(plugin).quickExportCurrentNote(createFile("Root.md"));
		expect(noticeMessages).toContain("Quick export failed. Could not load the current note.");
	});

	it("resolves LLM templates, warns on invalid formats, and handles unavailable clipboard", async () => {
		const plugin = createPlugin();
		plugin.settings.defaultExportFormat = "llm-markdown";
		mocks.buildExportOutput.mockImplementationOnce((options: { onInvalidFormat(): void }) => {
			options.onInvalidFormat();
			return "OUTPUT";
		});

		await getInternals(plugin).quickExportCurrentNote(createFile("Root.md"));

		expect(mocks.resolveLlmMarkdownTemplate).toHaveBeenCalled();
		expect(mocks.buildExportOutput).toHaveBeenCalledWith(
			expect.objectContaining({
				vaultPath: "Test vault",
				llmMarkdownTemplate: "CUSTOM",
				missingNotesCount: 1,
			})
		);
		expect(noticeMessages).toContain("Unknown export format in settings; falling back to XML.");
		expect(noticeMessages).toContain("Clipboard is not available in this environment.");
	});

	it("copies non-LLM exports to the clipboard", async () => {
		const writeText = vi.fn(async () => {});
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: { writeText },
		});
		const plugin = createPlugin();
		plugin.settings.defaultExportFormat = "xml";

		await getInternals(plugin).quickExportCurrentNote(createFile("Root.md"));

		expect(mocks.resolveLlmMarkdownTemplate).not.toHaveBeenCalled();
		expect(writeText).toHaveBeenCalledWith("OUTPUT");
		expect(noticeMessages).toContain("Quick export copied to clipboard.");
	});

	it("creates a uniquely named export note with the configured open behavior", async () => {
		const plugin = createPlugin();
		plugin.settings.defaultExportTarget = "new-note";
		plugin.settings.openCreatedExportNote = false;

		await getInternals(plugin).quickExportCurrentNote(createFile("Root.md"));

		expect(mocks.getAvailableExportNoteDestination).toHaveBeenCalled();
		expect(mocks.createExportNote).toHaveBeenCalledWith(
			plugin.app,
			"OUTPUT",
			{ folderPath: "Exports", noteName: "Root" },
			{ openAfterCreate: false }
		);
		expect(noticeMessages).toContain("Quick export note created: Exports/Root.md");
	});

	it("contains unexpected quick-export failures", async () => {
		const plugin = createPlugin();
		mocks.traverse.mockRejectedValueOnce(new Error("read failed"));
		const error = vi.spyOn(console, "error").mockImplementation(() => {});

		await getInternals(plugin).quickExportCurrentNote(createFile("Root.md"));

		expect(error).toHaveBeenCalledWith("Quick export failed", expect.any(Error));
		expect(noticeMessages).toContain("Quick export failed. See console for details.");
		error.mockRestore();
	});
});
