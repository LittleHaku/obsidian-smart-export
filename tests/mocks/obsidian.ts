// This file mocks the 'obsidian' module for Vitest.

type CreateElOptions = {
	cls?: string;
	text?: string;
	attr?: Record<string, string>;
	href?: string;
};

type ObsidianHTMLElement = HTMLElement & {
	empty: () => void;
	setText: (text: string) => void;
	appendText: (text: string) => void;
	createEl: <K extends keyof HTMLElementTagNameMap>(
		tag: K,
		options?: CreateElOptions
	) => HTMLElementTagNameMap[K];
	createDiv: (options?: CreateElOptions) => HTMLDivElement;
	createSpan: (options?: CreateElOptions) => HTMLSpanElement;
	addClass: (...classes: string[]) => void;
	removeClass: (...classes: string[]) => void;
};

function applyOptions(element: HTMLElement, options?: CreateElOptions): void {
	if (!options) {
		return;
	}

	if (options.cls) {
		element.className = options.cls;
	}
	if (options.text) {
		element.textContent = options.text;
	}
	if (options.attr) {
		for (const [key, value] of Object.entries(options.attr)) {
			element.setAttribute(key, value);
		}
	}
	if (options.href) {
		element.setAttribute("href", options.href);
	}
}

const elementPrototype = HTMLElement.prototype as ObsidianHTMLElement;

if (!elementPrototype.empty) {
	elementPrototype.empty = function empty(this: HTMLElement): void {
		this.replaceChildren();
	};
}

if (!elementPrototype.setText) {
	elementPrototype.setText = function setText(this: HTMLElement, text: string): void {
		this.textContent = text;
	};
}

if (!elementPrototype.appendText) {
	elementPrototype.appendText = function appendText(this: HTMLElement, text: string): void {
		this.append(this.ownerDocument.createTextNode(text));
	};
}

if (!elementPrototype.createEl) {
	elementPrototype.createEl = function createEl<K extends keyof HTMLElementTagNameMap>(
		this: HTMLElement,
		tag: K,
		options?: CreateElOptions
	): HTMLElementTagNameMap[K] {
		const element = this.ownerDocument.createElement(tag);
		applyOptions(element, options);
		this.append(element);
		return element;
	};
}

if (!elementPrototype.createDiv) {
	elementPrototype.createDiv = function createDiv(
		this: HTMLElement,
		options?: CreateElOptions
	): HTMLDivElement {
		return this.createEl("div", options);
	};
}

if (!elementPrototype.createSpan) {
	elementPrototype.createSpan = function createSpan(
		this: HTMLElement,
		options?: CreateElOptions
	): HTMLSpanElement {
		return this.createEl("span", options);
	};
}

if (!elementPrototype.addClass) {
	elementPrototype.addClass = function addClass(this: HTMLElement, ...classes: string[]): void {
		this.classList.add(...classes);
	};
}

if (!elementPrototype.removeClass) {
	elementPrototype.removeClass = function removeClass(
		this: HTMLElement,
		...classes: string[]
	): void {
		this.classList.remove(...classes);
	};
}

if (!Object.getOwnPropertyDescriptor(elementPrototype, "doc")) {
	Object.defineProperty(elementPrototype, "doc", {
		configurable: true,
		get(this: HTMLElement): Document {
			return this.ownerDocument;
		},
	});
}

if (!Object.getOwnPropertyDescriptor(elementPrototype, "win")) {
	Object.defineProperty(elementPrototype, "win", {
		configurable: true,
		get(this: HTMLElement): Window {
			return this.ownerDocument.defaultView ?? window;
		},
	});
}

if (!Object.getOwnPropertyDescriptor(Document.prototype, "win")) {
	Object.defineProperty(Document.prototype, "win", {
		configurable: true,
		get(this: Document): Window {
			return this.defaultView ?? window;
		},
	});
}

export class TFile {}
export class TFolder {}
export class App {}
export class Vault {}
export class MetadataCache {}
export class LinkCache {}
export class Position {}
export class Loc {}

