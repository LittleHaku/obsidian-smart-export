import { TFile } from "obsidian";
import { isSyntheticExportNode } from "../engine/exportTreeComposition";
import { ExportFormat, ExportNode, LinkTraversalMode, SmartExportSettings } from "../types";
import { normalizeNoteTag } from "../utils/noteFilters";
import { estimatePrintFriendlyMarkdownCharacterCount } from "../utils/printFriendlyMarkdownEstimate";
import { getPrintFriendlyMarkdownOptions } from "../utils/printFriendlyMarkdownOptions";

export const MAX_TREE_CACHE_ENTRIES = 5;

export type ExportSourceMode = "note" | "tag";
export type ExportTreeSource = { mode: "note"; path: string } | { mode: "tag"; tag: string };
export type AddedNoteMode = "single-note" | "extra-root";
export type AddedExportItem =
	{ kind: "note"; file: TFile; mode: AddedNoteMode } | { kind: "tag"; tag: string };

export function getSelectedTag(value: string): string {
	return normalizeNoteTag(value);
}

export function hasExportSource(
	mode: ExportSourceMode,
	selectedFile: TFile | null,
	selectedTag: string
): boolean {
	return getExportTreeSource(mode, selectedFile, selectedTag) !== null;
}

export function getExportTreeSource(
	mode: ExportSourceMode,
	selectedFile: TFile | null,
	selectedTag: string
): ExportTreeSource | null {
	if (mode === "tag") {
		const tag = getSelectedTag(selectedTag);
		return tag ? { mode: "tag", tag } : null;
	}
	return selectedFile ? { mode: "note", path: selectedFile.path } : null;
}

export function getExportSourceName(
	mode: ExportSourceMode,
	selectedFile: TFile | null,
	selectedTag: string
): string {
	if (mode === "tag") {
		const tag = getSelectedTag(selectedTag);
		return tag ? `Tag #${tag}` : "Tag export";
	}
	return selectedFile?.basename ?? "Smart export";
}

export function getExportTreeFailureMessage(mode: ExportSourceMode): string {
	return mode === "tag"
		? "No notes matched the selected tag after exclusions."
		: "Failed to generate export. See console for details.";
}

export function getAddedItemTitle(item: AddedExportItem): string {
	return item.kind === "tag" ? `#${normalizeNoteTag(item.tag)}` : item.file.basename;
}

export function getAddedItemPathText(item: AddedExportItem): string {
	return item.kind === "tag" ? "Tag" : item.file.path;
}

export function getAddedItemScopeText(item: AddedExportItem): string {
	if (item.kind === "tag") {
		return "Tag: starts export trees from all matching notes using the current depth and link direction.";
	}
	return item.mode === "extra-root"
		? "New root: starts another tree from this note using the current depth and link direction."
		: "Single note: includes only this note.";
}

export interface TreeCacheKeyOptions {
	sourceMode: ExportSourceMode;
	selectedFile: TFile | null;
	selectedTag: string;
	addedNotes: AddedExportItem[];
	contentDepth: number;
	titleDepth: number;
	linkTraversalMode: LinkTraversalMode;
	settings: Pick<
		SmartExportSettings,
		"ignoredTraversalFolders" | "ignoredTraversalTagPatterns" | "ignoredTraversalPropertyRules"
	>;
}

export function getTreeCacheKey(options: TreeCacheKeyOptions): string {
	const source =
		options.sourceMode === "tag"
			? `tag:${getSelectedTag(options.selectedTag)}`
			: `note:${options.selectedFile?.path ?? "unknown"}`;
	const addedNotes = JSON.stringify(
		options.addedNotes.map((item) =>
			item.kind === "tag"
				? (["tag", normalizeNoteTag(item.tag)] as const)
				: (["note", item.file.path, item.mode] as const)
		)
	);
	return `${source}|added:${addedNotes}|content:${options.contentDepth}|title:${options.titleDepth}|mode:${options.linkTraversalMode}|traversalIgnored:${JSON.stringify(options.settings.ignoredTraversalFolders)}|traversalIgnoredTags:${JSON.stringify(options.settings.ignoredTraversalTagPatterns)}|traversalIgnoredProperties:${JSON.stringify(options.settings.ignoredTraversalPropertyRules)}`;
}

export function flattenExportTree(rootNode: ExportNode): ExportNode[] {
	const notes: ExportNode[] = [];
	const queue = [rootNode];
	for (let head = 0; head < queue.length; head += 1) {
		const node = queue[head];
		if (!isSyntheticExportNode(node)) notes.push(node);
		queue.push(...node.children);
	}
	return notes;
}

