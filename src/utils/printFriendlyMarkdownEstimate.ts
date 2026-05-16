import { ExportNode, PrintFriendlyMarkdownOptions } from "../types";
import { isSyntheticExportNode } from "../engine/exportTreeComposition";
import { DEFAULT_PRINT_FRIENDLY_MARKDOWN_OPTIONS } from "./printFriendlyMarkdownOptions";
import { normalizeMarkdownHeadingsBelowParent } from "./markdownHeadingNormalization";
import {
	buildPrintFriendlyMarkdownStructure,
	escapePrintFriendlyWikiLinkValue,
	getPrintFriendlySectionSeparator,
	PRINT_FRIENDLY_TABLE_OF_CONTENTS_HEADING,
} from "./printFriendlyMarkdownStructure";

/**
 * Estimates print-friendly Markdown output length without generating the full export.
 */
export function estimatePrintFriendlyMarkdownCharacterCount(
	rootNode: ExportNode,
	selectedNodeIds: Set<string>,
	options?: PrintFriendlyMarkdownOptions
): number {
	const resolvedOptions = {
		...DEFAULT_PRINT_FRIENDLY_MARKDOWN_OPTIONS,
		...(options ?? {}),
	};
	const { headingLabels } = buildPrintFriendlyMarkdownStructure(rootNode, resolvedOptions);

	let total = 0;
	if (resolvedOptions.includeTableOfContents) {
		total += PRINT_FRIENDLY_TABLE_OF_CONTENTS_HEADING.length;
		total += estimateTableOfContentsLength(rootNode, headingLabels, new Set<string>(), 0);
		total += 1;
	}

	total += estimateBodyLength(
		rootNode,
		selectedNodeIds,
		headingLabels,
		new Set<string>(),
		0,
		resolvedOptions.includeTableOfContents ? 1 : 0,
		resolvedOptions
	);

	return total;
}

function estimateTableOfContentsLength(
	node: ExportNode,
	headingLabels: Map<string, string>,
	visited: Set<string>,
	depth: number
): number {
	if (visited.has(node.id)) {
		return 0;
	}
	visited.add(node.id);

	if (isSyntheticExportNode(node)) {
		let total = 0;
		for (const child of node.children) {
			total += estimateTableOfContentsLength(child, headingLabels, visited, depth);
		}
		return total;
	}

	const headingLabel = headingLabels.get(node.id)!;
	const escapedHeadingLength = escapePrintFriendlyWikiLinkValue(headingLabel).length;
	let total = depth * 2 + "- [[#".length + escapedHeadingLength + "|".length;
	total += escapedHeadingLength + "]]\n".length;

	for (const child of node.children) {
		total += estimateTableOfContentsLength(child, headingLabels, visited, depth + 1);
	}

	return total;
}

function estimateBodyLength(
	node: ExportNode,
	selectedNodeIds: Set<string>,
	headingLabels: Map<string, string>,
	visited: Set<string>,
	depth: number,
	renderedCount: number,
	options: PrintFriendlyMarkdownOptions
): number {
	if (visited.has(node.id)) {
		return 0;
	}
	visited.add(node.id);

	if (isSyntheticExportNode(node)) {
		let total = 0;
		let childRenderedCount = renderedCount;
		for (const child of node.children) {
			const childLength = estimateBodyLength(
				child,
				selectedNodeIds,
				headingLabels,
				visited,
				depth,
				childRenderedCount,
				options
			);
			if (childLength > 0) {
				total += childLength;
				childRenderedCount += 1;
			}
		}
		return total;
	}

	let total = 0;
	if (renderedCount > 0) {
		total += getPrintFriendlySectionSeparator(options).length;
	}

	const headingLabel = headingLabels.get(node.id)!;
	total += depth + 1 + " ".length + headingLabel.length + "\n\n".length;

	if (node.content && node.includeContent && selectedNodeIds.has(node.id)) {
		total +=
			estimateContentLengthAfterNormalization(node.content, depth + 1, options) + "\n\n".length;
	}

	let childRenderedCount = renderedCount + 1;
	for (const child of node.children) {
		const childLength = estimateBodyLength(
			child,
			selectedNodeIds,
			headingLabels,
			visited,
			depth + 1,
			childRenderedCount,
			options
		);
		if (childLength > 0) {
			total += childLength;
			childRenderedCount += 1;
		}
	}

	return total;
}

function estimateContentLengthAfterNormalization(
	content: string,
	parentHeadingLevel: number,
	options: PrintFriendlyMarkdownOptions
): number {
	if (!(content.startsWith("---\n") || content.startsWith("---\r\n"))) {
		return options.normalizeContentHeadings
			? normalizeMarkdownHeadingsBelowParent(content, parentHeadingLevel).length
			: content.length;
	}

	const newline = content.startsWith("---\r\n") ? "\r\n" : "\n";
	const lines = content.split(/\r?\n/);
	const closingIndex = lines.indexOf("---", 1);
	if (closingIndex < 0 || lines[closingIndex - 1] === "") {
		return options.normalizeContentHeadings
			? normalizeMarkdownHeadingsBelowParent(content, parentHeadingLevel).length
			: content.length;
	}

	const normalizedFrontmatterContent = [
		...lines.slice(0, closingIndex),
		"",
		...lines.slice(closingIndex),
	].join(newline);
	return options.normalizeContentHeadings
		? normalizeMarkdownHeadingsBelowParent(normalizedFrontmatterContent, parentHeadingLevel).length
		: normalizedFrontmatterContent.length;
}
