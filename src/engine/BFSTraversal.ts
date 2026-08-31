import { TFile } from "obsidian";
import { ExportNode, LinkTraversalMode } from "../types";
import { ObsidianAPI } from "../obsidian-api";
import { composeExportRootCollection } from "./exportTreeComposition";
import {
	compileFolderFilterMatchers,
	FolderFilterMatcher,
	pathMatchesFolderFilterMatchers,
} from "../utils/folderFilters";
import {
	compilePropertyFilterRules,
	compileTagFilterMatchers,
	frontmatterMatchesPropertyFilterRules,
	normalizeNoteTag,
	PropertyFilterRule,
	TagFilterMatcher,
	tagsMatchFilterMatchers,
} from "../utils/noteFilters";

export interface BFSTraversalOptions {
	/**
	 * Notes under these folders are fully excluded from traversal.
	 * This applies to outgoing, incoming, and both traversal modes.
	 */
	ignoredTraversalFolders?: string[];
	/**
	 * Notes matching any tag pattern are excluded from traversal.
	 */
	ignoredTraversalTagPatterns?: string[];
	/**
	 * Notes matching any frontmatter rule are excluded from traversal.
	 */
	ignoredTraversalPropertyRules?: string[];
}

interface DiscoveredLink {
	file: TFile;
	sourcePath: string;
	targetPath: string;
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
	private ignoredTraversalMatchers: FolderFilterMatcher[];
	private ignoredTraversalTagMatchers: TagFilterMatcher[];
	private ignoredTraversalPropertyRules: PropertyFilterRule[];
	private visited: Set<string> = new Set();
	private missingNotes: Set<string> = new Set();
	private discoveredOutgoingLinks: Map<string, Set<string>> = new Map();

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
		this.ignoredTraversalMatchers = compileFolderFilterMatchers(options.ignoredTraversalFolders);
		this.ignoredTraversalTagMatchers = compileTagFilterMatchers(
			options.ignoredTraversalTagPatterns
		);
		this.ignoredTraversalPropertyRules = compilePropertyFilterRules(
			options.ignoredTraversalPropertyRules
		);
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
		this.discoveredOutgoingLinks.clear();

		const rootFile = this.obsidianAPI.getTFile(rootNotePath);
		if (!rootFile) {
			console.error(`Root note not found: ${rootNotePath}`);
			return null;
		}

		const rootNode = this.createExportNode(rootFile, 0);
		this.visited.add(rootFile.path);
		this.traverseQueue([{ file: rootFile, depth: 0, parent: rootNode }]);
		this.applyDiscoveredOutgoingLinks(rootNode);

		await this.updateNodeContent(rootNode);

