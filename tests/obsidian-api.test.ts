import { beforeEach, describe, expect, it, vi } from "vitest";
import { TFile, TagCache } from "obsidian";
import { ObsidianAPI } from "../src/obsidian-api";
import { mockApp } from "./mocks/mockObsidianAPI";

function setGetTagsMock(getTags: () => Record<string, number>): void {
	(mockApp.metadataCache as unknown as { getTags: ReturnType<typeof vi.fn> }).getTags =
		vi.fn(getTags);
}

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

	it("lists tags from the metadata cache when available", () => {
		setGetTagsMock(() => ({
			"#Project": 2,
			"#Archive/2026": 1,
			"#project": 1,
		}));

		const api = new ObsidianAPI(mockApp);

		expect(api.getAvailableTags()).toEqual(["archive/2026", "project"]);
		expect(getMarkdownFilesMock).not.toHaveBeenCalled();
	});

	it("falls back to scanning note metadata when cache tags are unavailable", () => {
		setGetTagsMock(() => ({}));

		const api = new ObsidianAPI(mockApp);

		expect(api.getAvailableTags()).toEqual(["archive", "project", "project/alpha"]);
	});

	it("finds files matching a normalized tag pattern in path order", () => {
		setGetTagsMock(() => ({}));
		const api = new ObsidianAPI(mockApp);

		expect(api.getFilesMatchingTagPattern("#project").map((file) => file.path)).toEqual([
			"b.md",
			"folder/a.md",
		]);
		expect(api.getFilesMatchingTagPattern("#").map((file) => file.path)).toEqual([]);
	});
});
