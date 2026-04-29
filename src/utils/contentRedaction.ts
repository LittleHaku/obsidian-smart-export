import { ContentRedactionOptions, ExportNode, SmartExportSettings } from "../types";

export const DEFAULT_REDACTION_DELIMITER = ":::";
export const DEFAULT_REDACTION_REPLACEMENT = "REDACTED";

export function normalizeRedactionDelimiter(value: unknown): string {
	if (typeof value !== "string") {
		return DEFAULT_REDACTION_DELIMITER;
	}

	const delimiter = value.trim();
	return delimiter.length > 0 ? delimiter : DEFAULT_REDACTION_DELIMITER;
}

export function normalizeRedactionReplacement(value: unknown): string {
	return typeof value === "string" ? value : DEFAULT_REDACTION_REPLACEMENT;
}

export function getContentRedactionOptions(
	settings: Pick<
		SmartExportSettings,
		"redactMarkedSections" | "redactionDelimiter" | "redactionReplacement"
	>
): ContentRedactionOptions {
	return {
		enabled: settings.redactMarkedSections,
		delimiter: normalizeRedactionDelimiter(settings.redactionDelimiter),
		replacement: normalizeRedactionReplacement(settings.redactionReplacement),
	};
}

export function redactMarkedContent(content: string, options: ContentRedactionOptions): string {
	if (!options.enabled) {
		return content;
	}

	const delimiter = normalizeRedactionDelimiter(options.delimiter);
	const replacement = normalizeRedactionReplacement(options.replacement);
	const delimiterLength = delimiter.length;
	const chunks: string[] = [];
	let cursor = 0;

	while (cursor < content.length) {
		const start = content.indexOf(delimiter, cursor);
		if (start === -1) {
			chunks.push(content.slice(cursor));
			break;
		}

		const end = content.indexOf(delimiter, start + delimiterLength);
		if (end === -1) {
			chunks.push(content.slice(cursor));
			break;
		}

		chunks.push(content.slice(cursor, start), replacement);
		cursor = end + delimiterLength;
	}

	return chunks.join("");
}

export function redactExportTreeContent(
	rootNode: ExportNode,
	options?: ContentRedactionOptions | null
): ExportNode {
	if (!options?.enabled) {
		return rootNode;
	}

	return cloneNodeWithRedactedContent(rootNode, options);
}

function cloneNodeWithRedactedContent(
	node: ExportNode,
	options: ContentRedactionOptions
): ExportNode {
	return {
		...node,
		content:
			typeof node.content === "string" ? redactMarkedContent(node.content, options) : node.content,
		children: node.children.map((child) => cloneNodeWithRedactedContent(child, options)),
	};
}