type MockDebouncer<T extends unknown[], V> = {
	(...args: T): MockDebouncer<T, V>;
	cancel(): MockDebouncer<T, V>;
	run(): V | void;
};

export function debounce<T extends unknown[], V>(
	callback: (...args: T) => V,
	timeout = 0,
	resetTimer = false
): MockDebouncer<T, V> {
	let timer: number | null = null;
	let pendingArgs: T | null = null;

	const invoke = (): V | void => {
		timer = null;
		if (!pendingArgs) {
			return;
		}
		const args = pendingArgs;
		pendingArgs = null;
		return callback(...args);
	};

	const debounced = ((...args: T): MockDebouncer<T, V> => {
		pendingArgs = args;
		if (timer !== null && resetTimer) {
			window.clearTimeout(timer);
			timer = null;
		}
		timer ??= window.setTimeout(invoke, timeout);
		return debounced;
	}) as MockDebouncer<T, V>;

	debounced.cancel = () => {
		if (timer !== null) {
			window.clearTimeout(timer);
		}
		timer = null;
		pendingArgs = null;
		return debounced;
	};
	debounced.run = () => {
		if (timer === null) {
			return;
		}
		window.clearTimeout(timer);
		return invoke();
	};

	return debounced;
}

type MockObsidianWindow = Window & {
	createFragment?: () => DocumentFragment;
	createEl?: <K extends keyof HTMLElementTagNameMap>(
		tag: K,
		options?: CreateElOptions
	) => HTMLElementTagNameMap[K];
};

const mockWindow = window as MockObsidianWindow;
mockWindow.createFragment ??= () => new DocumentFragment();
mockWindow.createEl ??= <K extends keyof HTMLElementTagNameMap>(
	tag: K,
	options?: CreateElOptions
): HTMLElementTagNameMap[K] => {
	const element = document.body.createEl(tag, options);
	element.remove();
	return element;
};

export class Plugin {
	app: App;

	constructor(app = new App()) {
		this.app = app;
	}

	async saveData(_data: unknown): Promise<void> {}
}

export class PluginSettingTab {
	app: App;
	containerEl: HTMLDivElement;
	plugin: Plugin;
	settingItems: unknown[] = [];

	constructor(app: App, plugin: Plugin) {
		this.app = app;
		this.plugin = plugin;
		this.containerEl = mockWindow.createEl!("div");
	}

	getSettingDefinitions(): unknown[] {
		return [];
	}

	getControlValue(_key: string): unknown {
		return undefined;
	}

	async setControlValue(_key: string, _value: unknown): Promise<void> {}

	update(): void {
		this.settingItems = this.getSettingDefinitions();
	}

	refreshDomState(): void {}

	hide(): void {}
}

export class DropdownComponent {
	selectEl: HTMLSelectElement;

	constructor(containerEl: HTMLElement) {
		this.selectEl = containerEl.createEl("select");
	}

	addOption(value: string, display: string): this {
		const option = this.selectEl.createEl("option");
		option.value = value;
		option.textContent = display;
		return this;
	}

	setValue(value: string): this {
		this.selectEl.value = value;
		return this;
	}

	onChange(callback: (value: string) => unknown): this {
		this.selectEl.addEventListener("change", () => {
			void callback(this.selectEl.value);
		});
		return this;
	}
}

export class Setting {
	settingEl: HTMLDivElement;
	infoEl: HTMLDivElement;
	nameEl: HTMLDivElement;
	descEl: HTMLDivElement;
	controlEl: HTMLDivElement;

	constructor(containerEl: HTMLElement) {
		this.settingEl = containerEl.createDiv();
		this.infoEl = this.settingEl.createDiv();
		this.nameEl = this.infoEl.createDiv();
		this.descEl = this.infoEl.createDiv();
		this.controlEl = this.settingEl.createDiv();
	}

	setName(name: string): this {
		this.nameEl.textContent = name;
		return this;
	}

	setDesc(desc: string | DocumentFragment): this {
		this.descEl.replaceChildren(desc);
		return this;
	}

