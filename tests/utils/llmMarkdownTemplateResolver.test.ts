import { describe, expect, it, vi } from "vitest";
import { App, TFile, TFolder } from "obsidian";
import {
	COMPACT_BUILTIN_LLM_TEMPLATE_ID,
	DEFAULT_BUILTIN_LLM_TEMPLATE_ID,
	LLM_MARKDOWN_TEMPLATE_DIRECTORY,
	LLM_MARKDOWN_TEMPLATE_FILE,
	listLlmMarkdownTemplateOptions,
	normalizeTemplateDirectoryPath,
	resolveLlmMarkdownTemplate,
} from "../../src/utils/llmMarkdownTemplateResolver";

type MockTemplateContent = string | Error;

interface MockVault {
	getFileByPath: ReturnType<typeof vi.fn>;
	getFolderByPath: ReturnType<typeof vi.fn>;
	cachedRead: ReturnType<typeof vi.fn>;
}

function createMockTFile(path: string): TFile {
	const name = path.split("/").pop() ?? path;
	const extension = name.includes(".") ? (name.split(".").pop() ?? "") : "";
	const basename = extension.length > 0 ? name.slice(0, -(extension.length + 1)) : name;

	return Object.assign(new TFile(), { path, name, basename, extension });
}

function createMockTFolder(path: string, children: Array<TFile | TFolder> = []): TFolder {
	const name = path.split("/").pop() ?? path;
	return Object.assign(new TFolder(), { path, name, children });
}

function createMockVault(
	contents: Record<string, MockTemplateContent> = {},
	folders: Record<string, string[]> = {}
): MockVault {
	const files = new Map(Object.keys(contents).map((path) => [path, createMockTFile(path)]));

	return {
		getFileByPath: vi.fn((path: string) => files.get(path) ?? null),
		getFolderByPath: vi.fn((path: string) => {
			const childPaths = folders[path];
			if (childPaths === undefined) {
				return null;
			}
			return createMockTFolder(
				path,
				childPaths.map((childPath) => files.get(childPath) ?? createMockTFolder(childPath))
			);
		}),
		cachedRead: vi.fn(async (file: TFile) => {
			const content = contents[file.path];
			if (content instanceof Error) {
				throw content;
			}
			if (content === undefined) {
				throw new Error(`Missing mock content for ${file.path}`);
			}
			return content;
		}),
	};
}

function createMockApp(vault: MockVault): App {
	return { vault } as unknown as App;
}

