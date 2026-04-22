import { ReleaseNotesEntry, RELEASE_NOTES } from "../constants/releaseNotes";

export function normalizeStoredPluginVersion(value: unknown): string | null {
	if (typeof value !== "string") {
		return null;
	}

	const normalized = value.trim();
	return normalized.length > 0 ? normalized : null;
}

export function getLatestReleaseNotes(count = 5): ReleaseNotesEntry[] {
	return RELEASE_NOTES.slice(0, count);
}

export function getReleaseNotes(version: string): ReleaseNotesEntry | null {
	const normalizedVersion = normalizeStoredPluginVersion(version);
	if (!normalizedVersion) {
		return null;
	}

	return RELEASE_NOTES.find((note) => note.version === normalizedVersion) ?? null;
}

export function getReleaseNotesBetweenVersions(
	fromVersion: string,
	toVersion: string
): ReleaseNotesEntry[] {
	const normalizedFromVersion = normalizeStoredPluginVersion(fromVersion);
	const normalizedToVersion = normalizeStoredPluginVersion(toVersion);

	if (!normalizedFromVersion || !normalizedToVersion) {
		return getLatestReleaseNotes();
	}

	const fromIndex = RELEASE_NOTES.findIndex((note) => note.version === normalizedFromVersion);
	const toIndex = RELEASE_NOTES.findIndex((note) => note.version === normalizedToVersion);

	if (fromIndex === -1 || toIndex === -1) {
		return getLatestReleaseNotes();
	}

	const startIndex = Math.min(fromIndex, toIndex);
	const endIndex = Math.max(fromIndex, toIndex);

	// Intentionally inclusive of both endpoints.
	// The update modal is designed as a grouped recap window, modeled after
	// Notebook Navigator's behavior, so it may repeat the previously seen
	// release alongside newly crossed versions in the same modal.
	return RELEASE_NOTES.slice(startIndex, endIndex + 1);
}

export function compareVersions(firstVersion: string, secondVersion: string): number {
	const parseVersion = (version: string) => {
		// Ignore build metadata and preserve the full prerelease suffix after
		// the first hyphen so semver-like variants keep all identifiers.
		const versionWithoutBuildMetadata = version.split("+", 1)[0];
		const prereleaseSeparatorIndex = versionWithoutBuildMetadata.indexOf("-");
		const corePart =
			prereleaseSeparatorIndex === -1
				? versionWithoutBuildMetadata
				: versionWithoutBuildMetadata.slice(0, prereleaseSeparatorIndex);
		const prereleasePart =
			prereleaseSeparatorIndex === -1
				? ""
				: versionWithoutBuildMetadata.slice(prereleaseSeparatorIndex + 1);
		const core = corePart.split(".").map((part) => Number.parseInt(part, 10) || 0);
		const prerelease = prereleasePart ? prereleasePart.split(".") : [];
		return { core, prerelease };
	};

	const first = parseVersion(firstVersion);
	const second = parseVersion(secondVersion);

	for (let index = 0; index < Math.max(first.core.length, second.core.length); index += 1) {
		const firstPart = first.core[index] ?? 0;
		const secondPart = second.core[index] ?? 0;

		if (firstPart > secondPart) {
			return 1;
		}
		if (firstPart < secondPart) {
			return -1;
		}
	}

	if (first.prerelease.length === 0 && second.prerelease.length === 0) {
		return 0;
	}
	if (first.prerelease.length === 0) {
		return 1;
	}
	if (second.prerelease.length === 0) {
		return -1;
	}

	for (
		let index = 0;
		index < Math.max(first.prerelease.length, second.prerelease.length);
		index += 1
	) {
		const firstPart = first.prerelease[index];
		const secondPart = second.prerelease[index];

		if (firstPart === undefined) {
			return -1;
		}
		if (secondPart === undefined) {
			return 1;
		}

		const firstNumber = Number.parseInt(firstPart, 10);
		const secondNumber = Number.parseInt(secondPart, 10);
		const firstIsNumber = String(firstNumber) === firstPart;
		const secondIsNumber = String(secondNumber) === secondPart;

		if (firstIsNumber && secondIsNumber) {
			if (firstNumber > secondNumber) {
				return 1;
			}
			if (firstNumber < secondNumber) {
				return -1;
			}
			continue;
		}

		if (firstIsNumber !== secondIsNumber) {
			return firstIsNumber ? -1 : 1;
		}

		if (firstPart > secondPart) {
			return 1;
		}
		if (firstPart < secondPart) {
			return -1;
		}
	}

	return 0;
}

export function isReleaseAutoDisplayEnabled(version: string): boolean {
	const normalizedVersion = normalizeStoredPluginVersion(version);
	const note = RELEASE_NOTES.find((entry) => entry.version === normalizedVersion);

	if (!note) {
		return true;
	}

	return note.showOnUpdate !== false;
}

export function shouldAutoDisplayReleaseNotesForUpdate(
	fromVersion: string,
	toVersion: string
): boolean {
	const normalizedFromVersion = normalizeStoredPluginVersion(fromVersion);
	const normalizedToVersion = normalizeStoredPluginVersion(toVersion);

	if (!normalizedToVersion) {
		return true;
	}

	if (!normalizedFromVersion) {
		return isReleaseAutoDisplayEnabled(normalizedToVersion);
	}

	const versionComparison = compareVersions(normalizedToVersion, normalizedFromVersion);
	if (versionComparison < 0) {
		return false;
	}

	if (versionComparison === 0) {
		return isReleaseAutoDisplayEnabled(normalizedToVersion);
	}

	const notesInUpgradePath = RELEASE_NOTES.filter(
		(note) =>
			compareVersions(note.version, normalizedFromVersion) > 0 &&
			compareVersions(note.version, normalizedToVersion) <= 0
	);

	if (notesInUpgradePath.length === 0) {
		return isReleaseAutoDisplayEnabled(normalizedToVersion);
	}

	return notesInUpgradePath.some((note) => note.showOnUpdate !== false);
}
