import { describe, expect, it } from "vitest";
import {
	buildFolderPrefixes,
	normalizeFolderFilterList,
	normalizeFolderFilterPath,
	pathMatchesFolderPrefixes,
} from "../../src/utils/folderFilters";

describe("folderFilters", () => {
	it("normalizes a folder filter token", () => {
		expect(normalizeFolderFilterPath("  \\Research\\AI/  ")).toBe("Research/AI");
		expect(normalizeFolderFilterPath("  //Research///AI//  ")).toBe("/Research/AI");
		expect(normalizeFolderFilterPath("\u00A0Research\\AI")).toBe("Research/AI");
		expect(normalizeFolderFilterPath(" /res* ")).toBe("/res*");
		expect(normalizeFolderFilterPath("/")).toBe("");
		expect(normalizeFolderFilterPath("   ")).toBe("");
	});

	it("returns an empty list when input is not an array", () => {
		expect(normalizeFolderFilterList(undefined)).toEqual([]);
		expect(normalizeFolderFilterList("Research")).toEqual([]);
	});

	it("normalizes, splits, and deduplicates comma/newline entries", () => {
		const result = normalizeFolderFilterList([
			" templates, assets* , /archive ",
			"attachments*\n/projects/*",
			"templates",
			42,
			"",
		]);

		expect(result).toEqual(["templates", "assets*", "/archive", "attachments*", "/projects/*"]);
	});

	it("matches exact folder prefixes (legacy behavior)", () => {
		const matchers = buildFolderPrefixes(["Archive", "Research/AI"]);
		expect(pathMatchesFolderPrefixes("Archive/Note.md", matchers)).toBe(true);
		expect(pathMatchesFolderPrefixes("Research/AI/Model.md", matchers)).toBe(true);
		expect(pathMatchesFolderPrefixes("Archive.md", matchers)).toBe(false);
		expect(pathMatchesFolderPrefixes("Research/Notes.md", matchers)).toBe(false);
	});

	it("matches wildcard name patterns against any folder segment", () => {
		const matchers = buildFolderPrefixes(["assets*", "*_temp"]);
		expect(pathMatchesFolderPrefixes("media/assets/Note.md", matchers)).toBe(true);
		expect(pathMatchesFolderPrefixes("work/cache_temp/Note.md", matchers)).toBe(true);
		expect(pathMatchesFolderPrefixes("media/asset/Note.md", matchers)).toBe(false);
	});

	it("matches root/path patterns", () => {
		const matchers = buildFolderPrefixes(["/archive", "/res*", "/*/temp", "/projects/*"]);
		expect(pathMatchesFolderPrefixes("archive/Note.md", matchers)).toBe(true);
		expect(pathMatchesFolderPrefixes("research/Note.md", matchers)).toBe(true);
		expect(pathMatchesFolderPrefixes("work/temp/Note.md", matchers)).toBe(true);
		expect(pathMatchesFolderPrefixes("projects/demo/Note.md", matchers)).toBe(true);
		expect(pathMatchesFolderPrefixes("projects/demo/phase1/Note.md", matchers)).toBe(true);

		expect(pathMatchesFolderPrefixes("nested/archive/Note.md", matchers)).toBe(false);
		expect(pathMatchesFolderPrefixes("nested/research/Note.md", matchers)).toBe(false);
		expect(pathMatchesFolderPrefixes("temp/Note.md", matchers)).toBe(false);
		expect(pathMatchesFolderPrefixes("projects/Note.md", matchers)).toBe(false);
	});
});
