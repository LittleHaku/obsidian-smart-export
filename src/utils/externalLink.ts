declare module "obsidian" {
	export function openExternal(url: string): void;
}

import { openExternal } from "obsidian";

export function openExternalUrl(url: string): void {
	openExternal(url);
}
