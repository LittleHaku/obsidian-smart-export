import { describe, expect, it } from "vitest";
import {
	compilePropertyFilterRules,
	compileTagFilterMatchers,
	frontmatterMatchesPropertyFilterRules,
	normalizeNoteTag,
	normalizePropertyFilterList,
	normalizeTagFilterList,
	tagsMatchFilterMatchers,
} from "../../src/utils/noteFilters";

describe("noteFilters", () => {
	describe("tag filters", () => {
		it("normalizes note tags and tag patterns", () => {
			expect(normalizeNoteTag("  #Research/AI  ")).toBe("research/ai");
			expect(normalizeTagFilterList([" #Draft , projects/*/old ", "#draft", 42])).toEqual([
				"draft",
				"projects/*/old",
			]);
		});

		it("returns an empty tag filter list when input is not an array", () => {
			expect(normalizeTagFilterList(undefined)).toEqual([]);
			expect(normalizeTagFilterList("draft")).toEqual([]);
		});

		it("matches tag-prefix rules (tag and descendants)", () => {
			const matchers = compileTagFilterMatchers(["archive"]);
			expect(tagsMatchFilterMatchers(["archive"], matchers)).toBe(true);
			expect(tagsMatchFilterMatchers(["archive/2026"], matchers)).toBe(true);
			expect(tagsMatchFilterMatchers(["myarchive"], matchers)).toBe(false);
		});

		it("matches descendants-only rules", () => {
			const matchers = compileTagFilterMatchers(["archive/*"]);
			expect(tagsMatchFilterMatchers(["archive"], matchers)).toBe(false);
			expect(tagsMatchFilterMatchers(["archive/2026"], matchers)).toBe(true);
		});

		it("matches wildcard tag patterns", () => {
			const matchers = compileTagFilterMatchers(["arch*", "*draft", "projects/*/old"]);
			expect(tagsMatchFilterMatchers(["archive"], matchers)).toBe(true);
			expect(tagsMatchFilterMatchers(["mydraft"], matchers)).toBe(true);
			expect(tagsMatchFilterMatchers(["projects/client-a/old"], matchers)).toBe(true);
			expect(tagsMatchFilterMatchers(["projects/client-a/old/phase-2"], matchers)).toBe(true);
			expect(tagsMatchFilterMatchers(["projects/client-a/archive"], matchers)).toBe(false);
		});

		it("handles empty tag values and empty matcher sets", () => {
			const matchers = compileTagFilterMatchers(["draft"]);
			expect(tagsMatchFilterMatchers(["#"], matchers)).toBe(false);
			expect(tagsMatchFilterMatchers(["draft"], [])).toBe(false);
			expect(tagsMatchFilterMatchers([], matchers)).toBe(false);
		});
	});

	describe("property rules", () => {
		it("normalizes property rules and deduplicates entries", () => {
			expect(
				normalizePropertyFilterList([
					" status = done , published=true, archived ",
					"status=done",
					" invalid= ",
					"=missing-key",
					42,
				])
			).toEqual(["status=done", "published=true", "archived", "invalid="]);
		});

		it("returns an empty property rule list when input is not an array", () => {
			expect(normalizePropertyFilterList(undefined)).toEqual([]);
			expect(normalizePropertyFilterList("status=done")).toEqual([]);
			expect(compilePropertyFilterRules(undefined)).toEqual([]);
		});

		it("matches key-only property rules", () => {
			const rules = compilePropertyFilterRules(["archived"]);
			expect(frontmatterMatchesPropertyFilterRules({ archived: true }, rules)).toBe(true);
			expect(frontmatterMatchesPropertyFilterRules({ status: "done" }, rules)).toBe(false);
		});

		it("matches key=value rules with normalized comparisons", () => {
			const rules = compilePropertyFilterRules(["status=done", "published=true"]);
			expect(
				frontmatterMatchesPropertyFilterRules({ status: " Done ", published: false }, rules)
			).toBe(true);
			expect(
				frontmatterMatchesPropertyFilterRules({ status: "todo", published: true }, rules)
			).toBe(true);
			expect(frontmatterMatchesPropertyFilterRules({ status: "todo" }, rules)).toBe(false);
		});

		it("matches array values for key=value rules", () => {
			const rules = compilePropertyFilterRules(["tags=personal"]);
			expect(frontmatterMatchesPropertyFilterRules({ tags: ["work", "personal"] }, rules)).toBe(
				true
			);
			expect(frontmatterMatchesPropertyFilterRules({ tags: ["work"] }, rules)).toBe(false);
		});

		it("matches null, undefined, and object values", () => {
			expect(
				frontmatterMatchesPropertyFilterRules(
					{ archivedAt: null },
					compilePropertyFilterRules(["archivedat=null"])
				)
			).toBe(true);
			expect(
				frontmatterMatchesPropertyFilterRules(
					{ legacyFlag: undefined },
					compilePropertyFilterRules(["legacyflag=undefined"])
				)
			).toBe(true);
			expect(
				frontmatterMatchesPropertyFilterRules(
					{ config: { level: 2 } },
					compilePropertyFilterRules(['config={"level":2}'])
				)
			).toBe(true);
		});

		it("returns false when frontmatter or rules are empty", () => {
			const rules = compilePropertyFilterRules(["status=done"]);
			expect(frontmatterMatchesPropertyFilterRules(null, rules)).toBe(false);
			expect(frontmatterMatchesPropertyFilterRules({ status: "done" }, [])).toBe(false);
		});
	});
});
