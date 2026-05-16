import { describe, expect, it } from "vitest";
import { TFile } from "obsidian";
import {
	composeExportTree,
	createStandaloneExportNode,
	SYNTHETIC_EXPORT_ROOT_ID,
} from "../../src/engine/exportTreeComposition";
import { ExportNode } from "../../src/types";

function createNode(id: string, children: ExportNode[] = []): ExportNode {
	return {
		id,
		title: id.replace(/\.md$/, ""),
		depth: 0,
		includeContent: true,
		content: `${id} content`,
		children,
		tokenCount: 0,
		lastModified: new Date(1_000),
	};
}

function createFile(path: string, mtime: number): TFile {
	const file = new TFile();
	const name = path.split("/").pop() ?? path;
	Object.assign(file, {
		path,
		name,
		basename: name.replace(/\.md$/, ""),
		extension: "md",
		stat: {
			ctime: mtime,
			mtime,
			size: 10,
		},
		parent: null,
	});
	return file;
}

describe("exportTreeComposition", () => {
	it("returns the primary tree unchanged when there are no added notes", () => {
		const primaryTree = createNode("root.md");

		const composedTree = composeExportTree({ primaryTree });

		expect(composedTree).toBe(primaryTree);
	});

	it("combines the primary tree, extra roots, and single notes under a synthetic root", () => {
		const primaryTree = createNode("root.md");
		const extraRootTree = createNode("extra.md", [createNode("extra-child.md")]);
		const singleNoteNode = createNode("single.md");

		const composedTree = composeExportTree({
			primaryTree,
			extraRootTrees: [extraRootTree],
			singleNoteNodes: [singleNoteNode],
		});

		expect(composedTree.id).toBe(SYNTHETIC_EXPORT_ROOT_ID);
		expect(composedTree.synthetic).toBe(true);
		expect(composedTree.includeContent).toBe(false);
		expect(composedTree.children.map((child) => child.id)).toEqual([
			"root.md",
			"extra.md",
			"single.md",
		]);
		expect(composedTree.children[1].children[0].id).toBe("extra-child.md");
	});

	it("promotes explicitly added notes over matching primary tree descendants", () => {
		const primaryTree = createNode("root.md", [createNode("shared.md")]);
		const extraRootTree = createNode("extra.md", [
			createNode("shared.md"),
			createNode("unique.md"),
		]);
		const duplicateSingleNote = createNode("shared.md");

		const composedTree = composeExportTree({
			primaryTree,
			extraRootTrees: [extraRootTree],
			singleNoteNodes: [duplicateSingleNote],
		});

		const extraRoot = composedTree.children[1];
		expect(composedTree.children[0].children).toEqual([]);
		expect(extraRoot.children.map((child) => child.id)).toEqual(["shared.md", "unique.md"]);
		expect(composedTree.children.map((child) => child.id)).toEqual(["root.md", "extra.md"]);
	});

	it("creates a top-level entry for an added note that was already a primary tree descendant", () => {
		const primaryTree = createNode("root.md", [createNode("shared.md")]);
		const duplicateSingleNote = createNode("shared.md");

		const composedTree = composeExportTree({
			primaryTree,
			singleNoteNodes: [duplicateSingleNote],
		});

		expect(composedTree.id).toBe(SYNTHETIC_EXPORT_ROOT_ID);
		expect(composedTree.children[0].children).toEqual([]);
		expect(composedTree.children.map((child) => child.id)).toEqual(["root.md", "shared.md"]);
	});

	it("keeps the primary tree when an added note duplicates the primary root", () => {
		const primaryTree = createNode("root.md", [createNode("child.md")]);
		const duplicateRoot = createNode("root.md");

		const composedTree = composeExportTree({
			primaryTree,
			singleNoteNodes: [duplicateRoot],
		});

		expect(composedTree.id).toBe("root.md");
		expect(composedTree.synthetic).toBeUndefined();
		expect(composedTree.children.map((child) => child.id)).toEqual(["child.md"]);
	});

	it("creates standalone note nodes without traversed children", () => {
		const file = createFile("notes/standalone.md", 123_456);

		const node = createStandaloneExportNode(file, { content: "Standalone content" });

		expect(node).toMatchObject({
			id: "notes/standalone.md",
			title: "standalone",
			depth: 0,
			includeContent: true,
			content: "Standalone content",
			children: [],
			tokenCount: 0,
		});
		expect(node.lastModified).toEqual(new Date(123_456));
	});
});
