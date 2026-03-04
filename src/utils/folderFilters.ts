import { normalizePath } from "obsidian";

export interface FolderFilterMatcher {
	pattern: string;
	regex: RegExp;
}

function escapeRegex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeFilterToken(token: string): string {
	const trimmed = token.trim();
	if (!trimmed) {
		return "";
	}

	const hasRootPrefix = trimmed.startsWith("/");
	const normalized = trimmed
		.replace(/\u00A0/g, " ")
		.normalize()
		.replace(/[\\/]+/g, "/")
		.replace(/^\/+/, "")
		.replace(/\/+$/, "");
	if (!normalized) {
		return "";
	}

	return hasRootPrefix ? `/${normalized}` : normalized;
}

function splitFilterEntry(value: string): string[] {
	return value
		.split(/[,\n]/)
		.map((token) => token.trim())
		.filter((token) => token.length > 0);
}

function globSegmentToRegex(segment: string): string {
	return segment
		.split("*")
		.map((part) => escapeRegex(part))
		.join("[^/]*");
}

function toFolderPath(filePath: string): string {
	const normalized = normalizePath(filePath);
	const lastSlashIndex = normalized.lastIndexOf("/");
	if (lastSlashIndex <= 0) {
		return "";
	}
	return normalized.slice(0, lastSlashIndex);
}

function compilePattern(pattern: string): RegExp {
	const rootAnchored = pattern.startsWith("/");
	const normalizedPattern = rootAnchored ? pattern.slice(1) : pattern;

	// Name pattern: no slash + wildcard, matches any folder segment.
	// Example: assets* or *_temp
	if (!normalizedPattern.includes("/") && normalizedPattern.includes("*")) {
		const segmentRegex = globSegmentToRegex(normalizedPattern);
		return new RegExp(`(?:^|/)${segmentRegex}(?:/|$)`);
	}

	// Exact folder prefix (legacy behavior): no slash + no wildcard.
	// Example: GeminiHelper
	if (!normalizedPattern.includes("/")) {
		const escapedPrefix = escapeRegex(normalizedPattern);
		return new RegExp(`^${escapedPrefix}(?:/|$)`);
	}

	// Path pattern: slash-based with optional wildcards.
	// Examples: /archive, /res*, /*/temp, /projects/*
	const segments = normalizedPattern.split("/").map((segment) => globSegmentToRegex(segment));
	const pathRegex = segments.join("/");
	const anchor = rootAnchored ? "^" : "^";
	return new RegExp(`${anchor}${pathRegex}(?:/|$)`);
}

/**
 * Normalizes a user-provided folder filter token while preserving:
 * - wildcard markers (`*`)
 * - optional root anchor prefix (`/`)
 */
export function normalizeFolderFilterPath(folderPath: string): string {
	return normalizeFilterToken(folderPath);
}

/**
 * Parses arbitrary persisted values into a clean folder filter list:
 * - non-array input becomes []
 * - supports comma and newline separated tokens
 * - values are normalized and deduplicated
 */
export function normalizeFolderFilterList(values: unknown): string[] {
	if (!Array.isArray(values)) {
		return [];
	}

	const normalized: string[] = [];
	const seen = new Set<string>();
	for (const value of values) {
		if (typeof value !== "string") continue;
		for (const token of splitFilterEntry(value)) {
			const normalizedValue = normalizeFilterToken(token);
			if (!normalizedValue || seen.has(normalizedValue)) continue;
			seen.add(normalizedValue);
			normalized.push(normalizedValue);
		}
	}

	return normalized;
}

/**
 * Compiles filter entries into regex matchers for fast traversal checks.
 */
export function buildFolderPrefixes(folders: string[] | undefined): FolderFilterMatcher[] {
	if (!folders || folders.length === 0) {
		return [];
	}

	return normalizeFolderFilterList(folders).map((pattern) => ({
		pattern,
		regex: compilePattern(pattern),
	}));
}

/**
 * Matches a note path against compiled folder filter matchers.
 * The filename is removed before matching, so rules apply to folder paths only.
 */
export function pathMatchesFolderPrefixes(path: string, matchers: FolderFilterMatcher[]): boolean {
	const folderPath = toFolderPath(path);
	if (!folderPath) {
		return false;
	}

	return matchers.some((matcher) => matcher.regex.test(folderPath));
}
