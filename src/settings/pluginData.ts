import { normalizeExportFormat } from "../engine/exportOutput";
import { ExportTarget, SmartExportSettings } from "../types";
import {
	normalizeRegexRedactionReplacement,
	normalizeRedactionDelimiter,
	normalizeRedactionReplacement,
	normalizeRedactionRegexPatterns,
} from "../utils/contentRedaction";
import { normalizeExportNoteFolderPath } from "../utils/exportNote";
import { normalizeFolderFilterList } from "../utils/folderFilters";
import { DEFAULT_BUILTIN_LLM_TEMPLATE_ID } from "../utils/llmMarkdownTemplateResolver";
import { normalizePropertyFilterList, normalizeTagFilterList } from "../utils/noteFilters";
import {
	DEFAULT_PRINT_FRIENDLY_MARKDOWN_OPTIONS,
	normalizePrintFriendlyMarkdownOption,
} from "../utils/printFriendlyMarkdownOptions";
import { normalizeStoredPluginVersion } from "../utils/releaseNotes";
import { DEFAULT_SETTINGS, normalizeTemplateDirectorySetting } from "./defaultSettings";

export interface StoredPluginData {
	settings?: Partial<SmartExportSettings>;
	lastSeenVersion?: unknown;
}

export interface LoadedPluginData {
	settings: SmartExportSettings;
	lastSeenVersion: string | null;
	hasPersistedData: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function extractStoredSettings(storedData: unknown): Partial<SmartExportSettings> | null {
	if (!isRecord(storedData)) {
		return null;
	}

	if ("settings" in storedData) {
		return isRecord(storedData.settings) ? storedData.settings : null;
	}

	return storedData;
}

function normalizeExportTarget(value: unknown): ExportTarget {
	return value === "new-note" ? "new-note" : "clipboard";
}

function clampDepth(value: number): number {
	return Math.min(20, Math.max(1, value));
}

/** Converts both legacy flat data and the current envelope into normalized runtime state. */
export function loadPluginData(storedData: unknown): LoadedPluginData {
	const storedSettings = extractStoredSettings(storedData);
	const settings = { ...DEFAULT_SETTINGS, ...(storedSettings ?? {}) };

	settings.defaultContentDepth = clampDepth(settings.defaultContentDepth);
	settings.defaultTitleDepth = Math.max(
		settings.defaultContentDepth,
		clampDepth(settings.defaultTitleDepth)
	);
	settings.ignoredTraversalFolders = normalizeFolderFilterList(settings.ignoredTraversalFolders);
	settings.ignoredTraversalTagPatterns = normalizeTagFilterList(
		settings.ignoredTraversalTagPatterns
	);
	settings.ignoredTraversalPropertyRules = normalizePropertyFilterList(
		settings.ignoredTraversalPropertyRules
	);
	settings.redactMarkedSections = storedSettings?.redactMarkedSections === true;
	settings.redactionDelimiter = normalizeRedactionDelimiter(
		storedSettings?.redactionDelimiter ?? settings.redactionDelimiter
	);
	settings.redactionReplacement = normalizeRedactionReplacement(
		storedSettings?.redactionReplacement ?? settings.redactionReplacement
	);
	settings.redactRegexMatches = storedSettings?.redactRegexMatches === true;
	settings.redactionRegexReplacement = normalizeRegexRedactionReplacement(
		storedSettings?.redactionRegexReplacement ?? settings.redactionRegexReplacement
	);
	settings.redactionRegexPatterns = normalizeRedactionRegexPatterns(
		storedSettings?.redactionRegexPatterns ?? settings.redactionRegexPatterns
	);
	settings.defaultExportFormat = normalizeExportFormat(
		storedSettings?.defaultExportFormat ?? settings.defaultExportFormat
	);
	settings.defaultExportTarget = normalizeExportTarget(storedSettings?.defaultExportTarget);
	const templateId = storedSettings?.defaultLlmTemplateId;
	settings.defaultLlmTemplateId =
		typeof templateId === "string" && templateId.trim().length > 0
			? templateId.trim()
			: DEFAULT_BUILTIN_LLM_TEMPLATE_ID;
	const templateDirectory = storedSettings?.llmMarkdownTemplateDirectory;
	settings.llmMarkdownTemplateDirectory = normalizeTemplateDirectorySetting(
		typeof templateDirectory === "string"
			? templateDirectory
			: settings.llmMarkdownTemplateDirectory
	);
	const exportNoteFolder = storedSettings?.defaultExportNoteFolderPath;
	settings.defaultExportNoteFolderPath = normalizeExportNoteFolderPath(
		typeof exportNoteFolder === "string" ? exportNoteFolder : settings.defaultExportNoteFolderPath
	);
	settings.openCreatedExportNote =
		typeof storedSettings?.openCreatedExportNote === "boolean"
			? storedSettings.openCreatedExportNote
			: settings.openCreatedExportNote;
	settings.printFriendlyIncludeTableOfContents = normalizePrintFriendlyMarkdownOption(
		storedSettings?.printFriendlyIncludeTableOfContents,
		DEFAULT_PRINT_FRIENDLY_MARKDOWN_OPTIONS.includeTableOfContents
	);
	settings.printFriendlyNumberHeadings = normalizePrintFriendlyMarkdownOption(
		storedSettings?.printFriendlyNumberHeadings,
		DEFAULT_PRINT_FRIENDLY_MARKDOWN_OPTIONS.numberHeadings
	);
	settings.printFriendlyInsertSectionDividers = normalizePrintFriendlyMarkdownOption(
		storedSettings?.printFriendlyInsertSectionDividers,
		DEFAULT_PRINT_FRIENDLY_MARKDOWN_OPTIONS.insertSectionDividers
	);
	settings.printFriendlyInsertPageBreaks = normalizePrintFriendlyMarkdownOption(
		storedSettings?.printFriendlyInsertPageBreaks,
		DEFAULT_PRINT_FRIENDLY_MARKDOWN_OPTIONS.insertPageBreaksBetweenSections
	);
	settings.printFriendlyNormalizeContentHeadings = normalizePrintFriendlyMarkdownOption(
		storedSettings?.printFriendlyNormalizeContentHeadings,
		DEFAULT_PRINT_FRIENDLY_MARKDOWN_OPTIONS.normalizeContentHeadings
	);

	return {
		settings,
		lastSeenVersion: isRecord(storedData)
			? normalizeStoredPluginVersion(storedData.lastSeenVersion)
			: null,
		hasPersistedData: storedData !== null,
	};
}

export function savePluginData(
	settings: SmartExportSettings,
	lastSeenVersion: string | null
): StoredPluginData {
	return { settings, lastSeenVersion };
}
