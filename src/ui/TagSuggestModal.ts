import { App, FuzzySuggestModal } from "obsidian";
import { ObsidianAPI } from "../obsidian-api";

/**
 * A fuzzy suggestion modal for selecting a tag as an export source.
 */
export class TagSuggestModal extends FuzzySuggestModal<string> {
	private onSelect: (tag: string) => void;

	constructor(app: App, onSelect: (tag: string) => void) {
		super(app);
		this.onSelect = onSelect;
	}

	getItems(): string[] {
		return new ObsidianAPI(this.app).getAvailableTags();
	}

	getItemText(item: string): string {
		return `#${item}`;
	}

	onChooseItem(item: string, evt: MouseEvent | KeyboardEvent): void {
		this.onSelect(item);
	}
}
