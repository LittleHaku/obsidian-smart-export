import { describe, expect, it, vi } from "vitest";
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

	it("renders funding actions as safe external links", () => {
		const modal = new ReleaseNotesModal(new App(), SAMPLE_RELEASE_NOTES, {
			fundingUrl: "https://buymeacoffee.com/example",
		});

		modal.onOpen();

		const supportLink = modal.contentEl.querySelector<HTMLAnchorElement>(
			".smart-export-support-button-small"
		);
		expect(supportLink?.href).toBe("https://buymeacoffee.com/example");
		expect(supportLink?.target).toBe("_blank");
		expect(supportLink?.rel).toBe("noopener noreferrer");
	});

	it("uses the modal owner window to schedule focus", () => {
		const modal = new ReleaseNotesModal(new App(), SAMPLE_RELEASE_NOTES);
		const scheduledCallbacks: FrameRequestCallback[] = [];
		const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
			scheduledCallbacks.push(callback);
			return 42;
		});
		const cancelAnimationFrame = vi.fn();
		const ownerWindow = {
			requestAnimationFrame,
			cancelAnimationFrame,
		};
		Object.defineProperty(modal.contentEl, "win", {
			configurable: true,
			value: ownerWindow,
		});

		modal.open();

		expect(requestAnimationFrame).toHaveBeenCalledOnce();
		const okButton = modal.contentEl.querySelector<HTMLButtonElement>(".mod-cta");
		const focus = vi.spyOn(okButton as HTMLButtonElement, "focus");
		scheduledCallbacks[0]?.(0);
		expect(focus).toHaveBeenCalledOnce();
		expect(cancelAnimationFrame).not.toHaveBeenCalled();
	});

	it("cancels pending focus when the modal closes", () => {
		const onClose = vi.fn();
		const modal = new ReleaseNotesModal(new App(), SAMPLE_RELEASE_NOTES, { onClose });
		const requestAnimationFrame = vi.fn(() => 73);
		const cancelAnimationFrame = vi.fn();
		Object.defineProperty(modal.contentEl, "win", {
			configurable: true,
			value: {
				requestAnimationFrame,
				cancelAnimationFrame,
			},
		});

		modal.open();
		modal.close();

		expect(cancelAnimationFrame).toHaveBeenCalledWith(73);
		expect(onClose).toHaveBeenCalledOnce();
	});

	it("renders formatted multi-paragraph notes, every category, and invalid dates safely", () => {
		const modal = new ReleaseNotesModal(new App(), [
			{
				version: "next",
				date: "not-a-date",
				info: [
					"Plain ==highlight with **bold**== and [docs](https://example.com/docs).",
					"Visit https://example.com/path, or https://example.org",
				].join("\n\n"),
				new: ["New line one\nline two"],
				improved: ["Improved **rendering**"],
				changed: ["Changed at https://example.com/change!"],
				fixed: ["Fixed [issue](https://example.com/issue)"],
			},
		]);

		modal.onOpen();

		expect(modal.contentEl.querySelector("h3")?.textContent).toBe("Version next");
		expect(modal.contentEl.querySelectorAll(".smart-export-whats-new-info")).toHaveLength(2);
		expect(modal.contentEl.querySelector("mark")).toBeNull();
		expect(modal.contentEl.querySelector(".smart-export-whats-new-highlight")?.textContent).toBe(
			"highlight with bold"
		);
		expect(modal.contentEl.querySelectorAll("strong").length).toBeGreaterThan(1);
		expect(modal.contentEl.querySelectorAll("h4")).toHaveLength(4);
		expect(modal.contentEl.querySelectorAll("br")).toHaveLength(1);
		const links = Array.from(modal.contentEl.querySelectorAll<HTMLAnchorElement>("a"));
		expect(links.map((link) => link.href)).toEqual(
			expect.arrayContaining([
				"https://example.com/docs",
				"https://example.com/path",
				"https://example.org/",
			])
		);
		expect(modal.contentEl.textContent).toContain("path,");

		modal.contentEl.querySelector<HTMLButtonElement>(".mod-cta")?.click();
		expect(modal.contentEl.childElementCount).toBe(0);
	});
});
