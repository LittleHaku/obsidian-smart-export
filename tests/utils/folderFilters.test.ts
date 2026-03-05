import { describe, expect, it } from "vitest";
import {
	compileFolderFilterMatchers,
	normalizeFolderFilterList,
	normalizeFolderFilterPath,
	pathMatchesFolderFilterMatchers,
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
		const matchers = compileFolderFilterMatchers(["Archive", "Research/AI"]);
		expect(pathMatchesFolderFilterMatchers("Archive/Note.md", matchers)).toBe(true);
		expect(pathMatchesFolderFilterMatchers("Research/AI/Model.md", matchers)).toBe(true);
		expect(pathMatchesFolderFilterMatchers("Archive.md", matchers)).toBe(false);
		expect(pathMatchesFolderFilterMatchers("Research/Notes.md", matchers)).toBe(false);
	});

	it("matches wildcard name patterns against any folder segment", () => {
		const matchers = compileFolderFilterMatchers(["assets*", "*_temp"]);
		expect(pathMatchesFolderFilterMatchers("media/assets/Note.md", matchers)).toBe(true);
		expect(pathMatchesFolderFilterMatchers("work/cache_temp/Note.md", matchers)).toBe(true);
		expect(pathMatchesFolderFilterMatchers("media/asset/Note.md", matchers)).toBe(false);
	});

	it("matches root/path patterns", () => {
		const matchers = compileFolderFilterMatchers(["/archive", "/res*", "/*/temp", "/projects/*"]);
		expect(pathMatchesFolderFilterMatchers("archive/Note.md", matchers)).toBe(true);
		expect(pathMatchesFolderFilterMatchers("research/Note.md", matchers)).toBe(true);
		expect(pathMatchesFolderFilterMatchers("work/temp/Note.md", matchers)).toBe(true);
		expect(pathMatchesFolderFilterMatchers("projects/demo/Note.md", matchers)).toBe(true);
		expect(pathMatchesFolderFilterMatchers("projects/demo/phase1/Note.md", matchers)).toBe(true);

		expect(pathMatchesFolderFilterMatchers("nested/archive/Note.md", matchers)).toBe(false);
		expect(pathMatchesFolderFilterMatchers("nested/research/Note.md", matchers)).toBe(false);
		expect(pathMatchesFolderFilterMatchers("temp/Note.md", matchers)).toBe(false);
		expect(pathMatchesFolderFilterMatchers("projects/Note.md", matchers)).toBe(false);
	});
});
