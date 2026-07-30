import { describe, expect, it, vi } from "vitest";
import { createLinkedDescription } from "../../src/utils/linkedDescription";

describe("createLinkedDescription", () => {
	it("uses the owning window to create the fragment and link", () => {
		const append = vi.fn();
		const fragment = { append } as unknown as DocumentFragment;
		const link = {} as HTMLAnchorElement;
		const createFragment = vi.fn(() => fragment);
		const createEl = vi.fn(() => link);
		const owner = {
			doc: {
				win: {
					createFragment,
					createEl,
				},
			},
		} as unknown as HTMLElement;

		const description = createLinkedDescription(owner, {
			text: "Read the ",
			linkText: "template docs",
			href: "https://github.com/LittleHaku/obsidian-smart-export/wiki/Templates",
		});

		expect(description).toBe(fragment);
		expect(createFragment).toHaveBeenCalledOnce();
		expect(createEl).toHaveBeenCalledWith("a", {
			text: "template docs",
			href: "https://github.com/LittleHaku/obsidian-smart-export/wiki/Templates",
			attr: {
				target: "_blank",
				rel: "noopener noreferrer",
			},
		});
		expect(append).toHaveBeenNthCalledWith(1, "Read the ");
		expect(append).toHaveBeenNthCalledWith(2, link);
	});
});
