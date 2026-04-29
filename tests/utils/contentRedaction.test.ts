import { describe, expect, it } from "vitest";
import {
	DEFAULT_REDACTION_DELIMITER,
	DEFAULT_REDACTION_REPLACEMENT,
	getContentRedactionOptions,
	normalizeRedactionDelimiter,
	normalizeRedactionReplacement,
	redactExportTreeContent,
	redactMarkedContent,
} from "../../src/utils/contentRedaction";
import { ExportNode } from "../../src/types";

describe("contentRedaction", () => {
	it("leaves content unchanged when redaction is disabled", () => {
		expect(
			redactMarkedContent("Keep :::private::: text", {
				enabled: false,
				delimiter: ":::",
				replacement: "REDACTED",
			})
		).toBe("Keep :::private::: text");
	});

	it("redacts content between matching default delimiters", () => {
		expect(
			redactMarkedContent("Keep :::private thing::: visible", {
				enabled: true,
				delimiter: ":::",
				replacement: "REDACTED",
			})
		).toBe("Keep REDACTED visible");
	});

	it("redacts multiline and repeated marked sections", () => {
		expect(
			redactMarkedContent("A :::one\nline::: B :::two::: C", {
				enabled: true,
				delimiter: ":::",
				replacement: "[PRIVATE]",
			})
		).toBe("A [PRIVATE] B [PRIVATE] C");
	});

	it("supports a custom delimiter and empty replacement", () => {
		expect(
			redactMarkedContent("Keep <<secret<< visible", {
				enabled: true,
				delimiter: "<<",
				replacement: "",
			})
		).toBe("Keep  visible");

		expect(
			redactMarkedContent("Keep [[secret[[ visible", {
				enabled: true,
				delimiter: "[[",
				replacement: "[PRIVATE]",
			})
		).toBe("Keep [PRIVATE] visible");
	});

	it("leaves unmatched delimiters unchanged", () => {
		expect(
			redactMarkedContent("Keep :::private thing visible", {
				enabled: true,
				delimiter: ":::",
				replacement: "REDACTED",
			})
		).toBe("Keep :::private thing visible");
	});

	it("normalizes blank or invalid delimiter and replacement settings", () => {
		expect(normalizeRedactionDelimiter("   ")).toBe(DEFAULT_REDACTION_DELIMITER);
		expect(normalizeRedactionDelimiter(null)).toBe(DEFAULT_REDACTION_DELIMITER);
		expect(normalizeRedactionReplacement(null)).toBe(DEFAULT_REDACTION_REPLACEMENT);
		expect(normalizeRedactionReplacement("")).toBe("");
	});

	it("builds normalized redaction options from settings", () => {
		expect(
			getContentRedactionOptions({
				redactMarkedSections: true,
				redactionDelimiter: " %% ",
				redactionReplacement: "REMOVED",
			})
		).toEqual({
			enabled: true,
			delimiter: "%%",
			replacement: "REMOVED",
		});
	});

	it("redacts a cloned export tree without mutating the original tree", () => {
		const tree: ExportNode = {
			id: "root.md",
			title: "Root",
			depth: 0,
			includeContent: true,
			content: "Root :::private::: content",
			children: [
				{
					id: "child.md",
					title: "Child",
					depth: 1,
					includeContent: true,
					content: "Child :::secret::: content",
					children: [],
					tokenCount: 0,
					lastModified: new Date("2026-04-28T00:00:00.000Z"),
				},
			],
			tokenCount: 0,
			lastModified: new Date("2026-04-28T00:00:00.000Z"),
		};

		const redacted = redactExportTreeContent(tree, {
			enabled: true,
			delimiter: ":::",
			replacement: "REDACTED",
		});

		expect(redacted).not.toBe(tree);
		expect(redacted.content).toBe("Root REDACTED content");
		expect(redacted.children[0].content).toBe("Child REDACTED content");
		expect(tree.content).toBe("Root :::private::: content");
		expect(tree.children[0].content).toBe("Child :::secret::: content");
	});

	it("preserves nodes without content while cloning", () => {
		const tree: ExportNode = {
			id: "root.md",
			title: "Root",
			depth: 0,
			includeContent: false,
			children: [],
			tokenCount: 0,
			lastModified: new Date("2026-04-28T00:00:00.000Z"),
		};

		const redacted = redactExportTreeContent(tree, {
			enabled: true,
			delimiter: ":::",
			replacement: "REDACTED",
		});

		expect(redacted).not.toBe(tree);
		expect(redacted.content).toBeUndefined();
	});
});
