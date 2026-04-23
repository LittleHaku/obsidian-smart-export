export const DEFAULT_BUILTIN_LLM_TEMPLATE_ID = "builtin:default";
export const COMPACT_BUILTIN_LLM_TEMPLATE_ID = "builtin:compact";

export const DEFAULT_NOTE_STRUCTURE_DESCRIPTION = `This export contains a knowledge graph of interconnected Obsidian notes.
Notes are presented in breadth-first order starting from the root note.
Links to notes included in the export are rewritten as same-note links.
Referenced note headings are preserved when the export can generate a matching local anchor.
Missing notes (referenced but not found) are listed separately.`;

export const DEFAULT_BUILTIN_LLM_TEMPLATE_CONTENT = `{{metadata_yaml}}

## Note Structure

**Description**:
${DEFAULT_NOTE_STRUCTURE_DESCRIPTION}

**Included Notes**:
{{included_notes}}

## Note Contents

{{note_contents}}`;

export const COMPACT_BUILTIN_LLM_TEMPLATE_CONTENT = `{{metadata_yaml}}

## Included notes
{{included_notes}}

## Note contents
{{note_contents}}`;

export interface BuiltinLlmTemplate {
	id: string;
	label: string;
	content: string;
}

export const BUILTIN_LLM_TEMPLATES: BuiltinLlmTemplate[] = [
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
];

export function getBuiltinLlmTemplate(templateId: string): BuiltinLlmTemplate | null {
	return BUILTIN_LLM_TEMPLATES.find((template) => template.id === templateId) ?? null;
}
