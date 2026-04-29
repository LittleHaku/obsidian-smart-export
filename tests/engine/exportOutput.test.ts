import { describe, it, expect, vi } from "vitest";
import { buildExportOutput, normalizeExportFormat } from "../../src/engine/exportOutput";
import { ExportNode } from "../../src/types";

function createTree(): ExportNode {
	return {
		id: "root.md",
		title: "Root",
		depth: 0,
		includeContent: true,
		content: "Root content",
		children: [
			{
				id: "child.md",
				title: "Child",
				depth: 1,
				includeContent: true,
				content: "Child content",
				children: [],
				tokenCount: 0,
				lastModified: new Date("2026-03-03T00:00:00.000Z"),
			},
		],
		tokenCount: 0,
		lastModified: new Date("2026-03-03T00:00:00.000Z"),
	};
}

describe("exportOutput", () => {
	it("normalizes supported export formats", () => {
		expect(normalizeExportFormat("xml")).toBe("xml");
		expect(normalizeExportFormat("llm-markdown")).toBe("llm-markdown");
		expect(normalizeExportFormat("print-friendly-markdown")).toBe("print-friendly-markdown");
	});

	it("normalizes unknown export formats to xml", () => {
		expect(normalizeExportFormat("unknown")).toBe("xml");
		expect(normalizeExportFormat(123)).toBe("xml");
	});

	it("builds xml output", () => {
		const output = buildExportOutput({
			rootNode: createTree(),
			vaultPath: "Vault",
			format: "xml",
			missingNotesCount: 2,
		});

		expect(output.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
		expect(output).toContain("<starting_note>Root</starting_note>");
		expect(output).toContain("<missing_notes_count>2</missing_notes_count>");
	});

	it("builds llm markdown output", () => {
		const output = buildExportOutput({
			rootNode: createTree(),
			vaultPath: "Vault",
			format: "llm-markdown",
		});

		expect(output).toContain("---");
		expect(output).toContain("## Note Structure");
		expect(output).toContain("## Note Contents");
	});

	it("builds llm markdown output from a custom template", () => {
		const output = buildExportOutput({
			rootNode: createTree(),
			vaultPath: "Vault",
			format: "llm-markdown",
			llmMarkdownTemplate: "Root={{starting_note}}|Count={{total_notes_exported}}",
		});

		expect(output).toContain("Root=Root|Count=2");
	});

	it("builds print-friendly markdown output", () => {
		const output = buildExportOutput({
			rootNode: createTree(),
			vaultPath: "Vault",
			format: "print-friendly-markdown",
		});

		expect(output).toContain("# Table of contents");
		expect(output).toContain("# 1. Root");
		expect(output).toContain("Root content");
		expect(output).toContain("## 1.1 Child");
		expect(output).toContain("\n\n---\n\n");
	});

	it("redacts marked content before exporting", () => {
		const tree = createTree();
		tree.content = "Root :::private::: content";
		tree.children[0].content = "Child :::secret::: content";

		const output = buildExportOutput({
			rootNode: tree,
			vaultPath: "Vault",
			format: "print-friendly-markdown",
			contentRedactionOptions: {
				enabled: true,
				delimiter: ":::",
				replacement: "REDACTED",
				regexPatterns: [],
			},
		});

		expect(output).toContain("Root REDACTED content");
		expect(output).toContain("Child REDACTED content");
		expect(output).not.toContain("private");
		expect(output).not.toContain("secret");
		expect(tree.content).toBe("Root :::private::: content");
	});

	it("redacts regex matches before exporting", () => {
		const tree = createTree();
		tree.content = "Email hello@example.com";
		tree.children[0].content = "Visit https://example.com now";

		const output = buildExportOutput({
			rootNode: tree,
			vaultPath: "Vault",
			format: "print-friendly-markdown",
			contentRedactionOptions: {
				enabled: false,
				delimiter: ":::",
				replacement: "REDACTED",
				regexPatterns: ["[\\w.%+-]+@[\\w.-]+\\.[A-Za-z]{2,}", "https?:\\/\\/\\S+"],
			},
		});

		expect(output).toContain("Email REDACTED");
		expect(output).toContain("Visit REDACTED now");
		expect(output).not.toContain("hello@example.com");
		expect(output).not.toContain("https://example.com");
		expect(tree.content).toBe("Email hello@example.com");
	});

	it("builds print-friendly markdown output with page breaks instead of dividers", () => {
		const output = buildExportOutput({
			rootNode: createTree(),
			vaultPath: "Vault",
			format: "print-friendly-markdown",
			printFriendlyMarkdownOptions: {
				includeTableOfContents: true,
				numberHeadings: true,
				insertSectionDividers: true,
				insertPageBreaksBetweenSections: true,
				normalizeContentHeadings: true,
			},
		});

		expect(output).toContain("# Table of contents");
		expect(output).toContain('<div style="page-break-after: always;"></div>');
		expect(output).not.toContain("\n\n---\n\n");
	});

	it("passes print-friendly options through to the exporter", () => {
		const output = buildExportOutput({
			rootNode: createTree(),
			vaultPath: "Vault",
			format: "print-friendly-markdown",
			printFriendlyMarkdownOptions: {
				includeTableOfContents: false,
				numberHeadings: false,
				insertSectionDividers: false,
				insertPageBreaksBetweenSections: false,
				normalizeContentHeadings: false,
			},
		});

		expect(output).not.toContain("# Table of contents");
		expect(output).toContain("# Root");
		expect(output).toContain("## Child");
		expect(output).not.toContain("\n\n---\n\n");
	});

	it("falls back to xml and reports invalid format when callback is provided", () => {
		const onInvalidFormat = vi.fn();

		const output = buildExportOutput({
			rootNode: createTree(),
			vaultPath: "Vault",
			format: "invalid-format",
			missingNotesCount: 1,
			onInvalidFormat,
		});

		expect(onInvalidFormat).toHaveBeenCalledTimes(1);
		expect(onInvalidFormat).toHaveBeenCalledWith("xml");
		expect(output.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
	});

	it("falls back to xml when format is invalid and no callback is provided", () => {
		const output = buildExportOutput({
			rootNode: createTree(),
			vaultPath: "Vault",
			format: null,
		});

		expect(output.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
	});
});
