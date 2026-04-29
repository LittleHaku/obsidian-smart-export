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
