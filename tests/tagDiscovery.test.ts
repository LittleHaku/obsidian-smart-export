import { beforeEach, describe, expect, it, vi } from "vitest";
import { TFile, TagCache } from "obsidian";
import { ObsidianAPI } from "../src/obsidian-api";
import { TagDiscoveryService, TagDiscoverySource } from "../src/tagDiscovery";
import { mockApp } from "./mocks/mockObsidianAPI";

function createMockTFile(path: string): TFile {
	const file = new TFile();
	Object.assign(file, {
		path,
		name: path.split("/").pop(),
		basename: path.replace(/\.md$/, ""),
		extension: "md",
		vault: mockApp.vault,
		stat: { ctime: 1_000, mtime: 1_000, size: 100 },
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

describe("TagDiscoveryService", () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it("returns no tags for an empty vault", () => {
		mockApp.vault.getMarkdownFiles = vi.fn(() => []);
		const discovery = new TagDiscoveryService(new ObsidianAPI(mockApp));

		expect(discovery.getAvailableTags()).toEqual([]);
	});

	it("normalizes, deduplicates, and sorts inline, nested, and frontmatter tags", () => {
		const inlineFile = createMockTFile("inline.md");
		const frontmatterFile = createMockTFile("folder/frontmatter.md");
		mockApp.vault.getMarkdownFiles = vi.fn(() => [frontmatterFile, inlineFile]);
		mockApp.metadataCache.getCache = vi.fn((path: string) =>
			path === "inline.md"
				? { tags: [createTag("#Project/Alpha"), createTag("#project/alpha")] }
				: { frontmatter: { tags: ["Archive/2026", "project/alpha"] } }
		);
		const discovery = new TagDiscoveryService(new ObsidianAPI(mockApp));

		expect(discovery.getAvailableTags()).toEqual(["archive/2026", "project/alpha"]);
	});

	it("reuses the cache for an unchanged vault and protects it from callers", () => {
		const file = createMockTFile("note.md");
		const getMarkdownFiles = vi.fn(() => [file]);
		mockApp.vault.getMarkdownFiles = getMarkdownFiles;
		mockApp.metadataCache.getCache = vi.fn(() => ({ tags: [createTag("#stable")] }));
		const discovery = new TagDiscoveryService(new ObsidianAPI(mockApp));

		const firstResult = discovery.getAvailableTags();
		firstResult.push("mutated");

		expect(discovery.getAvailableTags()).toEqual(["stable"]);
		expect(getMarkdownFiles).toHaveBeenCalledTimes(1);
	});

	it("rebuilds the cached result after metadata changes invalidate it", () => {
		const file = createMockTFile("note.md");
		const getMarkdownFiles = vi.fn(() => [file]);
		mockApp.vault.getMarkdownFiles = getMarkdownFiles;
		let tag = "#before";
		mockApp.metadataCache.getCache = vi.fn(() => ({ tags: [createTag(tag)] }));
		const discovery = new TagDiscoveryService(new ObsidianAPI(mockApp));

		expect(discovery.getAvailableTags()).toEqual(["before"]);
		tag = "#after";
		discovery.invalidate();

		expect(discovery.getAvailableTags()).toEqual(["after"]);
		expect(getMarkdownFiles).toHaveBeenCalledTimes(2);
	});

	it("scans a large vault only once while its cache remains valid", () => {
		const files = Array.from({ length: 10_000 }, (_, index) =>
			createMockTFile(`folder/note-${index}.md`)
		);
		const getMarkdownFiles = vi.fn<() => TFile[]>(() => files);
		const getNoteTags = vi.fn<(file: TFile) => string[]>((file) => [
			`group/${Number.parseInt(file.path.slice("folder/note-".length, -".md".length), 10) % 10}`,
		]);
		const source: TagDiscoverySource = {
			getMarkdownFiles,
			getNoteTags,
		};
		const discovery = new TagDiscoveryService(source);

		expect(discovery.getAvailableTags()).toHaveLength(10);
		expect(discovery.getAvailableTags()).toHaveLength(10);
		expect(getMarkdownFiles).toHaveBeenCalledTimes(1);
		expect(getNoteTags).toHaveBeenCalledTimes(10_000);
	});
});
