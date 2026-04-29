import { describe, expect, it } from "vitest";
import {
	DEFAULT_REDACTION_DELIMITER,
	DEFAULT_REDACTION_REPLACEMENT,
	getContentRedactionOptions,
	normalizeRedactionDelimiter,
	normalizeRedactionRegexPatterns,
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

	it("redacts regex matches even when delimiter redaction is disabled", () => {
		expect(
			redactMarkedContent("Email hello@example.com and phone +1 555-123-4567.", {
				enabled: false,
				delimiter: ":::",
				replacement: "REDACTED",
				regexPatterns: ["[\\w.%+-]+@[\\w.-]+\\.[A-Za-z]{2,}", "\\+?\\d[\\d\\s().-]{7,}\\d"],
			})
		).toBe("Email REDACTED and phone REDACTED.");
	});

	it("supports slash-delimited regex rules with flags", () => {
		expect(
			redactMarkedContent("Email email EMAIL", {
				enabled: false,
				delimiter: ":::",
				replacement: "X",
				regexPatterns: ["/email/i"],
			})
		).toBe("X X X");
	});

	it("adds global matching to slash-delimited regex rules", () => {
		expect(
			redactMarkedContent("email email", {
				enabled: false,
				delimiter: ":::",
				replacement: "X",
				regexPatterns: ["/email/"],
			})
		).toBe("X X");

		expect(
			redactMarkedContent("email email", {
				enabled: false,
				delimiter: ":::",
				replacement: "X",
				regexPatterns: ["/email/g"],
			})
		).toBe("X X");
	});

	it("redacts common note elements with multiline regex rules", () => {
		const content = [
			"1. This is a footnote [^1]",
			"2. See the image ![[vault_pic.png]]",
			"3. [Link Label](https://obsidian.md)",
			"4. Visit https://google.com for info",
			"5. [[Private_Note_Path|Public Alias]]",
			"6. [Stray] [[Brackets]]",
		].join("\n");

		expect(
			redactMarkedContent(content, {
				enabled: false,
				delimiter: ":::",
				replacement: "",
				regexPatterns: [
					"\\[\\^[^\\]]+\\]",
					"!\\[\\[[^\\]]+\\]\\]",
					"\\[[^\\]]+\\]\\([^\\)]+\\)",
					"https?:\\/\\/\\S+",
					"\\[\\[[^\\]|]+\\|",
					"\\[\\[|\\]\\]|\\[|\\]",
				],
			})
		).toBe(
			[
				"1. This is a footnote ",
				"2. See the image ",
				"3. ",
				"4. Visit  for info",
				"5. Public Alias",
				"6. Stray Brackets",
			].join("\n")
		);
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

	it("combines delimiter and regex redaction", () => {
		expect(
			redactMarkedContent("Name :::Ivan::: email hello@example.com", {
				enabled: true,
				delimiter: ":::",
				replacement: "REDACTED",
				regexPatterns: ["[\\w.%+-]+@[\\w.-]+\\.[A-Za-z]{2,}"],
			})
		).toBe("Name REDACTED email REDACTED");
	});

	it("normalizes blank or invalid delimiter and replacement settings", () => {
		expect(normalizeRedactionDelimiter("   ")).toBe(DEFAULT_REDACTION_DELIMITER);
		expect(normalizeRedactionDelimiter(null)).toBe(DEFAULT_REDACTION_DELIMITER);
		expect(normalizeRedactionReplacement(null)).toBe(DEFAULT_REDACTION_REPLACEMENT);
		expect(normalizeRedactionReplacement("")).toBe("");
	});

	it("normalizes regex pattern settings", () => {
		expect(normalizeRedactionRegexPatterns(" email\\n\nemail\n  phone  ")).toEqual([
			"email\\n",
			"email",
			"phone",
		]);
		expect(normalizeRedactionRegexPatterns(["email\nphone", 12, "", "email"])).toEqual([
			"email",
			"phone",
		]);
		expect(normalizeRedactionRegexPatterns(null)).toEqual([]);
	});

	it("skips invalid regex rules", () => {
		expect(
			redactMarkedContent("Keep email and [", {
				enabled: false,
				delimiter: ":::",
				replacement: "X",
				regexPatterns: ["[", "email"],
			})
		).toBe("Keep X and [");
	});

	it("treats slash-starting rules without a closing slash as plain regex patterns", () => {
		expect(
			redactMarkedContent("Keep / marker", {
				enabled: false,
				delimiter: ":::",
				replacement: "X",
				regexPatterns: ["/"],
			})
		).toBe("Keep X marker");
	});

	it("skips slash-delimited regex rules with invalid flags", () => {
		expect(
			redactMarkedContent("Keep email", {
				enabled: false,
				delimiter: ":::",
				replacement: "X",
				regexPatterns: ["/email/i\\/"],
			})
		).toBe("Keep email");
	});

	it("builds normalized redaction options from settings", () => {
		expect(
			getContentRedactionOptions({
				redactMarkedSections: true,
				redactionDelimiter: " %% ",
				redactionReplacement: "REMOVED",
				redactionRegexPatterns: [" email ", "phone"],
			})
		).toEqual({
			enabled: true,
			delimiter: "%%",
			replacement: "REMOVED",
			regexPatterns: ["email", "phone"],
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
			regexPatterns: [],
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
			regexPatterns: [],
		});

		expect(redacted).not.toBe(tree);
		expect(redacted.content).toBeUndefined();
	});

	it("returns the original tree when no redaction behavior is configured", () => {
		const tree: ExportNode = {
			id: "root.md",
			title: "Root",
			depth: 0,
			includeContent: true,
			content: "Root content",
			children: [],
			tokenCount: 0,
			lastModified: new Date("2026-04-28T00:00:00.000Z"),
		};

		expect(
			redactExportTreeContent(tree, {
				enabled: false,
				delimiter: ":::",
				replacement: "REDACTED",
				regexPatterns: [],
			})
		).toBe(tree);
	});

	it("redacts a cloned export tree when only regex rules are configured", () => {
		const tree: ExportNode = {
			id: "root.md",
			title: "Root",
			depth: 0,
			includeContent: true,
			content: "Root hello@example.com content",
			children: [],
			tokenCount: 0,
			lastModified: new Date("2026-04-28T00:00:00.000Z"),
		};

		const redacted = redactExportTreeContent(tree, {
			enabled: false,
			delimiter: ":::",
			replacement: "REDACTED",
			regexPatterns: ["[\\w.%+-]+@[\\w.-]+\\.[A-Za-z]{2,}"],
		});

		expect(redacted).not.toBe(tree);
		expect(redacted.content).toBe("Root REDACTED content");
		expect(tree.content).toBe("Root hello@example.com content");
	});
});
