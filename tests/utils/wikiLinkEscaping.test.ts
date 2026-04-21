import { describe, expect, it } from "vitest";
import { escapeWikiLinkValue } from "../../src/utils/wikiLinkEscaping";

describe("wikiLinkEscaping", () => {
	it("escapes wiki-link control characters", () => {
		expect(escapeWikiLinkValue("Root \\| ] Note")).toBe("Root \\\\\\| \\] Note");
	});
});
