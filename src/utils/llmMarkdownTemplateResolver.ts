import { App, normalizePath } from "obsidian";

export const LLM_MARKDOWN_TEMPLATE_DIRECTORY = "smart-templates";
export const LLM_MARKDOWN_TEMPLATE_FILE = "llm-markdown.md";
export const DEFAULT_BUILTIN_LLM_TEMPLATE_ID = "builtin:default";
export const COMPACT_BUILTIN_LLM_TEMPLATE_ID = "builtin:compact";

const USER_TEMPLATE_ID_PREFIX = "user:";

interface BuiltinLlmTemplate {
	id: string;
	label: string;
	content: string;
}

const BUILTIN_LLM_TEMPLATES: BuiltinLlmTemplate[] = [
	{
		id: DEFAULT_BUILTIN_LLM_TEMPLATE_ID,
		label: "LLM-ready",
		content: `{{metadata_yaml}}

## Note Structure

**Description**:
This export contains a knowledge graph of interconnected Obsidian notes.
Notes are presented in breadth-first order starting from the root note.
Links between notes are preserved as [[wiki-style links]].
Missing notes (referenced but not found) are listed separately.

**Included Notes**:
{{included_notes}}

## Note Contents

{{note_contents}}`,
	},
	{
		id: COMPACT_BUILTIN_LLM_TEMPLATE_ID,
		label: "Compact",
		content: `{{metadata_yaml}}

## Included notes
{{included_notes}}

## Note contents
{{note_contents}}`,
	},
];

export interface LlmMarkdownTemplateOption {
	id: string;
	label: string;
	source: "builtin" | "user";
}

export interface ListLlmMarkdownTemplateOptionsOptions {
	includeCompactBuiltin?: boolean;
}

export interface LlmMarkdownTemplateResolution {
	template: string | null;
	sourcePath: string | null;
	templateId: string;
}

export function normalizeTemplateDirectoryPath(path: string): string {
	return normalizePath(path.trim());
}

function normalizeTemplateContent(content: string): string | null {
	return content.trim().length > 0 ? content : null;
}

function isMarkdownFile(path: string): boolean {
	return path.toLowerCase().endsWith(".md");
}

function toUserTemplateId(path: string): string {
	return `${USER_TEMPLATE_ID_PREFIX}${path}`;
}

function parseUserTemplateId(templateId: string): string | null {
	if (!templateId.startsWith(USER_TEMPLATE_ID_PREFIX)) {
		return null;
	}
	const path = templateId.slice(USER_TEMPLATE_ID_PREFIX.length);
	return path.length > 0 ? path : null;
}

function getTemplateLabelFromPath(path: string): string {
	const normalized = normalizePath(path);
	const segments = normalized.split("/");
	const fileName = segments[segments.length - 1] ?? normalized;
	return fileName.replace(/\.md$/i, "");
}

function findBuiltinTemplate(templateId: string): BuiltinLlmTemplate | null {
	return BUILTIN_LLM_TEMPLATES.find((template) => template.id === templateId) ?? null;
}

async function tryReadTemplate(app: App, path: string): Promise<string | null> {
	try {
		const exists = await app.vault.adapter.exists(path);
		if (!exists) {
			return null;
		}
		const content = await app.vault.adapter.read(path);
		return normalizeTemplateContent(content);
	} catch {
		return null;
	}
}

async function resolveFolderTemplateFallback(
	app: App,
	normalizedDirectory: string
): Promise<LlmMarkdownTemplateResolution | null> {
	const preferredPath = normalizePath(`${normalizedDirectory}/${LLM_MARKDOWN_TEMPLATE_FILE}`);
	const preferredTemplate = await tryReadTemplate(app, preferredPath);
	if (preferredTemplate !== null) {
		return {
			template: preferredTemplate,
			sourcePath: preferredPath,
			templateId: toUserTemplateId(preferredPath),
		};
	}

	try {
		const listed = await app.vault.adapter.list(normalizedDirectory);
		const fallbackFiles = listed.files
			.filter((filePath) => filePath !== preferredPath && isMarkdownFile(filePath))
			.sort((a, b) => a.localeCompare(b));

		for (const filePath of fallbackFiles) {
			const content = await tryReadTemplate(app, filePath);
			if (content !== null) {
				return {
					template: content,
					sourcePath: filePath,
					templateId: toUserTemplateId(filePath),
				};
			}
		}
	} catch {
		// Missing folder or adapter errors should not block export.
	}

	return null;
}

