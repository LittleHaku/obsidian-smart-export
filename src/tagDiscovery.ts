import type { TFile } from "obsidian";

export interface TagDiscoverySource {
	getMarkdownFiles(): TFile[];
	getNoteTags(file: TFile): string[];
}

/**
 * Builds the available tag list lazily and reuses it until vault metadata changes.
 */
export class TagDiscoveryService {
	private cachedTags: readonly string[] | null = null;

	constructor(private readonly source: TagDiscoverySource) {}

	/**
	 * Lists normalized tags in deterministic order without exposing the cached array.
	 */
	public getAvailableTags(): string[] {
		if (this.cachedTags === null) {
			const tags = new Set<string>();
			for (const file of this.source.getMarkdownFiles()) {
				for (const tag of this.source.getNoteTags(file)) {
					tags.add(tag);
				}
			}
			this.cachedTags = [...tags].sort((a, b) => a.localeCompare(b));
		}

		return [...this.cachedTags];
	}

	/**
	 * Invalidates the lazy cache after Obsidian reports metadata or vault changes.
	 */
	public invalidate(): void {
		this.cachedTags = null;
	}
}
