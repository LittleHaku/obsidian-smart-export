import { App, Setting, SettingDefinitionItem } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import {
	SmartExportSettingTab,
	SmartExportSettingsPlugin,
} from "../../src/ui/SmartExportSettingTab";
import { DEFAULT_SETTINGS } from "../../src/settings/defaultSettings";
import { SmartExportSettings } from "../../src/types";

type NamedDefinition = {
	name: string;
	desc?: string | DocumentFragment;
	visible?: boolean | (() => boolean);
	control?: {
		key: string;
		type: string;
		defaultValue?: unknown;
	};
	render?: (setting: Setting, group: never) => void | (() => void);
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
		expect(defaultOutputDescription).toBeInstanceOf(DocumentFragment);
		expect((defaultOutputDescription as DocumentFragment).querySelector("a")?.textContent).toBe(
			"Template docs"
		);
		expect(templateFolderDescription).toBeInstanceOf(DocumentFragment);
		expect(findDefinition(tab, "Default export note folder").control?.type).toBe("folder");
		expect(findDefinition(tab, "Markdown template folder").control?.type).toBe("folder");
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

	it("normalizes value changes, preserves depth invariants, and persists through the plugin", async () => {
		const { tab, plugin, saveSettings } = createSettingTab();
		const update = vi.spyOn(tab, "update");

		await tab.setControlValue("defaultContentDepth", 9);
		expect(plugin.settings.defaultContentDepth).toBe(9);
		expect(plugin.settings.defaultTitleDepth).toBe(9);
		expect(update).toHaveBeenCalledOnce();

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
		expect(saveSettings).toHaveBeenCalledTimes(7);

		await tab.setControlValue("defaultExportTarget", "unsupported");
		await tab.setControlValue("missingSetting", true);
		expect(saveSettings).toHaveBeenCalledTimes(7);
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
		input.value = "Changed after cleanup";
		input.dispatchEvent(new Event("input"));
		expect(output.value).toBe("Visible REDACTED text");
	});
});
