import { AbstractInputSuggest, App, TFolder } from "obsidian";

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

	constructor(app: App, inputEl: HTMLInputElement) {
		super(app, inputEl);
		this.inputEl = inputEl;
	}

	protected getSuggestions(query: string): string[] {
		const normalizedQuery = normalizePathForMatch(query);
		const folders = this.app.vault.getAllFolders(false);
		const folderPaths = folders
			.map((folder: TFolder) => folder.path)
			.filter((path) => path.length > 0);

		const startsWithMatches: string[] = [];
		const containsMatches: string[] = [];
		for (const folderPath of folderPaths) {
			const lowerPath = folderPath.toLowerCase();
			if (normalizedQuery.length === 0 || lowerPath.startsWith(normalizedQuery)) {
				startsWithMatches.push(folderPath);
				continue;
			}
			if (lowerPath.includes(normalizedQuery)) {
				containsMatches.push(folderPath);
			}
		}

		return [
			...startsWithMatches.sort((a, b) => a.localeCompare(b)),
			...containsMatches.sort((a, b) => a.localeCompare(b)),
		].slice(0, MAX_FOLDER_SUGGESTIONS);
	}

	renderSuggestion(folderPath: string, el: HTMLElement): void {
		el.setText(folderPath);
	}

	selectSuggestion(folderPath: string): void {
		this.setValue(folderPath);
		// Trigger TextComponent.onChange handlers so settings persist selected values.
		this.inputEl.dispatchEvent(new Event("input", { bubbles: true }));
		this.close();
	}
}
