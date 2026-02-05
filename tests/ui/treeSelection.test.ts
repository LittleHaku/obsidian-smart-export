import { describe, it, expect } from "vitest";
import {
	deselectSubtree,
	enforceAncestorSelection,
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
		const nodeB = createNode("B");
		const root = createNode("root", [nodeA, nodeB]);

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
		const root = createNode("root", [nodeA]);

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
		enforceAncestorSelection(selected, root, true, true);

		expect(selected.has("root")).toBe(true);
		expect(selected.has("A")).toBe(false);
		expect(selected.has("A1")).toBe(false);
		expect(selected.has("A1a")).toBe(false);
	});
});
