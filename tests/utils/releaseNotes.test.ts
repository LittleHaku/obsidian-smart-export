import changelog from "../../CHANGELOG.md?raw";
import manifestJson from "../../manifest.json?raw";
import { describe, expect, it } from "vitest";
import { RELEASE_NOTES } from "../../src/constants/releaseNotes";
import {
	compareVersions,
	getReleaseNotes,
	getReleaseNotesBetweenVersions,
	getLatestReleaseNotes,
	isReleaseAutoDisplayEnabled,
	normalizeStoredPluginVersion,
	shouldAutoDisplayReleaseNotesForUpdate,
} from "../../src/utils/releaseNotes";

interface ManifestJson {
	version: string;
}

const releaseNoteSections = [
	["new", "Added"],
	["improved", "Improved"],
	["changed", "Changed"],
	["fixed", "Fixed"],
] as const;

function getReleaseNote(version: string) {
	const releaseNote = RELEASE_NOTES.find((note) => note.version === version);
	if (!releaseNote) {
		throw new Error(`Missing release notes for ${version}`);
	}
	return releaseNote;
}

function readManifestVersion(): string {
	const manifest = JSON.parse(manifestJson) as ManifestJson;
	return manifest.version;
}

function getChangelogEntry(version: string): { date: string; body: string } {
	const lines = changelog.split("\n");
	const headingPrefix = `## [${version}] - `;
	const headingIndex = lines.findIndex((line) => line.startsWith(headingPrefix));

	if (headingIndex === -1) {
		throw new Error(`Missing changelog entry for ${version}`);
	}

	const date = lines[headingIndex].slice(headingPrefix.length);
	const nextHeadingIndex = lines.findIndex(
		(line, index) => index > headingIndex && line.startsWith("## [")
	);
	const bodyEndIndex = nextHeadingIndex === -1 ? lines.length : nextHeadingIndex;

	return {
		date,
		body: lines.slice(headingIndex + 1, bodyEndIndex).join("\n"),
	};
}

