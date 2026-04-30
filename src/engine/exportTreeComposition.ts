import { TFile } from "obsidian";
import { ExportNode } from "../types";

export const SYNTHETIC_EXPORT_ROOT_ID = "__smart_export_bundle_root__";

interface ComposeExportTreeOptions {
	primaryTree: ExportNode;
	extraRootTrees?: ExportNode[];
	singleNoteNodes?: ExportNode[];
}

interface StandaloneExportNodeOptions {
	content: string;
	depth?: number;
}

export function isSyntheticExportNode(node: ExportNode): boolean {
	return node.synthetic === true;
}

export function createStandaloneExportNode(
	file: TFile,
	options: StandaloneExportNodeOptions
): ExportNode {
	const depth = options.depth ?? 0;
	return {
		id: file.path,
		title: file.basename,
		depth,
		includeContent: true,
		content: options.content,
		children: [],
		tokenCount: 0,
		lastModified: new Date(file.stat.mtime),
	};
}

export function composeExportTree(options: ComposeExportTreeOptions): ExportNode {
	const extraRootTrees = options.extraRootTrees ?? [];
	const singleNoteNodes = options.singleNoteNodes ?? [];
	if (extraRootTrees.length === 0 && singleNoteNodes.length === 0) {
		return options.primaryTree;
	}

	const explicitTopLevelIds = new Set(
		[...extraRootTrees, ...singleNoteNodes]
			.filter((node) => !isSyntheticExportNode(node))
			.map((node) => node.id)
	);
	const seenPaths = new Set<string>();
	const primaryTree = cloneExportTreeDeduplicating(options.primaryTree, seenPaths, {
		skipPaths: explicitTopLevelIds,
		preserveCurrent: true,
	})!;

	const additionalChildren = [...extraRootTrees, ...singleNoteNodes]
		.map((tree) => cloneExportTreeDeduplicating(tree, seenPaths))
		.filter((tree): tree is ExportNode => tree !== null);

	if (additionalChildren.length === 0) {
		return primaryTree;
	}

	return {
		id: SYNTHETIC_EXPORT_ROOT_ID,
		title: "Export bundle",
		depth: 0,
		includeContent: false,
		children: [primaryTree, ...additionalChildren],
		tokenCount: 0,
		lastModified: getLatestModifiedDate([primaryTree, ...additionalChildren]),
		synthetic: true,
	};
}

interface CloneExportTreeOptions {
	skipPaths?: Set<string>;
	preserveCurrent?: boolean;
}

function cloneExportTreeDeduplicating(
	node: ExportNode,
	seenPaths: Set<string>,
	options: CloneExportTreeOptions = {}
): ExportNode | null {
	if (!isSyntheticExportNode(node)) {
		if (!options.preserveCurrent && options.skipPaths?.has(node.id)) {
			return null;
		}
		if (seenPaths.has(node.id)) {
			return null;
		}
		seenPaths.add(node.id);
	}

	const children = node.children
		.map((child) =>
			cloneExportTreeDeduplicating(child, seenPaths, {
				...options,
				preserveCurrent: false,
			})
		)
		.filter((child): child is ExportNode => child !== null);

	return {
		...node,
		children,
	};
}

function getLatestModifiedDate(nodes: ExportNode[]): Date {
	let latestTime = 0;
	const stack = [...nodes];
	while (stack.length > 0) {
		const node = stack.pop()!;
		latestTime = Math.max(latestTime, node.lastModified.getTime());
		stack.push(...node.children);
	}

	return new Date(latestTime);
}
