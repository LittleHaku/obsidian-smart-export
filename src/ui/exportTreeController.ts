import { App } from "obsidian";
import { BFSTraversal } from "../engine/BFSTraversal";
import { composeExportTree, createStandaloneExportNode } from "../engine/exportTreeComposition";
import { ObsidianAPI } from "../obsidian-api";
import { ExportNode, LinkTraversalMode, SmartExportSettings } from "../types";
import { AddedExportItem, ExportTreeSource } from "./exportModalState";

export interface ExportTreeBuildOptions {
	app: App;
	settings: SmartExportSettings;
	source: ExportTreeSource;
	addedNotes: AddedExportItem[];
	contentDepth: number;
	titleDepth: number;
	linkTraversalMode: LinkTraversalMode;
	isCurrent(): boolean;
}

export type ExportTreeBuildResult =
	| { status: "stale" }
	| { status: "empty" }
	| { status: "success"; tree: ExportNode; missingNotesCount: number };

/** Builds and composes every traversal root without owning modal or DOM state. */
export async function buildExportTreeFromSelection(
	options: ExportTreeBuildOptions
): Promise<ExportTreeBuildResult> {
	const obsidianAPI = new ObsidianAPI(options.app);
	const traversalOptions = {
		ignoredTraversalFolders: options.settings.ignoredTraversalFolders,
		ignoredTraversalTagPatterns: options.settings.ignoredTraversalTagPatterns,
		ignoredTraversalPropertyRules: options.settings.ignoredTraversalPropertyRules,
	};
	const createTraversal = (): BFSTraversal =>
		new BFSTraversal(
			obsidianAPI,
			options.contentDepth,
			options.titleDepth,
			options.linkTraversalMode,
			traversalOptions
		);

	const traversal = createTraversal();
	const primaryTree =
		options.source.mode === "tag"
			? await traversal.traverseTag(options.source.tag)
			: await traversal.traverse(options.source.path);
	if (!options.isCurrent()) return { status: "stale" };
	if (!primaryTree) return { status: "empty" };

	const missingNotes = new Set(traversal.getMissingNotes());
	const extraRootTrees: ExportNode[] = [];
	const singleNoteNodes: ExportNode[] = [];

	for (const item of options.addedNotes) {
		if (item.kind === "tag" || item.mode === "extra-root") {
			const extraTraversal = createTraversal();
			const extraRootTree =
				item.kind === "tag"
					? await extraTraversal.traverseTag(item.tag)
					: await extraTraversal.traverse(item.file.path);
			if (!options.isCurrent()) return { status: "stale" };
			if (extraRootTree) extraRootTrees.push(extraRootTree);
			for (const missingNote of extraTraversal.getMissingNotes()) missingNotes.add(missingNote);
			continue;
		}

		const content = await obsidianAPI.getNoteContent(item.file.path);
		if (!options.isCurrent()) return { status: "stale" };
		singleNoteNodes.push(createStandaloneExportNode(item.file, { content }));
	}

	return {
		status: "success",
		tree: composeExportTree({ primaryTree, extraRootTrees, singleNoteNodes }),
		missingNotesCount: missingNotes.size,
	};
}
