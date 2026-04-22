import { describe, expect, it } from "vitest";
import { normalizeFundingUrl } from "../../src/utils/fundingUrl";

describe("fundingUrl", () => {
	it("returns normalized http and https URLs", () => {
		expect(normalizeFundingUrl(" https://buymeacoffee.com/example ")).toBe(
			"https://buymeacoffee.com/example"
		);
		expect(normalizeFundingUrl("http://example.com/support")).toBe("http://example.com/support");
	});

	it("rejects empty and malformed values", () => {
		expect(normalizeFundingUrl("   ")).toBeUndefined();
		expect(normalizeFundingUrl("not-a-url")).toBeUndefined();
		expect(normalizeFundingUrl(undefined)).toBeUndefined();
	});

	it("rejects non-http protocols", () => {
		expect(normalizeFundingUrl("javascript:alert('xss')")).toBeUndefined();
		expect(normalizeFundingUrl("data:text/html,<script>alert(1)</script>")).toBeUndefined();
		expect(normalizeFundingUrl("file:///tmp/local.html")).toBeUndefined();
	});
});