export async function listLlmMarkdownTemplateOptions(
	app: App,
	templateDirectory: string = LLM_MARKDOWN_TEMPLATE_DIRECTORY,
	options: ListLlmMarkdownTemplateOptionsOptions = {}
): Promise<LlmMarkdownTemplateOption[]> {
	const includeCompactBuiltin = options.includeCompactBuiltin ?? true;
	const builtinTemplates = includeCompactBuiltin
		? BUILTIN_LLM_TEMPLATES
		: BUILTIN_LLM_TEMPLATES.filter((template) => template.id !== COMPACT_BUILTIN_LLM_TEMPLATE_ID);
	const templateOptions: LlmMarkdownTemplateOption[] = builtinTemplates.map((template) => ({
		id: template.id,
		label: template.label,
		source: "builtin",
	}));
	const normalizedDirectory = normalizeTemplateDirectoryPath(templateDirectory);
	if (normalizedDirectory.length === 0) {
		return templateOptions;
	}

	try {
		const listed = await app.vault.adapter.list(normalizedDirectory);
		const userTemplateFiles = listed.files
			.filter((filePath) => isMarkdownFile(filePath))
			.sort((a, b) => a.localeCompare(b));

		for (const filePath of userTemplateFiles) {
			const content = await tryReadTemplate(app, filePath);
			if (content === null) {
				continue;
			}
			templateOptions.push({
				id: toUserTemplateId(filePath),
				label: `Custom: ${getTemplateLabelFromPath(filePath)}`,
				source: "user",
			});
		}
	} catch {
		// Missing folder or adapter errors should not block export.
	}

	return templateOptions;
}

/**
 * Resolves a custom LLM markdown template from a vault folder.
 *
 * When an explicit template id is provided, it resolves that template.
 * Without an explicit template id, it checks folder templates first:
 * 1) `<directory>/llm-markdown.md`
 * 2) first non-empty `.md` file in the directory (sorted by path)
 * 3) built-in default template
 */
export async function resolveLlmMarkdownTemplate(
	app: App,
	templateDirectory: string = LLM_MARKDOWN_TEMPLATE_DIRECTORY,
	templateId?: string
): Promise<LlmMarkdownTemplateResolution> {
	const defaultBuiltinTemplate = findBuiltinTemplate(DEFAULT_BUILTIN_LLM_TEMPLATE_ID);
	if (!defaultBuiltinTemplate) {
		return { template: null, sourcePath: null, templateId: DEFAULT_BUILTIN_LLM_TEMPLATE_ID };
	}

	const explicitTemplateId = typeof templateId === "string" ? templateId.trim() : null;
	if (explicitTemplateId && explicitTemplateId.length > 0) {
		const builtinTemplate = findBuiltinTemplate(explicitTemplateId);
		if (builtinTemplate) {
			return {
				template: builtinTemplate.content,
				sourcePath: null,
				templateId: builtinTemplate.id,
			};
		}

		const userTemplatePath = parseUserTemplateId(explicitTemplateId);
		if (userTemplatePath) {
			const userTemplate = await tryReadTemplate(app, userTemplatePath);
			if (userTemplate !== null) {
				return {
					template: userTemplate,
					sourcePath: userTemplatePath,
					templateId: explicitTemplateId,
				};
			}
		}

		return {
			template: defaultBuiltinTemplate.content,
			sourcePath: null,
			templateId: defaultBuiltinTemplate.id,
		};
	}

	const normalizedDirectory = normalizeTemplateDirectoryPath(templateDirectory);
	if (normalizedDirectory.length > 0) {
		const folderTemplate = await resolveFolderTemplateFallback(app, normalizedDirectory);
		if (folderTemplate) {
			return folderTemplate;
		}
	}

	return {
		template: defaultBuiltinTemplate.content,
		sourcePath: null,
		templateId: defaultBuiltinTemplate.id,
	};
}
