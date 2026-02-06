import { describe, it, expect } from "vitest";
import { applyContentSelection } from "../../src/ui/treeContentSelection";
import { ExportNode } from "../../src/types";

const createNode = (
	id: string,
	includeContent: boolean,
	content = "",
	children: ExportNode[] = []
) => ({
	id,
	title: id,
	depth: 0,
	includeContent,
	content,
	children,
	tokenCount: 0,
	lastModified: new Date(),
});

describe("applyContentSelection", () => {
	it("keeps titles and removes content for unselected nodes", () => {
		const child1 = createNode("child1", true, "child1 content");
		const child2 = createNode("child2", true, "child2 content");
		const root = createNode("root", true, "root content", [child1, child2]);

		const selected = new Set<string>(["root", "child1"]);
		const result = applyContentSelection(root, selected);

		expect(result.title).toBe("root");
		expect(result.includeContent).toBe(true);
		expect(result.content).toBe("root content");
		expect(result.children.length).toBe(2);
		expect(result.children[0].content).toBe("child1 content");
		expect(result.children[1].content).toBeUndefined();
		expect(result.children[1].includeContent).toBe(false);
	});

	it("does not re-enable content when includeContent is already false", () => {
		const child = createNode("child", false, "hidden content");
		const root = createNode("root", true, "root content", [child]);

		const selected = new Set<string>(["root", "child"]);
		const result = applyContentSelection(root, selected);

		expect(result.children[0].includeContent).toBe(false);
		expect(result.children[0].content).toBeUndefined();
	});
});
