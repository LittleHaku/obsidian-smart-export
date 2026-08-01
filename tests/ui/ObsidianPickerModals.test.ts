import { App, EventRef, TFile, TFolder } from "obsidian";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { noticeMessages } from "../mocks/obsidian";
import { ExportNoteDestinationModal } from "../../src/ui/ExportNoteDestinationModal";
import { FolderPathSuggest } from "../../src/ui/FolderPathSuggest";
import { RootNoteSuggestModal } from "../../src/ui/RootNoteSuggestModal";
import { TagSuggestModal } from "../../src/ui/TagSuggestModal";
import { TagDiscoveryService } from "../../src/tagDiscovery";

type VaultEventCallback = () => void;

function createFile(path: string): TFile {
	const file = new TFile();
	file.path = path;
	file.name = path.split("/").pop() ?? path;
	file.basename = file.name.replace(/\.md$/i, "");
	file.extension = "md";
	file.parent = null;
	return file;
}

function createApp(folderPaths: string[] = []): {
	app: App;
	eventCallbacks: VaultEventCallback[];
	offref: ReturnType<typeof vi.fn>;
} {
	const eventCallbacks: VaultEventCallback[] = [];
	const offref = vi.fn();
	const folders = folderPaths.map((path) => {
		const folder = new TFolder();
		folder.path = path;
		return folder;
	});
	const app = new App();
	Object.assign(app, {
		vault: {
			getMarkdownFiles: vi.fn(() => []),
			getAllFolders: vi.fn(() => folders),
			on: vi.fn((_name: string, callback: VaultEventCallback): EventRef => {
				eventCallbacks.push(callback);
				return { id: String(eventCallbacks.length) };
			}),
			offref,
		},
	});
	return { app, eventCallbacks, offref };
}

class TestFolderPathSuggest extends FolderPathSuggest {
	getMatches(query: string): string[] {
		return this.getSuggestions(query);
	}
}

type DestinationModalInternals = {
	handleSubmit(): Promise<void>;
	updatePathPreview(): void;
};

