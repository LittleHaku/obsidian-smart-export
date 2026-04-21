import { describe, expect, it } from "vitest";
import { ExportNode, PrintFriendlyMarkdownOptions } from "../../src/types";
import {
	buildPrintFriendlyMarkdownStructure,
	escapePrintFriendlyWikiLinkValue,
	getPrintFriendlySectionSeparator,
	PRINT_FRIENDLY_PAGE_BREAK_MARKUP,
	PRINT_FRIENDLY_SECTION_DIVIDER,
} from "../../src/utils/printFriendlyMarkdownStructure";

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

describe("printFriendlyMarkdownStructure", () => {
	it("builds numbered heading labels by default and de-duplicates repeated nodes", () => {
		const shared = createMockExportNode("Shared", "shared.md", 1);
		const branch = createMockExportNode("Branch", "branch.md", 1, undefined, [shared]);
		const rootNode = createMockExportNode("Root", "root.md", 0, undefined, [shared, branch]);

		const { allNotes, headingLabels } = buildPrintFriendlyMarkdownStructure(rootNode);

		expect(allNotes.map((note) => note.id)).toEqual(["root.md", "shared.md", "branch.md"]);
		expect(headingLabels.get("root.md")).toBe("1. Root");
		expect(headingLabels.get("shared.md")).toBe("1.1 Shared");
		expect(headingLabels.get("branch.md")).toBe("1.2 Branch");
	});

	it("respects disabled numbering when explicit options are provided", () => {
		const duplicateA = createMockExportNode("Note", "folder/note-a.md", 1);
		const duplicateB = createMockExportNode("Note", "folder/note-b.md", 1);
		const rootNode = createMockExportNode("Root", "root.md", 0, undefined, [
			duplicateA,
			duplicateB,
		]);
		const options: PrintFriendlyMarkdownOptions = {
			includeTableOfContents: true,
			numberHeadings: false,
			insertSectionDividers: true,
			insertPageBreaksBetweenSections: false,
		};

		const { headingLabels } = buildPrintFriendlyMarkdownStructure(rootNode, options);

		expect(headingLabels.get("folder/note-a.md")).toBe("Note (folder/note-a)");
		expect(headingLabels.get("folder/note-b.md")).toBe("Note (folder/note-b)");
	});

	it("exposes shared escaping and section separator helpers", () => {
		expect(escapePrintFriendlyWikiLinkValue("Root \\| ] Note")).toBe("Root \\\\\\| \\] Note");
		expect(
			getPrintFriendlySectionSeparator({
				includeTableOfContents: true,
				numberHeadings: true,
				insertSectionDividers: false,
				insertPageBreaksBetweenSections: true,
			})
		).toBe(PRINT_FRIENDLY_PAGE_BREAK_MARKUP);
		expect(
			getPrintFriendlySectionSeparator({
				includeTableOfContents: true,
				numberHeadings: true,
				insertSectionDividers: true,
				insertPageBreaksBetweenSections: false,
			})
		).toBe(PRINT_FRIENDLY_SECTION_DIVIDER);
		expect(
			getPrintFriendlySectionSeparator({
				includeTableOfContents: false,
				numberHeadings: false,
				insertSectionDividers: false,
				insertPageBreaksBetweenSections: false,
			})
		).toBe("");
	});
});
