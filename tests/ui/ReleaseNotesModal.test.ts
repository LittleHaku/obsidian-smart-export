import { describe, expect, it } from "vitest";
import { App } from "obsidian";
import { ReleaseNotesModal } from "../../src/ui/ReleaseNotesModal";
import { ReleaseNotesEntry } from "../../src/constants/releaseNotes";

const SAMPLE_RELEASE_NOTES: ReleaseNotesEntry[] = [
	{
		version: "1.10.2",
		date: "2026-04-23",
		fixed: ["Preserved cross-note block links in Markdown exports."],
	},
];

describe("ReleaseNotesModal", () => {
	it("shows the plugin name in the what's new title and support copy", () => {
		const modal = new ReleaseNotesModal(new App(), SAMPLE_RELEASE_NOTES, {
			pluginName: "Smart Export",
		});

		modal.onOpen();

		expect(modal.titleEl.textContent).toBe("What's new in Smart Export");
		expect(modal.contentEl.textContent).toContain("If Smart Export is useful in your workflow");
	});

	it("falls back to the generic title when the plugin name is missing", () => {
		const modal = new ReleaseNotesModal(new App(), SAMPLE_RELEASE_NOTES);

		modal.onOpen();

		expect(modal.titleEl.textContent).toBe("What's new");
		expect(modal.contentEl.textContent).toContain("If this plugin is useful in your workflow");
	});
});
