import { App, TFile, TFolder, normalizePath } from "obsidian";

const EXPORT_NOTE_PREFIX = "Smart export";
const MARKDOWN_EXTENSION = ".md";
const INVALID_FILE_NAME_CHARS_REGEX = /[\\/:*?"<>|]/g;
const COLLAPSE_WHITESPACE_REGEX = /\s+/g;

export interface ExportNoteDestination {
	folderPath: string;
	noteName: string;
}

export interface CreateExportNoteOptions {
	openAfterCreate?: boolean;
}

function getParentFolderPath(filePath: string): string {
	const lastSlashIndex = filePath.lastIndexOf("/");
	return lastSlashIndex >= 0 ? filePath.slice(0, lastSlashIndex) : "";
}

function trimMarkdownExtension(noteName: string): string {
	return noteName.trim().replace(/\.md$/i, "");
}

export function sanitizeExportNoteTitleSegment(title: string): string {
	const sanitizedTitle = title
		.replace(INVALID_FILE_NAME_CHARS_REGEX, " ")
		.replace(COLLAPSE_WHITESPACE_REGEX, " ")
		.trim();

	return sanitizedTitle.length > 0 ? sanitizedTitle : "Untitled";
}

export function normalizeExportNoteFolderPath(folderPath: string): string {
	const trimmedFolderPath = folderPath.trim();
	return trimmedFolderPath.length > 0 ? normalizePath(trimmedFolderPath) : "";
}

export function normalizeExportNoteName(noteName: string): string {
	return sanitizeExportNoteTitleSegment(trimMarkdownExtension(noteName));
}

export function buildDefaultExportNoteName(rootNoteTitle: string): string {
	return `${EXPORT_NOTE_PREFIX} - ${sanitizeExportNoteTitleSegment(rootNoteTitle)}`;
}

export function getDefaultExportNoteDestination(rootFile: TFile): ExportNoteDestination {
	return {
		folderPath: getParentFolderPath(rootFile.path),
		noteName: buildDefaultExportNoteName(rootFile.basename),
	};
}

export function buildExportNotePath(destination: ExportNoteDestination): string {
	const folderPath = normalizeExportNoteFolderPath(destination.folderPath);
	const noteName = normalizeExportNoteName(destination.noteName);
	const fileName = `${noteName}${MARKDOWN_EXTENSION}`;

	return folderPath.length > 0
		? normalizePath(`${folderPath}/${fileName}`)
		: normalizePath(fileName);
}

async function ensureFolderExists(app: App, folderPath: string): Promise<void> {
	if (folderPath.length === 0) {
		return;
	}

	const normalizedFolderPath = normalizeExportNoteFolderPath(folderPath);
	if (normalizedFolderPath.length === 0) {
		return;
	}

	const segments = normalizedFolderPath.split("/");
	let currentPath = "";

	for (const segment of segments) {
		currentPath = currentPath.length > 0 ? `${currentPath}/${segment}` : segment;
		const existingEntry = app.vault.getAbstractFileByPath(currentPath);
		if (existingEntry instanceof TFolder) {
			continue;
		}
		if (existingEntry) {
			throw new Error(
				`Cannot create export folder because "${currentPath}" already exists as a file.`
			);
		}
		await app.vault.createFolder(currentPath);
	}
}

export async function createExportNote(
	app: App,
	content: string,
	destination: ExportNoteDestination,
	options: CreateExportNoteOptions = {}
): Promise<TFile> {
	const exportNotePath = buildExportNotePath(destination);
	await ensureFolderExists(app, destination.folderPath);

	const existingEntry = app.vault.getAbstractFileByPath(exportNotePath);
	if (existingEntry) {
		throw new Error(`An export note already exists at "${exportNotePath}".`);
	}

	const createdFile = await app.vault.create(exportNotePath, content);

	if (options.openAfterCreate !== false) {
		await app.workspace.getLeaf(true).openFile(createdFile);
	}

	return createdFile;
}
