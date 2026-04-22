export function normalizeFundingUrl(value: unknown): string | undefined {
	if (typeof value !== "string") {
		return undefined;
	}

	const normalizedValue = value.trim();
	if (normalizedValue.length === 0) {
		return undefined;
	}

	try {
		const url = new URL(normalizedValue);
		if (url.protocol !== "http:" && url.protocol !== "https:") {
			return undefined;
		}

		return url.toString();
	} catch {
		return undefined;
	}
}
