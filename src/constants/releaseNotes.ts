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
