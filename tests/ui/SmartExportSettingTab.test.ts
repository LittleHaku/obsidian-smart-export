import { App, Setting, SettingDefinitionItem, TFile, TFolder } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	SmartExportSettingTab,
	SmartExportSettingsPlugin,
} from "../../src/ui/SmartExportSettingTab";
import { DEFAULT_SETTINGS } from "../../src/settings/defaultSettings";
import { SmartExportSettings } from "../../src/types";

type NamedDefinition = {
	name: string;
	desc?: string | DocumentFragment;
	aliases?: string[];
	visible?: boolean | (() => boolean);
	control?: {
		key: string;
		type: string;
		defaultValue?: unknown;
	};
	render?: (setting: Setting, group: never) => void | (() => void);
};

type SettingTabInternals = {
	loadDefaultOutputTemplateOptions(): Promise<unknown[]>;
};

function createSettings(): SmartExportSettings {
	return {
		...DEFAULT_SETTINGS,
		ignoredTraversalFolders: [...DEFAULT_SETTINGS.ignoredTraversalFolders],
		ignoredTraversalTagPatterns: [...DEFAULT_SETTINGS.ignoredTraversalTagPatterns],
		ignoredTraversalPropertyRules: [...DEFAULT_SETTINGS.ignoredTraversalPropertyRules],
		redactionRegexPatterns: [...DEFAULT_SETTINGS.redactionRegexPatterns],
	};
}

function createSettingTab(): {
	tab: SmartExportSettingTab;
	plugin: SmartExportSettingsPlugin;
	saveSettings: ReturnType<typeof vi.fn>;
} {
	const app = new App();
	Object.assign(app, {
		vault: {
			getFolderByPath: vi.fn(() => null),
		},
	});
	const saveSettings = vi.fn(async () => {});
	const plugin = {
		settings: createSettings(),
		saveSettings,
	} as unknown as SmartExportSettingsPlugin;

	return {
		tab: new SmartExportSettingTab(app, plugin),
		plugin,
		saveSettings,
	};
}

function getNamedDefinitions(
	definitions: SettingDefinitionItem<keyof SmartExportSettings>[]
): NamedDefinition[] {
	const items: NamedDefinition[] = [];
	for (const definition of definitions) {
		if ("items" in definition && Array.isArray(definition.items)) {
			items.push(...(definition.items as NamedDefinition[]));
			continue;
		}
		if ("name" in definition) {
			items.push(definition);
		}
	}
	return items;
}

function findDefinition(tab: SmartExportSettingTab, name: string): NamedDefinition {
	const definition = getNamedDefinitions(tab.getSettingDefinitions()).find(
		(item) => item.name === name
	);
	if (!definition) {
		throw new Error(`Missing setting definition: ${name}`);
	}
	return definition;
}

