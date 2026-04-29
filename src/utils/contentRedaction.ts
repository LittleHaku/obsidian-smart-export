import { ContentRedactionOptions, ExportNode, SmartExportSettings } from "../types";

export const DEFAULT_REDACTION_DELIMITER = ":::";
export const DEFAULT_REDACTION_REPLACEMENT = "REDACTED";

interface RegexRedactionRule {
	pattern: string;
	regex: RegExp;
}

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

function normalizeRegexPatternText(text: string): string[] {
	return text
		.split(/\r?\n/)
		.map((pattern) => pattern.trim())
		.filter((pattern) => pattern.length > 0);
}

export function normalizeRedactionRegexPatterns(value: unknown): string[] {
	const patterns =
		typeof value === "string"
			? normalizeRegexPatternText(value)
			: Array.isArray(value)
				? value.flatMap((pattern) =>
						typeof pattern === "string" ? normalizeRegexPatternText(pattern) : []
					)
				: [];

	return [...new Set(patterns)];
}

function findClosingRegexSlash(pattern: string): number {
	for (let index = pattern.length - 1; index > 0; index -= 1) {
		if (pattern[index] !== "/") {
			continue;
		}

		let backslashCount = 0;
		for (let previousIndex = index - 1; previousIndex >= 0; previousIndex -= 1) {
			if (pattern[previousIndex] !== "\\") {
				break;
			}
			backslashCount += 1;
		}

		if (backslashCount % 2 === 0) {
			return index;
		}
	}

	return -1;
}

function normalizeRegexFlags(flags: string): string {
	const normalizedFlags = flags.length > 0 ? flags : "gm";
	return normalizedFlags.includes("g") ? normalizedFlags : `${normalizedFlags}g`;
}

function compileRegexRedactionRule(pattern: string): RegexRedactionRule | null {
	try {
		if (pattern.startsWith("/")) {
			const slashIndex = findClosingRegexSlash(pattern);
			if (slashIndex > 0) {
				return {
					pattern,
					regex: new RegExp(
						pattern.slice(1, slashIndex),
						normalizeRegexFlags(pattern.slice(slashIndex + 1))
					),
				};
			}
		}

		return {
			pattern,
			regex: new RegExp(pattern, "gm"),
		};
	} catch {
		return null;
	}
}

function compileRegexRedactionRules(patterns: string[] | undefined): RegexRedactionRule[] {
	return normalizeRedactionRegexPatterns(patterns)
		.map((pattern) => compileRegexRedactionRule(pattern))
		.filter((rule): rule is RegexRedactionRule => rule !== null);
}

export function getContentRedactionOptions(
	settings: Pick<
		SmartExportSettings,
		| "redactMarkedSections"
		| "redactionDelimiter"
		| "redactionReplacement"
		| "redactionRegexPatterns"
	>
): ContentRedactionOptions {
	return {
		enabled: settings.redactMarkedSections,
		delimiter: normalizeRedactionDelimiter(settings.redactionDelimiter),
		replacement: normalizeRedactionReplacement(settings.redactionReplacement),
		regexPatterns: normalizeRedactionRegexPatterns(settings.redactionRegexPatterns),
	};
}

export function redactMarkedContent(content: string, options: ContentRedactionOptions): string {
	const regexRules = compileRegexRedactionRules(options.regexPatterns);
	if (!options.enabled && regexRules.length === 0) {
		return content;
	}

	const delimiter = normalizeRedactionDelimiter(options.delimiter);
	const replacement = normalizeRedactionReplacement(options.replacement);
	const delimiterRedactedContent = options.enabled
		? redactDelimitedContent(content, delimiter, replacement)
		: content;

	return regexRules.reduce(
		(redactedContent, rule) => redactedContent.replace(rule.regex, replacement),
		delimiterRedactedContent
	);
}

function redactDelimitedContent(content: string, delimiter: string, replacement: string): string {
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
	if (!options) {
		return rootNode;
	}

	if (!options.enabled && normalizeRedactionRegexPatterns(options.regexPatterns).length === 0) {
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
