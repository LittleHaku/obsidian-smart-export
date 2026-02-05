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
	isRoot: boolean
) {
	const isSelected = isRoot || selectedNodeIds.has(node.id);
	if (!parentSelected && !isRoot) {
		selectedNodeIds.delete(node.id);
	}
	const nextParentSelected = parentSelected && isSelected;
	for (const child of node.children) {
		enforceAncestorSelection(selectedNodeIds, child, nextParentSelected, false);
	}
}
