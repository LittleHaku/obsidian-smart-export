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

	it("builds print-friendly markdown output", () => {
		const output = buildExportOutput({
			rootNode: createTree(),
			vaultPath: "Vault",
			format: "print-friendly-markdown",
		});

		expect(output).toContain("# Root");
		expect(output).toContain("Root content");
		expect(output).toContain("## Child");
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
