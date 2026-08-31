import { ExportFormat } from "../types";
import {
	DEFAULT_BUILTIN_LLM_TEMPLATE_ID,
	LlmMarkdownTemplateOption,
} from "./llmMarkdownTemplateResolver";

export const EXPORT_CHOICE_XML = "format:xml";
export const EXPORT_CHOICE_PRINT_FRIENDLY = "format:print-friendly-markdown";
export const EXPORT_CHOICE_MERMAID = "format:mermaid";
export const EXPORT_CHOICE_LLM_PREFIX = "template:";

export interface ExportChoiceState {
	format: ExportFormat;
	templateId: string;
}

export function getAvailableLlmTemplateOptions(
	options: LlmMarkdownTemplateOption[]
): LlmMarkdownTemplateOption[] {
	return options.length > 0
		? options
		: [{ id: DEFAULT_BUILTIN_LLM_TEMPLATE_ID, label: "LLM-ready", source: "builtin" }];
}

export function getCurrentExportChoiceValue(
	state: ExportChoiceState,
	options: LlmMarkdownTemplateOption[]
): string {
	if (state.format === "xml") return EXPORT_CHOICE_XML;
	if (state.format === "print-friendly-markdown") return EXPORT_CHOICE_PRINT_FRIENDLY;
	if (state.format === "mermaid") return EXPORT_CHOICE_MERMAID;
	const available = getAvailableLlmTemplateOptions(options);
	const templateId = available.some((option) => option.id === state.templateId)
		? state.templateId
		: DEFAULT_BUILTIN_LLM_TEMPLATE_ID;
	return `${EXPORT_CHOICE_LLM_PREFIX}${templateId}`;
}

export function applyExportChoiceSelection(
	state: ExportChoiceState,
	value: string
): ExportChoiceState {
	if (value === EXPORT_CHOICE_XML) return { ...state, format: "xml" };
	if (value === EXPORT_CHOICE_PRINT_FRIENDLY) {
		return { ...state, format: "print-friendly-markdown" };
	}
	if (value === EXPORT_CHOICE_MERMAID) return { ...state, format: "mermaid" };
	if (!value.startsWith(EXPORT_CHOICE_LLM_PREFIX)) return state;
	const templateId = value.slice(EXPORT_CHOICE_LLM_PREFIX.length);
	return {
		format: "llm-markdown",
		templateId: templateId || DEFAULT_BUILTIN_LLM_TEMPLATE_ID,
	};
}
