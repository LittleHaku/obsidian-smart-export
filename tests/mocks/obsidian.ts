// This file mocks the 'obsidian' module for Vitest.

export class TFile {}
export class App {}
export class Vault {}
export class MetadataCache {}
export class LinkCache {}
export class Position {}
export class Loc {}

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
