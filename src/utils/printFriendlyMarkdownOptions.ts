import { PrintFriendlyMarkdownOptions, SmartExportSettings } from "../types";

export const DEFAULT_PRINT_FRIENDLY_MARKDOWN_OPTIONS: PrintFriendlyMarkdownOptions = {
	includeTableOfContents: true,
	numberHeadings: true,
	insertSectionDividers: true,
};

export function getPrintFriendlyMarkdownOptions(
	settings: Pick<
		SmartExportSettings,
		| "printFriendlyIncludeTableOfContents"
		| "printFriendlyNumberHeadings"
		| "printFriendlyInsertSectionDividers"
	>
): PrintFriendlyMarkdownOptions {
	return {
		includeTableOfContents: settings.printFriendlyIncludeTableOfContents,
		numberHeadings: settings.printFriendlyNumberHeadings,
		insertSectionDividers: settings.printFriendlyInsertSectionDividers,
	};
}

export function normalizePrintFriendlyMarkdownOption(
	value: unknown,
	defaultValue: boolean
): boolean {
	return typeof value === "boolean" ? value : defaultValue;
}
