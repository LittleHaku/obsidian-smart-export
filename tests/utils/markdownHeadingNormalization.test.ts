import { describe, expect, it } from "vitest";
import { normalizeMarkdownHeadingsBelowParent } from "../../src/utils/markdownHeadingNormalization";

describe("normalizeMarkdownHeadingsBelowParent", () => {
	it("returns empty content unchanged", () => {
		expect(normalizeMarkdownHeadingsBelowParent("", 1)).toBe("");
	});

	it("normalizes atx headings below the parent heading level", () => {
		const content = ["# Overview", "## Details", "###### Deep", "####### Invalid"].join("\n");

		expect(normalizeMarkdownHeadingsBelowParent(content, 2)).toBe(
			["### Overview", "#### Details", "###### Deep", "####### Invalid"].join("\n")
		);
	});

	it("preserves line endings and supports tab heading separators", () => {
		expect(normalizeMarkdownHeadingsBelowParent("#\tOverview\r\nBody", 1)).toBe(
			"##\tOverview\r\nBody"
		);
	});

	it("normalizes setext headings below the parent heading level", () => {
		const content = [
			"Overview",
			"===",
			"",
			"Details",
			"---",
			"",
			"  Indented overview",
			"  ===  ",
			"",
			"Not a setext underline",
			"--- nope",
			"",
			"# ATX heading",
			"---",
			"> Quote overview",
			"> ===",
			"",
			"- List details",
			"  ---",
		].join("\n");

		expect(normalizeMarkdownHeadingsBelowParent(content, 2)).toBe(
			[
				"### Overview",
				"",
				"#### Details",
				"",
				"  ### Indented overview",
				"",
				"Not a setext underline",
				"--- nope",
				"",
				"### ATX heading",
				"---",
				"> ### Quote overview",
				"",
				"- #### List details",
			].join("\n")
		);
	});

	it("normalizes atx headings inside markdown container prefixes", () => {
		const content = [
			"> # Callout title",
			"> [!warning]",
			"> ## Callout detail",
			"- # Step",
			"  - ## Nested step",
			"1. # Numbered step",
			"> - # Quoted list step",
			"> > ## Nested quote detail",
			"> #NoSpace",
		].join("\n");

		expect(normalizeMarkdownHeadingsBelowParent(content, 1)).toBe(
			[
				"> ## Callout title",
				"> [!warning]",
				"> ### Callout detail",
				"- ## Step",
				"  - ### Nested step",
				"1. ## Numbered step",
				"> - ## Quoted list step",
				"> > ### Nested quote detail",
				"> #NoSpace",
			].join("\n")
		);
	});

	it("leaves non-headings unchanged", () => {
		const content = ["#NoSpace", "    # Indented code", "``", "# Heading"].join("\n");

		expect(normalizeMarkdownHeadingsBelowParent(content, 1)).toBe(
			["#NoSpace", "    # Indented code", "``", "## Heading"].join("\n")
		);
	});

	it("preserves frontmatter headings", () => {
		const content = ["---", "title: # Not a heading", "---", "# Heading"].join("\n");

		expect(normalizeMarkdownHeadingsBelowParent(content, 1)).toBe(
			["---", "title: # Not a heading", "---", "## Heading"].join("\n")
		);
	});

	it("preserves frontmatter setext-like lines", () => {
		const content = ["---", "title: Not a heading", "---", "Body"].join("\n");

		expect(normalizeMarkdownHeadingsBelowParent(content, 1)).toBe(content);
	});

	it("treats unterminated frontmatter as frontmatter", () => {
		const content = ["---", "# Not normalized"].join("\n");

		expect(normalizeMarkdownHeadingsBelowParent(content, 1)).toBe(content);
	});

	it("preserves fenced code block headings until a valid closing fence", () => {
		const content = [
			"````",
			"```",
			"# Still code",
			"````",
			"# Heading",
			"~~~",
			"Setext-looking code",
			"===",
			"# Tilde code",
			"~~~ js",
			"# Still tilde code",
			"~~~",
			"# Final",
		].join("\n");

		expect(normalizeMarkdownHeadingsBelowParent(content, 1)).toBe(
			[
				"````",
				"```",
				"# Still code",
				"````",
				"## Heading",
				"~~~",
				"Setext-looking code",
				"===",
				"# Tilde code",
				"~~~ js",
				"# Still tilde code",
				"~~~",
				"## Final",
			].join("\n")
		);
	});

	it("preserves fenced code block headings when the opening fence starts a list item", () => {
		const content = [
			"-   ```ts",
			"  # Still code",
			"  ```",
			"# Heading",
			"1.   ~~~js",
			"   # Still numbered code",
			"   ~~~",
			"> ```md",
			"> # Still quoted code",
			"> ```",
			"+\t```md",
			"  # Still tabbed list code",
			"  ```",
			"2)\t~~~",
			"   # Still paren list code",
			"   ~~~",
			"-not a list marker",
			"# Final",
		].join("\n");

		expect(normalizeMarkdownHeadingsBelowParent(content, 1)).toBe(
			[
				"-   ```ts",
				"  # Still code",
				"  ```",
				"## Heading",
				"1.   ~~~js",
				"   # Still numbered code",
				"   ~~~",
				"> ```md",
				"> # Still quoted code",
				"> ```",
				"+\t```md",
				"  # Still tabbed list code",
				"  ```",
				"2)\t~~~",
				"   # Still paren list code",
				"   ~~~",
				"-not a list marker",
				"## Final",
			].join("\n")
		);
	});
});