describe("SmartExportSettingTab", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("generates searchable declarative groups with every existing control", () => {
		const { tab } = createSettingTab();
		const definitions = tab.getSettingDefinitions();
		const headings = definitions.flatMap((definition) =>
			"type" in definition && definition.type === "group" && definition.heading
				? [definition.heading]
				: []
		);
		const items = getNamedDefinitions(definitions);

		expect(headings).toEqual([
			"Export defaults",
			"Traversal exclusions",
			"Content redaction",
			"Markdown templates",
			"Print-friendly Markdown",
			"Export modal behavior",
		]);
		expect(items.map((item) => item.name)).toEqual([
			"Default content depth",
			"Default title depth",
			"Default output",
			"Default export target",
			"Default export note folder",
			"Default link direction",
			"Ignored folders",
			"Hide notes with tags",
			"Hide notes with property rules",
			"Redact marked sections",
			"Redaction delimiter",
			"Marked section replacement",
			"Apply regular expression redaction rules",
			"Regular expression replacement",
			"Regular expression redaction rules",
			"Test content redaction",
			"Markdown template folder",
			"Template documentation",
			"Include table of contents",
			"Number headings",
			"Insert section dividers",
			"Insert page breaks",
			"Normalize content headings",
			"Auto-select current note",
			"Close modal after export",
			"Open created export note",
			"Show per-note token estimates",
		]);
		expect(Object.prototype.hasOwnProperty.call(SmartExportSettingTab.prototype, "display")).toBe(
			false
		);

		const defaultOutputDescription = findDefinition(tab, "Default output").desc;
		const templateFolderDescription = findDefinition(tab, "Markdown template folder").desc;
		expect(defaultOutputDescription).toContain("Template docs");
		expect(templateFolderDescription).toContain("Vault-relative folder");
		expect(findDefinition(tab, "Default export note folder").control?.type).toBe("folder");
		expect(findDefinition(tab, "Markdown template folder").control?.type).toBe("folder");
		expect(findDefinition(tab, "Redact marked sections").aliases).toEqual([
			"Redaction delimiter",
			"Marked section replacement",
		]);
		expect(findDefinition(tab, "Apply regular expression redaction rules").aliases).toEqual([
			"Regular expression replacement",
			"Regular expression redaction rules",
		]);
	});

	it("creates linked descriptions from their rendered rows", () => {
		const { tab } = createSettingTab();
		const defaultOutputSetting = new Setting(document.body);
		const defaultOutputCleanup = findDefinition(tab, "Default output").render?.(
			defaultOutputSetting,
			{} as never
		);
		const templateDocsSetting = new Setting(document.body);
		findDefinition(tab, "Template documentation").render?.(templateDocsSetting, {} as never);

		const defaultOutputLink = defaultOutputSetting.descEl.querySelector("a");
		const templateDocsLink = templateDocsSetting.descEl.querySelector("a");
		expect(defaultOutputLink?.textContent).toBe("Template docs");
		expect(defaultOutputLink?.ownerDocument).toBe(defaultOutputSetting.settingEl.ownerDocument);
		expect(templateDocsLink?.textContent).toBe("Template placeholder docs");
		expect(templateDocsLink?.ownerDocument).toBe(templateDocsSetting.settingEl.ownerDocument);

		if (typeof defaultOutputCleanup === "function") {
			defaultOutputCleanup();
		}
	});

	it("declares explicit defaults matching the values used for new installations", () => {
		const { tab } = createSettingTab();
		const controls = getNamedDefinitions(tab.getSettingDefinitions()).filter(
			(definition) => definition.control
		);

		expect(controls.length).toBeGreaterThan(0);
		for (const definition of controls) {
			expect(definition.control).toHaveProperty("defaultValue");
			expect(tab.getControlValue(definition.control!.key)).toEqual(
				definition.control!.defaultValue
			);
		}
	});

	it("normalizes value changes, preserves depth invariants, and persists immediate controls", async () => {
		const { tab, plugin, saveSettings } = createSettingTab();
		const update = vi.spyOn(tab, "update");

		await tab.setControlValue("defaultContentDepth", 9);
		expect(plugin.settings.defaultContentDepth).toBe(9);
		expect(plugin.settings.defaultTitleDepth).toBe(9);
		expect(update).not.toHaveBeenCalled();

		await tab.setControlValue("defaultTitleDepth", 2);
		expect(plugin.settings.defaultTitleDepth).toBe(9);

		await tab.setControlValue("ignoredTraversalFolders", " Templates, /Archive ");
		await tab.setControlValue("ignoredTraversalTagPatterns", " #draft, projects/* ");
		await tab.setControlValue("ignoredTraversalPropertyRules", " status=done, archived ");
		await tab.setControlValue("defaultExportNoteFolderPath", "\\Exports\\Generated\\");
		await tab.setControlValue("redactionDelimiter", " ");

		expect(plugin.settings.ignoredTraversalFolders).toEqual(["Templates", "/Archive"]);
		expect(plugin.settings.ignoredTraversalTagPatterns).toEqual(["draft", "projects/*"]);
		expect(plugin.settings.ignoredTraversalPropertyRules).toEqual(["status=done", "archived"]);
		expect(plugin.settings.defaultExportNoteFolderPath).toBe("Exports/Generated");
		expect(plugin.settings.redactionDelimiter).toBe(DEFAULT_SETTINGS.redactionDelimiter);
		expect(tab.getControlValue("ignoredTraversalFolders")).toBe("Templates, /Archive");
		expect(saveSettings).toHaveBeenCalledTimes(4);

		await tab.setControlValue("defaultExportTarget", "unsupported");
		await tab.setControlValue("missingSetting", true);
		expect(saveSettings).toHaveBeenCalledTimes(4);
	});

	it("restores the title slider when its value is clamped to the content depth", async () => {
		const { tab, plugin, saveSettings } = createSettingTab();
		const definition = findDefinition(tab, "Default title depth");
		const setting = new Setting(document.body);
		const cleanup = definition.render?.(setting, {} as never);
		const slider = setting.controlEl.querySelector<HTMLInputElement>('input[type="range"]');

		expect(slider?.value).toBe(String(DEFAULT_SETTINGS.defaultTitleDepth));
		await tab.setControlValue("defaultContentDepth", 9);
		expect(slider?.value).toBe("9");

		if (slider) {
			slider.value = "2";
			slider.dispatchEvent(new Event("input"));
		}
		await vi.waitFor(() => {
			expect(plugin.settings.defaultTitleDepth).toBe(9);
			expect(slider?.value).toBe("9");
		});
		expect(saveSettings).toHaveBeenCalledTimes(2);

		if (typeof cleanup === "function") {
			cleanup();
		}
	});

	it("debounces persistence for traversal exclusions and regular expression rules", async () => {
		vi.useFakeTimers();
		const { tab, plugin, saveSettings } = createSettingTab();

		await tab.setControlValue("ignoredTraversalFolders", "Templates");
		await tab.setControlValue("ignoredTraversalTagPatterns", "#draft");
		await tab.setControlValue("ignoredTraversalPropertyRules", "status=done");
		expect(saveSettings).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(299);
		expect(saveSettings).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);
		expect(saveSettings).toHaveBeenCalledOnce();

		await tab.setControlValue("redactionRegexPatterns", "secret");
		await tab.setControlValue("redactionRegexPatterns", "secret\\d+");
		expect(plugin.settings.redactionRegexPatterns).toEqual(["secret\\d+"]);
		expect(saveSettings).toHaveBeenCalledOnce();

		await vi.advanceTimersByTimeAsync(499);
		expect(saveSettings).toHaveBeenCalledOnce();
		await vi.advanceTimersByTimeAsync(1);
		expect(saveSettings).toHaveBeenCalledTimes(2);
	});

	it("updates a template folder without rebuilding the active settings tab", async () => {
		vi.useFakeTimers();
		const { tab, plugin, saveSettings } = createSettingTab();
		const update = vi.spyOn(tab, "update");
		const customTemplate = new TFile();
		customTemplate.path = "Templates/Final/custom.md";
		const templateFolder = new TFolder();
		templateFolder.children = [customTemplate];
		vi.spyOn(tab.app.vault, "getFolderByPath").mockImplementation((path) =>
			path === "Templates/Final" ? templateFolder : null
		);
		const definition = findDefinition(tab, "Default output");
		const setting = new Setting(document.body);
		const cleanup = definition.render?.(setting, {} as never);
		const dropdown = setting.controlEl.querySelector("select");
		await vi.waitFor(() => {
			expect(dropdown?.querySelector('option[value="template:builtin:default"]')).not.toBeNull();
		});

		await tab.setControlValue("llmMarkdownTemplateDirectory", "Templates/First");
		await tab.setControlValue("llmMarkdownTemplateDirectory", "Templates/Final");

		expect(plugin.settings.llmMarkdownTemplateDirectory).toBe("Templates/Final");
		expect(saveSettings).not.toHaveBeenCalled();
		expect(update).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(300);
		expect(saveSettings).toHaveBeenCalledOnce();
		expect(update).not.toHaveBeenCalled();
		expect(
			dropdown?.querySelector('option[value="template:user:Templates/Final/custom.md"]')
		).not.toBeNull();

		if (typeof cleanup === "function") {
			cleanup();
		}
	});

	it("refreshes conditional redaction rows when their controlling toggles change", async () => {
		const { tab, plugin } = createSettingTab();
		const refreshDomState = vi.spyOn(tab, "refreshDomState");
		const delimiter = findDefinition(tab, "Redaction delimiter");
		const regexRules = findDefinition(tab, "Regular expression redaction rules");

		expect((delimiter.visible as () => boolean)()).toBe(false);
		expect((regexRules.visible as () => boolean)()).toBe(false);

		await tab.setControlValue("redactMarkedSections", true);
		await tab.setControlValue("redactRegexMatches", true);

		expect(plugin.settings.redactMarkedSections).toBe(true);
		expect(plugin.settings.redactRegexMatches).toBe(true);
		expect((delimiter.visible as () => boolean)()).toBe(true);
		expect((regexRules.visible as () => boolean)()).toBe(true);
		expect(refreshDomState).toHaveBeenCalledTimes(2);
	});

	it("keeps the derived default-output dropdown functional inside a declarative row", async () => {
		const { tab, plugin, saveSettings } = createSettingTab();
		const definition = findDefinition(tab, "Default output");
		const setting = new Setting(document.body);
		const cleanup = definition.render?.(setting, {} as never);
		const dropdown = setting.controlEl.querySelector("select");

		await Promise.resolve();
		expect(dropdown).not.toBeNull();
		expect(dropdown?.value).toBe("format:xml");
		expect(dropdown?.options.length).toBeGreaterThan(2);

		if (dropdown) {
			dropdown.value = "format:print-friendly-markdown";
			dropdown.dispatchEvent(new Event("change"));
		}
		await Promise.resolve();

		expect(plugin.settings.defaultExportFormat).toBe("print-friendly-markdown");
		expect(saveSettings).toHaveBeenCalledOnce();
		if (typeof cleanup === "function") {
			cleanup();
		}
		expect(setting.controlEl.querySelectorAll("select")).toHaveLength(0);

		const rerenderCleanup = definition.render?.(setting, {} as never);
		expect(setting.controlEl.querySelectorAll("select")).toHaveLength(1);
		if (typeof rerenderCleanup === "function") {
			rerenderCleanup();
		}
	});

	it("preserves the live redaction preview and cleans up its input listener", async () => {
		const { tab } = createSettingTab();
		const definition = findDefinition(tab, "Test content redaction");
		const setting = new Setting(document.body);
		const cleanup = definition.render?.(setting, {} as never);
		const textareas = setting.settingEl.querySelectorAll("textarea");
		const input = textareas.item(0);
		const output = textareas.item(1);

		input.value = "Visible :::private::: text";
		input.dispatchEvent(new Event("input"));
		expect(output.value).toBe("Visible :::private::: text");

		await tab.setControlValue("redactMarkedSections", true);
		expect(output.value).toBe("Visible REDACTED text");

		if (typeof cleanup === "function") {
			cleanup();
		}
		expect(
			setting.settingEl.querySelectorAll(".smart-export-redaction-preview__grid")
		).toHaveLength(0);
		input.value = "Changed after cleanup";
		input.dispatchEvent(new Event("input"));
		expect(output.value).toBe("Visible REDACTED text");

		const rerenderCleanup = definition.render?.(setting, {} as never);
		expect(
			setting.settingEl.querySelectorAll(".smart-export-redaction-preview__grid")
		).toHaveLength(1);
		if (typeof rerenderCleanup === "function") {
			rerenderCleanup();
		}
	});

	it("covers every default-output choice and template fallback", async () => {
		const { tab, plugin, saveSettings } = createSettingTab();
		plugin.settings.defaultExportFormat = "llm-markdown";
		plugin.settings.defaultLlmTemplateId = "missing";
		const definition = findDefinition(tab, "Default output");
		const setting = new Setting(document.body);
		const cleanup = definition.render?.(setting, {} as never);
		const dropdown = setting.controlEl.querySelector("select");
		await vi.waitFor(() => {
			expect(dropdown?.querySelector('option[value="template:builtin:default"]')).not.toBeNull();
		});

		expect(dropdown?.value).toBe("template:builtin:default");
		const emptyTemplateOption = document.body.createEl("option");
		emptyTemplateOption.value = "template:";
		dropdown?.append(emptyTemplateOption);
		if (dropdown) {
			dropdown.value = "template:";
			dropdown.dispatchEvent(new Event("change"));
		}
		await Promise.resolve();
		for (const value of [
			"format:xml",
			"format:print-friendly-markdown",
			"template:builtin:default",
			"unsupported",
		]) {
			if (dropdown) {
				dropdown.value = value;
				dropdown.dispatchEvent(new Event("change"));
			}
			await Promise.resolve();
		}
		expect(plugin.settings.defaultExportFormat).toBe("llm-markdown");
		expect(plugin.settings.defaultLlmTemplateId).toBe("builtin:default");
		expect(saveSettings).toHaveBeenCalled();
		expect(tab.getControlValue("missingSetting")).toBeUndefined();

		if (typeof cleanup === "function") cleanup();
		const rerenderCleanup = definition.render?.(setting, {} as never);
		await Promise.resolve();
		expect(setting.controlEl.querySelector("select")?.value).toBe("template:builtin:default");
		if (typeof rerenderCleanup === "function") rerenderCleanup();
	});

	it("rejects invalid control types and accepts every validated enum and boolean", async () => {
		const { tab, plugin } = createSettingTab();
		const invalidUpdates: Array<[string, unknown]> = [
			["defaultContentDepth", "3"],
			["defaultTitleDepth", null],
			["defaultExportTarget", "other"],
			["defaultExportNoteFolderPath", 1],
			["defaultLinkTraversalMode", "sideways"],
			["ignoredTraversalFolders", []],
			["ignoredTraversalTagPatterns", []],
			["ignoredTraversalPropertyRules", []],
			["redactMarkedSections", "true"],
			["redactRegexMatches", "true"],
			["redactionDelimiter", 1],
			["redactionReplacement", 1],
			["redactionRegexReplacement", 1],
			["redactionRegexPatterns", []],
			["llmMarkdownTemplateDirectory", 1],
			["printFriendlyIncludeTableOfContents", "true"],
			["showTokenEstimatesInTree", "true"],
		];
		for (const [key, value] of invalidUpdates) {
			await tab.setControlValue(key, value);
		}

		for (const mode of ["outgoing", "incoming", "both"]) {
			await tab.setControlValue("defaultLinkTraversalMode", mode);
		}
		for (const target of ["clipboard", "new-note"]) {
			await tab.setControlValue("defaultExportTarget", target);
		}
		for (const key of [
			"printFriendlyIncludeTableOfContents",
			"printFriendlyNumberHeadings",
			"printFriendlyInsertSectionDividers",
			"printFriendlyInsertPageBreaks",
			"printFriendlyNormalizeContentHeadings",
			"autoSelectCurrentNote",
			"closeModalAfterExport",
			"openCreatedExportNote",
			"showTokenEstimatesInTree",
		]) {
			await tab.setControlValue(key, true);
		}
		await tab.setControlValue("redactionReplacement", "MASKED");
		await tab.setControlValue("redactionRegexReplacement", "");
		await tab.setControlValue(
			"llmMarkdownTemplateDirectory",
			plugin.settings.llmMarkdownTemplateDirectory
		);

		expect(plugin.settings.defaultLinkTraversalMode).toBe("both");
		expect(plugin.settings.defaultExportTarget).toBe("new-note");
		expect(plugin.settings.showTokenEstimatesInTree).toBe(true);
	});

	it("evaluates all conditional rows and flushes pending debounced work on hide", async () => {
		vi.useFakeTimers();
		const { tab } = createSettingTab();
		for (const name of [
			"Redaction delimiter",
			"Marked section replacement",
			"Regular expression replacement",
			"Regular expression redaction rules",
		]) {
			const visible = findDefinition(tab, name).visible as () => boolean;
			expect(visible()).toBe(false);
		}
		await tab.setControlValue("redactMarkedSections", true);
		await tab.setControlValue("redactRegexMatches", true);
		for (const name of [
			"Redaction delimiter",
			"Marked section replacement",
			"Regular expression replacement",
			"Regular expression redaction rules",
		]) {
			const visible = findDefinition(tab, name).visible as () => boolean;
			expect(visible()).toBe(true);
		}

		await tab.setControlValue("ignoredTraversalFolders", "Archive");
		await tab.setControlValue("redactionRegexPatterns", "secret");
		await tab.setControlValue("llmMarkdownTemplateDirectory", "Templates/New");
		tab.hide();
		await Promise.resolve();
	});

	it("discards stale template loads and resets missing selected templates", async () => {
		const { tab, plugin, saveSettings } = createSettingTab();
		const internals = tab as unknown as SettingTabInternals;
		plugin.settings.defaultExportFormat = "llm-markdown";
		plugin.settings.defaultLlmTemplateId = "missing";

		const first = internals.loadDefaultOutputTemplateOptions();
		plugin.settings.llmMarkdownTemplateDirectory = "Templates/Changed";
		const second = internals.loadDefaultOutputTemplateOptions();
		await first;
		await second;

		expect(plugin.settings.defaultLlmTemplateId).toBe("builtin:default");
		expect(saveSettings).toHaveBeenCalled();
	});

	it("removes every stale redaction preview grid before rerendering", () => {
		const { tab } = createSettingTab();
		const definition = findDefinition(tab, "Test content redaction");
		const setting = new Setting(document.body);
		setting.settingEl.createDiv({ cls: "smart-export-redaction-preview__grid" });
		setting.settingEl.createDiv({ cls: "smart-export-redaction-preview__grid" });

		const cleanup = definition.render?.(setting, {} as never);

		expect(
			setting.settingEl.querySelectorAll(".smart-export-redaction-preview__grid")
		).toHaveLength(1);
		if (typeof cleanup === "function") cleanup();
	});
});
