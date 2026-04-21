import { ExportNode, PrintFriendlyMarkdownOptions } from "../types";
import { buildExportedHeadingLabels } from "./exportMarkdownLinks";
import { DEFAULT_PRINT_FRIENDLY_MARKDOWN_OPTIONS } from "./printFriendlyMarkdownOptions";
import { escapeWikiLinkValue } from "./wikiLinkEscaping";

export const PRINT_FRIENDLY_TABLE_OF_CONTENTS_HEADING = "# Table of contents\n\n";
export const PRINT_FRIENDLY_SECTION_DIVIDER = "---\n\n";
export const PRINT_FRIENDLY_PAGE_BREAK_MARKUP = '<div style="page-break-after: always;"></div>\n\n';

export interface PrintFriendlyMarkdownStructure {
	allNotes: ExportNode[];
	headingLabels: Map<string, string>;
}

export function buildPrintFriendlyMarkdownStructure(
	rootNode: ExportNode,
	options?: PrintFriendlyMarkdownOptions
): PrintFriendlyMarkdownStructure {
	const resolvedOptions = {
		...DEFAULT_PRINT_FRIENDLY_MARKDOWN_OPTIONS,
		...(options ?? {}),
	};
	const allNotes = flattenUniquePrintFriendlyTree(rootNode);
	const baseHeadingLabels = buildExportedHeadingLabels(allNotes);

	return {
		allNotes,
		headingLabels: resolvedOptions.numberHeadings
			? buildNumberedHeadingLabels(rootNode, baseHeadingLabels)
			: baseHeadingLabels,
	};
}

export function flattenUniquePrintFriendlyTree(rootNode: ExportNode): ExportNode[] {
	const queue: ExportNode[] = [rootNode];
	const notes: ExportNode[] = [];
	const visited = new Set<string>();
	let head = 0;

	while (head < queue.length) {
		const note = queue[head++];
		if (visited.has(note.id)) {
			continue;
		}
		visited.add(note.id);
		notes.push(note);
		for (const child of note.children) {
			queue.push(child);
		}
	}

	return notes;
}

export function getPrintFriendlySectionSeparator(options: PrintFriendlyMarkdownOptions): string {
	if (options.insertPageBreaksBetweenSections) {
		return PRINT_FRIENDLY_PAGE_BREAK_MARKUP;
	}
	if (options.insertSectionDividers) {
		return PRINT_FRIENDLY_SECTION_DIVIDER;
	}
	return "";
}

export function escapePrintFriendlyWikiLinkValue(value: string): string {
	return escapeWikiLinkValue(value);
}

function buildNumberedHeadingLabels(
	rootNode: ExportNode,
	baseHeadingLabels: Map<string, string>
): Map<string, string> {
	const numberedHeadingLabels = new Map<string, string>();
	assignSectionNumbers(rootNode, [1], baseHeadingLabels, numberedHeadingLabels, new Set<string>());
	return numberedHeadingLabels;
}

function assignSectionNumbers(
	node: ExportNode,
	sectionNumber: number[],
	baseHeadingLabels: Map<string, string>,
	numberedHeadingLabels: Map<string, string>,
	visited: Set<string>
): void {
	visited.add(node.id);

	const baseHeadingLabel = baseHeadingLabels.get(node.id)!;
	numberedHeadingLabels.set(node.id, `${formatSectionNumber(sectionNumber)} ${baseHeadingLabel}`);

	let childIndex = 0;
	for (const child of node.children) {
		if (visited.has(child.id)) {
			continue;
		}
		childIndex += 1;
		assignSectionNumbers(
			child,
			[...sectionNumber, childIndex],
			baseHeadingLabels,
			numberedHeadingLabels,
			visited
		);
	}
}

function formatSectionNumber(sectionNumber: number[]): string {
	const joinedNumber = sectionNumber.join(".");
	return sectionNumber.length === 1 ? `${joinedNumber}.` : joinedNumber;
}
