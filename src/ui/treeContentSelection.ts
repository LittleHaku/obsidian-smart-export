import { ExportNode } from "../types";

export function applyContentSelection(
	node: ExportNode,
	selectedNodeIds: Set<string>
): ExportNode {
	const includeContent = node.includeContent && selectedNodeIds.has(node.id);
	const content = includeContent ? node.content : undefined;
	const children = node.children.map((child) => applyContentSelection(child, selectedNodeIds));

	return {
		...node,
		includeContent,
		content,
		children,
	};
}
