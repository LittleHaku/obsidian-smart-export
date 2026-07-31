import { beforeEach, describe, expect, it, vi } from "vitest";
import { TFile, TagCache } from "obsidian";
import { ObsidianAPI } from "../src/obsidian-api";
import { mockApp } from "./mocks/mockObsidianAPI";

function createMockTFile(path: string, basename: string): TFile {
	const file = new TFile();
	Object.assign(file, {
		path,
		name: `${basename}.md`,
		basename,
		extension: "md",
		vault: mockApp.vault,
		stat: {
			ctime: 1_000,
			mtime: 1_000,
			size: 100,
		},
		parent: null,
	});
	return file;
}

function createTag(tag: string): TagCache {
	return {
		tag,
		position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 0, offset: 0 } },
	};
}

describe("ObsidianAPI", () => {
	const files = [
		createMockTFile("b.md", "b"),
		createMockTFile("folder/a.md", "a"),
		createMockTFile("c.md", "c"),
	];
	let getMarkdownFilesMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.resetAllMocks();
		getMarkdownFilesMock = vi.fn(() => files);
		mockApp.vault.getMarkdownFiles = getMarkdownFilesMock;
		mockApp.metadataCache.getCache = vi.fn((path: string) => {
			if (path === "folder/a.md") {
				return {
					tags: [createTag("#Project/Alpha")],
					frontmatter: {},
				};
			}
			if (path === "b.md") {
				return {
					tags: [],
					frontmatter: { tags: ["project", "archive"] },
				};
			}
			return {
				tags: [],
				frontmatter: {},
			};
		});
	});

	it("reads normalized inline and frontmatter tags from public metadata APIs", () => {
		const api = new ObsidianAPI(mockApp);

		expect(api.getNoteTags(files[1])).toEqual(["project/alpha"]);
		expect(api.getNoteTags(files[0])).toEqual(["project", "archive"]);
	});

	it("finds files matching a normalized selected tag in path order", () => {
		const api = new ObsidianAPI(mockApp);

		expect(api.getFilesMatchingTag("#project").map((file) => file.path)).toEqual([
			"b.md",
			"folder/a.md",
		]);
		expect(api.getFilesMatchingTag("#").map((file) => file.path)).toEqual([]);
	});
});
