import { App, TFile, TFolder } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import {
	buildDefaultExportNoteName,
	buildExportNotePath,
	createExportNote,
	getAvailableExportNoteDestination,
	getDefaultExportNoteDestination,
	normalizeExportNoteFolderPath,
	normalizeExportNoteName,
	sanitizeExportNoteTitleSegment,
} from "../../src/utils/exportNote";

describe("exportNote", () => {
	describe("sanitizeExportNoteTitleSegment", () => {
		it("replaces invalid file name characters and collapses whitespace", () => {
			expect(sanitizeExportNoteTitleSegment('Project: "Alpha" / Beta?')).toBe("Project Alpha Beta");
		});

		it("falls back to Untitled when the sanitized title is empty", () => {
			expect(sanitizeExportNoteTitleSegment('\\\\ / : * ? " < > |')).toBe("Untitled");
		});
	});

	describe("normalize helpers", () => {
		it("normalizes folder paths using Obsidian path rules", () => {
			expect(normalizeExportNoteFolderPath(" /Exports//LLM/ ")).toBe("Exports/LLM");
			expect(normalizeExportNoteFolderPath("   ")).toBe("");
		});

		it("normalizes note names and removes the markdown extension", () => {
			expect(normalizeExportNoteName(' Project: "Alpha".md ')).toBe("Project Alpha");
		});

		it("builds a default export note name from the root note title", () => {
			expect(buildDefaultExportNoteName("Root note")).toBe("Smart export - Root note");
		});

		it("derives the default destination next to the root note", () => {
			const rootFile = Object.assign(new TFile(), {
				path: "projects/root.md",
				basename: "Root",
			});

			expect(getDefaultExportNoteDestination(rootFile)).toEqual({
				folderPath: "projects",
				noteName: "Smart export - Root",
			});
		});

		it("uses the vault root when the source note is in the vault root", () => {
			const rootFile = Object.assign(new TFile(), {
				path: "root.md",
				basename: "Root",
			});

			expect(getDefaultExportNoteDestination(rootFile)).toEqual({
				folderPath: "",
				noteName: "Smart export - Root",
			});
		});

		it("prefers the configured export folder when provided", () => {
			const rootFile = Object.assign(new TFile(), {
				path: "projects/root.md",
				basename: "Root",
			});

			expect(getDefaultExportNoteDestination(rootFile, " exports/final ")).toEqual({
				folderPath: "exports/final",
				noteName: "Smart export - Root",
			});
		});
	});

	describe("buildExportNotePath", () => {
		it("builds a note path in the selected folder", () => {
			expect(
				buildExportNotePath({
					folderPath: "projects/exports",
					noteName: "Smart export - Root",
				})
			).toBe("projects/exports/Smart export - Root.md");
		});

		it("builds a root-level note path when the folder is empty", () => {
			expect(
				buildExportNotePath({
					folderPath: "",
					noteName: "Smart export - Root",
				})
			).toBe("Smart export - Root.md");
		});
	});

	describe("createExportNote", () => {
		it("creates the export note and opens it by default", async () => {
			const createdFile = { path: "projects/exports/Smart export - Root.md" };
			const create = vi.fn().mockResolvedValue(createdFile);
			const createFolder = vi.fn().mockResolvedValue(undefined);
			const openFile = vi.fn().mockResolvedValue(undefined);
			const getAbstractFileByPath = vi.fn().mockReturnValue(null);
			const getLeaf = vi.fn().mockReturnValue({ openFile });
			const app = {
				vault: {
					getAbstractFileByPath,
					createFolder,
					create,
				},
				workspace: {
					getLeaf,
				},
			} as unknown as App;

			const result = await createExportNote(app, "Export body", {
				folderPath: "projects/exports",
				noteName: "Smart export - Root",
			});

			expect(createFolder).toHaveBeenNthCalledWith(1, "projects");
			expect(createFolder).toHaveBeenNthCalledWith(2, "projects/exports");
			expect(create).toHaveBeenCalledWith("projects/exports/Smart export - Root.md", "Export body");
			expect(getLeaf).toHaveBeenCalledWith(false);
			expect(openFile).toHaveBeenCalledWith(createdFile);
			expect(result).toBe(createdFile);
		});

		it("does not recreate folders that already exist", async () => {
			const projectsFolder = Object.assign(new TFolder(), { path: "projects" });
			const exportsFolder = Object.assign(new TFolder(), { path: "projects/exports" });
			const createFolder = vi.fn().mockResolvedValue(undefined);
			const getAbstractFileByPath = vi.fn((path: string) => {
				if (path === "projects") {
					return projectsFolder;
				}
				if (path === "projects/exports") {
					return exportsFolder;
				}
				return null;
			});
			const app = {
				vault: {
					getAbstractFileByPath,
					createFolder,
					create: vi.fn().mockResolvedValue({ path: "projects/exports/Smart export - Root.md" }),
				},
				workspace: {
					getLeaf: vi.fn().mockReturnValue({ openFile: vi.fn().mockResolvedValue(undefined) }),
				},
			} as unknown as App;

			await createExportNote(app, "Export body", {
				folderPath: "projects/exports",
				noteName: "Smart export - Root",
			});

			expect(createFolder).not.toHaveBeenCalled();
		});

		it("throws when the target note already exists", async () => {
			const app = {
				vault: {
					getAbstractFileByPath: vi.fn((path: string) =>
						path === "exports/Smart export - Root.md" ? { path } : null
					),
					createFolder: vi.fn().mockResolvedValue(undefined),
					create: vi.fn(),
				},
				workspace: {
					getLeaf: vi.fn(),
				},
			} as unknown as App;

			await expect(
				createExportNote(app, "Export body", {
					folderPath: "exports",
					noteName: "Smart export - Root",
				})
			).rejects.toThrow('An export note already exists at "exports/Smart export - Root.md".');
		});

		it("throws when a folder segment already exists as a file", async () => {
			const blockingFile = Object.assign(new TFile(), { path: "exports" });
			const app = {
				vault: {
					getAbstractFileByPath: vi.fn((path: string) =>
						path === "exports" ? blockingFile : null
					),
					createFolder: vi.fn(),
					create: vi.fn(),
				},
				workspace: {
					getLeaf: vi.fn(),
				},
			} as unknown as App;

			await expect(
				createExportNote(app, "Export body", {
					folderPath: "exports/nested",
					noteName: "Smart export - Root",
				})
			).rejects.toThrow('Cannot create export folder because "exports" already exists as a file.');
		});

		it("skips opening the file when requested", async () => {
			const createdFile = { path: "Smart export - Root.md" };
			const create = vi.fn().mockResolvedValue(createdFile);
			const openFile = vi.fn().mockResolvedValue(undefined);
			const createFolder = vi.fn().mockResolvedValue(undefined);
			const app = {
				vault: {
					getAbstractFileByPath: vi.fn().mockReturnValue(null),
					createFolder,
					create,
				},
				workspace: {
					getLeaf: vi.fn().mockReturnValue({ openFile }),
				},
			} as unknown as App;

			await createExportNote(
				app,
				"Export body",
				{
					folderPath: "",
					noteName: "Smart export - Root",
				},
				{
					openAfterCreate: false,
				}
			);

			expect(create).toHaveBeenCalledWith("Smart export - Root.md", "Export body");
			expect(createFolder).not.toHaveBeenCalled();
			expect(openFile).not.toHaveBeenCalled();
		});

		it("treats whitespace-only folder paths as the vault root", async () => {
			const create = vi.fn().mockResolvedValue({ path: "Smart export - Root.md" });
			const createFolder = vi.fn().mockResolvedValue(undefined);
			const app = {
				vault: {
					getAbstractFileByPath: vi.fn().mockReturnValue(null),
					createFolder,
					create,
				},
				workspace: {
					getLeaf: vi.fn().mockReturnValue({ openFile: vi.fn().mockResolvedValue(undefined) }),
				},
			} as unknown as App;

			await createExportNote(app, "Export body", {
				folderPath: "   ",
				noteName: "Smart export - Root",
			});

			expect(createFolder).not.toHaveBeenCalled();
			expect(create).toHaveBeenCalledWith("Smart export - Root.md", "Export body");
		});
	});

	describe("getAvailableExportNoteDestination", () => {
		it("returns the original destination when the path is unused", () => {
			const app = {
				vault: {
					getAbstractFileByPath: vi.fn().mockReturnValue(null),
				},
			} as unknown as App;

			expect(
				getAvailableExportNoteDestination(app, {
					folderPath: "exports",
					noteName: "Smart export - Root",
				})
			).toEqual({
				folderPath: "exports",
				noteName: "Smart export - Root",
			});
		});

		it("dedupes the note name when the default export note already exists", () => {
			const app = {
				vault: {
					getAbstractFileByPath: vi.fn((path: string) => {
						if (path === "exports/Smart export - Root.md") {
							return { path };
						}
						if (path === "exports/Smart export - Root (2).md") {
							return { path };
						}
						return null;
					}),
				},
			} as unknown as App;

			expect(
				getAvailableExportNoteDestination(app, {
					folderPath: " exports ",
					noteName: "Smart export - Root",
				})
			).toEqual({
				folderPath: "exports",
				noteName: "Smart export - Root (3)",
			});
		});
	});
});
