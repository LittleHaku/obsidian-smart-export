import { describe, it, expect } from "vitest";
import { LlmMarkdownExporter } from "../../src/engine/LlmMarkdownExporter";
import { ExportNode } from "../../src/types";

describe("LlmMarkdownExporter", () => {
	const createMockExportNode = (
		title: string,
		id: string,
		depth: number = 0,
		content?: string,
		children: ExportNode[] = []
	): ExportNode => ({
		id,
		title,
		depth,
		includeContent: true,
		content: content ?? `Content for ${title}`,
		children,
		tokenCount: 10,
		lastModified: new Date("2025-01-01"),
	});

	describe("Basic Export Functionality", () => {
		it("should export a single note correctly", () => {
			const rootNode = createMockExportNode("Root Note", "root.md", 0, "This is the root content");
			const exporter = new LlmMarkdownExporter();

			const result = exporter.export(rootNode, "TestVault");

			// Check metadata presence
			expect(result).toContain("export_timestamp:");
			expect(result).toMatch(/vault_path:\s*["']?TestVault["']?/);
			expect(result).toMatch(/starting_note:\s*["']?Root Note["']?/);
			expect(result).toContain("total_notes_exported: 1");
			expect(result).toContain("missing_notes_count: 0");
			expect(result).toContain("max_depth_used: 0");
			expect(result).toMatch(/processing_order:\s*["']?BFS \(Breadth-First Search\)["']?/);

			// Check structure section
			expect(result).toContain("## Note Structure");
			expect(result).toContain('Note 1: "Root Note"');

			// Check content section
			expect(result).toContain("## Note Contents");
			expect(result).toContain("## Root Note");
			expect(result).toContain("This is the root content");
		});

		it("should handle missing notes count correctly", () => {
			const rootNode = createMockExportNode("Root Note", "root.md");
			const exporter = new LlmMarkdownExporter();

			const result = exporter.export(rootNode, "TestVault", 5);

			expect(result).toContain("missing_notes_count: 5");
		});

		it("should default missing notes count to 0 when not provided", () => {
			const rootNode = createMockExportNode("Root Note", "root.md");
			const exporter = new LlmMarkdownExporter();

			const result = exporter.export(rootNode, "TestVault");

			expect(result).toContain("missing_notes_count: 0");
		});
	});

	describe("Complex Note Hierarchies", () => {
		it("should handle nested note structures correctly", () => {
			const grandChild = createMockExportNode("GrandChild", "grandchild.md", 2, "Deep content");
			const child1 = createMockExportNode("Child 1", "child1.md", 1, "Child 1 content", [
				grandChild,
			]);
			const child2 = createMockExportNode("Child 2", "child2.md", 1, "Child 2 content");
			const rootNode = createMockExportNode("Root", "root.md", 0, "Root content", [child1, child2]);

			const exporter = new LlmMarkdownExporter();
			const result = exporter.export(rootNode, "TestVault");

			// Should export all 4 notes
			expect(result).toContain("total_notes_exported: 4");
			expect(result).toContain("max_depth_used: 2");

			// All notes should be listed in structure
			expect(result).toContain('Note 1: "Root"');
			expect(result).toContain('Note 2: "Child 1"');
			expect(result).toContain('Note 3: "Child 2"');
			expect(result).toContain('Note 4: "GrandChild"');

			// All notes should have content sections
			expect(result).toContain("## Root");
			expect(result).toContain("## Child 1");
			expect(result).toContain("## Child 2");
			expect(result).toContain("## GrandChild");
		});

		it("should process notes in breadth-first order", () => {
			const grandChild1 = createMockExportNode("GrandChild 1", "gc1.md", 2);
			const grandChild2 = createMockExportNode("GrandChild 2", "gc2.md", 2);
			const child1 = createMockExportNode("Child 1", "child1.md", 1, "Child 1 content", [
				grandChild1,
			]);
			const child2 = createMockExportNode("Child 2", "child2.md", 1, "Child 2 content", [
				grandChild2,
			]);
			const rootNode = createMockExportNode("Root", "root.md", 0, "Root content", [child1, child2]);

			const exporter = new LlmMarkdownExporter();
			const result = exporter.export(rootNode, "TestVault");

			// Check BFS order: Root -> Child1 -> Child2 -> GrandChild1 -> GrandChild2
			const lines = result.split("\n");
			const rootIndex = lines.findIndex((line) => line.includes('Note 1: "Root"'));
			const child1Index = lines.findIndex((line) => line.includes('Note 2: "Child 1"'));
			const child2Index = lines.findIndex((line) => line.includes('Note 3: "Child 2"'));
			const gc1Index = lines.findIndex((line) => line.includes('Note 4: "GrandChild 1"'));
			const gc2Index = lines.findIndex((line) => line.includes('Note 5: "GrandChild 2"'));

			expect(rootIndex).toBeLessThan(child1Index);
			expect(child1Index).toBeLessThan(child2Index);
			expect(child2Index).toBeLessThan(gc1Index);
			expect(gc1Index).toBeLessThan(gc2Index);
		});

		it("disambiguates duplicate titles consistently in included notes and headings", () => {
			const duplicateA = createMockExportNode("Duplicate", "folder-a/Duplicate.md", 1, "A");
			const duplicateB = createMockExportNode("Duplicate", "folder-b/Duplicate.md", 1, "B");
			const rootNode = createMockExportNode("Root", "root.md", 0, "Root content", [
				duplicateA,
				duplicateB,
			]);

			const exporter = new LlmMarkdownExporter();
			const result = exporter.export(rootNode, "TestVault");

			expect(result).toContain('Note 2: "Duplicate (folder-a/Duplicate)"');
			expect(result).toContain('Note 3: "Duplicate (folder-b/Duplicate)"');
			expect(result).toContain("## Duplicate (folder-a/Duplicate)");
			expect(result).toContain("## Duplicate (folder-b/Duplicate)");
		});
	});

	describe("Content Handling", () => {
		it("should handle notes with undefined content", () => {
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

			const exporter = new LlmMarkdownExporter();
			const result = exporter.export(rootNode, "TestVault");

			expect(result).toContain("## Test Note");
			// Should handle undefined content gracefully without throwing
			expect(result).not.toContain("undefined");
		});

		it("should handle notes with empty content", () => {
			const rootNode = createMockExportNode("Empty Note", "empty.md", 0, "");
			const exporter = new LlmMarkdownExporter();

			const result = exporter.export(rootNode, "TestVault");

			expect(result).toContain("## Empty Note");
			expect(result).toContain("## Empty Note\n\n");
		});

		it("should preserve complex markdown content", () => {
			const complexContent = `# Heading 1

This note has [[wikilinks]] and **bold text**.

## Subheading

- List item 1
- List item 2 with [[Another Link]]

\`\`\`javascript
console.log("code block");
\`\`\`

> Quote block with [[Quoted Link]]

[External link](https://example.com)`;

			const rootNode = createMockExportNode("Complex Note", "complex.md", 0, complexContent);
			const exporter = new LlmMarkdownExporter();

			const result = exporter.export(rootNode, "TestVault");

			expect(result).toContain("[[wikilinks]]");
			expect(result).toContain("**bold text**");
			expect(result).toContain("[[Another Link]]");
			expect(result).toContain("console.log");
			expect(result).toContain("[[Quoted Link]]");
			expect(result).toContain("[External link](https://example.com)");
		});

		it("rewrites exported alias links into Obsidian heading links", () => {
			const child = createMockExportNode("Child Note", "notes/Child Note.md", 1, "Child content");
			const rootNode = createMockExportNode(
				"Root",
				"root.md",
				0,
				"See [[Child Note|overview]] and [[Missing note|summary]].",
				[child]
			);
			const exporter = new LlmMarkdownExporter();

			const result = exporter.export(rootNode, "TestVault");

			expect(result).toContain("## Root");
			expect(result).toContain("## Child Note");
			expect(result).toContain("[[#Child Note|overview (ref:Child Note)]]");
			expect(result).toContain("summary (ref:Missing note)");
		});

		it("rewrites exported heading links to the referenced heading anchor", () => {
			const child = createMockExportNode(
				"Child Note",
				"notes/Child Note.md",
				1,
				"## Risks\n\nChild content"
			);
			const rootNode = createMockExportNode("Root", "root.md", 0, "See [[Child Note#Risks]].", [
				child,
			]);
			const exporter = new LlmMarkdownExporter();

			const result = exporter.export(rootNode, "TestVault");
			const headingAnchorMatch = result.match(/## Risks \^(smart-export-[a-z0-9]+)\n/);

			expect(headingAnchorMatch).not.toBeNull();
			expect(result).toContain(`[[#^${headingAnchorMatch?.[1]}|Child Note#Risks]]`);
		});

		it("preserves exported cross-note block links as block anchors", () => {
			const child = createMockExportNode(
				"Child Note",
				"notes/Child Note.md",
				1,
				"Important paragraph ^important-block"
			);
			const rootNode = createMockExportNode(
				"Root",
				"root.md",
				0,
				"See [[Child Note^important-block|summary]].",
				[child]
			);
			const exporter = new LlmMarkdownExporter();

			const result = exporter.export(rootNode, "TestVault");

			expect(result).toContain("[[#^important-block|summary (ref:Child Note^important-block)]]");
			expect(result).toContain("Important paragraph ^important-block");
		});

		it("inserts a blank line before closing included note frontmatter", () => {
			const rootNode = createMockExportNode(
				"Root",
				"root.md",
				0,
				["---", "summary: test", "---", "# Inner heading"].join("\n")
			);
			const exporter = new LlmMarkdownExporter();

			const result = exporter.export(rootNode, "TestVault");

			expect(result).toContain(["---", "summary: test", "", "---", "# Inner heading"].join("\n"));
		});
	});

	describe("Metadata Generation", () => {
		it("should include proper timestamp in ISO format", () => {
			const rootNode = createMockExportNode("Test Note", "test.md");
			const exporter = new LlmMarkdownExporter();

			const result = exporter.export(rootNode, "TestVault");

			const timestampRegex =
				/export_timestamp:\s*["']?(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)["']?/;
			expect(result).toMatch(timestampRegex);
		});

		it("should handle vault paths with special characters", () => {
			const rootNode = createMockExportNode("Test Note", "test.md");
			const exporter = new LlmMarkdownExporter();
			const specialVaultPath = '/Users/test/My "Special" Vault & Notes';

			const result = exporter.export(rootNode, specialVaultPath);

			expect(result).toMatch(/vault_path:.*Special.*Vault.*Notes/);
		});

		it("should include descriptive text in note structure", () => {
			const rootNode = createMockExportNode("Test Note", "test.md");
			const exporter = new LlmMarkdownExporter();

			const result = exporter.export(rootNode, "TestVault");

			expect(result).toContain("This export contains a knowledge graph");
			expect(result).toContain("breadth-first order");
			expect(result).toContain("same-note links");
			expect(result).toContain("Missing notes (referenced but not found)");
		});
	});

	describe("Edge Cases", () => {
		it("should handle circular references in tree structure", () => {
			// Create a structure where nodes reference each other
			const nodeB = createMockExportNode("Node B", "nodeB.md", 1);
			const nodeA = createMockExportNode("Node A", "nodeA.md", 0, "Content A", [nodeB]);
			// Simulate circular reference by adding nodeA as child of nodeB
			nodeB.children.push(nodeA);

			const exporter = new LlmMarkdownExporter();
			const result = exporter.export(nodeA, "TestVault");

			// Should handle circular reference and only count each note once
			expect(result).toContain("total_notes_exported: 2");
			expect(result).toContain('Note 1: "Node A"');
			expect(result).toContain('Note 2: "Node B"');
		});

		it("should handle notes with very long titles", () => {
			const longTitle = "A".repeat(100);
			const rootNode = createMockExportNode(longTitle, "long.md");
			const exporter = new LlmMarkdownExporter();

			const result = exporter.export(rootNode, "TestVault");

			expect(result).toContain(longTitle);
			expect(result).toContain(`Note 1: "${longTitle}"`);
			expect(result).toContain(`## ${longTitle}`);
		});

		it("should handle empty vault path", () => {
			const rootNode = createMockExportNode("Test Note", "test.md");
			const exporter = new LlmMarkdownExporter();

			const result = exporter.export(rootNode, "");

			expect(result).toMatch(/vault_path:\s*["']{2}/);
		});

		it("should handle large number of missing notes", () => {
			const rootNode = createMockExportNode("Test Note", "test.md");
			const exporter = new LlmMarkdownExporter();

			const result = exporter.export(rootNode, "TestVault", 999);

			expect(result).toContain("missing_notes_count: 999");
		});
	});

	describe("Template Rendering", () => {
		it("renders custom templates with placeholders", () => {
			const child = createMockExportNode("Child", "child.md", 1, "Child content");
			const rootNode = createMockExportNode("Root", "root.md", 0, "Root content", [child]);
			const exporter = new LlmMarkdownExporter();
			const template = `# Export
Vault: {{vault_path}}
Root: {{starting_note}}
Count: {{total_notes_exported}}
Alias count: {{total_notes}}
Missing: {{missing_notes}}

{{included_notes}}

{{note_contents}}`;

			const result = exporter.export(rootNode, "TemplateVault", 0, template);

			expect(result).toContain("# Export");
			expect(result).toContain("Vault: TemplateVault");
			expect(result).toContain("Root: Root");
			expect(result).toContain("Count: 2");
			expect(result).toContain("Alias count: 2");
			expect(result).toContain("Missing: 0");
			expect(result).toContain('Note 1: "Root"');
			expect(result).toContain('Note 2: "Child"');
			expect(result).toContain("Root content");
			expect(result).toContain("Child content");
		});

		it("keeps unknown placeholders unchanged", () => {
			const rootNode = createMockExportNode("Root", "root.md");
			const exporter = new LlmMarkdownExporter();

			const result = exporter.export(rootNode, "TestVault", 0, "Unknown: {{does_not_exist}}");

			expect(result).toBe("Unknown: {{does_not_exist}}");
		});

		it("falls back to default template when custom template is empty", () => {
			const rootNode = createMockExportNode("Root", "root.md", 0, "Root content");
			const exporter = new LlmMarkdownExporter();

			const result = exporter.export(rootNode, "TestVault", 0, "   ");

			expect(result).toContain("## Note Structure");
			expect(result).toContain("## Note Contents");
		});

		it("renders note structure description placeholder", () => {
			const rootNode = createMockExportNode("Root", "root.md", 0, "Root content");
			const exporter = new LlmMarkdownExporter();

			const result = exporter.export(
				rootNode,
				"TestVault",
				0,
				"Desc:\n{{note_structure_description}}"
			);

			expect(result).toContain("This export contains a knowledge graph");
			expect(result).toContain("same-note links");
		});
	});

	describe("Output Format Structure", () => {
		it("should maintain proper markdown structure with sections", () => {
			const rootNode = createMockExportNode("Test Note", "test.md");
			const exporter = new LlmMarkdownExporter();

			const result = exporter.export(rootNode, "TestVault");

			// Check that the output has the three main sections in order
			const metadataIndex = result.indexOf("---");
			const structureIndex = result.indexOf("## Note Structure");
			const contentsIndex = result.indexOf("## Note Contents");

			expect(metadataIndex).toBeGreaterThanOrEqual(0);
			expect(structureIndex).toBeGreaterThan(metadataIndex);
			expect(contentsIndex).toBeGreaterThan(structureIndex);

			// Check proper separation between sections
			expect(result).toMatch(/---\n\n## Note Structure/);
			expect(result).toMatch(/\n\n## Note Contents\n\n/);
		});
	});
});
