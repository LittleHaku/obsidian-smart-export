export interface ReleaseNotesEntry {
	version: string;
	date: string;
	showOnUpdate?: boolean;
	bannerUrl?: boolean | string;
	youtubeUrl?: string;
	info?: string;
	new?: string[];
	improved?: string[];
	changed?: string[];
	fixed?: string[];
}

export const RELEASE_NOTES: ReleaseNotesEntry[] = [
	{
		version: "1.18.0",
		date: "2026-08-15",
		showOnUpdate: true,
		new: [
			"Mermaid exports now turn selected note traversals into directed, depth-colored diagrams with stable note IDs.",
			"Mermaid diagrams preserve cross-links and the direction of outgoing, incoming, and both traversal modes.",
		],
	},
	{
		version: "1.17.0",
		date: "2026-08-05",
		showOnUpdate: true,
		new: [
			"Custom Markdown templates can now use {{note_contents_page_separated}} to place each exported note on a separate page.",
		],
		changed: [
			"LLM Markdown exports now reuse rendered note blocks when preparing template placeholders, avoiding duplicate link-rewriting work.",
		],
	},
	{
		version: "1.16.4",
		date: "2026-08-01",
		showOnUpdate: false,
		changed: [
			"Smart Export internals now use focused lifecycle, settings, modal state, traversal, and export-execution modules while preserving existing behavior and saved settings.",
		],
	},
	{
		version: "1.16.3",
		date: "2026-08-01",
		showOnUpdate: false,
		changed: [
			"Automated tests now validate the complete executable plugin runtime with exact 100% project and patch coverage requirements.",
		],
	},
	{
		version: "1.16.2",
		date: "2026-07-31",
		showOnUpdate: false,
		changed: [
			"Production and type-checking builds now share a strict ES2018 compatibility baseline for supported desktop and mobile clients.",
		],
	},
	{
		version: "1.16.1",
		date: "2026-07-31",
		showOnUpdate: false,
		fixed: [
			"Tag pickers now use supported Obsidian metadata APIs and reuse an on-demand cache until note metadata or vault files change.",
		],
	},
	{
		version: "1.16.0",
		date: "2026-07-30",
		showOnUpdate: true,
		changed: [
			"Settings now use Obsidian's searchable declarative interface, with native vault-folder suggestions and conditional redaction controls.",
			"Smart Export now requires Obsidian 1.13.0 or newer; version 1.15.3 remains available for older Obsidian installations.",
		],
	},
	{
		version: "1.15.3",
		date: "2026-07-30",
		showOnUpdate: true,
		fixed: [
			"Settings, export controls, release-note focus, and external links now stay attached to their owning Obsidian window for reliable pop-out, desktop, and mobile behavior.",
		],
	},
	{
		version: "1.15.2",
		date: "2026-07-30",
		showOnUpdate: true,
		changed: [
			"Custom Markdown templates now use Obsidian's public Vault API for consistent desktop and mobile behavior; template folders must be visible inside Obsidian.",
		],
	},
	{
		version: "1.15.1",
		date: "2026-07-30",
		showOnUpdate: false,
		changed: [
			"The minimum supported Obsidian version is now declared as 1.6.6, matching the folder suggestion API used since Smart Export 1.5.1.",
			"The development, CI, and release toolchain has been refreshed for reproducible Windows, WSL, and Linux builds.",
		],
		fixed: [
			"Release metadata, generated release notes, TypeScript validation, and coverage uploads are now checked consistently before publishing.",
		],
	},
	{
		version: "1.15.0",
		date: "2026-05-17",
		showOnUpdate: true,
		new: [
			"Export modal can now use a tag as the starting point, exporting all matching inline and frontmatter tagged notes as top-level roots while preserving traversal exclusions.",
			"Include more notes now supports adding tags, so another tag can contribute matching notes to the same export.",
		],
	},
	{
		version: "1.14.0",
		date: "2026-05-16",
		showOnUpdate: true,
		new: [
			"Export modal extra notes can now be added as single notes or new roots, making disconnected context easier to include in a session-only export.",
		],
	},
	{
		version: "1.13.0",
		date: "2026-04-29",
		showOnUpdate: true,
		new: [
			"Content redaction now supports optional regular expression rules, one per line, for replacing patterned content such as emails, URLs, footnotes, comments, and private metadata in exported note content.",
			"Content redaction settings now include a live preview for testing delimiter and regular expression rules against sample text before exporting.",
			"Marked-section redaction and regular expression redaction now have separate toggles and replacement text. Marked sections default to REDACTED, while regular expression matches default to being removed.",
			"New installs include example regular expression rules and preview input, but both redaction systems remain off until enabled.",
		],
	},
	{
		version: "1.12.0",
		date: "2026-04-29",
		showOnUpdate: true,
		new: [
			"Optional content redaction can replace private sections marked with a configurable delimiter such as :::private text::: during export.",
			"Redaction is not active by default. Enable it in Settings -> Smart Export -> Content redaction -> Redact marked sections, then configure the delimiter and replacement text if needed.",
		],
	},
	{
		version: "1.11.0",
		date: "2026-04-25",
		showOnUpdate: true,
		changed: [
			"Print-friendly Markdown exports now normalize included note content headings below each exported note title heading by default so nested source headings do not visually outrank their note section.",
			"New print-friendly Markdown setting Normalize content headings can preserve source heading levels exactly when disabled.",
		],
	},
	{
		version: "1.10.3",
		date: "2026-04-23",
		showOnUpdate: true,
		changed: [
			"The post-update modal title now names Smart Export explicitly, so release notes clearly identify which plugin was updated.",
		],
	},
	{
		version: "1.10.2",
		date: "2026-04-23",
		showOnUpdate: true,
		fixed: [
			"Markdown exports now preserve cross-note block links such as [[note^block]] by rewriting them to same-note block anchors instead of falling back to note-level links.",
			"Aliased cross-note block links such as [[note^block|alias]] now preserve readable ref: context while still pointing to the referenced exported block anchor.",
		],
	},
	{
		version: "1.10.1",
		date: "2026-04-23",
		showOnUpdate: true,
		fixed: [
			"Markdown exports now include notes referenced through heading and block links such as [[note#heading]] and [[note^block]] during traversal.",
			"Markdown exports now preserve referenced note headings by rewriting [[note#heading]] links to generated same-note block anchors with valid Obsidian same-note link syntax when the target heading is included in the export.",
		],
	},
	{
		version: "1.10.1-beta.1",
		date: "2026-04-22",
		showOnUpdate: false,
		fixed: [
			"Markdown exports now include notes referenced through heading and block links such as [[note#heading]] and [[note^block]] during traversal.",
			"Markdown exports now preserve referenced note headings by rewriting [[note#heading]] links to generated same-note block anchors with valid Obsidian same-note link syntax when the target heading is included in the export.",
		],
	},
	{
		version: "1.10.0",
		date: "2026-04-21",
		showOnUpdate: true,
		new: [
			"Smart Export now shows a one-time what's new modal after plugin updates, with the current release notes plus OK and Buy me a coffee actions.",
		],
	},
	{
		version: "1.9.0",
		date: "2026-04-21",
		showOnUpdate: true,
		changed: [
			"Print-friendly Markdown exports can now include a linked table of contents, numbered section headings, and divider lines between note blocks.",
			"New print-friendly Markdown settings now control whether table of contents links, heading numbering, and section dividers are included in clipboard and new-note exports.",
			"Print-friendly Markdown exports can now insert HTML page breaks between note sections, which also puts the table of contents on its own page when enabled.",
			"New print-friendly Markdown setting now controls whether page breaks replace section dividers in clipboard and new-note exports.",
		],
	},
	{
		version: "1.9.0-beta.1",
		date: "2026-03-15",
		showOnUpdate: false,
		changed: [
			"Print-friendly Markdown exports can now include a linked table of contents, numbered section headings, and divider lines between note blocks.",
		],
	},
];
