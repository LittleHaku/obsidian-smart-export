interface LinkedDescriptionOptions {
	text: string;
	linkText: string;
	href: string;
}

interface ObsidianDomWindow extends Window {
	createFragment: typeof createFragment;
	createEl: typeof createEl;
}

/**
 * Builds a setting description in the same document as its owning container.
 * This keeps the fragment and link compatible with Obsidian pop-out windows.
 */
export function createLinkedDescription(
	owner: HTMLElement,
	{ text, linkText, href }: LinkedDescriptionOptions
): DocumentFragment {
	// Obsidian declares its DOM helpers globally even though they also exist on each pop-out Window.
	const ownerWindow = owner.doc.win as ObsidianDomWindow;
	const fragment = ownerWindow.createFragment();
	fragment.append(text);

	const link = ownerWindow.createEl("a", {
		text: linkText,
		href,
		attr: {
			target: "_blank",
			rel: "noopener noreferrer",
		},
	});
	fragment.append(link);

	return fragment;
}
