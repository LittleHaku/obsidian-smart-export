import { AbstractInputSuggest, App, EventRef, TFolder } from "obsidian";

const MAX_FOLDER_SUGGESTIONS = 100;

function normalizePathForMatch(value: string): string {
	return value
		.trim()
		.replace(/\\/g, "/")
		.replace(/^\/+|\/+$/g, "")
		.toLowerCase();
}

/**
 * Folder path autocomplete for settings text inputs.
 * Inspired by the folder suggestion UX used in Templater.
 */
export class FolderPathSuggest extends AbstractInputSuggest<string> {
	private readonly inputEl: HTMLInputElement;
	private cachedFolderPaths: string[] | null = null;
	private readonly vaultEventRefs: EventRef[] = [];

	constructor(app: App, inputEl: HTMLInputElement) {
		super(app, inputEl);
		this.inputEl = inputEl;

		const invalidateFolderCache = () => {
			this.cachedFolderPaths = null;
		};
		this.vaultEventRefs.push(this.app.vault.on("create", invalidateFolderCache));
		this.vaultEventRefs.push(this.app.vault.on("delete", invalidateFolderCache));
		this.vaultEventRefs.push(this.app.vault.on("rename", invalidateFolderCache));
	}

	public destroy(): void {
		for (const eventRef of this.vaultEventRefs) {
			this.app.vault.offref(eventRef);
		}
		this.vaultEventRefs.length = 0;
		this.cachedFolderPaths = null;
		this.close();
	}

	private getSortedFolderPaths(): string[] {
		if (this.cachedFolderPaths !== null) {
			return this.cachedFolderPaths;
		}

		const folders = this.app.vault.getAllFolders(false);
		this.cachedFolderPaths = folders
			.map((folder: TFolder) => folder.path)
			.filter((path) => path.length > 0)
			.sort((a, b) => a.localeCompare(b));

		return this.cachedFolderPaths;
	}

	protected getSuggestions(query: string): string[] {
		const normalizedQuery = normalizePathForMatch(query);
		const folderPaths = this.getSortedFolderPaths();
		if (normalizedQuery.length === 0) {
			return folderPaths.slice(0, MAX_FOLDER_SUGGESTIONS);
		}

		const startsWithMatches: string[] = [];
		const containsMatches: string[] = [];
		for (const folderPath of folderPaths) {
			const lowerPath = folderPath.toLowerCase();
			if (lowerPath.startsWith(normalizedQuery)) {
				startsWithMatches.push(folderPath);
				continue;
			}
			if (lowerPath.includes(normalizedQuery)) {
				containsMatches.push(folderPath);
			}
		}

		return [...startsWithMatches, ...containsMatches].slice(0, MAX_FOLDER_SUGGESTIONS);
	}

	renderSuggestion(folderPath: string, el: HTMLElement): void {
		el.setText(folderPath);
	}

	selectSuggestion(folderPath: string, _evt: MouseEvent | KeyboardEvent): void {
		this.setValue(folderPath);
		// Trigger TextComponent.onChange handlers so settings persist selected values.
		this.inputEl.dispatchEvent(new Event("input", { bubbles: true }));
		this.close();
	}
}
