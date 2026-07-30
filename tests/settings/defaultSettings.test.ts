import { describe, expect, it } from "vitest";
import {
	DEFAULT_REDACTION_REGEX_PATTERNS,
	DEFAULT_SETTINGS,
	normalizeTemplateDirectorySetting,
} from "../../src/settings/defaultSettings";
import { LLM_MARKDOWN_TEMPLATE_DIRECTORY } from "../../src/utils/llmMarkdownTemplateResolver";

describe("default settings", () => {
	it("provides independent defaults for redaction patterns and template paths", () => {
		expect(DEFAULT_SETTINGS.redactionRegexPatterns).toBe(DEFAULT_REDACTION_REGEX_PATTERNS);
		expect(DEFAULT_SETTINGS.llmMarkdownTemplateDirectory).toBe(LLM_MARKDOWN_TEMPLATE_DIRECTORY);
	});

	it("normalizes custom template directories and restores the default for blank paths", () => {
		expect(normalizeTemplateDirectorySetting(" Custom\\Templates/ ")).toBe("Custom/Templates");
		expect(normalizeTemplateDirectorySetting("  ")).toBe(LLM_MARKDOWN_TEMPLATE_DIRECTORY);
	});
});
