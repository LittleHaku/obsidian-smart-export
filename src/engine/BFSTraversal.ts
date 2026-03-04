import { TFile } from "obsidian";
import { ExportNode, LinkTraversalMode } from "../types";
import { ObsidianAPI } from "../obsidian-api";
import {
	buildFolderPrefixes,
	FolderFilterMatcher,
	pathMatchesFolderPrefixes,
} from "../utils/folderFilters";

export interface BFSTraversalOptions {
	/**
	 * Notes under these folders are fully excluded from traversal.
	 * This applies to outgoing, incoming, and both traversal modes.
	 */
	ignoredTraversalFolders?: string[];
}

/**
 * Implements a Breadth-First Search (BFS) traversal engine to discover and structure
 * linked notes from a starting root note.
 */
export class BFSTraversal {
	private static readonly CONTENT_READ_CONCURRENCY = 8;
	private obsidianAPI: ObsidianAPI;
	private contentDepth: number;
	private titleDepth: number;
	private linkTraversalMode: LinkTraversalMode;
	private ignoredTraversalPrefixes: FolderFilterMatcher[];
	private visited: Set<string> = new Set();
	private missingNotes: Set<string> = new Set();

	/**
	 * Creates an instance of the BFSTraversal engine.
	 * @param {ObsidianAPI} obsidianAPI - An instance of the ObsidianAPI wrapper.
	 * @param {number} contentDepth - The maximum depth to include full note content.
	 * @param {number} titleDepth - The maximum depth to include note titles.
	 * @param {LinkTraversalMode} linkTraversalMode - Which link directions should be followed.
	 */
	constructor(
		obsidianAPI: ObsidianAPI,
		contentDepth: number,
		titleDepth: number,
		linkTraversalMode: LinkTraversalMode = "outgoing",
		options: BFSTraversalOptions = {}
	) {
		this.obsidianAPI = obsidianAPI;
		this.contentDepth = contentDepth;
		this.titleDepth = titleDepth;
		this.linkTraversalMode = linkTraversalMode;
		this.ignoredTraversalPrefixes = buildFolderPrefixes(options.ignoredTraversalFolders);
	}

	/**
	 * Gets the set of missing notes encountered during traversal.
	 * @returns {string[]} Array of missing note names.
	 */
	public getMissingNotes(): string[] {
		return Array.from(this.missingNotes);
	}

	/**
	 * Traverses the note graph starting from a root note.
	 * @param {string} rootNotePath - The path of the starting note.
	 * @returns {Promise<ExportNode | null>} The root of the generated export tree, or null if the root note is not found.
	 */
	public async traverse(rootNotePath: string): Promise<ExportNode | null> {
		// Clear missing notes from any previous traversal
		this.missingNotes.clear();
		this.visited.clear();

		const rootFile = this.obsidianAPI.getTFile(rootNotePath);
		if (!rootFile) {
			console.error(`Root note not found: ${rootNotePath}`);
			return null;
		}

		const queue: { file: TFile; depth: number; parent: ExportNode }[] = [];
		const rootNode = this.createExportNode(rootFile, 0);

		this.visited.add(rootFile.path);
		queue.push({ file: rootFile, depth: 0, parent: rootNode });

		let head = 0;
		while (head < queue.length) {
			const { file, depth, parent } = queue[head++];

			if (depth >= this.titleDepth) continue;

			const linkedFiles = this.getLinkedFiles(file);
			for (const linkedFile of linkedFiles) {
				// Global folder exclusions are applied before any node is added to the tree.
				// Excluded notes are not traversed further, so links "from them" are ignored too.
				if (this.shouldExcludeTraversalFile(linkedFile)) continue;
				if (this.visited.has(linkedFile.path)) continue;

				this.visited.add(linkedFile.path);
				const childNode = this.createExportNode(linkedFile, depth + 1);
				parent.children.push(childNode);
				queue.push({
					file: linkedFile,
					depth: depth + 1,
					parent: childNode,
				});
			}
		}

		await this.updateNodeContent(rootNode);

		return rootNode;
	}

