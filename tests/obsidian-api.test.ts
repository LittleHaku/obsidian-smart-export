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

	it("wraps file lookup, title lookup, content reads, and absent files", async () => {
		const getFileByPath = vi.fn((path: string) => (path === files[0].path ? files[0] : null));
		const cachedRead = vi.fn(async () => "note content");
		mockApp.vault.getFileByPath = getFileByPath;
		mockApp.vault.cachedRead = cachedRead;
		const api = new ObsidianAPI(mockApp);

		expect(api.getTFile(files[0].path)).toBe(files[0]);
		expect(api.getNoteTitle(files[0])).toBe("b");
		await expect(api.getNoteContent(files[0].path)).resolves.toBe("note content");
		await expect(api.getNoteContent("missing.md")).resolves.toBe("");
		expect(cachedRead).toHaveBeenCalledOnce();
	});

	it("combines body and frontmatter links and handles empty metadata", () => {
		const bodyLink = { link: "Body" };
		const frontmatterLink = { link: "Frontmatter" };
		mockApp.metadataCache.getCache = vi
			.fn()
			.mockReturnValueOnce(null)
			.mockReturnValueOnce({})
			.mockReturnValueOnce({ links: [bodyLink] })
			.mockReturnValueOnce({ frontmatterLinks: [frontmatterLink] })
			.mockReturnValueOnce({ links: [bodyLink], frontmatterLinks: [frontmatterLink] });
		const api = new ObsidianAPI(mockApp);

		expect(api.getLinksForFile(files[0])).toBeUndefined();
		expect(api.getLinksForFile(files[0])).toBeUndefined();
		expect(api.getLinksForFile(files[0])).toEqual([bodyLink]);
		expect(api.getLinksForFile(files[0])).toEqual([frontmatterLink]);
		expect(api.getLinksForFile(files[0])).toEqual([bodyLink, frontmatterLink]);
	});

	it("builds, sorts, caches, and invalidates the incoming-link index", () => {
		const target = createMockTFile("target.md", "target");
		const sourceA = createMockTFile("a-source.md", "a-source");
		const sourceZ = createMockTFile("z-source.md", "z-source");
		const lookup = new Map([
			[sourceA.path, sourceA],
			[sourceZ.path, sourceZ],
		]);
		const getFileByPath = vi.fn((path: string) => lookup.get(path) ?? null);
		mockApp.vault.getFileByPath = getFileByPath;
		mockApp.metadataCache.resolvedLinks = {
			"z-source.md": { "target.md": 1, "ignored.md": 0 },
			"missing-source.md": { "target.md": 1 },
			"a-source.md": { "target.md": 2 },
		};
		const api = new ObsidianAPI(mockApp);

		expect(api.getIncomingLinksForFile(target)).toEqual([sourceA, sourceZ]);
		expect(api.getIncomingLinksForFile(createMockTFile("none.md", "none"))).toEqual([]);
		expect(getFileByPath).toHaveBeenCalledTimes(3);

		Reflect.deleteProperty(mockApp.metadataCache, "resolvedLinks");
		api.invalidateIncomingLinksIndex();
		expect(api.getIncomingLinksForFile(target)).toEqual([]);
	});

	it("resolves direct, heading, and block wikilinks with conservative fallbacks", () => {
		const resolved = files[0];
		const getFirstLinkpathDest = vi
			.fn()
			.mockReturnValueOnce(resolved)
			.mockReturnValueOnce(null)
			.mockReturnValueOnce(resolved)
			.mockReturnValue(null);
		mockApp.metadataCache.getFirstLinkpathDest = getFirstLinkpathDest;
		const api = new ObsidianAPI(mockApp);

		expect(api.resolveLink("b", "source.md")).toBe(resolved);
		expect(api.resolveLink("b#Heading", "source.md")).toBe(resolved);
		expect(api.resolveLink("missing", "source.md")).toBeNull();
		expect(api.resolveLink("#Heading", "source.md")).toBeNull();
		expect(api.resolveLink("^block", "source.md")).toBeNull();
	});

	it("handles absent, empty, duplicate, and malformed tag metadata", () => {
		mockApp.metadataCache.getCache = vi
			.fn()
			.mockReturnValueOnce(null)
			.mockReturnValueOnce({ tags: [] })
			.mockReturnValueOnce({
				tags: [createTag("#Project"), createTag("#project"), createTag("#")],
			});
		const api = new ObsidianAPI(mockApp);

		expect(api.getNoteTags(files[0])).toEqual([]);
		expect(api.getNoteTags(files[0])).toEqual([]);
		expect(api.getNoteTags(files[0])).toEqual(["project"]);
	});

	it("returns only plain-object frontmatter", () => {
		mockApp.metadataCache.getCache = vi
			.fn()
			.mockReturnValueOnce(null)
			.mockReturnValueOnce({ frontmatter: null })
			.mockReturnValueOnce({ frontmatter: [] })
			.mockReturnValueOnce({ frontmatter: "invalid" })
			.mockReturnValueOnce({ frontmatter: { status: "done" } });
		const api = new ObsidianAPI(mockApp);

		expect(api.getNoteFrontmatter(files[0])).toBeNull();
		expect(api.getNoteFrontmatter(files[0])).toBeNull();
		expect(api.getNoteFrontmatter(files[0])).toBeNull();
		expect(api.getNoteFrontmatter(files[0])).toBeNull();
		expect(api.getNoteFrontmatter(files[0])).toEqual({ status: "done" });
	});
});
