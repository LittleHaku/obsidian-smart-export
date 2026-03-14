import { describe, it, expect } from "vitest";
import { PrintFriendlyMarkdownExporter } from "../../src/engine/PrintFriendlyMarkdownExporter";
import { ExportNode } from "../../src/types";

describe("PrintFriendlyMarkdownExporter", () => {
	const createMockExportNode = (
		title: string,
		id: string,
		depth: number = 0,
		content?: string,
		children: ExportNode[] = [],
		includeContent: boolean = true
	): ExportNode => ({
		id,
		title,
		depth,
		includeContent,
		content: content ?? `Content for ${title}`,
		children,
		tokenCount: 10,
		lastModified: new Date("2025-01-01"),
	});

	describe("Basic Export Functionality", () => {
		it("should export a single note correctly", () => {
			const rootNode = createMockExportNode("Root Note", "root.md", 0, "This is the root content");
			const exporter = new PrintFriendlyMarkdownExporter();

			const result = exporter.export(rootNode);

			expect(result).toContain("# Root Note");
			expect(result).toContain("This is the root content");
		});

		it("should handle notes without content", () => {
			const rootNode = createMockExportNode("Title Only", "title.md", 0, undefined, [], false);
			const exporter = new PrintFriendlyMarkdownExporter();

			const result = exporter.export(rootNode);

			expect(result).toContain("# Title Only");
			expect(result).not.toContain("Content for Title Only");
		});

		it("should handle notes with empty content", () => {
			const rootNode = createMockExportNode("Empty Note", "empty.md", 0, "");
			const exporter = new PrintFriendlyMarkdownExporter();

			const result = exporter.export(rootNode);

			expect(result).toContain("# Empty Note");
			expect(result).toBe("# Empty Note\n\n");
		});
	});

	describe("Hierarchical Structure", () => {
		it("should create proper heading levels for nested notes", () => {
			const child2 = createMockExportNode("Child 2", "child2.md", 1, "Child 2 content");
			const child1 = createMockExportNode("Child 1", "child1.md", 1, "Child 1 content");
			const rootNode = createMockExportNode("Root", "root.md", 0, "Root content", [child1, child2]);

			const exporter = new PrintFriendlyMarkdownExporter();
			const result = exporter.export(rootNode);

			expect(result).toContain("# Root");
			expect(result).toContain("## Child 1");
			expect(result).toContain("## Child 2");
			expect(result).toContain("Root content");
			expect(result).toContain("Child 1 content");
			expect(result).toContain("Child 2 content");
		});

		it("should handle deep nesting with correct heading levels", () => {
			const grandChild = createMockExportNode("GrandChild", "gc.md", 2, "Deep content");
			const child = createMockExportNode("Child", "child.md", 1, "Child content", [grandChild]);
			const rootNode = createMockExportNode("Root", "root.md", 0, "Root content", [child]);

			const exporter = new PrintFriendlyMarkdownExporter();
			const result = exporter.export(rootNode);

			expect(result).toContain("# Root");
			expect(result).toContain("## Child");
			expect(result).toContain("### GrandChild");
			expect(result).toContain("Root content");
			expect(result).toContain("Child content");
			expect(result).toContain("Deep content");
		});

		it("should handle very deep nesting", () => {
			// Create a 5-level deep structure
			const level4 = createMockExportNode("Level 4", "level4.md", 4, "Level 4 content");
			const level3 = createMockExportNode("Level 3", "level3.md", 3, "Level 3 content", [level4]);
			const level2 = createMockExportNode("Level 2", "level2.md", 2, "Level 2 content", [level3]);
			const level1 = createMockExportNode("Level 1", "level1.md", 1, "Level 1 content", [level2]);
			const root = createMockExportNode("Root", "root.md", 0, "Root content", [level1]);

			const exporter = new PrintFriendlyMarkdownExporter();
			const result = exporter.export(root);

			expect(result).toContain("# Root");
			expect(result).toContain("## Level 1");
			expect(result).toContain("### Level 2");
			expect(result).toContain("#### Level 3");
			expect(result).toContain("##### Level 4");
		});
	});

	describe("Content Inclusion Logic", () => {
		it("should respect includeContent flag", () => {
			const child = createMockExportNode("Child", "child.md", 1, "Should not appear", [], false);
			const rootNode = createMockExportNode("Root", "root.md", 0, "Root content", [child]);

			const exporter = new PrintFriendlyMarkdownExporter();
			const result = exporter.export(rootNode);

			expect(result).toContain("# Root");
			expect(result).toContain("Root content");
			expect(result).toContain("## Child");
			expect(result).not.toContain("Should not appear");
		});

		it("should include content when includeContent is true", () => {
			const child = createMockExportNode("Child", "child.md", 1, "Should appear", [], true);
			const rootNode = createMockExportNode("Root", "root.md", 0, "Root content", [child]);

			const exporter = new PrintFriendlyMarkdownExporter();
			const result = exporter.export(rootNode);

			expect(result).toContain("# Root");
			expect(result).toContain("Root content");
			expect(result).toContain("## Child");
			expect(result).toContain("Should appear");
		});
	});

	describe("Complex Content Handling", () => {
		it("should preserve markdown formatting in content", () => {
			const complexContent = `# This is a heading in content

This has **bold** and *italic* text.

- List item 1
- List item 2

\`\`\`javascript
console.log("code block");
\`\`\`

> Quote block

[Link](https://example.com)

[[Wikilink]]`;

			const rootNode = createMockExportNode("Complex", "complex.md", 0, complexContent);
			const exporter = new PrintFriendlyMarkdownExporter();

			const result = exporter.export(rootNode);

			expect(result).toContain("**bold**");
			expect(result).toContain("*italic*");
			expect(result).toContain("- List item 1");
			expect(result).toContain("console.log");
			expect(result).toContain("> Quote block");
			expect(result).toContain("[Link](https://example.com)");
			expect(result).toContain("[[Wikilink]]");
		});

		it("should rewrite exported wikilinks into Obsidian heading links and preserve embeds", () => {
			const child = createMockExportNode("Linked Note", "Linked Note.md", 1, "Child content");
			const rootNode = createMockExportNode(
				"Root",
				"root.md",
				0,
				"Link [[Linked Note|summary]] plus image ![[diagram.png]]",
				[child]
			);

			const exporter = new PrintFriendlyMarkdownExporter();
			const result = exporter.export(rootNode);

			expect(result).toContain("# Root");
			expect(result).toContain("## Linked Note");
			expect(result).toContain("[[#Linked Note|summary (ref:Linked Note)]]");
			expect(result).toContain("![[diagram.png]]");
		});

		it("should handle undefined content", () => {
			const rootNode: ExportNode = {
				id: "test.md",
				title: "Test Note",
				depth: 0,
				includeContent: true,
				content: undefined,
				children: [],
				tokenCount: 0,
				lastModified: new Date("2025-01-01"),
			};

			const exporter = new PrintFriendlyMarkdownExporter();
			const result = exporter.export(rootNode);

			expect(result).toContain("# Test Note");
			expect(result).not.toContain("undefined");
		});
	});

	describe("Multiple Children", () => {
		it("should handle multiple children at the same level", () => {
			const children = [
				createMockExportNode("First Child", "first.md", 1, "First content"),
				createMockExportNode("Second Child", "second.md", 1, "Second content"),
				createMockExportNode("Third Child", "third.md", 1, "Third content"),
			];
			const rootNode = createMockExportNode("Root", "root.md", 0, "Root content", children);

			const exporter = new PrintFriendlyMarkdownExporter();
			const result = exporter.export(rootNode);

			expect(result).toContain("# Root");
			expect(result).toContain("## First Child");
			expect(result).toContain("## Second Child");
			expect(result).toContain("## Third Child");
			expect(result).toContain("First content");
			expect(result).toContain("Second content");
			expect(result).toContain("Third content");
		});

		it("should maintain correct order of children", () => {
			const children = [
				createMockExportNode("Alpha", "alpha.md", 1, "Alpha content"),
				createMockExportNode("Beta", "beta.md", 1, "Beta content"),
				createMockExportNode("Gamma", "gamma.md", 1, "Gamma content"),
			];
			const rootNode = createMockExportNode("Root", "root.md", 0, "Root content", children);

			const exporter = new PrintFriendlyMarkdownExporter();
			const result = exporter.export(rootNode);

			const alphaIndex = result.indexOf("## Alpha");
			const betaIndex = result.indexOf("## Beta");
			const gammaIndex = result.indexOf("## Gamma");

			expect(alphaIndex).toBeLessThan(betaIndex);
			expect(betaIndex).toBeLessThan(gammaIndex);
		});
	});

	describe("Edge Cases", () => {
		it("should handle circular references without infinite recursion", () => {
			const nodeB = createMockExportNode("Node B", "node-b.md", 1, "Content B");
			const nodeA = createMockExportNode("Node A", "node-a.md", 0, "Content A", [nodeB]);
			nodeB.children.push(nodeA);

			const exporter = new PrintFriendlyMarkdownExporter();
			const result = exporter.export(nodeA);

			expect(result.match(/^# Node A$/m)).toHaveLength(1);
			expect(result.match(/^## Node B$/m)).toHaveLength(1);
			expect(result).toContain("Content A");
			expect(result).toContain("Content B");
		});

		it("should handle notes with special characters in titles", () => {
			const rootNode = createMockExportNode(
				'Note with "quotes" & <brackets>',
				"special.md",
				0,
				"Special content"
			);
			const exporter = new PrintFriendlyMarkdownExporter();

			const result = exporter.export(rootNode);

			expect(result).toContain('# Note with "quotes" & <brackets>');
			expect(result).toContain("Special content");
		});

		it("should handle notes with very long titles", () => {
			const longTitle = "A".repeat(200);
			const rootNode = createMockExportNode(longTitle, "long.md", 0, "Long title content");
			const exporter = new PrintFriendlyMarkdownExporter();

			const result = exporter.export(rootNode);

			expect(result).toContain(`# ${longTitle}`);
			expect(result).toContain("Long title content");
		});

		it("should handle empty note tree (no children)", () => {
			const rootNode = createMockExportNode("Lonely Note", "lonely.md", 0, "All alone");
			const exporter = new PrintFriendlyMarkdownExporter();

			const result = exporter.export(rootNode);

			expect(result).toContain("# Lonely Note");
			expect(result).toContain("All alone");
			expect(result).not.toContain("##"); // No child headings
		});

		it("should handle single character titles and content", () => {
			const rootNode = createMockExportNode("A", "a.md", 0, "B");
			const exporter = new PrintFriendlyMarkdownExporter();

			const result = exporter.export(rootNode);

			expect(result).toContain("# A");
			expect(result).toContain("B");
		});
	});

	describe("Output Structure", () => {
		it("should maintain proper newline spacing", () => {
			const child = createMockExportNode("Child", "child.md", 1, "Child content");
			const rootNode = createMockExportNode("Root", "root.md", 0, "Root content", [child]);

			const exporter = new PrintFriendlyMarkdownExporter();
			const result = exporter.export(rootNode);

			expect(result).toBe("# Root\n\nRoot content\n\n## Child\n\nChild content\n\n");
		});

		it("should handle recursive structure correctly", () => {
			const deepChild = createMockExportNode("Deep", "deep.md", 2, "Deep content");
			const child = createMockExportNode("Child", "child.md", 1, "Child content", [deepChild]);
			const rootNode = createMockExportNode("Root", "root.md", 0, "Root content", [child]);

			const exporter = new PrintFriendlyMarkdownExporter();
			const result = exporter.export(rootNode);

			// Ensure the structure is built recursively
			expect(result).toContain("# Root");
			expect(result).toContain("## Child");
			expect(result).toContain("### Deep");

			// Ensure all content is included
			expect(result).toContain("Root content");
			expect(result).toContain("Child content");
			expect(result).toContain("Deep content");
		});
	});
});
