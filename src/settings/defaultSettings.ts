import { SmartExportSettings } from "../types";
import {
	DEFAULT_REDACTION_DELIMITER,
	DEFAULT_REDACTION_REPLACEMENT,
	DEFAULT_REGEX_REDACTION_REPLACEMENT,
} from "../utils/contentRedaction";
import {
	DEFAULT_BUILTIN_LLM_TEMPLATE_ID,
	LLM_MARKDOWN_TEMPLATE_DIRECTORY,
	normalizeTemplateDirectoryPath,
} from "../utils/llmMarkdownTemplateResolver";
import { DEFAULT_PRINT_FRIENDLY_MARKDOWN_OPTIONS } from "../utils/printFriendlyMarkdownOptions";

export const DEFAULT_REDACTION_REGEX_PATTERNS = [
	"\\[\\^[^\\]]+\\]",
	"!\\[\\[[^\\]]+\\]\\]",
	"\\]\\([^\\)]+\\)",
	"https?:\\/\\/\\S+",
	"\\[\\[[^\\]|]+\\|",
	"\\[\\[|\\]\\]|\\[|\\]",
];

export function normalizeTemplateDirectorySetting(path: string): string {
	const normalized = normalizeTemplateDirectoryPath(path);
	return normalized.length > 0 ? normalized : LLM_MARKDOWN_TEMPLATE_DIRECTORY;
}

export const DEFAULT_SETTINGS: SmartExportSettings = {
	defaultContentDepth: 3,
	defaultTitleDepth: 6,
	defaultExportFormat: "xml",
	defaultExportTarget: "clipboard",
	defaultLlmTemplateId: DEFAULT_BUILTIN_LLM_TEMPLATE_ID,
	defaultLinkTraversalMode: "outgoing",
	defaultExportNoteFolderPath: "",
	openCreatedExportNote: true,
	autoSelectCurrentNote: true,
	closeModalAfterExport: false,
	showTokenEstimatesInTree: false,
	ignoredTraversalFolders: [],
	ignoredTraversalTagPatterns: [],
	ignoredTraversalPropertyRules: [],
	redactMarkedSections: false,
	redactionDelimiter: DEFAULT_REDACTION_DELIMITER,
	redactionReplacement: DEFAULT_REDACTION_REPLACEMENT,
	redactRegexMatches: false,
	redactionRegexReplacement: DEFAULT_REGEX_REDACTION_REPLACEMENT,
	redactionRegexPatterns: DEFAULT_REDACTION_REGEX_PATTERNS,
	llmMarkdownTemplateDirectory: LLM_MARKDOWN_TEMPLATE_DIRECTORY,
	printFriendlyIncludeTableOfContents:
		DEFAULT_PRINT_FRIENDLY_MARKDOWN_OPTIONS.includeTableOfContents,
	printFriendlyNumberHeadings: DEFAULT_PRINT_FRIENDLY_MARKDOWN_OPTIONS.numberHeadings,
	printFriendlyInsertSectionDividers: DEFAULT_PRINT_FRIENDLY_MARKDOWN_OPTIONS.insertSectionDividers,
	printFriendlyInsertPageBreaks:
		DEFAULT_PRINT_FRIENDLY_MARKDOWN_OPTIONS.insertPageBreaksBetweenSections,
	printFriendlyNormalizeContentHeadings:
		DEFAULT_PRINT_FRIENDLY_MARKDOWN_OPTIONS.normalizeContentHeadings,
};
