// This file mocks the 'obsidian' module for Vitest.

type CreateElOptions = {
	cls?: string;
	text?: string;
	attr?: Record<string, string>;
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
		this.append(document.createTextNode(text));
	};
}

if (!elementPrototype.createEl) {
	elementPrototype.createEl = function createEl<K extends keyof HTMLElementTagNameMap>(
		this: HTMLElement,
		tag: K,
		options?: CreateElOptions
	): HTMLElementTagNameMap[K] {
		const element = document.createElement(tag);
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

export class TFile {}
export class TFolder {}
export class App {}
export class Vault {}
export class MetadataCache {}
export class LinkCache {}
export class Position {}
export class Loc {}
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

export function openExternal(_url: string): void {}

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
