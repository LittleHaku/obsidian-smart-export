import { ExportNode } from "../types";

export function selectNode(selectedNodeIds: Set<string>, nodeId: string) {
	selectedNodeIds.add(nodeId);
}

export function selectSubtree(selectedNodeIds: Set<string>, node: ExportNode) {
	if (node.includeContent) {
		selectedNodeIds.add(node.id);
	}
	for (const child of node.children) {
		selectSubtree(selectedNodeIds, child);
	}
}

export function selectAncestors(selectedNodeIds: Set<string>, ancestorIds: string[]) {
	for (const id of ancestorIds) {
		selectedNodeIds.add(id);
	}
}

export function deselectSubtree(selectedNodeIds: Set<string>, node: ExportNode) {
	selectedNodeIds.delete(node.id);
	for (const child of node.children) {
		deselectSubtree(selectedNodeIds, child);
	}
}

export function enforceAncestorSelection(
	selectedNodeIds: Set<string>,
	node: ExportNode,
	parentSelected: boolean,
	lockedNodeIds: Set<string> = new Set()
) {
	const isSelected = node.includeContent ? selectedNodeIds.has(node.id) : true;
	if (!parentSelected && !lockedNodeIds.has(node.id)) {
		selectedNodeIds.delete(node.id);
	}
	const nextParentSelected = parentSelected && isSelected;
	for (const child of node.children) {
		enforceAncestorSelection(selectedNodeIds, child, nextParentSelected, lockedNodeIds);
	}
}

export function reconcileContentSelectionState(
	selectedNodeIds: Set<string>,
	knownContentNodeIds: Set<string>,
	userDeselectedNodeIds: Set<string>,
	rootNode: ExportNode,
	lockedNodeIds: Set<string> = new Set()
) {
	reconcileContentSelectionNode(
		selectedNodeIds,
		knownContentNodeIds,
		userDeselectedNodeIds,
		rootNode,
		true,
		true,
		lockedNodeIds
	);
	enforceAncestorSelection(selectedNodeIds, rootNode, true, lockedNodeIds);
}

function reconcileContentSelectionNode(
	selectedNodeIds: Set<string>,
	knownContentNodeIds: Set<string>,
	userDeselectedNodeIds: Set<string>,
	node: ExportNode,
	parentSelected: boolean,
	isRoot: boolean,
	lockedNodeIds: Set<string>
) {
	if (!node.includeContent) {
		selectedNodeIds.delete(node.id);
		knownContentNodeIds.delete(node.id);
	} else {
		const wasKnown = knownContentNodeIds.has(node.id);
		if (isRoot || lockedNodeIds.has(node.id)) {
			selectedNodeIds.add(node.id);
			userDeselectedNodeIds.delete(node.id);
		} else if (!parentSelected) {
			selectedNodeIds.delete(node.id);
		} else if (userDeselectedNodeIds.has(node.id)) {
			selectedNodeIds.delete(node.id);
		} else if (!wasKnown) {
			selectedNodeIds.add(node.id);
		}
		knownContentNodeIds.add(node.id);
	}

	const nodeSelected = node.includeContent ? selectedNodeIds.has(node.id) : parentSelected;
	for (const child of node.children) {
		reconcileContentSelectionNode(
			selectedNodeIds,
			knownContentNodeIds,
			userDeselectedNodeIds,
			child,
			nodeSelected,
			false,
			lockedNodeIds
		);
	}
}
