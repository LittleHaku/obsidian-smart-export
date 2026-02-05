import { ExportNode } from "../types";

export function selectNode(selectedNodeIds: Set<string>, nodeId: string) {
	selectedNodeIds.add(nodeId);
}

export function selectSubtree(selectedNodeIds: Set<string>, node: ExportNode) {
	selectedNodeIds.add(node.id);
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