		return rootNode;
	}

	/**
	 * Traverses the note graph from every note matching the selected tag.
	 */
	public async traverseTag(tag: string): Promise<ExportNode | null> {
		this.missingNotes.clear();
		this.visited.clear();
		this.discoveredOutgoingLinks.clear();

		const rootFiles = this.obsidianAPI
			.getFilesMatchingTag(tag)
			.filter((file) => !this.shouldExcludeTraversalFile(file));

		if (rootFiles.length === 0) {
			return null;
		}

		const queue: { file: TFile; depth: number; parent: ExportNode }[] = [];
		const rootNodes = rootFiles.map((rootFile) => {
			const rootNode = this.createExportNode(rootFile, 0);
			this.visited.add(rootFile.path);
			queue.push({ file: rootFile, depth: 0, parent: rootNode });
			return rootNode;
		});

		this.traverseQueue(queue);
		const rootNode = composeExportRootCollection({
			title: this.getTagRootTitle(tag),
			roots: rootNodes,
		})!;

		this.applyDiscoveredOutgoingLinks(rootNode);
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
			outgoingLinks: [],
			tokenCount: 0, // Token counting will be implemented later
			lastModified: new Date(file.stat.mtime),
		};

		return node;
	}

	private traverseQueue(queue: { file: TFile; depth: number; parent: ExportNode }[]): void {
		let head = 0;
		while (head < queue.length) {
			const { file, depth, parent } = queue[head++];

			if (depth >= this.titleDepth) continue;

			const discoveredLinks = this.getDiscoveredLinks(file);
			for (const discoveredLink of discoveredLinks) {
				const linkedFile = discoveredLink.file;
				// Global exclusions are applied before any node is added to the tree.
				// Excluded notes are not traversed further, so links "from them" are ignored too.
				if (this.shouldExcludeTraversalFile(linkedFile)) continue;

				this.recordDiscoveredLink(discoveredLink.sourcePath, discoveredLink.targetPath);
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
	}

	private getTagRootTitle(tag: string): string {
		const normalizedTag = normalizeNoteTag(tag);
		return normalizedTag ? `Tag: #${normalizedTag}` : "Tag export";
	}

	/**
	 * Gets linked files based on the configured traversal mode.
	 * @private
	 */
	private getDiscoveredLinks(file: TFile): DiscoveredLink[] {
		const discoveredLinks: DiscoveredLink[] = [];
		const seenEdges = new Set<string>();
		const addDiscoveredLink = (link: DiscoveredLink): void => {
			const edgeKey = `${link.sourcePath}\u0000${link.targetPath}`;
			if (seenEdges.has(edgeKey)) return;
			seenEdges.add(edgeKey);
			discoveredLinks.push(link);
		};

		if (this.linkTraversalMode === "outgoing" || this.linkTraversalMode === "both") {
			const outgoingFiles = this.getOutgoingLinkedFiles(file);
			for (const outgoingFile of outgoingFiles) {
				addDiscoveredLink({
					file: outgoingFile,
					sourcePath: file.path,
					targetPath: outgoingFile.path,
				});
			}
		}

		if (this.linkTraversalMode === "incoming" || this.linkTraversalMode === "both") {
			const incomingFiles = this.obsidianAPI.getIncomingLinksForFile(file);
			for (const incomingFile of incomingFiles) {
				addDiscoveredLink({
					file: incomingFile,
					sourcePath: incomingFile.path,
					targetPath: file.path,
				});
			}
		}

		return discoveredLinks;
	}

	private recordDiscoveredLink(sourcePath: string, targetPath: string): void {
		const targets = this.discoveredOutgoingLinks.get(sourcePath) ?? new Set<string>();
		targets.add(targetPath);
		this.discoveredOutgoingLinks.set(sourcePath, targets);
	}

	private applyDiscoveredOutgoingLinks(rootNode: ExportNode): void {
		const nodesByPath = new Map<string, ExportNode>();
		const stack: ExportNode[] = [rootNode];
		while (stack.length > 0) {
			const node = stack.pop()!;
			if (!node.synthetic) nodesByPath.set(node.id, node);
			stack.push(...node.children);
		}

		for (const [sourcePath, sourceNode] of nodesByPath) {
			const targets = this.discoveredOutgoingLinks.get(sourcePath) ?? [];
			sourceNode.outgoingLinks = [...targets].filter((targetPath) => nodesByPath.has(targetPath));
		}
	}

	private shouldExcludeTraversalFile(file: TFile): boolean {
		if (
			this.ignoredTraversalMatchers.length > 0 &&
			pathMatchesFolderFilterMatchers(file.path, this.ignoredTraversalMatchers)
		) {
			return true;
		}

		if (this.ignoredTraversalTagMatchers.length > 0) {
			const noteTags = this.obsidianAPI.getNoteTags(file);
			if (tagsMatchFilterMatchers(noteTags, this.ignoredTraversalTagMatchers)) {
				return true;
			}
		}

		if (this.ignoredTraversalPropertyRules.length > 0) {
			const frontmatter = this.obsidianAPI.getNoteFrontmatter(file);
			if (frontmatterMatchesPropertyFilterRules(frontmatter, this.ignoredTraversalPropertyRules)) {
				return true;
			}
		}

		return false;
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
