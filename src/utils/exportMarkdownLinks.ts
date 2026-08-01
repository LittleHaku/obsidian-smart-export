import { normalizePath } from "obsidian";
import { ExportNode } from "../types";
import { escapeWikiLinkValue } from "./wikiLinkEscaping";

const MARKDOWN_EXTENSION_REGEX = /\.md$/i;
const HEADING_OR_BLOCK_REF_SEPARATOR_REGEX = /[#^]/;
const TRAILING_HEADING_HASHES_REGEX = /[ \t]+#+[ \t]*$/;
const TRAILING_BLOCK_ID_REGEX = /[ \t]+\^([A-Za-z0-9-]+)[ \t]*$/;
const SYNTHETIC_HEADING_BLOCK_ID_PREFIX = "smart-export";

interface ExportedNoteReference {
	headingTarget: string;
	requestedHeadingLookupKeys: Set<string>;
	headingBlockTargets: Map<string, string>;
}

interface ExportedMarkdownLinkIndex {
	noteReferencesById: Map<string, ExportedNoteReference>;
	pathReferences: Map<string, ExportedNoteReference>;
	titleReferences: Map<string, ExportedNoteReference | null>;
}

interface ParsedLinkTarget {
	baseTarget: string;
	headingLookupKey: string | null;
	blockTarget: string | null;
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
		content.indexOf("~", currentIndex),
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

function normalizeHeadingLookupKey(value: string): string {
	return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function parseLinkTarget(rawTarget: string): ParsedLinkTarget {
	const separatorIndex = rawTarget.search(HEADING_OR_BLOCK_REF_SEPARATOR_REGEX);
	if (separatorIndex < 0) {
		return {
			baseTarget: rawTarget,
			headingLookupKey: null,
			blockTarget: null,
		};
	}

	const separator = rawTarget[separatorIndex];
	const baseTarget = rawTarget.slice(0, separatorIndex).trim();
	const suffix = rawTarget.slice(separatorIndex + 1).trim();

	return {
		baseTarget,
		headingLookupKey:
			separator === "#" && suffix.length > 0 ? normalizeHeadingLookupKey(suffix) : null,
		blockTarget: separator === "^" && suffix.length > 0 ? suffix : null,
	};
}

function hashString(value: string): string {
	let hash = 2166136261;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}

	return (hash >>> 0).toString(36);
}

function createSyntheticHeadingBlockId(
	noteId: string,
	headingLookupKey: string,
	occurrenceIndex: number
): string {
	return `${SYNTHETIC_HEADING_BLOCK_ID_PREFIX}-${hashString(
		`${noteId}\u0000${headingLookupKey}\u0000${occurrenceIndex}`
	)}`;
}

function getLineBodyAndNewline(line: string): { body: string; newline: string } {
	if (line.endsWith("\r\n")) {
		return {
			body: line.slice(0, -2),
			newline: "\r\n",
		};
	}

	if (line.endsWith("\n")) {
		return {
			body: line.slice(0, -1),
			newline: "\n",
		};
	}

	return {
		body: line,
		newline: "",
	};
}

function getFenceInfo(lineBody: string): { character: string; length: number } | null {
	const markerIndex = findFenceMarkerIndexAtLine(lineBody, 0);
	const fenceCharacter = lineBody[markerIndex];
	if ((fenceCharacter !== "`" && fenceCharacter !== "~") || markerIndex < 0) {
		return null;
	}

	const fenceLength = countRepeatedCharacter(lineBody, markerIndex, fenceCharacter);
	if (fenceLength < 3) {
		return null;
	}

	return {
		character: fenceCharacter,
		length: fenceLength,
	};
}

function shouldCloseFence(lineBody: string, fenceCharacter: string, fenceLength: number): boolean {
	const markerIndex = findFenceMarkerIndexAtLine(lineBody, 0);
	if (lineBody[markerIndex] !== fenceCharacter) {
		return false;
	}

	const markerLength = countRepeatedCharacter(lineBody, markerIndex, fenceCharacter);
	if (markerLength < fenceLength) {
		return false;
	}

	for (
		let currentIndex = markerIndex + markerLength;
		currentIndex < lineBody.length;
		currentIndex += 1
	) {
		const character = lineBody[currentIndex];
		if (character !== " " && character !== "\t") {
			return false;
		}
	}

	return true;
}

function parseHeadingLine(
	lineBody: string,
	noteId: string,
	headingOccurrences: Map<string, number>
): {
	headingLookupKey: string;
	blockId: string;
	existingBlockId: string | null;
	insertionIndex: number;
} | null {
	const markerIndex = skipUpToThreeLeadingSpaces(lineBody, 0);
	const markerLength = countRepeatedCharacter(lineBody, markerIndex, "#");
	if (markerLength < 1 || markerLength > 6) {
		return null;
	}

	const afterMarkerIndex = markerIndex + markerLength;
	if (lineBody[afterMarkerIndex] !== " " && lineBody[afterMarkerIndex] !== "\t") {
		return null;
	}

	const trimmedBody = lineBody.trimEnd();
	let headingText = trimmedBody.slice(afterMarkerIndex).trim();
	if (headingText.length === 0) {
		return null;
	}

	const existingBlockIdMatch = headingText.match(TRAILING_BLOCK_ID_REGEX);
	const existingBlockId = existingBlockIdMatch?.[1] ?? null;
	if (existingBlockIdMatch?.index !== undefined) {
		headingText = headingText.slice(0, existingBlockIdMatch.index).trimEnd();
	}

	headingText = headingText.replace(TRAILING_HEADING_HASHES_REGEX, "").trimEnd();

	const headingLookupKey = normalizeHeadingLookupKey(headingText);
	const occurrenceIndex = headingOccurrences.get(headingLookupKey) ?? 0;
	headingOccurrences.set(headingLookupKey, occurrenceIndex + 1);

	const closingHashesMatch = trimmedBody.match(TRAILING_HEADING_HASHES_REGEX);
	const insertionIndex = existingBlockId
		? trimmedBody.length
		: (closingHashesMatch?.index ?? trimmedBody.length);

	return {
		headingLookupKey,
		blockId:
			existingBlockId ?? createSyntheticHeadingBlockId(noteId, headingLookupKey, occurrenceIndex),
		existingBlockId,
		insertionIndex,
	};
}

function collectWikiLinkInnerContents(content: string): string[] {
	const links: string[] = [];
	let currentIndex = 0;

	while (currentIndex < content.length) {
		const nextSpecialIndex = getNextSpecialTokenIndex(content, currentIndex);
		if (nextSpecialIndex < 0) {
			break;
		}

		currentIndex = nextSpecialIndex;

		if (content[currentIndex] === "`" || content[currentIndex] === "~") {
			const markerCharacter = content[currentIndex];
			const markerLength = countRepeatedCharacter(content, currentIndex, markerCharacter);
			const isFence = markerLength >= 3 && isFenceStart(content, currentIndex);
			if (isFence) {
				const closingIndex = findClosingCodeFence(
					content,
					currentIndex,
					markerCharacter,
					markerLength
				);
				if (closingIndex < 0) {
					break;
				}

				currentIndex = closingIndex;
				continue;
			}

			if (markerCharacter === "`") {
				const closingIndex = findClosingInlineCodeSpan(content, currentIndex, markerLength);
				if (closingIndex < 0) {
					break;
				}

				currentIndex = closingIndex + markerLength;
				continue;
			}

			currentIndex += markerLength;
			continue;
		}

		if (content.startsWith("![[", currentIndex)) {
			const closingIndex = content.indexOf("]]", currentIndex + 3);
			if (closingIndex < 0) {
				break;
			}

			currentIndex = closingIndex + 2;
			continue;
		}

		const closingIndex = content.indexOf("]]", currentIndex + 2);
		if (closingIndex < 0) {
			break;
		}

		links.push(content.slice(currentIndex + 2, closingIndex));
		currentIndex = closingIndex + 2;
	}

	return links;
}

function collectReferencedHeadingBlockTargets(
	content: string,
	noteId: string,
	requestedHeadingLookupKeys: Set<string>
): Map<string, string> {
	if (requestedHeadingLookupKeys.size === 0 || content.length === 0) {
		return new Map();
	}

	const blockTargets = new Map<string, string>();
	const headingOccurrences = new Map<string, number>();
	const lines = content.match(/.*(?:\r?\n|$)/g)!;
	let isInFrontmatter = false;
	let currentFence: { character: string; length: number } | null = null;
	let isFirstLine = true;

	for (const line of lines) {
		if (line.length === 0) {
			continue;
		}

		const { body } = getLineBodyAndNewline(line);

		if (isFirstLine && body === "---") {
			isInFrontmatter = true;
			isFirstLine = false;
			continue;
		}
		isFirstLine = false;

		if (isInFrontmatter) {
			if (body === "---") {
				isInFrontmatter = false;
			}
			continue;
		}

		if (currentFence) {
			if (shouldCloseFence(body, currentFence.character, currentFence.length)) {
				currentFence = null;
			}
			continue;
		}

		const fenceInfo = getFenceInfo(body);
		if (fenceInfo) {
			currentFence = fenceInfo;
			continue;
		}

		const parsedHeading = parseHeadingLine(body, noteId, headingOccurrences);
		if (!parsedHeading || !requestedHeadingLookupKeys.has(parsedHeading.headingLookupKey)) {
			continue;
		}

		if (!blockTargets.has(parsedHeading.headingLookupKey)) {
			blockTargets.set(parsedHeading.headingLookupKey, parsedHeading.blockId);
		}
	}

	return blockTargets;
}

function annotateReferencedHeadingsForExport(
	content: string,
	noteId: string,
	linkIndex: ExportedMarkdownLinkIndex
): string {
	const noteReference = linkIndex.noteReferencesById.get(noteId);
	if (!noteReference || noteReference.headingBlockTargets.size === 0) {
		return content;
	}

	const headingOccurrences = new Map<string, number>();
	const lines = content.match(/.*(?:\r?\n|$)/g)!;
	const rewrittenLines: string[] = [];
	let isInFrontmatter = false;
	let currentFence: { character: string; length: number } | null = null;
	let isFirstLine = true;

	for (const line of lines) {
		if (line.length === 0) {
			continue;
		}

		const { body, newline } = getLineBodyAndNewline(line);

		if (isFirstLine && body === "---") {
			isInFrontmatter = true;
			rewrittenLines.push(line);
			isFirstLine = false;
			continue;
		}
		isFirstLine = false;

		if (isInFrontmatter) {
			rewrittenLines.push(line);
			if (body === "---") {
				isInFrontmatter = false;
			}
			continue;
		}

		if (currentFence) {
			rewrittenLines.push(line);
			if (shouldCloseFence(body, currentFence.character, currentFence.length)) {
				currentFence = null;
			}
			continue;
		}

		const fenceInfo = getFenceInfo(body);
		if (fenceInfo) {
			currentFence = fenceInfo;
			rewrittenLines.push(line);
			continue;
		}

		const parsedHeading = parseHeadingLine(body, noteId, headingOccurrences);
		if (!parsedHeading) {
			rewrittenLines.push(line);
			continue;
		}

		const expectedBlockId = noteReference.headingBlockTargets.get(parsedHeading.headingLookupKey);
		if (
			!expectedBlockId ||
			parsedHeading.blockId !== expectedBlockId ||
			parsedHeading.existingBlockId
		) {
			rewrittenLines.push(line);
			continue;
		}

		rewrittenLines.push(
			`${body.slice(0, parsedHeading.insertionIndex)} ^${parsedHeading.blockId}${body.slice(parsedHeading.insertionIndex)}${newline}`
		);
	}

	return rewrittenLines.join("");
}

function rewriteWikiLink(innerContent: string, linkIndex: ExportedMarkdownLinkIndex): string {
	const separatorIndex = innerContent.indexOf("|");
	const rawTarget =
		separatorIndex >= 0 ? innerContent.slice(0, separatorIndex).trim() : innerContent.trim();
	const alias = separatorIndex >= 0 ? innerContent.slice(separatorIndex + 1).trim() : "";

	if (rawTarget.length === 0) {
		return `[[${innerContent}]]`;
	}

	if (rawTarget.startsWith("#")) {
		return `[[${innerContent}]]`;
	}

	if (rawTarget.startsWith("^")) {
		const localBlockTarget = rawTarget.slice(1).trim();
		if (localBlockTarget.length === 0) {
			return `[[${innerContent}]]`;
		}

		const label =
			alias.length > 0
				? `${escapeWikiLinkValue(alias)}`
				: `^${escapeWikiLinkValue(localBlockTarget)}`;
		return `[[#^${escapeWikiLinkValue(localBlockTarget)}|${label}]]`;
	}

	const parsedTarget = parseLinkTarget(rawTarget);
	const lookupKey = normalizeLookupKey(parsedTarget.baseTarget);
	const resolvedReference =
		linkIndex.pathReferences.get(lookupKey) ?? linkIndex.titleReferences.get(lookupKey) ?? null;

	if (!resolvedReference) {
		return alias.length > 0 ? `${alias} (ref:${rawTarget})` : `[[${innerContent}]]`;
	}

	const label = alias.length > 0 ? `${alias} (ref:${rawTarget})` : rawTarget;
	if (parsedTarget.blockTarget) {
		return `[[#^${escapeWikiLinkValue(parsedTarget.blockTarget)}|${escapeWikiLinkValue(label)}]]`;
	}

	if (parsedTarget.headingLookupKey) {
		const headingBlockTarget = resolvedReference.headingBlockTargets.get(
			parsedTarget.headingLookupKey
		);
		if (headingBlockTarget) {
			return `[[#^${escapeWikiLinkValue(headingBlockTarget)}|${escapeWikiLinkValue(label)}]]`;
		}
	}

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
	const noteReferencesById = new Map<string, ExportedNoteReference>();
	const pathReferences = new Map<string, ExportedNoteReference>();
	const titleReferences = new Map<string, ExportedNoteReference | null>();

	for (const [index, note] of notes.entries()) {
		const reference = {
			headingTarget: getHeadingTarget(note, index),
			requestedHeadingLookupKeys: new Set<string>(),
			headingBlockTargets: new Map<string, string>(),
		};
		noteReferencesById.set(note.id, reference);
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

	for (const note of notes) {
		for (const innerContent of collectWikiLinkInnerContents(note.content ?? "")) {
			const separatorIndex = innerContent.indexOf("|");
			const rawTarget =
				separatorIndex >= 0 ? innerContent.slice(0, separatorIndex).trim() : innerContent.trim();
			if (rawTarget.length === 0 || rawTarget.startsWith("#") || rawTarget.startsWith("^")) {
				continue;
			}

			const parsedTarget = parseLinkTarget(rawTarget);
			if (!parsedTarget.headingLookupKey) {
				continue;
			}

			const lookupKey = normalizeLookupKey(parsedTarget.baseTarget);
			const resolvedReference =
				pathReferences.get(lookupKey) ?? titleReferences.get(lookupKey) ?? null;
			resolvedReference?.requestedHeadingLookupKeys.add(parsedTarget.headingLookupKey);
		}
	}

	for (const note of notes) {
		const reference = noteReferencesById.get(note.id)!;
		reference.headingBlockTargets = collectReferencedHeadingBlockTargets(
			note.content ?? "",
			note.id,
			reference.requestedHeadingLookupKeys
		);
	}

	return {
		noteReferencesById,
		pathReferences,
		titleReferences,
	};
}

export function rewriteMarkdownLinksForExport(
	content: string,
	linkIndex: ExportedMarkdownLinkIndex,
	currentNoteId?: string
): string {
	if (content.length === 0) {
		return content;
	}

	content = normalizeFrontmatterSpacingForExport(content);
	if (currentNoteId) {
		content = annotateReferencedHeadingsForExport(content, currentNoteId, linkIndex);
	}

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

		if (content[currentIndex] === "`" || content[currentIndex] === "~") {
			const markerCharacter = content[currentIndex];
			const markerLength = countRepeatedCharacter(content, currentIndex, markerCharacter);
			const isFence = markerLength >= 3 && isFenceStart(content, currentIndex);
			if (isFence) {
				const closingIndex = findClosingCodeFence(
					content,
					currentIndex,
					markerCharacter,
					markerLength
				);
				if (closingIndex < 0) {
					rewrittenParts.push(content.slice(currentIndex));
					break;
				}

				rewrittenParts.push(content.slice(currentIndex, closingIndex));
				currentIndex = closingIndex;
				continue;
			}

			if (markerCharacter === "`") {
				const closingIndex = findClosingInlineCodeSpan(content, currentIndex, markerLength);
				if (closingIndex < 0) {
					rewrittenParts.push(content.slice(currentIndex));
					break;
				}

				const sliceEnd = closingIndex + markerLength;
				rewrittenParts.push(content.slice(currentIndex, sliceEnd));
				currentIndex = sliceEnd;
				continue;
			}

			rewrittenParts.push(content.slice(currentIndex, currentIndex + markerLength));
			currentIndex += markerLength;
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
