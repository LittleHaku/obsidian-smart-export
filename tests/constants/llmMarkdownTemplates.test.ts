import { describe, expect, it } from "vitest";
import {
	BUILTIN_LLM_TEMPLATES,
	COMPACT_BUILTIN_LLM_TEMPLATE_CONTENT,
	COMPACT_BUILTIN_LLM_TEMPLATE_ID,
	DEFAULT_BUILTIN_LLM_TEMPLATE_CONTENT,
	DEFAULT_BUILTIN_LLM_TEMPLATE_ID,
	DEFAULT_NOTE_STRUCTURE_DESCRIPTION,
	getBuiltinLlmTemplate,
} from "../../src/constants/llmMarkdownTemplates";

describe("llmMarkdownTemplates constants", () => {
	it("defines the expected built-in template ids", () => {
		expect(DEFAULT_BUILTIN_LLM_TEMPLATE_ID).toBe("builtin:default");
		expect(COMPACT_BUILTIN_LLM_TEMPLATE_ID).toBe("builtin:compact");
	});

	it("includes canonical built-in template definitions", () => {
		expect(BUILTIN_LLM_TEMPLATES).toEqual([
			{
				id: DEFAULT_BUILTIN_LLM_TEMPLATE_ID,
				label: "LLM-ready",
				content: DEFAULT_BUILTIN_LLM_TEMPLATE_CONTENT,
			},
			{
				id: COMPACT_BUILTIN_LLM_TEMPLATE_ID,
				label: "Compact",
				content: COMPACT_BUILTIN_LLM_TEMPLATE_CONTENT,
			},
		]);
	});

	it("returns built-ins by id and null for unknown ids", () => {
		expect(getBuiltinLlmTemplate(DEFAULT_BUILTIN_LLM_TEMPLATE_ID)?.label).toBe("LLM-ready");
		expect(getBuiltinLlmTemplate(COMPACT_BUILTIN_LLM_TEMPLATE_ID)?.label).toBe("Compact");
		expect(getBuiltinLlmTemplate("builtin:missing")).toBeNull();
	});

	it("keeps the shared default note-structure description in the default template", () => {
		expect(DEFAULT_BUILTIN_LLM_TEMPLATE_CONTENT).toContain(DEFAULT_NOTE_STRUCTURE_DESCRIPTION);
	});
});