describe("llmMarkdownTemplateResolver", () => {
	it("resolves an explicit built-in template id without reading files", async () => {
		const vault = createMockVault();
		const app = createMockApp(vault);

		const result = await resolveLlmMarkdownTemplate(
			app,
			LLM_MARKDOWN_TEMPLATE_DIRECTORY,
			COMPACT_BUILTIN_LLM_TEMPLATE_ID
		);

		expect(result.templateId).toBe(COMPACT_BUILTIN_LLM_TEMPLATE_ID);
		expect(result.sourcePath).toBeNull();
		expect(result.template).toContain("## Included notes");
		expect(vault.getFileByPath).not.toHaveBeenCalled();
		expect(vault.getFolderByPath).not.toHaveBeenCalled();
		expect(vault.cachedRead).not.toHaveBeenCalled();
	});

	it("trims whitespace around explicit built-in template ids", async () => {
		const vault = createMockVault();
		const app = createMockApp(vault);

		const result = await resolveLlmMarkdownTemplate(
			app,
			LLM_MARKDOWN_TEMPLATE_DIRECTORY,
			`  ${COMPACT_BUILTIN_LLM_TEMPLATE_ID}  `
		);

		expect(result.templateId).toBe(COMPACT_BUILTIN_LLM_TEMPLATE_ID);
		expect(result.sourcePath).toBeNull();
		expect(vault.getFileByPath).not.toHaveBeenCalled();
		expect(vault.getFolderByPath).not.toHaveBeenCalled();
		expect(vault.cachedRead).not.toHaveBeenCalled();
	});

	it("resolves an explicit user template id through the Vault API", async () => {
		const userTemplatePath = "smart-templates/custom.md";
		const vault = createMockVault({ [userTemplatePath]: "custom template" });
		const app = createMockApp(vault);

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
		expect(vault.getFileByPath).toHaveBeenCalledWith(userTemplatePath);
		expect(vault.cachedRead).toHaveBeenCalledWith(
			expect.objectContaining({ path: userTemplatePath })
		);
	});

	it("normalizes an explicit user template path before lookup", async () => {
		const normalizedPath = "smart-templates/custom.md";
		const vault = createMockVault({ [normalizedPath]: "custom template" });
		const app = createMockApp(vault);

		await resolveLlmMarkdownTemplate(
			app,
			LLM_MARKDOWN_TEMPLATE_DIRECTORY,
			"user:/smart-templates//custom.md"
		);

		expect(vault.getFileByPath).toHaveBeenCalledWith(normalizedPath);
	});

	it("falls back to built-in default when an explicit user template is missing", async () => {
		const vault = createMockVault();
		const app = createMockApp(vault);

		const result = await resolveLlmMarkdownTemplate(
			app,
			LLM_MARKDOWN_TEMPLATE_DIRECTORY,
			"user:x.md"
		);

		expect(result.templateId).toBe(DEFAULT_BUILTIN_LLM_TEMPLATE_ID);
		expect(result.sourcePath).toBeNull();
		expect(result.template).toContain("## Note Structure");
		expect(vault.cachedRead).not.toHaveBeenCalled();
	});

	it("falls back to built-in default when a user template lookup throws", async () => {
		const vault = createMockVault();
		vault.getFileByPath.mockImplementation(() => {
			throw new Error("vault failure");
		});
		const app = createMockApp(vault);

		const result = await resolveLlmMarkdownTemplate(
			app,
			LLM_MARKDOWN_TEMPLATE_DIRECTORY,
			"user:smart-templates/broken.md"
		);

		expect(result.templateId).toBe(DEFAULT_BUILTIN_LLM_TEMPLATE_ID);
		expect(result.sourcePath).toBeNull();
	});

	it("falls back to built-in default when reading a user template throws", async () => {
		const path = "smart-templates/broken.md";
		const vault = createMockVault({ [path]: new Error("read failure") });
		const app = createMockApp(vault);

		const result = await resolveLlmMarkdownTemplate(
			app,
			LLM_MARKDOWN_TEMPLATE_DIRECTORY,
			`user:${path}`
		);

		expect(result.templateId).toBe(DEFAULT_BUILTIN_LLM_TEMPLATE_ID);
		expect(result.sourcePath).toBeNull();
	});

	it("resolves the preferred folder template without listing the folder", async () => {
		const preferredPath = `${LLM_MARKDOWN_TEMPLATE_DIRECTORY}/${LLM_MARKDOWN_TEMPLATE_FILE}`;
		const vault = createMockVault({ [preferredPath]: "preferred" });
		const app = createMockApp(vault);

		const result = await resolveLlmMarkdownTemplate(app);

		expect(result).toEqual({
			template: "preferred",
			sourcePath: preferredPath,
			templateId: `user:${preferredPath}`,
		});
		expect(vault.getFolderByPath).not.toHaveBeenCalled();
	});

	it("falls back to the first readable Markdown file sorted by path", async () => {
		const fallbackEmpty = "smart-templates/alpha.md";
		const fallbackValid = "smart-templates/beta.MD";
		const textFile = "smart-templates/readme.txt";
		const vault = createMockVault(
			{
				[fallbackEmpty]: "   ",
				[fallbackValid]: "valid",
				[textFile]: "ignored",
			},
			{
				[LLM_MARKDOWN_TEMPLATE_DIRECTORY]: [fallbackValid, textFile, fallbackEmpty],
			}
		);
		const app = createMockApp(vault);

		const result = await resolveLlmMarkdownTemplate(app);

		expect(result).toEqual({
			template: "valid",
			sourcePath: fallbackValid,
			templateId: `user:${fallbackValid}`,
		});
		expect(vault.getFolderByPath).toHaveBeenCalledWith(LLM_MARKDOWN_TEMPLATE_DIRECTORY);
	});

	it("falls back to built-in default when the template folder is missing", async () => {
		const vault = createMockVault();
		const app = createMockApp(vault);

		const result = await resolveLlmMarkdownTemplate(app);

		expect(result.templateId).toBe(DEFAULT_BUILTIN_LLM_TEMPLATE_ID);
		expect(result.sourcePath).toBeNull();
		expect(result.template).toContain("## Note Contents");
	});

	it("falls back to built-in default when the template folder is empty", async () => {
		const vault = createMockVault({}, { [LLM_MARKDOWN_TEMPLATE_DIRECTORY]: [] });
		const app = createMockApp(vault);

		const result = await resolveLlmMarkdownTemplate(app);

		expect(result.templateId).toBe(DEFAULT_BUILTIN_LLM_TEMPLATE_ID);
		expect(result.sourcePath).toBeNull();
	});

	it("falls back to built-in default when the template folder lookup fails", async () => {
		const vault = createMockVault();
		vault.getFolderByPath.mockImplementation(() => {
			throw new Error("vault failure");
		});
		const app = createMockApp(vault);

		const result = await resolveLlmMarkdownTemplate(app);

		expect(result.templateId).toBe(DEFAULT_BUILTIN_LLM_TEMPLATE_ID);
		expect(result.sourcePath).toBeNull();
	});

	it("falls back to built-in default for invalid explicit ids", async () => {
		const vault = createMockVault();
		const app = createMockApp(vault);

		const result = await resolveLlmMarkdownTemplate(
			app,
			LLM_MARKDOWN_TEMPLATE_DIRECTORY,
			"invalid-id"
		);

		expect(result.templateId).toBe(DEFAULT_BUILTIN_LLM_TEMPLATE_ID);
		expect(result.sourcePath).toBeNull();
		expect(vault.getFileByPath).not.toHaveBeenCalled();
	});

	it("falls back to built-in default for empty explicit user template ids", async () => {
		const vault = createMockVault();
		const app = createMockApp(vault);

		const result = await resolveLlmMarkdownTemplate(app, LLM_MARKDOWN_TEMPLATE_DIRECTORY, "user:");

		expect(result.templateId).toBe(DEFAULT_BUILTIN_LLM_TEMPLATE_ID);
		expect(result.sourcePath).toBeNull();
	});

	it("lists built-in and immediate user template options", async () => {
		const alpha = "smart-templates/alpha.md";
		const beta = "smart-templates/beta.md";
		const textFile = "smart-templates/z.txt";
		const nestedFolder = "smart-templates/nested";
		const vault = createMockVault(
			{
				[alpha]: "alpha",
				[beta]: "beta",
				[textFile]: "ignored",
			},
			{
				[LLM_MARKDOWN_TEMPLATE_DIRECTORY]: [textFile, beta, nestedFolder, alpha],
			}
		);
		const app = createMockApp(vault);

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
				id: `user:${alpha}`,
				label: "Custom: alpha",
				source: "user",
			},
			{
				id: `user:${beta}`,
				label: "Custom: beta",
				source: "user",
			},
		]);
		expect(vault.cachedRead).not.toHaveBeenCalled();
	});

	it("lists only built-ins when the template directory is blank", async () => {
		const vault = createMockVault();
		const app = createMockApp(vault);

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
		expect(vault.getFolderByPath).not.toHaveBeenCalled();
	});

	it("lists only built-ins when the template folder is missing", async () => {
		const vault = createMockVault();
		const app = createMockApp(vault);

		const options = await listLlmMarkdownTemplateOptions(app);

		expect(options).toHaveLength(2);
		expect(options.every((option) => option.source === "builtin")).toBe(true);
	});

	it("does not treat a file path as a template folder", async () => {
		const filePath = "smart-templates.md";
		const vault = createMockVault({ [filePath]: "not a folder" });
		const app = createMockApp(vault);

		const options = await listLlmMarkdownTemplateOptions(app, filePath);

		expect(options).toHaveLength(2);
		expect(options.every((option) => option.source === "builtin")).toBe(true);
		expect(vault.getFolderByPath).toHaveBeenCalledWith(filePath);
	});

	it("can list options without the compact built-in template", async () => {
		const vault = createMockVault({}, { [LLM_MARKDOWN_TEMPLATE_DIRECTORY]: [] });
		const app = createMockApp(vault);

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

	it("falls back to built-in default when fallback Markdown files are unreadable", async () => {
		const unreadableA = "smart-templates/a.md";
		const unreadableB = "smart-templates/b.md";
		const vault = createMockVault(
			{
				[unreadableA]: new Error("read failure"),
				[unreadableB]: new Error("read failure"),
			},
			{
				[LLM_MARKDOWN_TEMPLATE_DIRECTORY]: [unreadableA, unreadableB],
			}
		);
		const app = createMockApp(vault);

		const result = await resolveLlmMarkdownTemplate(app);

		expect(result.templateId).toBe(DEFAULT_BUILTIN_LLM_TEMPLATE_ID);
		expect(result.sourcePath).toBeNull();
		expect(vault.getFileByPath).toHaveBeenCalledWith(
			`${LLM_MARKDOWN_TEMPLATE_DIRECTORY}/${LLM_MARKDOWN_TEMPLATE_FILE}`
		);
		expect(vault.cachedRead).toHaveBeenCalledTimes(2);
	});

	it("falls back directly to the built-in default when the template directory is blank", async () => {
		const vault = createMockVault();
		const app = createMockApp(vault);

		const result = await resolveLlmMarkdownTemplate(app, "   ");

		expect(result.templateId).toBe(DEFAULT_BUILTIN_LLM_TEMPLATE_ID);
		expect(result.sourcePath).toBeNull();
		expect(vault.getFolderByPath).not.toHaveBeenCalled();
	});

	it("normalizes directory paths", () => {
		expect(normalizeTemplateDirectoryPath(" /alpha//beta/ ")).toBe("alpha/beta");
	});
});
