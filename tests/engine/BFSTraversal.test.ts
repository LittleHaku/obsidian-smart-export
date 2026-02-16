import { describe, it, expect, beforeEach, vi } from "vitest";
import { BFSTraversal } from "../../src/engine/BFSTraversal";
import { mockApp } from "../mocks/mockObsidianAPI";
import { TFile, LinkCache, FrontmatterLinkCache } from "obsidian";
import { ObsidianAPI } from "../../src/obsidian-api";

// Mock TFile constructor
const createMockTFile = (path: string, basename: string): TFile => {
	const file = new TFile();
	Object.assign(file, {
		path: path,
		name: basename,
		basename: basename,
		extension: "md",
		vault: mockApp.vault,
		stat: {
			ctime: Date.now(),
			mtime: Date.now(),
			size: 100,
		},
		parent: null,
	});
	return file;
};

describe("BFSTraversal", () => {
	let bfsTraversal: BFSTraversal;
	let obsidianAPI: ObsidianAPI;
	const mockFiles: { [key: string]: TFile } = {};
	const mockFileContents: { [key: string]: string } = {};
	const mockFileLinks: { [key: string]: LinkCache[] } = {};
	const mockFileFrontmatterLinks: { [key: string]: FrontmatterLinkCache[] } = {};

	const rebuildResolvedLinks = () => {
		const resolvedLinks: Record<string, Record<string, number>> = {};

		for (const [sourcePath, links] of Object.entries(mockFileLinks)) {
			for (const link of links) {
				const targetFile = Object.values(mockFiles).find((file) => file.basename === link.link);
				if (!targetFile) continue;
				resolvedLinks[sourcePath] ??= {};
				resolvedLinks[sourcePath][targetFile.path] =
					(resolvedLinks[sourcePath][targetFile.path] ?? 0) + 1;
			}
		}

		for (const [sourcePath, links] of Object.entries(mockFileFrontmatterLinks)) {
			for (const link of links) {
				const targetFile = Object.values(mockFiles).find((file) => file.basename === link.link);
				if (!targetFile) continue;
				resolvedLinks[sourcePath] ??= {};
				resolvedLinks[sourcePath][targetFile.path] =
					(resolvedLinks[sourcePath][targetFile.path] ?? 0) + 1;
			}
		}

		(
			mockApp.metadataCache as { resolvedLinks: Record<string, Record<string, number>> }
		).resolvedLinks = resolvedLinks;
	};

	// Helper function to create LinkCache objects
	const createLink = (link: string): LinkCache => ({
		link,
		original: `[[${link}]]`,
		position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 0, offset: 0 } },
	});
	const createFrontmatterLink = (link: string, key: string): FrontmatterLinkCache => ({
		link,
		original: `[[${link}]]`,
		key,
	});

	beforeEach(() => {
		vi.resetAllMocks();
		for (const collection of [
			mockFiles as Record<string, unknown>,
			mockFileContents as Record<string, unknown>,
			mockFileLinks as Record<string, unknown>,
			mockFileFrontmatterLinks as Record<string, unknown>,
		]) {
			for (const key of Object.keys(collection)) {
				delete collection[key];
			}
		}

		// Setup mock files
		mockFiles["root.md"] = createMockTFile("root.md", "root");
		mockFiles["A.md"] = createMockTFile("A.md", "A");
		mockFiles["B.md"] = createMockTFile("B.md", "B");
		mockFiles["C.md"] = createMockTFile("C.md", "C");
		mockFiles["D.md"] = createMockTFile("D.md", "D");
		mockFiles["cycle1.md"] = createMockTFile("cycle1.md", "cycle1");
		mockFiles["cycle2.md"] = createMockTFile("cycle2.md", "cycle2");
		// Note: deliberately NOT creating 'missing.md' to test missing note handling

		// Setup mock file contents
		mockFileContents["root.md"] = "[[A]] [[B]] [[missing]]";
		mockFileContents["A.md"] = "[[C]] [[D]]";
		mockFileContents["B.md"] = "";
		mockFileContents["C.md"] = "";
		mockFileContents["D.md"] = "[[A]]"; // Link back to A
		mockFileContents["cycle1.md"] = "[[cycle2]]";
		mockFileContents["cycle2.md"] = "[[cycle1]]";

		// Setup mock link resolution
		mockFileLinks["root.md"] = [createLink("A"), createLink("B"), createLink("missing")];
		mockFileLinks["A.md"] = [createLink("C"), createLink("D")];
		mockFileLinks["B.md"] = [];
		mockFileLinks["C.md"] = [];
		mockFileLinks["D.md"] = [createLink("A")];
		mockFileLinks["cycle1.md"] = [createLink("cycle2")];
		mockFileLinks["cycle2.md"] = [createLink("cycle1")];
		mockFileFrontmatterLinks["root.md"] = [];
		mockFileFrontmatterLinks["A.md"] = [];
		mockFileFrontmatterLinks["B.md"] = [];
		mockFileFrontmatterLinks["C.md"] = [];
		mockFileFrontmatterLinks["D.md"] = [];
		mockFileFrontmatterLinks["cycle1.md"] = [];
		mockFileFrontmatterLinks["cycle2.md"] = [];
		rebuildResolvedLinks();

		// Mock App object behavior
		mockApp.vault.getAbstractFileByPath = vi.fn((path: string) => mockFiles[path]);
		mockApp.vault.getFileByPath = vi.fn((path: string) => mockFiles[path] || null);
		mockApp.vault.cachedRead = vi.fn((file: TFile) =>
			Promise.resolve(mockFileContents[file.path] || "")
		);
		mockApp.metadataCache.getCache = vi.fn((path: string) => ({
			links: mockFileLinks[path] || [],
			frontmatterLinks: mockFileFrontmatterLinks[path] || [],
		}));
		mockApp.metadataCache.getFirstLinkpathDest = vi.fn((link: string, sourcePath: string) => {
			if (link === "missing") return null;
			const targetFile = Object.values(mockFiles).find((f) => f.basename === link);
			return targetFile || null;
		});

		obsidianAPI = new ObsidianAPI(mockApp);
		bfsTraversal = new BFSTraversal(obsidianAPI, 1, 2);
	});

	it("should correctly traverse the note graph from the root", async () => {
		const rootNode = await bfsTraversal.traverse("root.md");
		expect(rootNode).not.toBeNull();
		expect(rootNode?.title).toBe("root");
		expect(rootNode?.children.length).toBe(2);
		expect(rootNode?.children[0].title).toBe("A");
		expect(rootNode?.children[1].title).toBe("B");
		expect(rootNode?.children[0].children.length).toBe(2);
		expect(rootNode?.children[0].children[0].title).toBe("C");
	});

	it("should respect contentDepth and titleDepth", async () => {
		const rootNode = await bfsTraversal.traverse("root.md");
		expect(rootNode?.depth).toBe(0);
		expect(rootNode?.includeContent).toBe(true);
		expect(rootNode?.content).toBe("[[A]] [[B]] [[missing]]");

		const nodeA = rootNode?.children[0];
		expect(nodeA?.depth).toBe(1);
		expect(nodeA?.includeContent).toBe(true);
		expect(nodeA?.content).toBe("[[C]] [[D]]");

		const nodeC = nodeA?.children[0];
		expect(nodeC?.depth).toBe(2);
		expect(nodeC?.includeContent).toBe(false);
		expect(nodeC?.content).toBeUndefined();
	});

	it("should handle circular references gracefully", async () => {
		const rootNode = await bfsTraversal.traverse("cycle1.md");
		expect(rootNode).not.toBeNull();
		expect(rootNode?.title).toBe("cycle1");
		expect(rootNode?.children.length).toBe(1);
		expect(rootNode?.children[0].title).toBe("cycle2");
		expect(rootNode?.children[0].children.length).toBe(0); // Should not link back to cycle1
	});

	it("should handle missing notes (unresolved links)", async () => {
		const rootNode = await bfsTraversal.traverse("root.md");

		// Should have 2 children (A and B), but not 'missing'
		expect(rootNode?.children.length).toBe(2);
		const titles = rootNode?.children.map((c) => c.title);
		expect(titles).toContain("A");
		expect(titles).toContain("B");
		expect(titles).not.toContain("missing");

		// Should track 'missing' as a missing note
		const missingNotes = bfsTraversal.getMissingNotes();
		expect(missingNotes).toContain("missing");
		expect(missingNotes.length).toBe(1);
	});

	it("should return null if the root note is not found", async () => {
		const result = await bfsTraversal.traverse("nonexistent.md");
		expect(result).toBeNull();
	});

	it("should include links from frontmatter properties", async () => {
		mockFiles["fm-root.md"] = createMockTFile("fm-root.md", "fm-root");
		mockFileContents["fm-root.md"] = "No links in body.";
		mockFileLinks["fm-root.md"] = [];
		mockFileFrontmatterLinks["fm-root.md"] = [createFrontmatterLink("A", "related")];
		rebuildResolvedLinks();

		const rootNode = await bfsTraversal.traverse("fm-root.md");

		expect(rootNode).not.toBeNull();
		expect(rootNode?.children.length).toBe(1);
		expect(rootNode?.children[0].title).toBe("A");
	});

	it("should track multiple missing notes across different depths", async () => {
		// Add a note with multiple missing links
		mockFiles["multi-missing.md"] = createMockTFile("multi-missing.md", "multi-missing");
		mockFileContents["multi-missing.md"] = "[[missing1]] [[missing2]] [[A]]";
		mockFileLinks["multi-missing.md"] = [
			createLink("missing1"),
			createLink("missing2"),
			createLink("A"),
		];
		rebuildResolvedLinks();

		const rootNode = await bfsTraversal.traverse("multi-missing.md");

		// Should only have A as a child, not the missing ones
		expect(rootNode?.children.length).toBe(1);
		expect(rootNode?.children[0].title).toBe("A");

		// Should track both missing notes
		const missingNotes = bfsTraversal.getMissingNotes();
		expect(missingNotes).toContain("missing1");
		expect(missingNotes).toContain("missing2");
		expect(missingNotes.length).toBe(2);
	});

	it("should properly handle child node creation and queue management", async () => {
		// Create a more complex structure to ensure child nodes are properly created
		// and added to both parent.children and the processing queue

		mockFiles["parent.md"] = createMockTFile("parent.md", "parent");
		mockFiles["child1.md"] = createMockTFile("child1.md", "child1");
		mockFiles["child2.md"] = createMockTFile("child2.md", "child2");
		mockFiles["grandchild.md"] = createMockTFile("grandchild.md", "grandchild");

		mockFileContents["parent.md"] = "[[child1]] [[child2]]";
		mockFileContents["child1.md"] = "[[grandchild]]";
		mockFileContents["child2.md"] = "";
		mockFileContents["grandchild.md"] = "";

		mockFileLinks["parent.md"] = [createLink("child1"), createLink("child2")];
		mockFileLinks["child1.md"] = [createLink("grandchild")];
		mockFileLinks["child2.md"] = [];
		mockFileLinks["grandchild.md"] = [];
		rebuildResolvedLinks();

		const rootNode = await bfsTraversal.traverse("parent.md");

		// This should exercise the path where child nodes are successfully created
		// and added to parent.children (lines 106-107)
		expect(rootNode).not.toBeNull();
		expect(rootNode?.title).toBe("parent");
		expect(rootNode?.children.length).toBe(2);
		expect(rootNode?.children[0].title).toBe("child1");
		expect(rootNode?.children[1].title).toBe("child2");
		expect(rootNode?.children[0].children.length).toBe(1);
		expect(rootNode?.children[0].children[0].title).toBe("grandchild");
	});

	it("should traverse incoming backlinks when mode is incoming", async () => {
		const traversal = new BFSTraversal(obsidianAPI, 1, 2, "incoming");
		const rootNode = await traversal.traverse("A.md");

		expect(rootNode).not.toBeNull();
		expect(rootNode?.title).toBe("A");
		expect(rootNode?.children.map((child) => child.title)).toEqual(["D", "root"]);
		expect(traversal.getMissingNotes()).toHaveLength(0);
	});

	it("should exclude notes in ignored traversal folders for outgoing links", async () => {
		mockFiles["root-folder-test.md"] = createMockTFile("root-folder-test.md", "root-folder-test");
		mockFiles["keep/visible.md"] = createMockTFile("keep/visible.md", "visible");
		mockFiles["excluded/hidden.md"] = createMockTFile("excluded/hidden.md", "hidden");

		mockFileContents["root-folder-test.md"] = "[[visible]] [[hidden]]";
		mockFileContents["keep/visible.md"] = "";
		mockFileContents["excluded/hidden.md"] = "";

		mockFileLinks["root-folder-test.md"] = [createLink("visible"), createLink("hidden")];
		mockFileLinks["keep/visible.md"] = [];
		mockFileLinks["excluded/hidden.md"] = [];

		mockFileFrontmatterLinks["root-folder-test.md"] = [];
		mockFileFrontmatterLinks["keep/visible.md"] = [];
		mockFileFrontmatterLinks["excluded/hidden.md"] = [];
		rebuildResolvedLinks();

		const traversal = new BFSTraversal(obsidianAPI, 1, 1, "outgoing", {
			ignoredTraversalFolders: ["excluded"],
		});
		const rootNode = await traversal.traverse("root-folder-test.md");

		expect(rootNode).not.toBeNull();
		expect(rootNode?.children.map((child) => child.id)).toEqual(["keep/visible.md"]);
	});

	it("should exclude notes in ignored traversal folders for incoming links", async () => {
		mockFiles["target-global-ignore.md"] = createMockTFile(
			"target-global-ignore.md",
			"target-global-ignore"
		);
		mockFiles["included/source.md"] = createMockTFile("included/source.md", "source");
		mockFiles["excluded/source-hidden.md"] = createMockTFile(
			"excluded/source-hidden.md",
			"source-hidden"
		);

		mockFileContents["target-global-ignore.md"] = "";
		mockFileContents["included/source.md"] = "[[target-global-ignore]]";
		mockFileContents["excluded/source-hidden.md"] = "[[target-global-ignore]]";

		mockFileLinks["target-global-ignore.md"] = [];
		mockFileLinks["included/source.md"] = [createLink("target-global-ignore")];
		mockFileLinks["excluded/source-hidden.md"] = [createLink("target-global-ignore")];

		mockFileFrontmatterLinks["target-global-ignore.md"] = [];
		mockFileFrontmatterLinks["included/source.md"] = [];
		mockFileFrontmatterLinks["excluded/source-hidden.md"] = [];
		rebuildResolvedLinks();

		const traversal = new BFSTraversal(obsidianAPI, 1, 1, "incoming", {
			ignoredTraversalFolders: ["excluded"],
		});
		const rootNode = await traversal.traverse("target-global-ignore.md");

		expect(rootNode).not.toBeNull();
		expect(rootNode?.children.map((child) => child.id)).toEqual(["included/source.md"]);
	});

	it("should exclude notes in ignored traversal folders when mode is both", async () => {
		mockFiles["both/target.md"] = createMockTFile("both/target.md", "both-target");
		mockFiles["included/both-keep-out.md"] = createMockTFile(
			"included/both-keep-out.md",
			"both-keep-out"
		);
		mockFiles["excluded/both-drop-out.md"] = createMockTFile(
			"excluded/both-drop-out.md",
			"both-drop-out"
		);
		mockFiles["included/both-keep-in.md"] = createMockTFile(
			"included/both-keep-in.md",
			"both-keep-in"
		);
		mockFiles["excluded/both-drop-in.md"] = createMockTFile(
			"excluded/both-drop-in.md",
			"both-drop-in"
		);

		mockFileContents["both/target.md"] = "[[both-keep-out]] [[both-drop-out]]";
		mockFileContents["included/both-keep-out.md"] = "[[both-target]]";
		mockFileContents["excluded/both-drop-out.md"] = "[[both-target]]";
		mockFileContents["included/both-keep-in.md"] = "[[both-target]]";
		mockFileContents["excluded/both-drop-in.md"] = "[[both-target]]";

		mockFileLinks["both/target.md"] = [createLink("both-keep-out"), createLink("both-drop-out")];
		mockFileLinks["included/both-keep-out.md"] = [createLink("both-target")];
		mockFileLinks["excluded/both-drop-out.md"] = [createLink("both-target")];
		mockFileLinks["included/both-keep-in.md"] = [createLink("both-target")];
		mockFileLinks["excluded/both-drop-in.md"] = [createLink("both-target")];

		mockFileFrontmatterLinks["both/target.md"] = [];
		mockFileFrontmatterLinks["included/both-keep-out.md"] = [];
		mockFileFrontmatterLinks["excluded/both-drop-out.md"] = [];
		mockFileFrontmatterLinks["included/both-keep-in.md"] = [];
		mockFileFrontmatterLinks["excluded/both-drop-in.md"] = [];
		rebuildResolvedLinks();

		const traversal = new BFSTraversal(obsidianAPI, 1, 1, "both", {
			ignoredTraversalFolders: ["excluded"],
		});
		const rootNode = await traversal.traverse("both/target.md");

		expect(rootNode).not.toBeNull();
		expect(rootNode?.children.map((child) => child.id)).toEqual([
			"included/both-keep-out.md",
			"included/both-keep-in.md",
		]);
	});

	it("should traverse outgoing and incoming links without duplicates when mode is both", async () => {
		const traversal = new BFSTraversal(obsidianAPI, 1, 1, "both");
		const rootNode = await traversal.traverse("A.md");

		expect(rootNode).not.toBeNull();
		expect(rootNode?.title).toBe("A");
		expect(rootNode?.children.map((child) => child.title)).toEqual(["C", "D", "root"]);
		expect(new Set(rootNode?.children.map((child) => child.id)).size).toBe(3);
	});

	it("should deduplicate repeated outgoing links to the same file", async () => {
		mockFileLinks["root.md"] = [createLink("A"), createLink("A"), createLink("B")];
		rebuildResolvedLinks();

		const traversal = new BFSTraversal(obsidianAPI, 1, 1, "outgoing");
		const rootNode = await traversal.traverse("root.md");

		expect(rootNode).not.toBeNull();
		expect(rootNode?.children.map((child) => child.title)).toEqual(["A", "B"]);
		expect(new Set(rootNode?.children.map((child) => child.id)).size).toBe(2);
	});

	it("should skip content reads when no nodes are content-eligible", async () => {
		const traversal = new BFSTraversal(obsidianAPI, -1, 2);
		const rootNode = await traversal.traverse("root.md");

		expect(rootNode).not.toBeNull();
		expect(rootNode?.includeContent).toBe(false);
		expect(rootNode?.content).toBeUndefined();
		const cachedReadCalls = (
			mockApp.vault as unknown as { cachedRead: { mock: { calls: unknown[] } } }
		).cachedRead.mock.calls.length;
		expect(cachedReadCalls).toBe(0);
	});
});
