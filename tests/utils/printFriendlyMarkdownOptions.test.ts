import { describe, expect, it } from "vitest";
import {
	DEFAULT_PRINT_FRIENDLY_MARKDOWN_OPTIONS,
	getPrintFriendlyMarkdownOptions,
	normalizePrintFriendlyMarkdownOption,
} from "../../src/utils/printFriendlyMarkdownOptions";

describe("printFriendlyMarkdownOptions", () => {
	it("returns print-friendly export options from plugin settings", () => {
		expect(
			getPrintFriendlyMarkdownOptions({
				printFriendlyIncludeTableOfContents: false,
				printFriendlyNumberHeadings: true,
				printFriendlyInsertSectionDividers: false,
			})
		).toEqual({
			includeTableOfContents: false,
			numberHeadings: true,
			insertSectionDividers: false,
		});
	});

	it("normalizes boolean settings and falls back for invalid values", () => {
		expect(normalizePrintFriendlyMarkdownOption(true, false)).toBe(true);
		expect(normalizePrintFriendlyMarkdownOption("yes", false)).toBe(false);
		expect(
			normalizePrintFriendlyMarkdownOption(
				undefined,
				DEFAULT_PRINT_FRIENDLY_MARKDOWN_OPTIONS.includeTableOfContents
			)
		).toBe(true);
	});
});
