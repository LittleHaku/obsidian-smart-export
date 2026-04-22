import { describe, expect, it, vi } from "vitest";
import * as obsidian from "obsidian";
import { openExternalUrl } from "../../src/utils/externalLink";

describe("externalLink", () => {
	it("opens URLs through Obsidian's external-link API", () => {
		const openExternalSpy = vi.spyOn(obsidian, "openExternal");

		openExternalUrl("https://buymeacoffee.com/example");

		expect(openExternalSpy).toHaveBeenCalledWith("https://buymeacoffee.com/example");
	});
});
