import { ReleaseNotesEntry } from "../constants/releaseNotes";
import {
	compareVersions,
	getLatestReleaseNotes,
	getReleaseNotesBetweenVersions,
	isReleaseAutoDisplayEnabled,
	normalizeStoredPluginVersion,
	shouldAutoDisplayReleaseNotesForUpdate,
} from "../utils/releaseNotes";

export interface ReleaseNotesCoordinatorOptions {
	manifestVersion: string;
	lastSeenVersion: string | null;
	hasPersistedData: boolean;
	fundingUrl?: string;
	setLastSeenVersion(version: string): void;
	persist(): Promise<void>;
	open(notes: ReleaseNotesEntry[], currentVersion: string, fundingUrl?: string): void;
}

/** Applies update-note policy independently from plugin registration and lifecycle setup. */
export async function coordinateAutomaticReleaseNotes(
	options: ReleaseNotesCoordinatorOptions
): Promise<void> {
	try {
		const currentVersion = normalizeStoredPluginVersion(options.manifestVersion);
		if (!currentVersion) {
			return;
		}

		const markSeen = async (): Promise<void> => {
			options.setLastSeenVersion(currentVersion);
			await options.persist();
		};

		if (!options.hasPersistedData) {
			await markSeen();
			return;
		}

		if (!options.lastSeenVersion) {
			if (!isReleaseAutoDisplayEnabled(currentVersion)) {
				await markSeen();
				return;
			}

			options.open(getLatestReleaseNotes(), currentVersion, options.fundingUrl);
			return;
		}

		if (options.lastSeenVersion === currentVersion) {
			return;
		}

		const versionComparison = compareVersions(currentVersion, options.lastSeenVersion);
		const isUpgrade = versionComparison > 0;
		if (isUpgrade) {
			if (!shouldAutoDisplayReleaseNotesForUpdate(options.lastSeenVersion, currentVersion)) {
				await markSeen();
				return;
			}
		} else if (versionComparison < 0 || !isReleaseAutoDisplayEnabled(currentVersion)) {
			await markSeen();
			return;
		}

		const releaseNotes = isUpgrade
			? getReleaseNotesBetweenVersions(options.lastSeenVersion, currentVersion)
			: getLatestReleaseNotes();
		if (releaseNotes.length === 0) {
			await markSeen();
			return;
		}

		options.open(releaseNotes, currentVersion, options.fundingUrl);
	} catch (error) {
		console.error("Failed to prepare release notes", error);
	}
}
