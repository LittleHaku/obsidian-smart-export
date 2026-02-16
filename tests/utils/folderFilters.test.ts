import { describe, expect, it } from "vitest";
import {
	buildFolderPrefixes,
	normalizeFolderFilterList,
	normalizeFolderFilterPath,
	pathMatchesFolderPrefixes,
} from "../../src/utils/folderFilters";

describe("folderFilters", () => {
	it("normalizes a folder path", () => {
		expect(normalizeFolderFilterPath("  \\Research\\AI/  ")).toBe("Research/AI");
		expect(normalizeFolderFilterPath("  //Research///AI//  ")).toBe("Research/AI");
		expect(normalizeFolderFilterPath("\u00A0Research\\AI")).toBe("Research/AI");
		expect(normalizeFolderFilterPath("   ")).toBe("");
	});

	it("returns an empty list when input is not an array", () => {
		expect(normalizeFolderFilterList(undefined)).toEqual([]);
		expect(normalizeFolderFilterList("Research")).toEqual([]);
	});

	it("normalizes, filters, and deduplicates folder values", () => {
		const result = normalizeFolderFilterList([
			" Research ",
			"/Research/",
			"\\Research\\AI\\",
			42,
			"",
			"  ",
		]);

		expect(result).toEqual(["Research", "Research/AI"]);
	});

	it("builds canonical folder prefixes", () => {
		expect(buildFolderPrefixes(undefined)).toEqual([]);
		expect(buildFolderPrefixes([" Research ", "Research"])).toEqual(["Research/"]);
		expect(buildFolderPrefixes(["Archive/Sub"])).toEqual(["Archive/Sub/"]);
	});

	it("matches paths against folder prefixes", () => {
		const prefixes = ["Archive/", "Research/AI/"];
		expect(pathMatchesFolderPrefixes("Archive/Note.md", prefixes)).toBe(true);
		expect(pathMatchesFolderPrefixes("Research/AI/Model.md", prefixes)).toBe(true);
		expect(pathMatchesFolderPrefixes("Archive.md", prefixes)).toBe(false);
		expect(pathMatchesFolderPrefixes("Research/Notes.md", prefixes)).toBe(false);
	});
});
