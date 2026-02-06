import { App, TFile, Reference } from "obsidian";

/**
 * A wrapper class for the Obsidian API to provide a stable, testable interface
 * for interacting with the vault.
 */
export class ObsidianAPI {
	private app: App;
	private incomingLinksIndex: Map<string, TFile[]> | null = null;

	/**
	 * Creates an instance of ObsidianAPI.
	 * @param {App} app - The Obsidian App instance.
	 */
	constructor(app: App) {
		this.app = app;
	}

	/**
	 * Retrieves a TFile object for a given path.
	 * @param {string} path - The file path.
	 * @returns {TFile | null} The TFile object or null if not found.
	 */
	public getTFile(path: string): TFile | null {
		return this.app.vault.getFileByPath(path);
	}

	/**
	 * Gets all outgoing links from a given file.
	 * @param {TFile} file - The file to get links from.
	 * @returns {Reference[] | undefined} An array of link references or undefined if no links.
	 */
	public getLinksForFile(file: TFile): Reference[] | undefined {
		const cache = this.app.metadataCache.getCache(file.path);
		if (!cache) return;

		const links = cache.links ?? [];
		const frontmatterLinks = cache.frontmatterLinks ?? [];
		if (links.length === 0 && frontmatterLinks.length === 0) return;

		return [...links, ...frontmatterLinks];
	}

	/**
	 * Gets files that link to the provided file.
	 * @param {TFile} file - The destination file.
	 * @returns {TFile[]} Files that contain resolved links to the destination file.
	 */
	public getIncomingLinksForFile(file: TFile): TFile[] {
		if (!this.incomingLinksIndex) {
			this.incomingLinksIndex = new Map<string, TFile[]>();
			const resolvedLinks = this.app.metadataCache.resolvedLinks ?? {};

			for (const [sourcePath, destinations] of Object.entries(resolvedLinks)) {
				const sourceFile = this.getTFile(sourcePath);
				if (!sourceFile) continue;

				for (const [destinationPath, count] of Object.entries(destinations)) {
					if (count <= 0) continue;
					const incomingFiles = this.incomingLinksIndex.get(destinationPath) ?? [];
					incomingFiles.push(sourceFile);
					this.incomingLinksIndex.set(destinationPath, incomingFiles);
				}
			}

			for (const incomingFiles of this.incomingLinksIndex.values()) {
				incomingFiles.sort((a, b) => a.path.localeCompare(b.path));
			}
		}

		return [...(this.incomingLinksIndex.get(file.path) ?? [])];
	}

	/**
	 * Resolves a wikilink to its corresponding TFile.
	 * @param {string} link - The wikilink text.
	 * @param {string} sourcePath - The path of the file containing the link.
	 * @returns {TFile | null} The resolved TFile or null if it cannot be resolved.
	 */
	public resolveLink(link: string, sourcePath: string): TFile | null {
		return this.app.metadataCache.getFirstLinkpathDest(link, sourcePath);
	}

	/**
	 * Gets the title of a note.
	 * @param {TFile} file - The file to get the title from.
	 * @returns {string} The base name of the file.
	 */
	public getNoteTitle(file: TFile): string {
		return file.basename;
	}

	/**
	 * Reads the content of a note.
	 * @param {string} path - The path to the note file.
	 * @returns {Promise<string>} The content of the note.
	 */
	public async getNoteContent(path: string): Promise<string> {
		const file = this.getTFile(path);
		if (!file) {
			return "";
		}
		return this.app.vault.cachedRead(file);
	}

	// Future methods for API interaction will go here.
}

/**
 * A utility class for extracting metadata from notes.
 * @deprecated This is a placeholder and will be implemented in a future version.
 */
export class NoteMetadataExtractor {
	private app: App;

	/**
	 * Creates an instance of NoteMetadataExtractor.
	 * @param {App} app - The Obsidian App instance.
	 */
	constructor(app: App) {
		this.app = app;
	}

	// Future methods for metadata extraction will go here.
}