describe("Obsidian picker modals", () => {
	beforeEach(() => {
		noticeMessages.length = 0;
	});

	it("lists and chooses root notes", () => {
		const { app } = createApp();
		const notes = [createFile("folder/Alpha.md"), createFile("Beta.md")];
		app.vault.getMarkdownFiles = vi.fn(() => notes);
		const onSelect = vi.fn();
		const modal = new RootNoteSuggestModal(app, onSelect);

		expect(modal.getItems()).toEqual(notes);
		expect(modal.getItemText(notes[0])).toBe("Alpha");
		modal.onChooseItem(notes[1], new MouseEvent("click"));
		expect(onSelect).toHaveBeenCalledWith(notes[1]);
	});

	it("lists normalized tags and forwards the selected tag", () => {
		const { app } = createApp();
		const tagDiscovery = {
			getAvailableTags: vi.fn(() => ["alpha", "project/nested"]),
		} as unknown as TagDiscoveryService;
		const onSelect = vi.fn();
		const modal = new TagSuggestModal(app, tagDiscovery, onSelect);

		expect(modal.getItems()).toEqual(["alpha", "project/nested"]);
		expect(modal.getItemText("alpha")).toBe("#alpha");
		modal.onChooseItem("project/nested", new KeyboardEvent("keydown"));
		expect(onSelect).toHaveBeenCalledWith("project/nested");
	});

	it("sorts, filters, caches, invalidates, renders, and selects folder paths", () => {
		const manyFolders = Array.from({ length: 105 }, (_, index) => `Folder ${index}`);
		const { app, eventCallbacks, offref } = createApp([
			"",
			"Zulu/Archive",
			"Alpha",
			"Beta/Alpha notes",
			...manyFolders,
		]);
		const input = document.body.createEl("input");
		const inputEvent = vi.fn();
		input.addEventListener("input", inputEvent);
		const suggest = new TestFolderPathSuggest(app, input);

		expect(suggest.getMatches(" /Zulu\\Ar/ ")).toEqual(["Zulu/Archive"]);
		expect(suggest.getMatches("archive")).toEqual(["Zulu/Archive"]);
		expect(suggest.getMatches("alpha")).toEqual(["Alpha", "Beta/Alpha notes"]);
		expect(suggest.getMatches("")).toHaveLength(100);

		const rendered = document.body.createDiv();
		suggest.renderSuggestion("Alpha", rendered);
		expect(rendered.textContent).toBe("Alpha");
		suggest.selectSuggestion("Beta/Alpha notes", new MouseEvent("click"));
		expect(input.value).toBe("Beta/Alpha notes");
		expect(inputEvent).toHaveBeenCalledOnce();

		eventCallbacks[0]?.();
		expect(suggest.getMatches("archive")).toEqual(["Zulu/Archive"]);
		suggest.destroy();
		expect(offref).toHaveBeenCalledTimes(3);
	});

	it("renders a destination from a root note and submits normalized input", async () => {
		const { app } = createApp();
		const root = createFile("Projects/Root note.md");
		const onSubmit = vi.fn(async () => true);
		const modal = new ExportNoteDestinationModal(app, root, "Exports", onSubmit);

		modal.onOpen();
		expect(modal.titleEl.textContent).toBe("Export to new note");
		expect(modal.contentEl.textContent).toContain("Path: Exports/Smart export - Root note.md");
		const inputs = modal.contentEl.querySelectorAll("input");
		const folderInput = inputs.item(0);
		const nameInput = inputs.item(1);
		folderInput.value = " /Generated\\Daily/ ";
		folderInput.dispatchEvent(new Event("input"));
		nameInput.value = " Daily export.md ";
		nameInput.dispatchEvent(new Event("input"));
		expect(modal.contentEl.textContent).toContain("Path: Generated/Daily/Daily export.md");

		nameInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
		expect(onSubmit).not.toHaveBeenCalled();
		nameInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
		await vi.waitFor(() => {
			expect(onSubmit).toHaveBeenCalledWith({
				folderPath: "Generated/Daily",
				noteName: "Daily export",
			});
		});
		expect(modal.contentEl.childElementCount).toBe(0);
	});

	it("validates blank names, honors rejected submission, and supports tag-style sources", async () => {
		const { app } = createApp();
		const onSubmit = vi.fn(async (): Promise<boolean | void> => false);
		const modal = new ExportNoteDestinationModal(
			app,
			null,
			"Tag exports",
			onSubmit,
			"Tag: #project"
		);
		const internals = modal as unknown as DestinationModalInternals;

		modal.onClose();
		internals.updatePathPreview();
		modal.onOpen();
		const nameInput = modal.contentEl.querySelectorAll("input").item(1);
		expect(nameInput.value).toBe("Smart export - Tag #project");
		nameInput.value = "   ";
		nameInput.dispatchEvent(new Event("input"));
		await internals.handleSubmit();
		expect(noticeMessages).toContain("Please enter a note name.");

		nameInput.value = "Tag export";
		nameInput.dispatchEvent(new Event("input"));
		await internals.handleSubmit();
		expect(onSubmit).toHaveBeenCalledOnce();
		expect(modal.contentEl.childElementCount).toBeGreaterThan(0);

		onSubmit.mockResolvedValueOnce(false).mockResolvedValueOnce(undefined);
		await internals.handleSubmit();
		await internals.handleSubmit();
		expect(modal.contentEl.childElementCount).toBe(0);
	});

	it("wires cancel and create buttons", async () => {
		const { app } = createApp();
		const onSubmit = vi.fn(async () => true);
		const cancelModal = new ExportNoteDestinationModal(app, null, "", onSubmit);
		cancelModal.onOpen();
		const cancel = Array.from(
			cancelModal.contentEl.querySelectorAll<HTMLButtonElement>("button")
		).find((button) => button.textContent === "Cancel");
		cancel?.click();
		expect(cancelModal.contentEl.childElementCount).toBe(0);

		const createModal = new ExportNoteDestinationModal(app, null, "", onSubmit);
		createModal.onOpen();
		const create = Array.from(
			createModal.contentEl.querySelectorAll<HTMLButtonElement>("button")
		).find((button) => button.textContent === "Create note");
		create?.click();
		await vi.waitFor(() => expect(onSubmit).toHaveBeenCalled());
	});
});
