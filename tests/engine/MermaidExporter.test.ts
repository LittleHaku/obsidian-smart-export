import { describe, expect, it } from "vitest";
import { MermaidExporter } from "../../src/engine/MermaidExporter";
import { ExportNode } from "../../src/types";

function createNode(
	title: string,
	id: string,
	depth = 0,
	children: ExportNode[] = [],
	outgoingLinks?: string[]
): ExportNode {
	return {
		id,
		title,
		depth,
		includeContent: true,
		children,
		...(outgoingLinks ? { outgoingLinks } : {}),
		tokenCount: 0,
		lastModified: new Date(0),
	};
}

describe("MermaidExporter", () => {
	it("renders a stable flowchart with escaped labels, tree edges, and depth styles", () => {
		const child = createNode('Child "note"', "folder/child.md", 1);
		const root = createNode("Root <note> & details", "root.md", 0, [child]);
		const exporter = new MermaidExporter();

		const output = exporter.export(root);

		expect(output).toContain("```mermaid\nflowchart TD");
		expect(output).toContain("Root &lt;note&gt; &amp; details");
		expect(output).toContain("Child &quot;note&quot;");
		expect(output).toMatch(/note_[0-9a-f]{8}\["Root/);
		expect(output).toMatch(/note_[0-9a-f]{8} --> note_[0-9a-f]{8}/);
		expect(output).toContain("classDef depth0");
		expect(output).toContain("classDef depth1");
		expect(output).toMatch(/\n```$/);
		expect(exporter.export(root)).toBe(output);
	});

	it("uses directed graph metadata, deduplicates edges, and skips missing targets", () => {
		const root = createNode("Root", "root.md", 0, [], ["child.md", "child.md", "missing.md"]);
		const child = createNode("Child", "child.md", 1);
		const syntheticRoot = createNode("Export bundle", "synthetic", 0, [root, child]);
		syntheticRoot.synthetic = true;

		const output = new MermaidExporter().export(syntheticRoot);
		const edgeLines = output.split("\n").filter((line) => line.includes(" --> "));

		expect(edgeLines).toHaveLength(1);
		expect(output).toContain("classDef depth0");
		expect(output).toContain("classDef depth1");
		expect(output).not.toContain("Export bundle");
	});

	it("walks synthetic tree branches when using legacy tree edges", () => {
		const syntheticChild = createNode("Synthetic", "synthetic-child", 1, [
			createNode("Grandchild", "grandchild.md", 2),
		]);
		syntheticChild.synthetic = true;
		const root = createNode("Root", "root.md", 0, [syntheticChild]);

		const output = new MermaidExporter().export(root);

		expect(output).toContain('["Grandchild"]');
		expect(output).not.toContain("Synthetic");
	});

	it("renders cyclic legacy trees without revisiting note objects", () => {
		const root = createNode("Root", "root.md");
		const child = createNode("Child", "child.md", 1);
		root.children.push(child);
		child.children.push(root);

		const output = new MermaidExporter().export(root);
		const edgeLines = output.split("\n").filter((line) => line.includes(" --> "));

		expect(output.match(/\["Root"\]/g)).toHaveLength(1);
		expect(output.match(/\["Child"\]/g)).toHaveLength(1);
		expect(edgeLines).toHaveLength(2);
	});

	it("escapes embedded link labels and block targets", () => {
		const root = createNode("Original", "root.md");
		const output = new MermaidExporter().export(root, {
			labelsByNoteId: new Map([["root.md", 'Label <tag> & "details"']]),
			internalLinkBlockIdsByNoteId: new Map([["root.md", `target'&"<>\nnext`]]),
		});

		expect(output).toContain(
			`<a class='internal-link' href='#^target&#39;&amp;&quot;&lt;&gt; next'>Label &lt;tag&gt; &amp; &quot;details&quot;</a>`
		);
	});

	it("adds a suffix when generated IDs collide", () => {
		const exporter = new MermaidExporter();
		const hash = (exporter as unknown as { hash: (value: string) => string }).hash;
		(exporter as unknown as { hash: (value: string) => string }).hash = () => "collision";

		const output = exporter.export(
			createNode("Root", "root.md", 0, [createNode("Child", "child.md", 1)])
		);

		expect(output).toContain("note_collision[");
		expect(output).toContain("note_collision_2[");
		(exporter as unknown as { hash: (value: string) => string }).hash = hash;
	});

	it("handles empty synthetic exports and invalid depths", () => {
		const syntheticRoot = createNode("Empty", "synthetic", Number.NaN);
		syntheticRoot.synthetic = true;

		expect(new MermaidExporter().export(syntheticRoot)).toBe("```mermaid\nflowchart TD\n```");
		expect(new MermaidExporter().export(createNode("Invalid", "invalid.md", Number.NaN))).toContain(
			"classDef depth0"
		);
	});
});
