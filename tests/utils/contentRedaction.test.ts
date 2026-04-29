import { describe, expect, it } from "vitest";
import {
	DEFAULT_REDACTION_DELIMITER,
	DEFAULT_REDACTION_REPLACEMENT,
	DEFAULT_REGEX_REDACTION_REPLACEMENT,
	getContentRedactionOptions,
	normalizeRegexRedactionReplacement,
	normalizeRedactionDelimiter,
	normalizeRedactionRegexPatterns,
	normalizeRedactionReplacement,
	redactExportTreeContent,
	redactMarkedContent,
} from "../../src/utils/contentRedaction";
import { ContentRedactionOptions, ExportNode } from "../../src/types";

function createRedactionOptions(
	overrides: Partial<ContentRedactionOptions> = {}
): ContentRedactionOptions {
	return {
		markedSectionsEnabled: false,
		delimiter: ":::",
		markedSectionReplacement: DEFAULT_REDACTION_REPLACEMENT,
		regexRulesEnabled: false,
		regexReplacement: DEFAULT_REGEX_REDACTION_REPLACEMENT,
		regexPatterns: [],
		...overrides,
	};
}

describe("contentRedaction", () => {
	it("leaves content unchanged when redaction is disabled", () => {
		expect(redactMarkedContent("Keep :::private::: text", createRedactionOptions())).toBe(
			"Keep :::private::: text"
		);
	});

	it("redacts regex matches even when delimiter redaction is disabled", () => {
		expect(
			redactMarkedContent("Email hello@example.com and phone +1 555-123-4567.", {
				...createRedactionOptions(),
				regexRulesEnabled: true,
				regexReplacement: "REDACTED",
				regexPatterns: ["[\\w.%+-]+@[\\w.-]+\\.[A-Za-z]{2,}", "\\+?\\d[\\d\\s().-]{7,}\\d"],
			})
		).toBe("Email REDACTED and phone REDACTED.");
	});

	it("supports slash-delimited regex rules with flags", () => {
		expect(
			redactMarkedContent("Email email EMAIL", {
				...createRedactionOptions(),
				regexRulesEnabled: true,
				regexReplacement: "X",
				regexPatterns: ["/email/i"],
			})
		).toBe("X X X");
	});

	it("adds global matching to slash-delimited regex rules", () => {
		expect(
			redactMarkedContent("email email", {
				...createRedactionOptions(),
				regexRulesEnabled: true,
				regexReplacement: "X",
				regexPatterns: ["/email/"],
			})
		).toBe("X X");

		expect(
			redactMarkedContent("email email", {
				...createRedactionOptions(),
				regexRulesEnabled: true,
				regexReplacement: "X",
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
				...createRedactionOptions(),
				regexRulesEnabled: true,
				regexReplacement: "",
				regexPatterns: [
					"\\[\\^[^\\]]+\\]",
					"!\\[\\[[^\\]]+\\]\\]",
					"\\]\\([^\\)]+\\)",
					"https?:\\/\\/\\S+",
					"\\[\\[[^\\]|]+\\|",
					"\\[\\[|\\]\\]|\\[|\\]",
				],
			})
		).toBe(
			[
				"1. This is a footnote ",
				"2. See the image ",
				"3. Link Label",
				"4. Visit  for info",
				"5. Public Alias",
				"6. Stray Brackets",
			].join("\n")
		);
	});

	it("redacts content between matching default delimiters", () => {
		expect(
			redactMarkedContent("Keep :::private thing::: visible", {
				...createRedactionOptions(),
				markedSectionsEnabled: true,
				delimiter: ":::",
				markedSectionReplacement: "REDACTED",
			})
		).toBe("Keep REDACTED visible");
	});

	it("redacts multiline and repeated marked sections", () => {
		expect(
			redactMarkedContent("A :::one\nline::: B :::two::: C", {
				...createRedactionOptions(),
				markedSectionsEnabled: true,
				delimiter: ":::",
				markedSectionReplacement: "[PRIVATE]",
			})
		).toBe("A [PRIVATE] B [PRIVATE] C");
	});

	it("supports a custom delimiter and empty replacement", () => {
		expect(
			redactMarkedContent("Keep <<secret<< visible", {
				...createRedactionOptions(),
				markedSectionsEnabled: true,
				delimiter: "<<",
				markedSectionReplacement: "",
			})
		).toBe("Keep  visible");

		expect(
			redactMarkedContent("Keep [[secret[[ visible", {
				...createRedactionOptions(),
				markedSectionsEnabled: true,
				delimiter: "[[",
				markedSectionReplacement: "[PRIVATE]",
			})
		).toBe("Keep [PRIVATE] visible");
	});

	it("leaves unmatched delimiters unchanged", () => {
		expect(
			redactMarkedContent("Keep :::private thing visible", {
				...createRedactionOptions(),
				markedSectionsEnabled: true,
				delimiter: ":::",
				markedSectionReplacement: "REDACTED",
			})
		).toBe("Keep :::private thing visible");
	});

	it("combines delimiter and regex redaction", () => {
		expect(
			redactMarkedContent("Name :::Ivan::: email hello@example.com", {
				...createRedactionOptions(),
				markedSectionsEnabled: true,
				delimiter: ":::",
				markedSectionReplacement: "REDACTED",
				regexRulesEnabled: true,
				regexReplacement: "[EMAIL]",
				regexPatterns: ["[\\w.%+-]+@[\\w.-]+\\.[A-Za-z]{2,}"],
			})
		).toBe("Name REDACTED email [EMAIL]");
	});

	it("normalizes blank or invalid delimiter and replacement settings", () => {
		expect(normalizeRedactionDelimiter("   ")).toBe(DEFAULT_REDACTION_DELIMITER);
		expect(normalizeRedactionDelimiter(null)).toBe(DEFAULT_REDACTION_DELIMITER);
		expect(normalizeRedactionReplacement(null)).toBe(DEFAULT_REDACTION_REPLACEMENT);
		expect(normalizeRedactionReplacement("")).toBe("");
		expect(normalizeRegexRedactionReplacement(null)).toBe(DEFAULT_REGEX_REDACTION_REPLACEMENT);
		expect(normalizeRegexRedactionReplacement("")).toBe("");
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
				...createRedactionOptions(),
				regexRulesEnabled: true,
				regexReplacement: "X",
				regexPatterns: ["[", "email"],
			})
		).toBe("Keep X and [");
	});

	it("treats slash-starting rules without a closing slash as plain regex patterns", () => {
		expect(
			redactMarkedContent("Keep / marker", {
				...createRedactionOptions(),
				regexRulesEnabled: true,
				regexReplacement: "X",
				regexPatterns: ["/"],
			})
		).toBe("Keep X marker");
	});

	it("skips slash-delimited regex rules with invalid flags", () => {
		expect(
			redactMarkedContent("Keep email", {
				...createRedactionOptions(),
				regexRulesEnabled: true,
				regexReplacement: "X",
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
				redactRegexMatches: true,
				redactionRegexReplacement: "",
				redactionRegexPatterns: [" email ", "phone"],
			})
		).toEqual({
			markedSectionsEnabled: true,
			delimiter: "%%",
			markedSectionReplacement: "REMOVED",
			regexRulesEnabled: true,
			regexReplacement: "",
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
			...createRedactionOptions(),
			markedSectionsEnabled: true,
			delimiter: ":::",
			markedSectionReplacement: "REDACTED",
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
			...createRedactionOptions(),
			markedSectionsEnabled: true,
			delimiter: ":::",
			markedSectionReplacement: "REDACTED",
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
				...createRedactionOptions(),
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
			...createRedactionOptions(),
			regexRulesEnabled: true,
			regexReplacement: "REDACTED",
			regexPatterns: ["[\\w.%+-]+@[\\w.-]+\\.[A-Za-z]{2,}"],
		});

		expect(redacted).not.toBe(tree);
		expect(redacted.content).toBe("Root REDACTED content");
		expect(tree.content).toBe("Root hello@example.com content");
	});
});