	/**
	 * Creates a new ExportNode for a given file.
	 * @private
	 * @param {TFile} file - The file to create a node for.
	 * @param {number} depth - The depth of the file in the traversal.
	 * @returns {ExportNode} The created ExportNode.
	 */
	private createExportNode(file: TFile, depth: number): ExportNode {
		const title = this.obsidianAPI.getNoteTitle(file);
		const node: ExportNode = {
			id: file.path,
			title,
			depth,
			includeContent: depth <= this.contentDepth,
			children: [],
			tokenCount: 0, // Token counting will be implemented later
			lastModified: new Date(file.stat.mtime),
		};

		return node;
	}

	/**
	 * Gets linked files based on the configured traversal mode.
	 * @private
	 */
	private getLinkedFiles(file: TFile): TFile[] {
		const linkedFiles: TFile[] = [];
		const seenPaths = new Set<string>();

		if (this.linkTraversalMode === "outgoing" || this.linkTraversalMode === "both") {
			const outgoingFiles = this.getOutgoingLinkedFiles(file);
			for (const outgoingFile of outgoingFiles) {
				if (seenPaths.has(outgoingFile.path)) continue;
				seenPaths.add(outgoingFile.path);
				linkedFiles.push(outgoingFile);
			}
		}

		if (this.linkTraversalMode === "incoming" || this.linkTraversalMode === "both") {
			const incomingFiles = this.obsidianAPI.getIncomingLinksForFile(file);
			for (const incomingFile of incomingFiles) {
				if (seenPaths.has(incomingFile.path)) continue;
				seenPaths.add(incomingFile.path);
				linkedFiles.push(incomingFile);
			}
		}

		return linkedFiles;
	}

	private shouldExcludeTraversalFile(file: TFile): boolean {
		if (this.ignoredTraversalPrefixes.length === 0) {
			return false;
		}

		return pathMatchesFolderPrefixes(file.path, this.ignoredTraversalPrefixes);
	}

	/**
	 * Gets outgoing linked files and tracks unresolved links.
	 * @private
	 */
	private getOutgoingLinkedFiles(file: TFile): TFile[] {
		const links = this.obsidianAPI.getLinksForFile(file);
		if (!links) return [];

		const linkedFiles: TFile[] = [];
		for (const link of links) {
			const linkedFile = this.obsidianAPI.resolveLink(link.link, file.path);
			if (linkedFile) {
				linkedFiles.push(linkedFile);
			} else {
				// Track missing notes (links that couldn't be resolved)
				this.missingNotes.add(link.link);
			}
		}

		return linkedFiles;
	}

	/**
	 * Recursively populates the `content` field of each node in the tree
	 * based on whether its depth is within the `contentDepth`.
	 * @private
	 * @param {ExportNode} node - The starting node to process.
	 */
	private async updateNodeContent(rootNode: ExportNode) {
		const nodesToRead: ExportNode[] = [];
		const stack: ExportNode[] = [rootNode];
		while (stack.length > 0) {
			const node = stack.pop()!;

			if (node.includeContent) {
				nodesToRead.push(node);
			} else {
				delete node.content;
			}

			for (const child of node.children) {
				stack.push(child);
			}
		}

		await this.runWithConcurrency(
			nodesToRead,
			BFSTraversal.CONTENT_READ_CONCURRENCY,
			async (node) => {
				node.content = await this.obsidianAPI.getNoteContent(node.id);
			}
		);
	}

	private async runWithConcurrency<T>(
		items: T[],
		concurrency: number,
		task: (item: T) => Promise<void>
	): Promise<void> {
		if (items.length === 0) {
			return;
		}

		const workerCount = Math.min(Math.max(1, concurrency), items.length);
		let nextIndex = 0;

		const workers = Array.from({ length: workerCount }, async () => {
			while (nextIndex < items.length) {
				const currentIndex = nextIndex++;
				await task(items[currentIndex]);
			}
		});

		await Promise.all(workers);
	}
}
