import { describe, it, expect } from "vitest";
import {
	deselectSubtree,
	enforceAncestorSelection,
	reconcileContentSelectionState,
	selectAncestors,
	selectNode,
	selectSubtree,
} from "../../src/ui/treeSelection";
import { ExportNode } from "../../src/types";

const createNode = (id: string, children: ExportNode[] = []): ExportNode => ({
	id,
	title: id,
	depth: 0,
	includeContent: true,
	children,
	tokenCount: 0,
	lastModified: new Date(),
});

describe("treeSelection", () => {
	it("selectAncestors adds all ancestor ids", () => {
		const selected = new Set<string>(["B"]);
		selectAncestors(selected, ["root", "A"]);

		expect(selected.has("root")).toBe(true);
		expect(selected.has("A")).toBe(true);
		expect(selected.has("B")).toBe(true);
	});

	it("deselectSubtree removes node and descendants but keeps others", () => {
		const nodeA1 = createNode("A1");
		const nodeA = createNode("A", [nodeA1]);

		const selected = new Set<string>(["root", "A", "A1", "B"]);
		deselectSubtree(selected, nodeA);

		expect(selected.has("root")).toBe(true);
		expect(selected.has("B")).toBe(true);
		expect(selected.has("A")).toBe(false);
		expect(selected.has("A1")).toBe(false);
	});

	it("selectNode does not auto-select descendants", () => {
		const nodeA1a = createNode("A1a");
		const nodeA1 = createNode("A1", [nodeA1a]);
		const nodeA = createNode("A", [nodeA1]);
		const root = createNode("root", [nodeA]);

		const selected = new Set<string>();
		selectAncestors(selected, ["root", "A"]);
		selectNode(selected, "A1");

		expect(selected.has("root")).toBe(true);
		expect(selected.has("A")).toBe(true);
		expect(selected.has("A1")).toBe(true);
		expect(selected.has("A1a")).toBe(false);
		expect(root.children[0].children[0].id).toBe("A1");
	});

	it("selectSubtree selects node and descendants", () => {
		const nodeA1a = createNode("A1a");
		const nodeA1 = createNode("A1", [nodeA1a]);
		const nodeA = createNode("A", [nodeA1]);

		const selected = new Set<string>();
		selectSubtree(selected, nodeA);

		expect(selected.has("A")).toBe(true);
		expect(selected.has("A1")).toBe(true);
		expect(selected.has("A1a")).toBe(true);
		expect(selected.has("root")).toBe(false);
	});

	it("selectSubtree skips nodes without content", () => {
		const nodeA1a = createNode("A1a", []);
		const nodeA1 = createNode("A1", [nodeA1a]);
		const nodeA = createNode("A", [nodeA1]);
		const root = createNode("root", [nodeA]);

		nodeA1.includeContent = false;
		nodeA1a.includeContent = false;

		const selected = new Set<string>();
		selectSubtree(selected, root);

		expect(selected.has("root")).toBe(true);
		expect(selected.has("A")).toBe(true);
		expect(selected.has("A1")).toBe(false);
		expect(selected.has("A1a")).toBe(false);
	});

	it("enforceAncestorSelection removes descendants when parent is deselected", () => {
		const nodeA1a = createNode("A1a");
		const nodeA1 = createNode("A1", [nodeA1a]);
		const nodeA = createNode("A", [nodeA1]);
		const root = createNode("root", [nodeA]);

		const selected = new Set<string>(["root", "A1", "A1a"]);
		enforceAncestorSelection(selected, root, true);

		expect(selected.has("root")).toBe(true);
		expect(selected.has("A")).toBe(false);
		expect(selected.has("A1")).toBe(false);
		expect(selected.has("A1a")).toBe(false);
	});

	it("preserves explicit deselections when a rebuilt tree adds a new note", () => {
		const originalChild = createNode("original-child");
		const originalRoot = createNode("root", [originalChild]);
		const selected = new Set<string>();
		const knownContent = new Set<string>();
		const userDeselected = new Set<string>();

		reconcileContentSelectionState(selected, knownContent, userDeselected, originalRoot);
		deselectSubtree(selected, originalChild);
		userDeselected.add(originalChild.id);

		const addedNote = createNode("added-note");
		const rebuiltRoot = createNode("root", [createNode("original-child"), addedNote]);
		reconcileContentSelectionState(selected, knownContent, userDeselected, rebuiltRoot);

		expect(selected.has("root")).toBe(true);
		expect(selected.has("original-child")).toBe(false);
		expect(selected.has("added-note")).toBe(true);
		expect(userDeselected.has("original-child")).toBe(true);
	});

	it("keeps a locked primary root selected under a synthetic bundle root", () => {
		const primaryRootPath = "Projects/Launch plan.md";
		const extraRootPath = "References/Budget.md";
		const primaryRoot = createNode(primaryRootPath);
		const extraRoot = createNode(extraRootPath);
		const bundleRoot = createNode("__smart_export_bundle_root__", [primaryRoot, extraRoot]);
		bundleRoot.includeContent = false;
		bundleRoot.synthetic = true;
		const selected = new Set<string>([extraRootPath]);
		const knownContent = new Set<string>([primaryRootPath, extraRootPath]);
		const userDeselected = new Set<string>([primaryRootPath]);

		reconcileContentSelectionState(
			selected,
			knownContent,
			userDeselected,
			bundleRoot,
			new Set([primaryRootPath])
		);

		expect(selected.has("__smart_export_bundle_root__")).toBe(false);
		expect(selected.has(primaryRootPath)).toBe(true);
		expect(selected.has(extraRootPath)).toBe(true);
		expect(userDeselected.has(primaryRootPath)).toBe(false);
	});
});