export function selectAllNodes(node: ExportNode, selectedNodeIds: Set<string>): void {
	if (node.includeContent) selectedNodeIds.add(node.id);
	for (const child of node.children) selectAllNodes(child, selectedNodeIds);
}

export function markUserDeselectedSubtree(
	node: ExportNode,
	userDeselectedNodeIds: Set<string>,
	lockedRootNodeIds: Set<string>
): void {
	if (node.includeContent && !lockedRootNodeIds.has(node.id)) {
		userDeselectedNodeIds.add(node.id);
	}
	for (const child of node.children) {
		markUserDeselectedSubtree(child, userDeselectedNodeIds, lockedRootNodeIds);
	}
}

export function clearNodeIdsInSubtree(node: ExportNode, nodeIds: Set<string>): void {
	nodeIds.delete(node.id);
	for (const child of node.children) clearNodeIdsInSubtree(child, nodeIds);
}

export function collapseRootOnly(node: ExportNode, collapsedNodeIds: Set<string>): void {
	if (node.children.length > 0) collapsedNodeIds.add(node.id);
}

export function collapseAllNodes(node: ExportNode, collapsedNodeIds: Set<string>): void {
	if (node.children.length === 0) return;
	collapsedNodeIds.add(node.id);
	for (const child of node.children) collapseAllNodes(child, collapsedNodeIds);
}

export function expandAllNodes(node: ExportNode, collapsedNodeIds: Set<string>): void {
	collapsedNodeIds.delete(node.id);
	for (const child of node.children) expandAllNodes(child, collapsedNodeIds);
}

export function buildContentDisplayTree(node: ExportNode): ExportNode | null {
	const children = node.children
		.map(buildContentDisplayTree)
		.filter((child): child is ExportNode => child !== null);
	if (!node.includeContent && children.length === 0) return null;
	return { ...node, children };
}

export function countTreeNodes(
	node: ExportNode,
	selectedNodeIds: Set<string>
): { total: number; selected: number } {
	let total = node.includeContent ? 1 : 0;
	let selected = node.includeContent && selectedNodeIds.has(node.id) ? 1 : 0;
	for (const child of node.children) {
		const counts = countTreeNodes(child, selectedNodeIds);
		total += counts.total;
		selected += counts.selected;
	}
	return { total, selected };
}

export function estimateTokensFromCharacterCount(characterCount: number): number {
	return Math.ceil(characterCount / 4);
}

export function estimateExportCharacterCount(
	rootNode: ExportNode,
	selectedNodeIds: Set<string>,
	format: ExportFormat,
	settings: SmartExportSettings,
	vaultName: string,
	missingNotesCount: number
): number {
	const notes = flattenExportTree(rootNode);
	let maxDepth = 0;
	let titleChars = 0;
	let selectedContentChars = 0;
	for (const note of notes) {
		maxDepth = Math.max(maxDepth, note.depth);
		titleChars += note.title.length;
		if (note.includeContent && selectedNodeIds.has(note.id)) {
			selectedContentChars += note.content?.length ?? 0;
		}
	}
	const metadataChars =
		240 +
		vaultName.length +
		rootNode.title.length +
		String(notes.length).length +
		String(missingNotesCount).length +
		String(maxDepth).length;

	switch (format) {
		case "xml":
			return metadataChars + titleChars * 2 + selectedContentChars + notes.length * 120;
		case "llm-markdown":
			return metadataChars + titleChars * 2 + selectedContentChars + notes.length * 80;
		case "print-friendly-markdown":
			return estimatePrintFriendlyMarkdownCharacterCount(
				rootNode,
				selectedNodeIds,
				getPrintFriendlyMarkdownOptions(settings)
			);
		case "mermaid":
			return 80 + titleChars + notes.length * 85;
		default:
			return titleChars + selectedContentChars;
	}
}

export function formatTokenCountMessage(tokenCount: number): string {
	let text = `Estimated tokens: ~${tokenCount.toLocaleString()}`;
	if (tokenCount > 200000) text += " — exceeds most context limits";
	else if (tokenCount > 128000) text += " — may exceed common context limits";
	else if (tokenCount > 100000) text += " — large export";
	return text;
}

export function getDomSafeId(value: string): string {
	return value.replace(/[^a-zA-Z0-9_-]+/g, "-");
}
