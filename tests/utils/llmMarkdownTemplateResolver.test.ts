import { describe, it, expect, vi } from "vitest";
import { App } from "obsidian";
import {
	COMPACT_BUILTIN_LLM_TEMPLATE_ID,
	DEFAULT_BUILTIN_LLM_TEMPLATE_ID,
	LLM_MARKDOWN_TEMPLATE_DIRECTORY,
	LLM_MARKDOWN_TEMPLATE_FILE,
	listLlmMarkdownTemplateOptions,
	normalizeTemplateDirectoryPath,
	resolveLlmMarkdownTemplate,
} from "../../src/utils/llmMarkdownTemplateResolver";

interface MockAdapter {
	exists: ReturnType<typeof vi.fn>;
	read: ReturnType<typeof vi.fn>;
	list: ReturnType<typeof vi.fn>;
}

function createMockApp(adapter: MockAdapter): App {
	return {
		vault: {
			adapter,
		},
	} as unknown as App;
}

describe("llmMarkdownTemplateResolver", () => {
	it("resolves an explicit built-in template id without reading files", async () => {
		const adapter = {
			exists: vi.fn(),
			read: vi.fn(),
			list: vi.fn(),
		};
		const app = createMockApp(adapter);

		const result = await resolveLlmMarkdownTemplate(
			app,
			LLM_MARKDOWN_TEMPLATE_DIRECTORY,
			COMPACT_BUILTIN_LLM_TEMPLATE_ID
		);

		expect(result.templateId).toBe(COMPACT_BUILTIN_LLM_TEMPLATE_ID);
		expect(result.sourcePath).toBeNull();
		expect(result.template).toContain("## Included notes");
		expect(adapter.exists).not.toHaveBeenCalled();
		expect(adapter.read).not.toHaveBeenCalled();
		expect(adapter.list).not.toHaveBeenCalled();
	});

	it("resolves an explicit user template id", async () => {
		const userTemplatePath = "smart-templates/custom.md";
		const adapter = {
			exists: vi.fn(async (path: string) => path === userTemplatePath),
			read: vi.fn(async () => "custom template"),
			list: vi.fn(),
		};
		const app = createMockApp(adapter);

		const result = await resolveLlmMarkdownTemplate(
			app,
			LLM_MARKDOWN_TEMPLATE_DIRECTORY,
			`user:${userTemplatePath}`
		);

		expect(result).toEqual({
			template: "custom template",
			sourcePath: userTemplatePath,
			templateId: `user:${userTemplatePath}`,
		});
	});

	it("falls back to built-in default when explicit user template id cannot be read", async () => {
		const adapter = {
			exists: vi.fn(async () => false),
			read: vi.fn(),
			list: vi.fn(),
		};
		const app = createMockApp(adapter);

		const result = await resolveLlmMarkdownTemplate(app, LLM_MARKDOWN_TEMPLATE_DIRECTORY, "user:x.md");

		expect(result.templateId).toBe(DEFAULT_BUILTIN_LLM_TEMPLATE_ID);
		expect(result.sourcePath).toBeNull();
		expect(result.template).toContain("## Note Structure");
	});

	it("resolves the preferred folder template when no explicit template id is provided", async () => {
		const preferredPath = `${LLM_MARKDOWN_TEMPLATE_DIRECTORY}/${LLM_MARKDOWN_TEMPLATE_FILE}`;
		const adapter = {
			exists: vi.fn(async (path: string) => path === preferredPath),
			read: vi.fn(async () => "preferred"),
			list: vi.fn(),
		};
		const app = createMockApp(adapter);

		const result = await resolveLlmMarkdownTemplate(app);

		expect(result).toEqual({
			template: "preferred",
			sourcePath: preferredPath,
			templateId: `user:${preferredPath}`,
		});
		expect(adapter.list).not.toHaveBeenCalled();
	});

	it("falls back to the first readable markdown file when preferred is missing", async () => {
		const fallbackEmpty = "smart-templates/alpha.md";
		const fallbackValid = "smart-templates/beta.MD";
		const adapter = {
			exists: vi.fn(async (path: string) => path === fallbackEmpty || path === fallbackValid),
			read: vi.fn(async (path: string) => (path === fallbackEmpty ? "   " : "valid")),
			list: vi.fn(async () => ({
				files: [fallbackValid, fallbackEmpty, "smart-templates/readme.txt"],
				folders: [],
			})),
		};
		const app = createMockApp(adapter);

		const result = await resolveLlmMarkdownTemplate(app);

		expect(result).toEqual({
			template: "valid",
			sourcePath: fallbackValid,
			templateId: `user:${fallbackValid}`,
		});
	});

	it("falls back to built-in default when folder listing fails", async () => {
		const adapter = {
			exists: vi.fn(async () => false),
			read: vi.fn(),
			list: vi.fn(async () => {
				throw new Error("missing directory");
			}),
		};
		const app = createMockApp(adapter);

		const result = await resolveLlmMarkdownTemplate(app);

		expect(result.templateId).toBe(DEFAULT_BUILTIN_LLM_TEMPLATE_ID);
		expect(result.sourcePath).toBeNull();
		expect(result.template).toContain("## Note Contents");
	});

	it("falls back to built-in default for invalid explicit ids", async () => {
		const adapter = {
			exists: vi.fn(),
			read: vi.fn(),
			list: vi.fn(),
		};
		const app = createMockApp(adapter);

		const result = await resolveLlmMarkdownTemplate(
			app,
			LLM_MARKDOWN_TEMPLATE_DIRECTORY,
			"invalid-id"
		);

		expect(result.templateId).toBe(DEFAULT_BUILTIN_LLM_TEMPLATE_ID);
		expect(result.sourcePath).toBeNull();
	});

	it("lists built-in and user template options", async () => {
		const alpha = "smart-templates/alpha.md";
		const beta = "smart-templates/beta.md";
		const adapter = {
			exists: vi.fn(async () => true),
			read: vi.fn(async (path: string) => (path === alpha ? "   " : "content")),
			list: vi.fn(async () => ({
				files: ["smart-templates/z.txt", beta, alpha],
				folders: [],
			})),
		};
		const app = createMockApp(adapter);

		const options = await listLlmMarkdownTemplateOptions(app);

		expect(options).toEqual([
			{
				id: DEFAULT_BUILTIN_LLM_TEMPLATE_ID,
				label: "LLM-ready",
				source: "builtin",
			},
			{
				id: COMPACT_BUILTIN_LLM_TEMPLATE_ID,
				label: "Compact",
				source: "builtin",
			},
			{
				id: `user:${beta}`,
				label: "Custom: beta",
				source: "user",
			},
		]);
	});

	it("lists only built-ins when template directory is blank", async () => {
		const adapter = {
			exists: vi.fn(),
			read: vi.fn(),
			list: vi.fn(),
		};
		const app = createMockApp(adapter);

		const options = await listLlmMarkdownTemplateOptions(app, "   ");

		expect(options).toEqual([
			{
				id: DEFAULT_BUILTIN_LLM_TEMPLATE_ID,
				label: "LLM-ready",
				source: "builtin",
			},
			{
				id: COMPACT_BUILTIN_LLM_TEMPLATE_ID,
				label: "Compact",
				source: "builtin",
			},
		]);
		expect(adapter.list).not.toHaveBeenCalled();
	});

	it("can list options without compact built-in template", async () => {
		const adapter = {
			exists: vi.fn(),
			read: vi.fn(),
			list: vi.fn(async () => ({
				files: [],
				folders: [],
			})),
		};
		const app = createMockApp(adapter);

		const options = await listLlmMarkdownTemplateOptions(app, LLM_MARKDOWN_TEMPLATE_DIRECTORY, {
			includeCompactBuiltin: false,
		});

		expect(options).toEqual([
			{
				id: DEFAULT_BUILTIN_LLM_TEMPLATE_ID,
				label: "LLM-ready",
				source: "builtin",
			},
		]);
	});

	it("normalizes directory paths", () => {
		expect(normalizeTemplateDirectoryPath(" /alpha//beta/ ")).toBe("alpha/beta");
	});
});
