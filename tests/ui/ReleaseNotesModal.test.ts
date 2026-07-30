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
});