describe("releaseNotes", () => {
	it("normalizes stored plugin versions", () => {
		expect(normalizeStoredPluginVersion(" 1.9.0 ")).toBe("1.9.0");
		expect(normalizeStoredPluginVersion("")).toBeNull();
		expect(normalizeStoredPluginVersion(undefined)).toBeNull();
	});

	it("returns release notes for a normalized version", () => {
		for (const releaseNote of RELEASE_NOTES) {
			expect(getReleaseNotes(` ${releaseNote.version} `)).toEqual(releaseNote);
		}

		expect(getReleaseNotes("   ")).toBeNull();
		expect(getReleaseNotes("1.8.0")).toBeNull();
	});

	it("keeps release notes aligned with current release metadata and changelog", () => {
		const currentReleaseNotes = RELEASE_NOTES[0];
		const changelogEntry = getChangelogEntry(currentReleaseNotes.version);

		expect(currentReleaseNotes.version).toBe(readManifestVersion());
		expect(currentReleaseNotes.date).toBe(changelogEntry.date);

		for (const [releaseNoteKey, changelogHeading] of releaseNoteSections) {
			const items = currentReleaseNotes[releaseNoteKey];
			if (!items) {
				continue;
			}

			expect(items.length).toBeGreaterThan(0);
			expect(changelogEntry.body).toContain(`### ${changelogHeading}`);
		}
	});

	it("keeps release notes unique, populated, and sorted newest first", () => {
		const versions = new Set<string>();

		for (const [index, releaseNote] of RELEASE_NOTES.entries()) {
			expect(versions.has(releaseNote.version)).toBe(false);
			versions.add(releaseNote.version);
			expect(releaseNote.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
			expect(
				releaseNoteSections.some(([releaseNoteKey]) => {
					const items = releaseNote[releaseNoteKey];
					return items !== undefined && items.length > 0;
				})
			).toBe(true);

			for (const [releaseNoteKey] of releaseNoteSections) {
				const items = releaseNote[releaseNoteKey];
				if (!items) {
					continue;
				}

				expect(items.every((item) => item.trim().length > 0)).toBe(true);
			}

			const nextReleaseNote = RELEASE_NOTES[index + 1];
			if (nextReleaseNote) {
				expect(
					compareVersions(releaseNote.version, nextReleaseNote.version)
				).toBeGreaterThanOrEqual(0);
			}
		}
	});

	it("returns the latest release notes and upgrade ranges", () => {
		expect(getLatestReleaseNotes(RELEASE_NOTES.length)).toEqual(RELEASE_NOTES);
		expect(getLatestReleaseNotes(1)).toEqual([RELEASE_NOTES[0]]);
		expect(getReleaseNotesBetweenVersions(" 1.9.0-beta.1 ", " 1.9.0 ")).toEqual([
			getReleaseNote("1.9.0"),
			getReleaseNote("1.9.0-beta.1"),
		]);
		expect(getReleaseNotesBetweenVersions("1.9.0-beta.1", "1.9.0")).toEqual([
			getReleaseNote("1.9.0"),
			getReleaseNote("1.9.0-beta.1"),
		]);
		expect(getReleaseNotesBetweenVersions("1.10.0", "1.10.0")).toEqual([getReleaseNote("1.10.0")]);
		expect(getReleaseNotesBetweenVersions("   ", "1.10.0")).toEqual(getLatestReleaseNotes());
		expect(getReleaseNotesBetweenVersions("1.8.0", "1.10.0")).toEqual(getLatestReleaseNotes());
	});

	it("compares versions using semantic version segments", () => {
		expect(compareVersions("1.9.0", "1.8.0")).toBe(1);
		expect(compareVersions("1.8.0", "1.9.0")).toBe(-1);
		expect(compareVersions("1.9", "1.9.0")).toBe(0);
		expect(compareVersions("1.9.0", "1.9")).toBe(0);
		expect(compareVersions("1.9.0", "1.9.0-beta.1")).toBe(1);
		expect(compareVersions("1.9.0-beta.2", "1.9.0-beta.1")).toBe(1);
		expect(compareVersions("1.9.0-beta.1", "1.9.0-beta")).toBe(1);
		expect(compareVersions("1.9.0-beta.1", "1.9.0-beta.2")).toBe(-1);
		expect(compareVersions("1.9.0-beta", "1.9.0-beta.1")).toBe(-1);
		expect(compareVersions("1.9.0-beta.1", "1.9.0-beta.alpha")).toBe(-1);
		expect(compareVersions("1.9.0-beta.alpha", "1.9.0-beta.1")).toBe(1);
		expect(compareVersions("1.9.0-canary.1", "1.9.0-beta.1")).toBe(1);
		expect(compareVersions("1.9.0-alpha.1", "1.9.0-beta.1")).toBe(-1);
		expect(compareVersions("1.9.0-beta.1", "1.9.0-beta.1")).toBe(0);
		expect(compareVersions("1.10.0-beta.1-hotfix.1", "1.10.0-beta.1-hotfix.2")).toBe(-1);
		expect(compareVersions("1.10.0-beta.1-hotfix.1", "1.10.0-beta.1")).toBe(1);
		expect(compareVersions("1.10.0+build.1", "1.10.0+build.2")).toBe(0);
		expect(compareVersions("1.10.0-beta.1+build.1", "1.10.0-beta.1")).toBe(0);
	});

	it("uses per-release auto-display settings and upgrade-path logic", () => {
		for (const releaseNote of RELEASE_NOTES) {
			expect(isReleaseAutoDisplayEnabled(releaseNote.version)).toBe(
				releaseNote.showOnUpdate !== false
			);
		}

		expect(isReleaseAutoDisplayEnabled("0.1.0")).toBe(true);
		expect(
			shouldAutoDisplayReleaseNotesForUpdate(RELEASE_NOTES[1].version, RELEASE_NOTES[0].version)
		).toBe(true);
		expect(shouldAutoDisplayReleaseNotesForUpdate("1.10.3", "1.11.0")).toBe(true);
		expect(shouldAutoDisplayReleaseNotesForUpdate("1.10.2", "1.10.3")).toBe(true);
		expect(shouldAutoDisplayReleaseNotesForUpdate("1.10.1", "1.10.2")).toBe(true);
		expect(shouldAutoDisplayReleaseNotesForUpdate("1.10.0", "1.10.1")).toBe(true);
		expect(shouldAutoDisplayReleaseNotesForUpdate("1.9.0", "1.10.0")).toBe(true);
		expect(shouldAutoDisplayReleaseNotesForUpdate("1.8.0", "1.9.0")).toBe(true);
		expect(shouldAutoDisplayReleaseNotesForUpdate("1.9.0-beta.1", "1.9.0")).toBe(true);
		expect(shouldAutoDisplayReleaseNotesForUpdate(" 1.9.0-beta.1 ", " 1.9.0 ")).toBe(true);
		expect(shouldAutoDisplayReleaseNotesForUpdate("1.10.0", "1.10.0")).toBe(true);
		expect(shouldAutoDisplayReleaseNotesForUpdate("1.10.0", "1.9.0")).toBe(false);
		expect(shouldAutoDisplayReleaseNotesForUpdate("   ", "1.9.0-beta.1")).toBe(false);
		expect(shouldAutoDisplayReleaseNotesForUpdate("1.9.0", "   ")).toBe(true);
		expect(shouldAutoDisplayReleaseNotesForUpdate("2.0.0", "1.9.0-beta.1")).toBe(false);
		expect(shouldAutoDisplayReleaseNotesForUpdate("99.0.0", "100.0.0")).toBe(true);
	});
});
