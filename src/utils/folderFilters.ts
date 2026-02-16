/**
 * Normalizes a user-provided folder path so matching is stable across platforms
 * and resilient to accidental whitespace/slashes.
 */
export function normalizeFolderFilterPath(folderPath: string): string {
	return folderPath
		.trim()
		.replace(/\\/g, "/")
		.replace(/\/+/g, "/")
		.replace(/^\/+/, "")
		.replace(/\/+$/, "");
}

/**
 * Parses arbitrary persisted values into a clean folder filter list:
 * - non-array input becomes []
 * - non-string entries are ignored
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
		const normalizedValue = normalizeFolderFilterPath(value);
		if (!normalizedValue || seen.has(normalizedValue)) continue;
		seen.add(normalizedValue);
		normalized.push(normalizedValue);
	}

	return normalized;
}

/**
 * Converts folder names to canonical "prefix/" form so matching can use
 * a fast `startsWith` check with predictable boundaries.
 */
export function buildFolderPrefixes(folders: string[] | undefined): string[] {
	if (!folders || folders.length === 0) {
		return [];
	}

	return normalizeFolderFilterList(folders).map((folder) => `${folder}/`);
}

/**
 * Prefix-based folder matching.
 * Example: prefix `Archive/` matches `Archive/Note.md` but not `Archive.md`.
 */
export function pathMatchesFolderPrefixes(path: string, prefixes: string[]): boolean {
	return prefixes.some((prefix) => path.startsWith(prefix));
}
