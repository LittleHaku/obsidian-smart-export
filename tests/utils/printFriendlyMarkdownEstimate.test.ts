import { describe, expect, it } from "vitest";
import { PrintFriendlyMarkdownExporter } from "../../src/engine/PrintFriendlyMarkdownExporter";
import { ExportNode, PrintFriendlyMarkdownOptions } from "../../src/types";
import { applyContentSelection } from "../../src/ui/treeContentSelection";
import { estimatePrintFriendlyMarkdownCharacterCount } from "../../src/utils/printFriendlyMarkdownEstimate";

function createMockExportNode(
	title: string,
	id: string,
	depth: number = 0,
	content?: string,
	children: ExportNode[] = [],
	includeContent: boolean = true
): ExportNode {
	return {
		id,
		title,
		depth,
		includeContent,
		content: content ?? `Content for ${title}`,
		children,
		tokenCount: 0,
		lastModified: new Date("2025-01-01"),
	};
}

function estimateSelectedLength(
	rootNode: ExportNode,
	selectedNodeIds: string[],
	options?: PrintFriendlyMarkdownOptions
): number {
	return estimatePrintFriendlyMarkdownCharacterCount(rootNode, new Set(selectedNodeIds), options);
}

describe("estimatePrintFriendlyMarkdownCharacterCount", () => {
	it("matches exporter length for standard content with default options", () => {
		const child = createMockExportNode("Child", "child.md", 1, "Child body");
		const rootNode = createMockExportNode("Root", "root.md", 0, "Root body", [child]);
		const exporter = new PrintFriendlyMarkdownExporter();

		const estimatedLength = estimateSelectedLength(rootNode, ["root.md", "child.md"]);
		const actualLength = exporter.export(rootNode).length;

		expect(estimatedLength).toBe(actualLength);
	});

	it("matches exporter length when content is deselected and print-friendly options are disabled", () => {
		const child = createMockExportNode("Child", "child.md", 1, "Child body");
		const rootNode = createMockExportNode("Root", "root.md", 0, "Root body", [child]);
		const options: PrintFriendlyMarkdownOptions = {
			includeTableOfContents: false,
			numberHeadings: false,
			insertSectionDividers: false,
			insertPageBreaksBetweenSections: false,
			normalizeContentHeadings: false,
		};
		const exporter = new PrintFriendlyMarkdownExporter();
		const selectedNodeIds = new Set<string>(["root.md"]);

		const estimatedLength = estimateSelectedLength(rootNode, ["root.md"], options);
		const actualLength = exporter.export(
			applyContentSelection(rootNode, selectedNodeIds),
			options
		).length;

		expect(estimatedLength).toBe(actualLength);
	});

	it("matches exporter length when content headings are normalized", () => {
		const child = createMockExportNode("Child", "child.md", 1, "# Child section");
		const rootNode = createMockExportNode("Root", "root.md", 0, "# Root section", [child]);
		const exporter = new PrintFriendlyMarkdownExporter();

		const estimatedLength = estimateSelectedLength(rootNode, ["root.md", "child.md"]);
		const actualLength = exporter.export(rootNode).length;

		expect(estimatedLength).toBe(actualLength);
	});

	it("matches exporter length for repeated nodes and frontmatter normalization", () => {
		const repeated = createMockExportNode(
			"Shared",
			"shared.md",
			1,
			["---", "summary: test", "---", "Shared body"].join("\n")
		);
		const secondBranch = createMockExportNode("Branch", "branch.md", 1, "Branch body", [repeated]);
		const rootNode = createMockExportNode("Root", "root.md", 0, "Root body", [
			repeated,
			secondBranch,
		]);
		const exporter = new PrintFriendlyMarkdownExporter();

		const estimatedLength = estimateSelectedLength(rootNode, ["root.md", "shared.md", "branch.md"]);
		const actualLength = exporter.export(rootNode).length;

		expect(estimatedLength).toBe(actualLength);
	});

	it("matches exporter length when frontmatter is already normalized", () => {
		const rootNode = createMockExportNode(
			"Root",
			"root.md",
			0,
			["---", "summary: test", "", "---", "Body"].join("\n")
		);
		const exporter = new PrintFriendlyMarkdownExporter();

		const estimatedLength = estimateSelectedLength(rootNode, ["root.md"]);
		const actualLength = exporter.export(rootNode).length;

		expect(estimatedLength).toBe(actualLength);
	});

	it("matches exporter length when frontmatter is empty", () => {
		const rootNode = createMockExportNode("Root", "root.md", 0, ["---", "---", "Body"].join("\n"));
		const exporter = new PrintFriendlyMarkdownExporter();

		const estimatedLength = estimateSelectedLength(rootNode, ["root.md"]);
		const actualLength = exporter.export(rootNode).length;

		expect(estimatedLength).toBe(actualLength);
	});

	it("matches exporter length when frontmatter is unclosed", () => {
		const rootNode = createMockExportNode(
			"Root",
			"root.md",
			0,
			["---", "summary: test", "Body"].join("\n")
		);
		const exporter = new PrintFriendlyMarkdownExporter();

		const estimatedLength = estimateSelectedLength(rootNode, ["root.md"]);
		const actualLength = exporter.export(rootNode).length;

		expect(estimatedLength).toBe(actualLength);
	});

	it("matches exporter length for unclosed frontmatter when content heading normalization is disabled", () => {
		const rootNode = createMockExportNode(
			"Root",
			"root.md",
			0,
			["---", "summary: test", "# Preserved"].join("\n")
		);
		const options: PrintFriendlyMarkdownOptions = {
			includeTableOfContents: true,
			numberHeadings: true,
			insertSectionDividers: true,
			insertPageBreaksBetweenSections: false,
			normalizeContentHeadings: false,
		};
		const exporter = new PrintFriendlyMarkdownExporter();

		const estimatedLength = estimateSelectedLength(rootNode, ["root.md"], options);
		const actualLength = exporter.export(rootNode, options).length;

		expect(estimatedLength).toBe(actualLength);
	});

	it("matches exporter length for frontmatter spacing when content heading normalization is disabled", () => {
		const rootNode = createMockExportNode(
			"Root",
			"root.md",
			0,
			["---", "summary: test", "---", "# Preserved"].join("\n")
		);
		const options: PrintFriendlyMarkdownOptions = {
			includeTableOfContents: true,
			numberHeadings: true,
			insertSectionDividers: true,
			insertPageBreaksBetweenSections: false,
			normalizeContentHeadings: false,
		};
		const exporter = new PrintFriendlyMarkdownExporter();

		const estimatedLength = estimateSelectedLength(rootNode, ["root.md"], options);
		const actualLength = exporter.export(rootNode, options).length;

		expect(estimatedLength).toBe(actualLength);
	});

	it("matches exporter length when frontmatter uses CRLF newlines", () => {
		const rootNode = createMockExportNode(
			"Root",
			"root.md",
			0,
			["---", "summary: test", "---", "Body"].join("\r\n")
		);
		const exporter = new PrintFriendlyMarkdownExporter();

		const estimatedLength = estimateSelectedLength(rootNode, ["root.md"]);
		const actualLength = exporter.export(rootNode).length;

		expect(estimatedLength).toBe(actualLength);
	});
});