	setHeading(): this {
		this.settingEl.classList.add("setting-item-heading");
		return this;
	}

	addDropdown(callback: (component: DropdownComponent) => unknown): this {
		callback(new DropdownComponent(this.controlEl));
		return this;
	}
}

export class Modal {
	app: App;
	modalEl: HTMLDivElement;
	titleEl: HTMLHeadingElement;
	contentEl: HTMLDivElement;

	constructor(app: App) {
		this.app = app;
		this.modalEl = document.createElement("div");
		this.modalEl.className = "modal";
		this.titleEl = document.createElement("h1");
		this.contentEl = document.createElement("div");
		this.contentEl.className = "modal-content";
		this.modalEl.append(this.titleEl, this.contentEl);
	}

	open(): void {
		this.onOpen();
	}

	close(): void {
		this.onClose();
	}

	onOpen(): void {}

	onClose(): void {}
}

interface MockTagCache {
	tag: string;
}

interface MockCachedMetadata {
	tags?: MockTagCache[];
	frontmatter?: Record<string, unknown>;
}

export function normalizePath(path: string): string {
	return path
		.replace(/\u00A0/g, " ")
		.normalize()
		.replace(/[\\/]+/g, "/")
		.replace(/^\/+/, "")
		.replace(/\/+$/, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function formatYamlValue(value: unknown): string {
	if (typeof value === "string") {
		return JSON.stringify(value);
	}
	if (typeof value === "number") {
		return Number.isFinite(value) ? String(value) : "null";
	}
	if (typeof value === "boolean") {
		return value ? "true" : "false";
	}
	if (typeof value === "bigint") {
		return value.toString();
	}
	if (value === null || value === undefined) {
		return "null";
	}
	if (Array.isArray(value) || isRecord(value)) {
		const serialized = JSON.stringify(value);
		return serialized ?? "null";
	}

	return "null";
}

export function stringifyYaml(obj: unknown): string {
	if (!isRecord(obj)) {
		return "";
	}

	return (
		Object.entries(obj)
			.map(([key, value]) => `${key}: ${formatYamlValue(value)}`)
			.join("\n") + "\n"
	);
}

export function getAllTags(cache: unknown): string[] | null {
	if (!cache || typeof cache !== "object") {
		return null;
	}

	const metadata = cache as MockCachedMetadata;
	const tags = new Set<string>();

	for (const tagEntry of metadata.tags ?? []) {
		if (!tagEntry || typeof tagEntry.tag !== "string") continue;
		tags.add(tagEntry.tag);
	}

	const frontmatter = metadata.frontmatter;
	if (frontmatter && typeof frontmatter === "object" && !Array.isArray(frontmatter)) {
		const tagFields = [frontmatter.tags, frontmatter.tag];
		for (const tagField of tagFields) {
			if (typeof tagField === "string") {
				for (const token of tagField.split(/[,\n]/)) {
					const trimmed = token.trim();
					if (!trimmed) continue;
					tags.add(trimmed.startsWith("#") ? trimmed : `#${trimmed}`);
				}
				continue;
			}
			if (Array.isArray(tagField)) {
				for (const tagValue of tagField) {
					if (typeof tagValue !== "string") continue;
					const trimmed = tagValue.trim();
					if (!trimmed) continue;
					tags.add(trimmed.startsWith("#") ? trimmed : `#${trimmed}`);
				}
			}
		}
	}

	return tags.size > 0 ? [...tags] : null;
}

export function parseFrontMatterEntry(frontmatter: unknown, key: string | RegExp): unknown {
	if (!frontmatter || typeof frontmatter !== "object" || Array.isArray(frontmatter)) {
		return null;
	}
	const frontmatterRecord = frontmatter as Record<string, unknown>;

	if (typeof key === "string") {
		return Object.prototype.hasOwnProperty.call(frontmatterRecord, key)
			? frontmatterRecord[key]
			: null;
	}

	for (const [entryKey, entryValue] of Object.entries(frontmatterRecord)) {
		if (key.test(entryKey)) {
			return entryValue;
		}
	}

	return null;
}
