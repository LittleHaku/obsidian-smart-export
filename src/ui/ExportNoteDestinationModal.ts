import { App, Modal, Notice, Setting, TFile } from "obsidian";
import { FolderPathSuggest } from "./FolderPathSuggest";
import {
	buildExportNotePath,
	getDefaultExportNoteDestination,
	normalizeExportNoteFolderPath,
	normalizeExportNoteName,
	ExportNoteDestination,
} from "../utils/exportNote";

export class ExportNoteDestinationModal extends Modal {
	private readonly onSubmit: (
		destination: ExportNoteDestination
	) => Promise<boolean | void> | boolean | void;
	private folderPath: string;
	private noteName: string;
	private folderSuggest: FolderPathSuggest | null = null;
	private pathPreviewEl: HTMLElement | null = null;

	constructor(
		app: App,
		rootFile: TFile | null,
		defaultFolderPath: string,
		onSubmit: (destination: ExportNoteDestination) => Promise<boolean | void> | boolean | void,
		sourceName: string = "Smart export"
	) {
		super(app);
		this.onSubmit = onSubmit;

		const defaultDestination = rootFile
			? getDefaultExportNoteDestination(rootFile, defaultFolderPath)
			: {
					folderPath: normalizeExportNoteFolderPath(defaultFolderPath),
					noteName: normalizeExportNoteName(`Smart export - ${sourceName}`),
				};
		this.folderPath = defaultDestination.folderPath;
		this.noteName = defaultDestination.noteName;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.setTitle("Export to new note");

		contentEl.createEl("p", {
			text: "Choose where to create the export note. Folder paths are vault-relative.",
			cls: "smart-export-section-description",
		});

		new Setting(contentEl)
			.setName("Folder")
			.setDesc("Leave empty to create the note in the vault root")
			.addText((text) => {
				text
					.setPlaceholder("Exports")
					.setValue(this.folderPath)
					.onChange((value) => {
						this.folderPath = value;
						this.updatePathPreview();
					});
				this.folderSuggest = new FolderPathSuggest(this.app, text.inputEl);
				return text;
			});

		new Setting(contentEl)
			.setName("Note name")
			.setDesc("Markdown note name without the .md extension")
			.addText((text) => {
				text
					.setPlaceholder("Smart export")
					.setValue(this.noteName)
					.onChange((value) => {
						this.noteName = value;
						this.updatePathPreview();
					});

				text.inputEl.addEventListener("keydown", (event: KeyboardEvent) => {
					if (event.key !== "Enter") {
						return;
					}
					event.preventDefault();
					void this.handleSubmit();
				});

				return text;
			});

		this.pathPreviewEl = contentEl.createDiv({ cls: "smart-export-selected-file" });
		this.updatePathPreview();

		new Setting(contentEl)
			.addButton((button) => {
				button.setButtonText("Cancel").onClick(() => {
					this.close();
				});
			})
			.addButton((button) => {
				button
					.setButtonText("Create note")
					.setCta()
					.onClick(() => {
						void this.handleSubmit();
					});
			});
	}

	onClose(): void {
		this.folderSuggest?.destroy();
		this.folderSuggest = null;
		this.pathPreviewEl = null;
		this.contentEl.empty();
	}

	private getNormalizedDestination(): ExportNoteDestination {
		return {
			folderPath: normalizeExportNoteFolderPath(this.folderPath),
			noteName: normalizeExportNoteName(this.noteName),
		};
	}

	private updatePathPreview(): void {
		if (!this.pathPreviewEl) {
			return;
		}

		const destination = this.getNormalizedDestination();
		this.pathPreviewEl.setText(`Path: ${buildExportNotePath(destination)}`);
	}

	private async handleSubmit(): Promise<void> {
		if (this.noteName.trim().length === 0) {
			new Notice("Please enter a note name.");
			return;
		}

		const destination = this.getNormalizedDestination();
		const submitResult = await this.onSubmit(destination);
		if (submitResult === false) {
			return;
		}

		this.close();
	}
}
