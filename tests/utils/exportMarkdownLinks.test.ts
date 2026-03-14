import { describe, expect, it } from "vitest";
import { ExportNode } from "../../src/types";
import {
	buildExportedHeadingLabels,
	buildExportedMarkdownLinkIndex,
	rewriteMarkdownLinksForExport,
} from "../../src/utils/exportMarkdownLinks";

function createMockExportNode(title: string, id: string, children: ExportNode[] = []): ExportNode {
	return {
		id,
		title,
		depth: 0,
		includeContent: true,
		content: "",
		children,
		tokenCount: 0,
		lastModified: new Date("2026-03-13T00:00:00.000Z"),
	};
}

describe("exportMarkdownLinks", () => {
	it("adds a path suffix to duplicate exported headings", () => {
		const labels = buildExportedHeadingLabels([
			createMockExportNode("Duplicate", "folder-a/Duplicate.md"),
			createMockExportNode("Duplicate", "folder-b/Duplicate.md"),
		]);

		expect(labels.get("folder-a/Duplicate.md")).toBe("Duplicate (folder-a/Duplicate)");
		expect(labels.get("folder-b/Duplicate.md")).toBe("Duplicate (folder-b/Duplicate)");
	});

	it("falls back to the note path when the exported title is blank", () => {
		const labels = buildExportedHeadingLabels([createMockExportNode("   ", "notes/Blank.md")]);

		expect(labels.get("notes/Blank.md")).toBe("notes/Blank");
	});

	it("rewrites exported wikilinks into Obsidian heading links", () => {
		const child = createMockExportNode("Child", "notes/Child.md");
		const notes = [createMockExportNode("Root", "Root.md"), child];
		const labels = buildExportedHeadingLabels(notes);
		const index = buildExportedMarkdownLinkIndex(
			notes,
			(note) => labels.get(note.id) ?? note.title
		);

		expect(rewriteMarkdownLinksForExport("See [[Child]] for details.", index)).toBe(
			"See [[#Child|Child]] for details."
		);
	});

	it("appends ref text for aliased links", () => {
		const child = createMockExportNode("Child", "notes/Child.md");
		const labels = buildExportedHeadingLabels([child]);
		const index = buildExportedMarkdownLinkIndex(
			[child],
			(note) => labels.get(note.id) ?? note.title
		);

		expect(rewriteMarkdownLinksForExport("Jump to [[Child|overview]].", index)).toBe(
			"Jump to [[#Child|overview (ref:Child)]]."
		);
	});

	it("escapes heading targets that contain wiki-link control characters", () => {
		const special = createMockExportNode("Heading ]| target", "special.md");
		const labels = buildExportedHeadingLabels([special]);
		const index = buildExportedMarkdownLinkIndex(
			[special],
			(note) => labels.get(note.id) ?? note.title
		);

		expect(rewriteMarkdownLinksForExport("See [[special|summary]].", index)).toBe(
			"See [[#Heading \\]\\| target|summary (ref:special)]]."
		);
	});

	it("keeps ambiguous title-only links untouched", () => {
		const notes = [
			createMockExportNode("Duplicate", "folder-a/Duplicate.md"),
			createMockExportNode("Duplicate", "folder-b/Duplicate.md"),
		];
		const labels = buildExportedHeadingLabels(notes);
		const index = buildExportedMarkdownLinkIndex(
			notes,
			(note) => labels.get(note.id) ?? note.title
		);

		expect(rewriteMarkdownLinksForExport("See [[Duplicate]].", index)).toBe("See [[Duplicate]].");
	});

	it("rewrites path-qualified links even when titles are duplicated", () => {
		const notes = [
			createMockExportNode("Duplicate", "folder-a/Duplicate.md"),
			createMockExportNode("Duplicate", "folder-b/Duplicate.md"),
		];
		const labels = buildExportedHeadingLabels(notes);
		const index = buildExportedMarkdownLinkIndex(
			notes,
			(note) => labels.get(note.id) ?? note.title
		);

		expect(rewriteMarkdownLinksForExport("See [[folder-b/Duplicate]].", index)).toBe(
			"See [[#Duplicate (folder-b/Duplicate)|folder-b/Duplicate]]."
		);
	});

	it("converts unresolved aliased links into readable plain text", () => {
		const root = createMockExportNode("Root", "Root.md");
		const labels = buildExportedHeadingLabels([root]);
		const index = buildExportedMarkdownLinkIndex(
			[root],
			(note) => labels.get(note.id) ?? note.title
		);

		expect(rewriteMarkdownLinksForExport("See [[Missing note|summary]].", index)).toBe(
			"See summary (ref:Missing note)."
		);
	});

	it("keeps malformed links with blank targets untouched", () => {
		const root = createMockExportNode("Root", "Root.md");
		const labels = buildExportedHeadingLabels([root]);
		const index = buildExportedMarkdownLinkIndex(
			[root],
			(note) => labels.get(note.id) ?? note.title
		);

		expect(rewriteMarkdownLinksForExport("See [[|summary]].", index)).toBe("See [[|summary]].");
	});

	it("supports exported links with heading or block suffixes", () => {
		const child = createMockExportNode("Child", "notes/Child.md");
		const labels = buildExportedHeadingLabels([child]);
		const index = buildExportedMarkdownLinkIndex(
			[child],
			(note) => labels.get(note.id) ?? note.title
		);

		expect(rewriteMarkdownLinksForExport("See [[Child#Section]].", index)).toBe(
			"See [[#Child|Child#Section]]."
		);
		expect(rewriteMarkdownLinksForExport("See [[Child^block]].", index)).toBe(
			"See [[#Child|Child^block]]."
		);
	});

	it("preserves image embeds and code spans", () => {
		const child = createMockExportNode("Child", "Child.md");
		const labels = buildExportedHeadingLabels([child]);
		const index = buildExportedMarkdownLinkIndex(
			[child],
			(note) => labels.get(note.id) ?? note.title
		);
		const content = [
			"Inline `[[Child]]` code",
			"```md",
			"[[Child]]",
			"```",
			"![[diagram.png]]",
			"[[Child]]",
		].join("\n");

		expect(rewriteMarkdownLinksForExport(content, index)).toBe(
			[
				"Inline `[[Child]]` code",
				"```md",
				"[[Child]]",
				"```",
				"![[diagram.png]]",
				"[[#Child|Child]]",
			].join("\n")
		);
	});

	it("keeps rewriting disabled inside fenced code blocks even when fence text appears in the block", () => {
		const child = createMockExportNode("Child", "Child.md");
		const labels = buildExportedHeadingLabels([child]);
		const index = buildExportedMarkdownLinkIndex(
			[child],
			(note) => labels.get(note.id) ?? note.title
		);
		const content = [
			"```md",
			'const literalFence = "```";',
			"[[Child]]",
			"```",
			"Outside [[Child]]",
		].join("\n");

		expect(rewriteMarkdownLinksForExport(content, index)).toBe(
			["```md", 'const literalFence = "```";', "[[Child]]", "```", "Outside [[#Child|Child]]"].join(
				"\n"
			)
		);
	});

	it("supports indented CRLF closing fences without rewriting inside the block", () => {
		const child = createMockExportNode("Child", "Child.md");
		const labels = buildExportedHeadingLabels([child]);
		const index = buildExportedMarkdownLinkIndex(
			[child],
			(note) => labels.get(note.id) ?? note.title
		);
		const content = ["```md", "[[Child]]", "  ```", "Outside [[Child]]"].join("\r\n");

		expect(rewriteMarkdownLinksForExport(content, index)).toBe(
			["```md", "[[Child]]", "  ```", "Outside [[#Child|Child]]"].join("\r\n")
		);
	});

	it("keeps rewriting disabled inside indented fenced code blocks", () => {
		const child = createMockExportNode("Child", "Child.md");
		const labels = buildExportedHeadingLabels([child]);
		const index = buildExportedMarkdownLinkIndex(
			[child],
			(note) => labels.get(note.id) ?? note.title
		);
		const content = [
			"- Example:",
			"  ```md",
			'  const literalFence = "```";',
			"  [[Child]]",
			"  ```",
			"Outside [[Child]]",
		].join("\n");

		expect(rewriteMarkdownLinksForExport(content, index)).toBe(
			[
				"- Example:",
				"  ```md",
				'  const literalFence = "```";',
				"  [[Child]]",
				"  ```",
				"Outside [[#Child|Child]]",
			].join("\n")
		);
	});

	it("does not treat backtick runs with more than three leading spaces as fenced code blocks", () => {
		const child = createMockExportNode("Child", "Child.md");
		const labels = buildExportedHeadingLabels([child]);
		const index = buildExportedMarkdownLinkIndex(
			[child],
			(note) => labels.get(note.id) ?? note.title
		);
		const content = ["    ```md", "    [[Child]]"].join("\n");

		expect(rewriteMarkdownLinksForExport(content, index)).toBe(content);
	});

	it("does not treat backtick runs with non-space prefix text as fenced code blocks", () => {
		const child = createMockExportNode("Child", "Child.md");
		const labels = buildExportedHeadingLabels([child]);
		const index = buildExportedMarkdownLinkIndex(
			[child],
			(note) => labels.get(note.id) ?? note.title
		);
		const content = ["- ```md", "[[Child]]", "```", "Outside [[Child]]"].join("\n");

		expect(rewriteMarkdownLinksForExport(content, index)).toBe(
			["- ```md", "[[Child]]", "```", "Outside [[#Child|Child]]"].join("\n")
		);
	});

	it("leaves unterminated fenced code blocks unchanged", () => {
		const child = createMockExportNode("Child", "Child.md");
		const labels = buildExportedHeadingLabels([child]);
		const index = buildExportedMarkdownLinkIndex(
			[child],
			(note) => labels.get(note.id) ?? note.title
		);
		const content = ["```md", "[[Child]]", "const note = 1;"].join("\n");

		expect(rewriteMarkdownLinksForExport(content, index)).toBe(content);
	});

	it("inserts a blank line before closing exported frontmatter", () => {
		const root = createMockExportNode("Root", "Root.md");
		const labels = buildExportedHeadingLabels([root]);
		const index = buildExportedMarkdownLinkIndex(
			[root],
			(note) => labels.get(note.id) ?? note.title
		);
		const content = ["---", "summary: test", "---", "# Inner heading"].join("\n");

		expect(rewriteMarkdownLinksForExport(content, index)).toBe(
			["---", "summary: test", "", "---", "# Inner heading"].join("\n")
		);
	});

	it("keeps exported frontmatter unchanged when a blank line already exists before closing", () => {
		const root = createMockExportNode("Root", "Root.md");
		const labels = buildExportedHeadingLabels([root]);
		const index = buildExportedMarkdownLinkIndex(
			[root],
			(note) => labels.get(note.id) ?? note.title
		);
		const content = ["---", "summary: test", "", "---", "# Inner heading"].join("\n");

		expect(rewriteMarkdownLinksForExport(content, index)).toBe(content);
	});

	it("keeps exported frontmatter unchanged when the closing fence is missing", () => {
		const root = createMockExportNode("Root", "Root.md");
		const labels = buildExportedHeadingLabels([root]);
		const index = buildExportedMarkdownLinkIndex(
			[root],
			(note) => labels.get(note.id) ?? note.title
		);
		const content = ["---", "summary: test", "# Inner heading"].join("\n");

		expect(rewriteMarkdownLinksForExport(content, index)).toBe(content);
	});

	it("preserves CRLF line endings when inserting a blank line before closing frontmatter", () => {
		const root = createMockExportNode("Root", "Root.md");
		const labels = buildExportedHeadingLabels([root]);
		const index = buildExportedMarkdownLinkIndex(
			[root],
			(note) => labels.get(note.id) ?? note.title
		);
		const content = ["---", "summary: test", "---", "# Inner heading"].join("\r\n");

		expect(rewriteMarkdownLinksForExport(content, index)).toBe(
			["---", "summary: test", "", "---", "# Inner heading"].join("\r\n")
		);
	});

	it("returns empty content unchanged", () => {
		const root = createMockExportNode("Root", "Root.md");
		const labels = buildExportedHeadingLabels([root]);
		const index = buildExportedMarkdownLinkIndex(
			[root],
			(note) => labels.get(note.id) ?? note.title
		);

		expect(rewriteMarkdownLinksForExport("", index)).toBe("");
	});

	it("ignores notes with blank titles when building title lookups", () => {
		const blank = createMockExportNode("   ", "notes/Blank.md");
		const labels = buildExportedHeadingLabels([blank]);
		const index = buildExportedMarkdownLinkIndex(
			[blank],
			(note) => labels.get(note.id) ?? note.title
		);

		expect(rewriteMarkdownLinksForExport("See [[Blank]].", index)).toBe("See [[Blank]].");
		expect(rewriteMarkdownLinksForExport("See [[notes/Blank]].", index)).toBe(
			"See [[#notes/Blank|notes/Blank]]."
		);
	});

	it("leaves unterminated code spans, embeds, and links unchanged", () => {
		const child = createMockExportNode("Child", "Child.md");
		const labels = buildExportedHeadingLabels([child]);
		const index = buildExportedMarkdownLinkIndex(
			[child],
			(note) => labels.get(note.id) ?? note.title
		);

		expect(rewriteMarkdownLinksForExport("Inline `[[Child]]", index)).toBe("Inline `[[Child]]");
		expect(rewriteMarkdownLinksForExport("![[diagram.png", index)).toBe("![[diagram.png");
		expect(rewriteMarkdownLinksForExport("[[Child", index)).toBe("[[Child");
	});

	it("keeps standalone bracket and bang characters unchanged", () => {
		const child = createMockExportNode("Child", "Child.md");
		const labels = buildExportedHeadingLabels([child]);
		const index = buildExportedMarkdownLinkIndex(
			[child],
			(note) => labels.get(note.id) ?? note.title
		);

		expect(rewriteMarkdownLinksForExport("Array syntax [x] and excitement!", index)).toBe(
			"Array syntax [x] and excitement!"
		);
	});
});
