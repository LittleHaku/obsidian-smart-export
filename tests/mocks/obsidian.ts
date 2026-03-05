// This file mocks the 'obsidian' module for Vitest.

export class TFile {}
export class App {}
export class Vault {}
export class MetadataCache {}
export class LinkCache {}
export class Position {}
export class Loc {}

interface MockTagCache {
	tag: string;
}

interface MockCachedMetadata {
	tags?: MockTagCache[];
	frontmatter?: Record<string, unknown>;
}

export function normalizePath(path: string): string {
	return path
		.replace(/\u00A0/g, " ")
		.normalize()
		.replace(/[\\/]+/g, "/")
		.replace(/^\/+/, "")
		.replace(/\/+$/, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function formatYamlValue(value: unknown): string {
	if (typeof value === "string") {
		return JSON.stringify(value);
	}
	if (typeof value === "number") {
		return Number.isFinite(value) ? String(value) : "null";
	}
	if (typeof value === "boolean") {
		return value ? "true" : "false";
	}
	if (typeof value === "bigint") {
		return value.toString();
	}
	if (value === null || value === undefined) {
		return "null";
	}
	if (Array.isArray(value) || isRecord(value)) {
		const serialized = JSON.stringify(value);
		return serialized ?? "null";
	}

	return "null";
}

export function stringifyYaml(obj: unknown): string {
	if (!isRecord(obj)) {
		return "";
	}

	return (
		Object.entries(obj)
			.map(([key, value]) => `${key}: ${formatYamlValue(value)}`)
			.join("\n") + "\n"
	);
}

export function getAllTags(cache: unknown): string[] | null {
	if (!cache || typeof cache !== "object") {
		return null;
	}

	const metadata = cache as MockCachedMetadata;
	const tags = new Set<string>();

	for (const tagEntry of metadata.tags ?? []) {
		if (!tagEntry || typeof tagEntry.tag !== "string") continue;
		tags.add(tagEntry.tag);
	}

	const frontmatter = metadata.frontmatter;
	if (frontmatter && typeof frontmatter === "object" && !Array.isArray(frontmatter)) {
		const tagFields = [frontmatter.tags, frontmatter.tag];
		for (const tagField of tagFields) {
			if (typeof tagField === "string") {
				for (const token of tagField.split(/[,\n]/)) {
					const trimmed = token.trim();
					if (!trimmed) continue;
					tags.add(trimmed.startsWith("#") ? trimmed : `#${trimmed}`);
				}
				continue;
			}
			if (Array.isArray(tagField)) {
				for (const tagValue of tagField) {
					if (typeof tagValue !== "string") continue;
					const trimmed = tagValue.trim();
					if (!trimmed) continue;
					tags.add(trimmed.startsWith("#") ? trimmed : `#${trimmed}`);
				}
			}
		}
	}

	return tags.size > 0 ? [...tags] : null;
}
