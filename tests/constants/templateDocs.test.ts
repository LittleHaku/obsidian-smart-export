import { describe, expect, it } from "vitest";
import { TEMPLATE_DOCS_URL } from "../../src/constants/templateDocs";

describe("templateDocs constants", () => {
	it("exports the canonical template docs URL", () => {
		expect(TEMPLATE_DOCS_URL).toBe(
			"https://github.com/LittleHaku/obsidian-smart-export/blob/main/templates/README.md"
		);
	});
});
