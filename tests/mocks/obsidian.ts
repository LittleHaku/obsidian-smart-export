// This file mocks the 'obsidian' module for Vitest.

export class TFile {}
export class App {}
export class Vault {}
export class MetadataCache {}
export class LinkCache {}
export class Position {}
export class Loc {}

function formatYamlValue(value: unknown): string {
	if (typeof value === "string") {
		return JSON.stringify(value);
	}
	if (value === null) {
		return "null";
	}
	return String(value);
}

export function stringifyYaml(obj: any): string {
	if (!obj || typeof obj !== "object") {
		return "";
	}

	return (
		Object.entries(obj)
			.map(([key, value]) => `${key}: ${formatYamlValue(value)}`)
			.join("\n") + "\n"
	);
}
