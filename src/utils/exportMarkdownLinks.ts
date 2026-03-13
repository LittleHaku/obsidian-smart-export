import { normalizePath } from "obsidian";
import { ExportNode } from "../types";

const MARKDOWN_EXTENSION_REGEX = /\.md$/i;
const HEADING_OR_BLOCK_REF_SEPARATOR_REGEX = /[#^]/;

interface ExportedNoteReference {
	headingTarget: string;
}

interface ExportedMarkdownLinkIndex {
	pathReferences: Map<string, ExportedNoteReference>;
	titleReferences: Map<string, ExportedNoteReference | null>;
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

function escapeMarkdownLinkLabel(value: string): string {
	return value.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\]/g, "\\]");
}

function rewriteWikiLink(innerContent: string, linkIndex: ExportedMarkdownLinkIndex): string {
	const separatorIndex = innerContent.indexOf("|");
	const rawTarget =
		separatorIndex >= 0 ? innerContent.slice(0, separatorIndex).trim() : innerContent.trim();
	const alias = separatorIndex >= 0 ? innerContent.slice(separatorIndex + 1).trim() : "";

	if (rawTarget.length === 0) {
		return `[[${innerContent}]]`;
	}

	const lookupKey = getTargetLookupKey(rawTarget);
	const resolvedReference =
		linkIndex.pathReferences.get(lookupKey) ?? linkIndex.titleReferences.get(lookupKey) ?? null;

	if (!resolvedReference) {
		return alias.length > 0 ? `${alias} (ref:${rawTarget})` : `[[${innerContent}]]`;
	}

	const label = alias.length > 0 ? `${alias} (ref:${rawTarget})` : rawTarget;
	return `[[#${resolvedReference.headingTarget}|${escapeMarkdownLinkLabel(label)}]]`;
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
		const pathLookupKeys = new Set<string>([
			normalizeLookupKey(note.id),
			normalizeLookupKey(note.id.replace(MARKDOWN_EXTENSION_REGEX, "")),
		]);
		const titleLookupKey = normalizeLookupKey(note.title);

		for (const key of pathLookupKeys) {
			if (key.length > 0) {
				pathReferences.set(key, reference);
			}
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

	const rewrittenParts: string[] = [];
	let currentIndex = 0;

	while (currentIndex < content.length) {
		const backtickMatch = content.slice(currentIndex).match(/^`+/);
		if (backtickMatch) {
			const backticks = backtickMatch[0];
			const closingIndex = content.indexOf(backticks, currentIndex + backticks.length);
			if (closingIndex < 0) {
				rewrittenParts.push(content.slice(currentIndex));
				break;
			}
			rewrittenParts.push(content.slice(currentIndex, closingIndex + backticks.length));
			currentIndex = closingIndex + backticks.length;
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

		if (content.startsWith("[[", currentIndex)) {
			const closingIndex = content.indexOf("]]", currentIndex + 2);
			if (closingIndex < 0) {
				rewrittenParts.push(content.slice(currentIndex));
				break;
			}
			rewrittenParts.push(
				rewriteWikiLink(content.slice(currentIndex + 2, closingIndex), linkIndex)
			);
			currentIndex = closingIndex + 2;
			continue;
		}

		rewrittenParts.push(content[currentIndex]);
		currentIndex += 1;
	}

	return rewrittenParts.join("");
}
