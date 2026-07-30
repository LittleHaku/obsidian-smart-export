import { App, normalizePath, TFile } from "obsidian";
import {
	BUILTIN_LLM_TEMPLATES,
	BuiltinLlmTemplate,
	COMPACT_BUILTIN_LLM_TEMPLATE_ID,
	DEFAULT_BUILTIN_LLM_TEMPLATE_ID,
	getBuiltinLlmTemplate,
} from "../constants/llmMarkdownTemplates";

export const LLM_MARKDOWN_TEMPLATE_DIRECTORY = "smart-templates";
export const LLM_MARKDOWN_TEMPLATE_FILE = "llm-markdown.md";
export { COMPACT_BUILTIN_LLM_TEMPLATE_ID, DEFAULT_BUILTIN_LLM_TEMPLATE_ID };

const USER_TEMPLATE_ID_PREFIX = "user:";

export interface LlmMarkdownTemplateOption {
	id: string;
	label: string;
	source: "builtin" | "user";
}

export interface ListLlmMarkdownTemplateOptionsOptions {
	includeCompactBuiltin?: boolean;
}

export interface LlmMarkdownTemplateResolution {
	template: string;
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
	const fileName = segments[segments.length - 1];
	return fileName.replace(/\.md$/i, "");
}

function findBuiltinTemplate(templateId: string): BuiltinLlmTemplate | null {
	return getBuiltinLlmTemplate(templateId);
}

async function tryReadTemplate(app: App, path: string): Promise<string | null> {
	try {
		const file = app.vault.getFileByPath(normalizePath(path));
		if (file === null) {
			return null;
		}
		const content = await app.vault.cachedRead(file);
		return normalizeTemplateContent(content);
	} catch {
		return null;
	}
}

function listMarkdownTemplates(app: App, normalizedDirectory: string): TFile[] {
	try {
		const folder = app.vault.getFolderByPath(normalizedDirectory);
		if (folder === null) {
			return [];
		}

		return folder.children
			.filter((child): child is TFile => child instanceof TFile && isMarkdownFile(child.path))
			.sort((a, b) => a.path.localeCompare(b.path));
	} catch {
		// Template discovery failures should not block export.
		return [];
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

	const fallbackFiles = listMarkdownTemplates(app, normalizedDirectory).filter(
		(file) => file.path !== preferredPath
	);

	for (const file of fallbackFiles) {
		const content = await tryReadTemplate(app, file.path);
		if (content !== null) {
			return {
				template: content,
				sourcePath: file.path,
				templateId: toUserTemplateId(file.path),
			};
		}
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

	for (const file of listMarkdownTemplates(app, normalizedDirectory)) {
		templateOptions.push({
			id: toUserTemplateId(file.path),
			label: `Custom: ${getTemplateLabelFromPath(file.path)}`,
			source: "user",
		});
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
	const defaultBuiltinTemplate = findBuiltinTemplate(DEFAULT_BUILTIN_LLM_TEMPLATE_ID)!;

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
