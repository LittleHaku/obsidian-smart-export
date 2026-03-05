export interface TagFilterMatcher {
	pattern: string;
	regex: RegExp;
}

export interface PropertyFilterRule {
	raw: string;
	key: string;
	expectedValue: string | null;
}

function escapeRegex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function splitFilterEntry(value: string): string[] {
	return value
		.split(/[,\n]/)
		.map((token) => token.trim())
		.filter((token) => token.length > 0);
}

function normalizeSharedToken(token: string): string {
	return token
		.replace(/\u00A0/g, " ")
		.normalize()
		.trim()
		.toLowerCase()
		.replace(/[\\/]+/g, "/")
		.replace(/^\/+/, "")
		.replace(/\/+$/, "");
}

function normalizeTagToken(token: string): string {
	return normalizeSharedToken(token).replace(/^#+/, "");
}

function compileTagPattern(pattern: string): RegExp {
	if (pattern.endsWith("/*") && !pattern.slice(0, -2).includes("*")) {
		const escapedBase = escapeRegex(pattern.slice(0, -2));
		return new RegExp(`^${escapedBase}/.+$`);
	}

	if (!pattern.includes("*")) {
		const escapedPrefix = escapeRegex(pattern);
		return new RegExp(`^${escapedPrefix}(?:/|$)`);
	}

	const wildcardRegex = pattern
		.split("*")
		.map((part) => escapeRegex(part))
		.join("[^/]*");
	return new RegExp(`^${wildcardRegex}(?:/|$)`);
}

function normalizePropertyKey(key: string): string {
	return normalizeSharedToken(key);
}

function normalizePropertyValue(value: string): string {
	return normalizeSharedToken(value);
}

function normalizePropertyRuleToken(token: string): string {
	const trimmed = token
		.replace(/\u00A0/g, " ")
		.normalize()
		.trim();

	const equalIndex = trimmed.indexOf("=");
	if (equalIndex < 0) {
		return normalizePropertyKey(trimmed);
	}

	const key = normalizePropertyKey(trimmed.slice(0, equalIndex));
	if (!key) {
		return "";
	}
	const value = normalizePropertyValue(trimmed.slice(equalIndex + 1));
	return `${key}=${value}`;
}

function normalizeComparableValue(value: unknown): string {
	if (typeof value === "string") {
		return normalizePropertyValue(value);
	}
	if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
		return String(value).toLowerCase();
	}
	if (value === null) {
		return "null";
	}
	if (value === undefined) {
		return "undefined";
	}
	return normalizePropertyValue(JSON.stringify(value));
}

function findFrontmatterValue(
	frontmatter: Record<string, unknown>,
	key: string
): { found: boolean; value: unknown } {
	for (const [frontmatterKey, frontmatterValue] of Object.entries(frontmatter)) {
		if (normalizePropertyKey(frontmatterKey) === key) {
			return {
				found: true,
				value: frontmatterValue,
			};
		}
	}
	return {
		found: false,
		value: undefined,
	};
}

function valueMatchesExpected(frontmatterValue: unknown, expectedValue: string): boolean {
	if (Array.isArray(frontmatterValue)) {
		return frontmatterValue.some((value) => normalizeComparableValue(value) === expectedValue);
	}

	return normalizeComparableValue(frontmatterValue) === expectedValue;
}

/**
 * Normalizes a raw note tag or pattern:
 * - trims whitespace
 * - removes leading "#"
 * - lowercases
 * - normalizes slash separators
 */
export function normalizeNoteTag(value: string): string {
	return normalizeTagToken(value);
}

/**
 * Parses arbitrary persisted values into normalized, deduplicated tag patterns.
 * Supports comma and newline separators for compatibility with setting inputs.
 */
export function normalizeTagFilterList(values: unknown): string[] {
	if (!Array.isArray(values)) {
		return [];
	}

	const normalized: string[] = [];
	const seen = new Set<string>();
	for (const value of values) {
		if (typeof value !== "string") continue;
		for (const token of splitFilterEntry(value)) {
			const normalizedValue = normalizeTagToken(token);
			if (!normalizedValue || seen.has(normalizedValue)) continue;
			seen.add(normalizedValue);
			normalized.push(normalizedValue);
		}
	}

	return normalized;
}

/**
 * Compiles normalized tag patterns into regex matchers.
 */
export function compileTagFilterMatchers(patterns: string[] | undefined): TagFilterMatcher[] {
	if (!patterns || patterns.length === 0) {
		return [];
	}

	return normalizeTagFilterList(patterns).map((pattern) => ({
		pattern,
		regex: compileTagPattern(pattern),
	}));
}

/**
 * Checks whether any tag matches any compiled tag pattern.
 */
export function tagsMatchFilterMatchers(tags: string[], matchers: TagFilterMatcher[]): boolean {
	if (tags.length === 0 || matchers.length === 0) {
		return false;
	}

	return tags.some((tag) => {
		const normalizedTag = normalizeTagToken(tag);
		if (!normalizedTag) {
			return false;
		}
		return matchers.some((matcher) => matcher.regex.test(normalizedTag));
	});
}

/**
 * Parses arbitrary persisted values into normalized, deduplicated property rules.
 * Rule format:
 * - `key` (property exists)
 * - `key=value` (exact normalized value)
 */
export function normalizePropertyFilterList(values: unknown): string[] {
	if (!Array.isArray(values)) {
		return [];
	}

	const normalized: string[] = [];
	const seen = new Set<string>();
	for (const value of values) {
		if (typeof value !== "string") continue;
		for (const token of splitFilterEntry(value)) {
			const normalizedValue = normalizePropertyRuleToken(token);
			if (!normalizedValue || seen.has(normalizedValue)) continue;
			seen.add(normalizedValue);
			normalized.push(normalizedValue);
		}
	}

	return normalized;
}

/**
 * Compiles normalized property rules for frontmatter matching.
 */
export function compilePropertyFilterRules(rules: string[] | undefined): PropertyFilterRule[] {
	if (!rules || rules.length === 0) {
		return [];
	}

	return normalizePropertyFilterList(rules).map((raw) => {
		const equalIndex = raw.indexOf("=");
		if (equalIndex < 0) {
			return {
				raw,
				key: raw,
				expectedValue: null,
			};
		}

		return {
			raw,
			key: raw.slice(0, equalIndex),
			expectedValue: raw.slice(equalIndex + 1),
		};
	});
}

/**
 * Checks whether note frontmatter matches any compiled property rule.
 */
export function frontmatterMatchesPropertyFilterRules(
	frontmatter: Record<string, unknown> | null | undefined,
	rules: PropertyFilterRule[]
): boolean {
	if (!frontmatter || rules.length === 0) {
		return false;
	}

	return rules.some((rule) => {
		const frontmatterValue = findFrontmatterValue(frontmatter, rule.key);
		if (!frontmatterValue.found) {
			return false;
		}
		if (rule.expectedValue === null) {
			return true;
		}
		return valueMatchesExpected(frontmatterValue.value, rule.expectedValue);
	});
}
