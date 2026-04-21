import { normalizePath } from "obsidian";
import { ExportNode } from "../types";
import { escapeWikiLinkValue } from "./wikiLinkEscaping";

const MARKDOWN_EXTENSION_REGEX = /\.md$/i;
const HEADING_OR_BLOCK_REF_SEPARATOR_REGEX = /[#^]/;

interface ExportedNoteReference {
	headingTarget: string;
}

interface ExportedMarkdownLinkIndex {
	pathReferences: Map<string, ExportedNoteReference>;
	titleReferences: Map<string, ExportedNoteReference | null>;
}

function countRepeatedCharacter(content: string, startIndex: number, character: string): number {
	let currentIndex = startIndex;
	while (content[currentIndex] === character) {
		currentIndex += 1;
	}

	return currentIndex - startIndex;
}

function findLineEnd(content: string, startIndex: number): number {
	const newlineIndex = content.indexOf("\n", startIndex);
	return newlineIndex >= 0 ? newlineIndex + 1 : content.length;
}

function findLineStart(content: string, startIndex: number): number {
	let lineStart = startIndex;
	while (lineStart > 0 && content[lineStart - 1] !== "\n") {
		lineStart -= 1;
	}

	return lineStart;
}

function skipUpToThreeLeadingSpaces(content: string, startIndex: number): number {
	let currentIndex = startIndex;
	let indentation = 0;
	while (indentation < 3 && content[currentIndex] === " ") {
		currentIndex += 1;
		indentation += 1;
	}

	return currentIndex;
}

function tryConsumeListMarker(content: string, startIndex: number): number {
	const unorderedMarker = content[startIndex];
	if (
		(unorderedMarker === "-" || unorderedMarker === "+" || unorderedMarker === "*") &&
		(content[startIndex + 1] === " " || content[startIndex + 1] === "\t")
	) {
		let currentIndex = startIndex + 2;
		while (content[currentIndex] === " " || content[currentIndex] === "\t") {
			currentIndex += 1;
		}

		return currentIndex;
	}

	let currentIndex = startIndex;
	while (content[currentIndex] >= "0" && content[currentIndex] <= "9") {
		currentIndex += 1;
	}

	if (
		currentIndex > startIndex &&
		(content[currentIndex] === "." || content[currentIndex] === ")") &&
		(content[currentIndex + 1] === " " || content[currentIndex + 1] === "\t")
	) {
		currentIndex += 2;
		while (content[currentIndex] === " " || content[currentIndex] === "\t") {
			currentIndex += 1;
		}

		return currentIndex;
	}

	return -1;
}

function findFenceMarkerIndexAtLine(content: string, lineStart: number): number {
	let currentIndex = skipUpToThreeLeadingSpaces(content, lineStart);

	while (true) {
		if (content[currentIndex] === ">") {
			currentIndex += 1;
			if (content[currentIndex] === " ") {
				currentIndex += 1;
			}
			currentIndex = skipUpToThreeLeadingSpaces(content, currentIndex);
			continue;
		}

		const listMarkerEnd = tryConsumeListMarker(content, currentIndex);
		if (listMarkerEnd >= 0) {
			currentIndex = skipUpToThreeLeadingSpaces(content, listMarkerEnd);
			continue;
		}

		break;
	}

	return currentIndex;
}

function isFenceStart(content: string, markerIndex: number): boolean {
	const lineStart = findLineStart(content, markerIndex);
	return findFenceMarkerIndexAtLine(content, lineStart) === markerIndex;
}

function findClosingInlineCodeSpan(
	content: string,
	startIndex: number,
	backtickLength: number
): number {
	const lineEnd = findLineEnd(content, startIndex);
	const closingDelimiter = "`".repeat(backtickLength);
	const closingIndex = content.indexOf(closingDelimiter, startIndex + backtickLength);

	return closingIndex >= 0 && closingIndex < lineEnd ? closingIndex : -1;
}

function findClosingCodeFence(
	content: string,
	startIndex: number,
	fenceCharacter: string,
	fenceLength: number
): number {
	let lineStart = findLineEnd(content, startIndex);

	while (lineStart < content.length) {
		const markerIndex = findFenceMarkerIndexAtLine(content, lineStart);
		const markerLength = countRepeatedCharacter(content, markerIndex, fenceCharacter);
		if (markerLength >= fenceLength) {
			let afterMarkerIndex = markerIndex + markerLength;
			while (content[afterMarkerIndex] === " " || content[afterMarkerIndex] === "\t") {
				afterMarkerIndex += 1;
			}

			const followingCharacter = content[afterMarkerIndex];
			if (
				afterMarkerIndex === content.length ||
				followingCharacter === "\n" ||
				followingCharacter === "\r"
			) {
				return findLineEnd(content, afterMarkerIndex);
			}
		}

		lineStart = findLineEnd(content, lineStart);
	}

	return -1;
}

function getNextSpecialTokenIndex(content: string, currentIndex: number): number {
	const candidateIndexes = [
		content.indexOf("`", currentIndex),
		content.indexOf("![[", currentIndex),
		content.indexOf("[[", currentIndex),
	].filter((index) => index >= 0);

	return candidateIndexes.length > 0 ? Math.min(...candidateIndexes) : -1;
}

function normalizeFrontmatterSpacingForExport(content: string): string {
	if (!(content.startsWith("---\n") || content.startsWith("---\r\n"))) {
		return content;
	}

	const newline = content.startsWith("---\r\n") ? "\r\n" : "\n";
	const lines = content.split(/\r?\n/);
	const closingIndex = lines.indexOf("---", 1);
	if (closingIndex < 0) {
		return content;
	}

	if (closingIndex > 1 && lines[closingIndex - 1] === "") {
		return content;
	}

	return [...lines.slice(0, closingIndex), "", ...lines.slice(closingIndex)].join(newline);
}

function normalizeLookupKey(value: string): string {
	const trimmedValue = value.trim().replace(MARKDOWN_EXTENSION_REGEX, "");
	if (trimmedValue.length === 0) {
		return "";
	}

	return normalizePath(trimmedValue).toLowerCase();
}

function getTargetLookupKey(linkTarget: string): string {
	const [baseTarget] = linkTarget.split(HEADING_OR_BLOCK_REF_SEPARATOR_REGEX, 1);
	return normalizeLookupKey(baseTarget);
}

function rewriteWikiLink(innerContent: string, linkIndex: ExportedMarkdownLinkIndex): string {
	const separatorIndex = innerContent.indexOf("|");
	const rawTarget =
		separatorIndex >= 0 ? innerContent.slice(0, separatorIndex).trim() : innerContent.trim();
	const alias = separatorIndex >= 0 ? innerContent.slice(separatorIndex + 1).trim() : "";

	if (rawTarget.length === 0) {
		return `[[${innerContent}]]`;
	}

	if (rawTarget.startsWith("#") || rawTarget.startsWith("^")) {
		return `[[${innerContent}]]`;
	}

	const lookupKey = getTargetLookupKey(rawTarget);
	const resolvedReference =
		linkIndex.pathReferences.get(lookupKey) ?? linkIndex.titleReferences.get(lookupKey) ?? null;

	if (!resolvedReference) {
		return alias.length > 0 ? `${alias} (ref:${rawTarget})` : `[[${innerContent}]]`;
	}

	const label = alias.length > 0 ? `${alias} (ref:${rawTarget})` : rawTarget;
	return `[[#${escapeWikiLinkValue(resolvedReference.headingTarget)}|${escapeWikiLinkValue(label)}]]`;
}

function getDisplayPath(noteId: string): string {
	return normalizePath(noteId.trim()).replace(MARKDOWN_EXTENSION_REGEX, "");
}

export function buildExportedHeadingLabels(notes: ExportNode[]): Map<string, string> {
	const titleCounts = new Map<string, number>();

	for (const note of notes) {
		const titleLookupKey = normalizeLookupKey(note.title);
		if (titleLookupKey.length === 0) {
			continue;
		}

		titleCounts.set(titleLookupKey, (titleCounts.get(titleLookupKey) ?? 0) + 1);
	}

	return new Map(
		notes.map((note) => {
			const titleLookupKey = normalizeLookupKey(note.title);
			if (titleLookupKey.length === 0) {
				return [note.id, getDisplayPath(note.id)];
			}

			const titleCount = titleCounts.get(titleLookupKey)!;
			if (titleCount === 1) {
				return [note.id, note.title];
			}

			return [note.id, `${note.title} (${getDisplayPath(note.id)})`];
		})
	);
}

export function buildExportedMarkdownLinkIndex(
	notes: ExportNode[],
	getHeadingTarget: (note: ExportNode, index: number) => string
): ExportedMarkdownLinkIndex {
	const pathReferences = new Map<string, ExportedNoteReference>();
	const titleReferences = new Map<string, ExportedNoteReference | null>();

	for (const [index, note] of notes.entries()) {
		const reference = {
			headingTarget: getHeadingTarget(note, index),
		};
		const pathLookupKey = normalizeLookupKey(note.id);
		const titleLookupKey = normalizeLookupKey(note.title);

		if (pathLookupKey.length > 0) {
			pathReferences.set(pathLookupKey, reference);
		}

		if (titleLookupKey.length === 0) {
			continue;
		}

		if (!titleReferences.has(titleLookupKey)) {
			titleReferences.set(titleLookupKey, reference);
			continue;
		}

		titleReferences.set(titleLookupKey, null);
	}

	return {
		pathReferences,
		titleReferences,
	};
}

export function rewriteMarkdownLinksForExport(
	content: string,
	linkIndex: ExportedMarkdownLinkIndex
): string {
	if (content.length === 0) {
		return content;
	}

	content = normalizeFrontmatterSpacingForExport(content);

	const rewrittenParts: string[] = [];
	let currentIndex = 0;

	while (currentIndex < content.length) {
		const nextSpecialIndex = getNextSpecialTokenIndex(content, currentIndex);
		if (nextSpecialIndex < 0) {
			rewrittenParts.push(content.slice(currentIndex));
			break;
		}

		if (nextSpecialIndex > currentIndex) {
			rewrittenParts.push(content.slice(currentIndex, nextSpecialIndex));
			currentIndex = nextSpecialIndex;
		}

		if (content[currentIndex] === "`") {
			const backtickLength = countRepeatedCharacter(content, currentIndex, "`");
			const isFence = backtickLength >= 3 && isFenceStart(content, currentIndex);
			const closingIndex = isFence
				? findClosingCodeFence(content, currentIndex, "`", backtickLength)
				: findClosingInlineCodeSpan(content, currentIndex, backtickLength);
			if (closingIndex < 0) {
				rewrittenParts.push(content.slice(currentIndex));
				break;
			}

			const sliceEnd = isFence ? closingIndex : closingIndex + backtickLength;
			rewrittenParts.push(content.slice(currentIndex, sliceEnd));
			currentIndex = sliceEnd;
			continue;
		}

		if (content.startsWith("![[", currentIndex)) {
			const closingIndex = content.indexOf("]]", currentIndex + 3);
			if (closingIndex < 0) {
				rewrittenParts.push(content.slice(currentIndex));
				break;
			}
			rewrittenParts.push(content.slice(currentIndex, closingIndex + 2));
			currentIndex = closingIndex + 2;
			continue;
		}

		const closingIndex = content.indexOf("]]", currentIndex + 2);
		if (closingIndex < 0) {
			rewrittenParts.push(content.slice(currentIndex));
			break;
		}
		rewrittenParts.push(rewriteWikiLink(content.slice(currentIndex + 2, closingIndex), linkIndex));
		currentIndex = closingIndex + 2;
	}

	return rewrittenParts.join("");
}
