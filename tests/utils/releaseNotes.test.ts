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

describe("releaseNotes", () => {
	it("normalizes stored plugin versions", () => {
		expect(normalizeStoredPluginVersion(" 1.9.0 ")).toBe("1.9.0");
		expect(normalizeStoredPluginVersion("")).toBeNull();
		expect(normalizeStoredPluginVersion(undefined)).toBeNull();
	});

	it("returns release notes for a normalized version", () => {
		expect(getReleaseNotes(" 1.10.0 ")).toEqual(RELEASE_NOTES[0]);
		expect(getReleaseNotes("1.9.0")).toEqual(RELEASE_NOTES[1]);
		expect(getReleaseNotes("1.9.0-beta.1")).toEqual(RELEASE_NOTES[2]);
		expect(getReleaseNotes("   ")).toBeNull();
		expect(getReleaseNotes("1.8.0")).toBeNull();
	});

	it("tracks the current stable release notes payload", () => {
		const releaseNotes = RELEASE_NOTES[0];
		expect(releaseNotes.version).toBe("1.10.0");
		expect(releaseNotes.date).toBe("2026-04-21");
		expect(releaseNotes.new?.some((item) => item.includes("what's new modal"))).toBe(true);
	});

	it("returns the latest release notes and upgrade ranges", () => {
		expect(getLatestReleaseNotes(RELEASE_NOTES.length)).toEqual(RELEASE_NOTES);
		expect(getLatestReleaseNotes(1)).toEqual([RELEASE_NOTES[0]]);
		expect(getReleaseNotesBetweenVersions(" 1.9.0-beta.1 ", " 1.9.0 ")).toEqual([
			RELEASE_NOTES[1],
			RELEASE_NOTES[2],
		]);
		expect(getReleaseNotesBetweenVersions("1.9.0-beta.1", "1.9.0")).toEqual([
			RELEASE_NOTES[1],
			RELEASE_NOTES[2],
		]);
		expect(getReleaseNotesBetweenVersions("1.10.0", "1.10.0")).toEqual([RELEASE_NOTES[0]]);
		expect(getReleaseNotesBetweenVersions("   ", "1.10.0")).toEqual(
			getLatestReleaseNotes(RELEASE_NOTES.length)
		);
		expect(getReleaseNotesBetweenVersions("1.8.0", "1.10.0")).toEqual(
			getLatestReleaseNotes(RELEASE_NOTES.length)
		);
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
	});

	it("uses per-release auto-display settings and upgrade-path logic", () => {
		expect(isReleaseAutoDisplayEnabled("1.10.0")).toBe(true);
		expect(isReleaseAutoDisplayEnabled("1.9.0")).toBe(true);
		expect(isReleaseAutoDisplayEnabled("1.9.0-beta.1")).toBe(false);
		expect(isReleaseAutoDisplayEnabled("0.1.0")).toBe(true);
		expect(shouldAutoDisplayReleaseNotesForUpdate("1.9.0", "1.10.0")).toBe(true);
		expect(shouldAutoDisplayReleaseNotesForUpdate("1.8.0", "1.9.0")).toBe(true);
		expect(shouldAutoDisplayReleaseNotesForUpdate("1.9.0-beta.1", "1.9.0")).toBe(true);
		expect(shouldAutoDisplayReleaseNotesForUpdate("1.10.0", "1.10.0")).toBe(true);
		expect(shouldAutoDisplayReleaseNotesForUpdate("2.0.0", "1.9.0-beta.1")).toBe(false);
		expect(shouldAutoDisplayReleaseNotesForUpdate("99.0.0", "100.0.0")).toBe(true);
	});
});
