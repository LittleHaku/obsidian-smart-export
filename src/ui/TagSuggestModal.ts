import { App, FuzzySuggestModal } from "obsidian";
import { TagDiscoveryService } from "../tagDiscovery";

/**
 * A fuzzy suggestion modal for selecting a tag as an export source.
 */
export class TagSuggestModal extends FuzzySuggestModal<string> {
	private readonly onSelect: (tag: string) => void;
	private readonly tagDiscovery: TagDiscoveryService;

	constructor(app: App, tagDiscovery: TagDiscoveryService, onSelect: (tag: string) => void) {
		super(app);
		this.tagDiscovery = tagDiscovery;
		this.onSelect = onSelect;
	}

	getItems(): string[] {
		return this.tagDiscovery.getAvailableTags();
	}

	getItemText(item: string): string {
		return `#${item}`;
	}

	onChooseItem(item: string, evt: MouseEvent | KeyboardEvent): void {
		this.onSelect(item);
	}
}
