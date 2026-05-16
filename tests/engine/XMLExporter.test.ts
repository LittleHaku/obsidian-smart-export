import { describe, it, expect } from "vitest";
import { XMLExporter } from "../../src/engine/XMLExporter";
import { ExportNode } from "../../src/types";

describe("XMLExporter", () => {
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

	describe("Basic XML Export", () => {
		it("should include missing notes count in XML metadata", () => {
			const rootNode = createMockExportNode("Root Note", "root.md");
			const exporter = new XMLExporter();

			const result = exporter.export(rootNode, "TestVault", 3);

			expect(result).toContain("<missing_notes_count>3</missing_notes_count>");
			expect(result).toContain("<total_notes_exported>1</total_notes_exported>");
			expect(result).toContain("<starting_note>Root Note</starting_note>");
			expect(result).toContain("<vault_path>TestVault</vault_path>");
		});

		it("should default missing notes count to 0 when not provided", () => {
			const rootNode = createMockExportNode("Root Note", "root.md");
			const exporter = new XMLExporter();

			const result = exporter.export(rootNode, "TestVault");

			expect(result).toContain("<missing_notes_count>0</missing_notes_count>");
		});

		it("should generate well-formed XML with proper headers", () => {
			const rootNode = createMockExportNode("Test Note", "test.md");
			const exporter = new XMLExporter();

			const result = exporter.export(rootNode, "TestVault");

			expect(result).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
			expect(result).toContain("<obsidian_export>");
			expect(result).toContain("</obsidian_export>");
		});

		it("skips synthetic bundle roots when listing and rendering notes", () => {
			const root = createMockExportNode("Root", "root.md", 0, "Root content");
			const extra = createMockExportNode("Extra", "extra.md", 0, "Extra content");
			const bundle = createMockExportNode("Export bundle", "__smart_export_bundle_root__", 0, "", [
				root,
				extra,
			]);
			bundle.includeContent = false;
			bundle.synthetic = true;
			const exporter = new XMLExporter();

			const result = exporter.export(bundle, "TestVault");

			expect(result).toContain("<starting_note>Export bundle</starting_note>");
			expect(result).toContain("<total_notes_exported>2</total_notes_exported>");
			expect(result).toContain('name="Root"');
			expect(result).toContain('name="Extra"');
			expect(result).not.toContain('name="Export bundle"');
		});
	});

	describe("Complex Note Hierarchies", () => {
		it("should handle deep nested note structures", () => {
			const deepChild = createMockExportNode("Deep Child", "deep.md", 2);
			const child1 = createMockExportNode("Child 1", "child1.md", 1, "Child content", [deepChild]);
			const child2 = createMockExportNode("Child 2", "child2.md", 1);
			const rootNode = createMockExportNode("Root", "root.md", 0, "Root content", [child1, child2]);

			const exporter = new XMLExporter();
			const result = exporter.export(rootNode, "TestVault", 0);

			// Should export all 4 notes
			expect(result).toContain("<total_notes_exported>4</total_notes_exported>");
			expect(result).toContain("<max_depth_used>2</max_depth_used>");

			// All notes should be present
			expect(result).toContain('name="Root"');
			expect(result).toContain('name="Child 1"');
			expect(result).toContain('name="Child 2"');
			expect(result).toContain('name="Deep Child"');
		});

		it("should handle multiple children at same depth level", () => {
			const children = Array.from({ length: 5 }, (_, i) =>
				createMockExportNode(`Child ${i + 1}`, `child${i + 1}.md`, 1)
			);
			const rootNode = createMockExportNode("Root", "root.md", 0, "Root content", children);

			const exporter = new XMLExporter();
			const result = exporter.export(rootNode, "TestVault");

			expect(result).toContain("<total_notes_exported>6</total_notes_exported>");
			expect(result).toContain("<max_depth_used>1</max_depth_used>");

			// All children should be present
			for (let i = 1; i <= 5; i++) {
				expect(result).toContain(`name="Child ${i}"`);
			}
		});

		it("should handle circular references gracefully", () => {
			// Create a structure where Node A links to Node B, and Node B links back to Node A
			const nodeB = createMockExportNode("Node B", "nodeB.md", 1);
			const nodeA = createMockExportNode("Node A", "nodeA.md", 0, "Content A", [nodeB]);
			// Simulate circular reference by adding nodeA as child of nodeB
			nodeB.children.push(nodeA);

			const exporter = new XMLExporter();
			const result = exporter.export(nodeA, "TestVault");

			// Should only export each note once despite circular reference
			expect(result).toContain("<total_notes_exported>2</total_notes_exported>");
			expect(result).toContain('name="Node A"');
			expect(result).toContain('name="Node B"');
		});
	});

	describe("Content Sanitization", () => {
		it("should properly sanitize XML special characters in titles", () => {
			const rootNode = createMockExportNode('Note with <tags> & "quotes"', "test.md");
			const exporter = new XMLExporter();

			const result = exporter.export(rootNode, "TestVault");

			expect(result).toContain('name="Note with &lt;tags&gt; &amp; &quot;quotes&quot;"');
		});

		it("should properly sanitize content with CDATA sections", () => {
			const content = `This content has <HTML> tags & special chars "quotes" and 'apostrophes'
Also has ]]> which could break CDATA`;
			const rootNode = createMockExportNode("Test Note", "test.md", 0, content);
			const exporter = new XMLExporter();

			const result = exporter.export(rootNode, "TestVault");

			expect(result).toContain("<![CDATA[");
			expect(result).toContain("]]&gt;"); // Should escape ]]> in CDATA
			expect(result).toContain("This content has <HTML> tags"); // HTML should be preserved in CDATA
		});

		it("should handle empty content gracefully", () => {
			const rootNode = createMockExportNode("Empty Note", "empty.md", 0, "");
			const exporter = new XMLExporter();

			const result = exporter.export(rootNode, "TestVault");

			expect(result).toContain('name="Empty Note"');
			expect(result).toContain("<![CDATA[]]>");
		});
	});

	describe("Metadata Validation", () => {
		it("should include proper timestamp in ISO format", () => {
			const rootNode = createMockExportNode("Test Note", "test.md");
			const exporter = new XMLExporter();

			const result = exporter.export(rootNode, "TestVault");

			const timestampRegex =
				/<export_timestamp>(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)<\/export_timestamp>/;
			expect(result).toMatch(timestampRegex);
		});

		it("should include BFS processing order in metadata", () => {
			const rootNode = createMockExportNode("Test Note", "test.md");
			const exporter = new XMLExporter();

			const result = exporter.export(rootNode, "TestVault");

			expect(result).toContain("<processing_order>BFS (Breadth-First Search)</processing_order>");
		});

		it("should properly structure note metadata sections", () => {
			const rootNode = createMockExportNode("Test Note", "test.md");
			const exporter = new XMLExporter();

			const result = exporter.export(rootNode, "TestVault");

			expect(result).toContain("<metadata>");
			expect(result).toContain("</metadata>");
			expect(result).toContain("<note_structure>");
			expect(result).toContain("</note_structure>");
			expect(result).toContain("<note_contents>");
			expect(result).toContain("</note_contents>");
		});
	});

	describe("Missing Notes Scenarios", () => {
		it("should track high number of missing notes", () => {
			const rootNode = createMockExportNode("Root Note", "root.md");
			const exporter = new XMLExporter();

			const result = exporter.export(rootNode, "TestVault", 25);

			expect(result).toContain("<missing_notes_count>25</missing_notes_count>");
			expect(result).toContain("<total_notes_exported>1</total_notes_exported>");
		});

		it("should handle zero missing notes explicitly", () => {
			const rootNode = createMockExportNode("Root Note", "root.md");
			const exporter = new XMLExporter();

			const result = exporter.export(rootNode, "TestVault", 0);

			expect(result).toContain("<missing_notes_count>0</missing_notes_count>");
		});
	});

	describe("Real-world Scenarios", () => {
		it("should handle realistic note content with wikilinks", () => {
			const content = `# Research Notes

This note discusses [[Important Concept]] and links to [[Missing Note]].

## Key Points
- Point 1 about [[Another Note]]
- Point 2 with "quotes" and <emphasis>

See also: [[Final Reference]]`;

			const rootNode = createMockExportNode("Research Notes", "research.md", 0, content);
			const exporter = new XMLExporter();

			const result = exporter.export(rootNode, "My Vault", 2);

			expect(result).toContain("<vault_path>My Vault</vault_path>");
			expect(result).toContain("<missing_notes_count>2</missing_notes_count>");
			expect(result).toContain("[[Important Concept]]");
			expect(result).toContain('Point 2 with "quotes" and <emphasis>'); // Content preserved in CDATA
		});

		it("should handle large vault paths with special characters", () => {
			const rootNode = createMockExportNode("Test", "test.md");
			const exporter = new XMLExporter();
			const vaultPath = "/Users/john/Documents/My Vault & Notes/Special <Project>";

			const result = exporter.export(rootNode, vaultPath);

			expect(result).toContain(
				"<vault_path>/Users/john/Documents/My Vault &amp; Notes/Special &lt;Project&gt;</vault_path>"
			);
		});

		it("should handle notes with complex titles and maintain structure", () => {
			const child1 = createMockExportNode("Meeting Notes: Q1 2024 <Planning>", "meeting.md", 1);
			const child2 = createMockExportNode('Project "Alpha" & Beta Analysis', "project.md", 1);
			const rootNode = createMockExportNode(
				"2024 Planning Overview",
				"overview.md",
				0,
				"Overview content",
				[child1, child2]
			);

			const exporter = new XMLExporter();
			const result = exporter.export(rootNode, "Corporate Vault");

			expect(result).toContain("<total_notes_exported>3</total_notes_exported>");
			expect(result).toContain('name="Meeting Notes: Q1 2024 &lt;Planning&gt;"');
			expect(result).toContain('name="Project &quot;Alpha&quot; &amp; Beta Analysis"');
		});
	});

	describe("Edge Cases", () => {
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

			const exporter = new XMLExporter();
			const result = exporter.export(rootNode, "TestVault");

			expect(result).toContain("<![CDATA[]]>");
			expect(result).toContain('name="Test Note"');
		});

		it("should handle single character titles and content", () => {
			const rootNode = createMockExportNode("A", "a.md", 0, "B");
			const exporter = new XMLExporter();

			const result = exporter.export(rootNode, "V");

			expect(result).toContain("<vault_path>V</vault_path>");
			expect(result).toContain('name="A"');
			expect(result).toContain("<![CDATA[B]]>");
		});
	});
});
