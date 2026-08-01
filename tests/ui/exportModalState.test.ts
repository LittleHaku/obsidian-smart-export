import { TFile } from "obsidian";
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../../src/settings/defaultSettings";
import { ExportNode } from "../../src/types";
import {
	applyExportChoiceSelection,
	buildContentDisplayTree,
	clearNodeIdsInSubtree,
	collapseAllNodes,
	countTreeNodes,
	EXPORT_CHOICE_LLM_PREFIX,
	formatTokenCountMessage,
	getAddedItemScopeText,
	getCurrentExportChoiceValue,
	getTreeCacheKey,
	markUserDeselectedSubtree,
	selectAllNodes,
} from "../../src/ui/exportModalState";

function createFile(path: string): TFile {
	const file = new TFile();
	file.path = path;
	file.name = path.split("/").pop() ?? path;
	file.basename = file.name.replace(/\.md$/i, "");
	file.extension = "md";
	file.stat = { ctime: 0, mtime: 0, size: 0 };
	file.parent = null;
	return file;
}

function createNode(id: string, children: ExportNode[] = [], includeContent = true): ExportNode {
	return {
		id,
		title: id,
		depth: 0,
		includeContent,
		content: includeContent ? `${id} content` : undefined,
		children,
		tokenCount: 0,
		lastModified: new Date(0),
	};
}

describe("exportModalState", () => {
	it("normalizes export choices without mutating the previous state", () => {
		const initial = { format: "xml" as const, templateId: "builtin:default" };
		const custom = applyExportChoiceSelection(initial, `${EXPORT_CHOICE_LLM_PREFIX}user:custom.md`);

		expect(initial.format).toBe("xml");
		expect(custom).toEqual({ format: "llm-markdown", templateId: "user:custom.md" });
		expect(getCurrentExportChoiceValue(custom, [])).toBe(
			`${EXPORT_CHOICE_LLM_PREFIX}builtin:default`
		);
	});

	it("builds collision-safe cache keys for mixed session-only additions", () => {
		const root = createFile("Projects/Root.md");
		const extra = createFile("Projects/Extra.md");
		const key = getTreeCacheKey({
			sourceMode: "note",
			selectedFile: root,
			selectedTag: "",
			addedNotes: [
				{ kind: "note", file: extra, mode: "extra-root" },
				{ kind: "tag", tag: " #Project " },
			],
			contentDepth: 3,
			titleDepth: 6,
			linkTraversalMode: "both",
			settings: DEFAULT_SETTINGS,
		});

		expect(key).toContain('added:[["note","Projects/Extra.md","extra-root"],["tag","project"]]');
		expect(key).toContain("|mode:both|");
	});

	it("keeps locked roots selected while projecting and counting content nodes", () => {
		const leaf = createNode("Leaf.md");
		const titleOnly = createNode("Title only.md", [], false);
		const root = createNode("Root.md", [leaf, titleOnly]);
		const selected = new Set<string>();
		const deselected = new Set<string>();

		selectAllNodes(root, selected);
		markUserDeselectedSubtree(root, deselected, new Set([root.id]));
		collapseAllNodes(root, new Set());

		expect(selected).toEqual(new Set(["Root.md", "Leaf.md"]));
		expect(deselected).toEqual(new Set(["Leaf.md"]));
		expect(countTreeNodes(root, selected)).toEqual({ total: 2, selected: 2 });
		expect(buildContentDisplayTree(titleOnly)).toBeNull();

		clearNodeIdsInSubtree(root, selected);
		expect(selected.size).toBe(0);
	});

	it("keeps user-facing scope and token warnings stable", () => {
		expect(
			getAddedItemScopeText({ kind: "note", file: createFile("Single.md"), mode: "single-note" })
		).toBe("Single note: includes only this note.");
		expect(formatTokenCountMessage(200_001)).toContain("exceeds most context limits");
	});
});
