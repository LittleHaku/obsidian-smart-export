import { App, Modal } from "obsidian";
import { ReleaseNotesEntry } from "../constants/releaseNotes";

interface ReleaseNotesModalOptions {
	fundingUrl?: string;
	onClose?: () => void;
	pluginName?: string;
}

export class ReleaseNotesModal extends Modal {
	private okButton: HTMLButtonElement | null = null;
	private focusAnimationFrame: number | null = null;
	private focusAnimationWindow: Window | null = null;

	constructor(
		app: App,
		private readonly releaseNotes: ReleaseNotesEntry[],
		private readonly options: ReleaseNotesModalOptions = {}
	) {
		super(app);
	}

	private renderFormattedText(container: HTMLElement, text: string): void {
		const renderInline = (segment: string, destination: HTMLElement) => {
			const pattern =
				/==([\s\S]*?)==|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|(https?:\/\/[^\s]+)/g;
			let lastIndex = 0;
			let match: RegExpExecArray | null;

			const appendPlainText = (value: string) => {
				if (value.length > 0) {
					destination.appendText(value);
				}
			};

			while ((match = pattern.exec(segment)) !== null) {
				appendPlainText(segment.slice(lastIndex, match.index));

				if (match[1]) {
					const highlight = destination.createSpan({
						cls: "smart-export-whats-new-highlight",
					});
					renderInline(match[1], highlight);
				} else if (match[2] && match[3]) {
					const link = destination.createEl("a", {
						text: match[2],
					});
					link.href = match[3];
					link.target = "_blank";
					link.rel = "noopener noreferrer";
				} else if (match[4]) {
					destination.createEl("strong", {
						text: match[4],
					});
				} else if (match[5]) {
					let url = match[5];
					let trailingPunctuation = "";
					const trailingMatch = url.match(/[.,;:!?)]+$/);
					if (trailingMatch) {
						trailingPunctuation = trailingMatch[0];
						url = url.slice(0, -trailingPunctuation.length);
					}

					const link = destination.createEl("a", {
						text: url,
					});
					link.href = url;
					link.target = "_blank";
					link.rel = "noopener noreferrer";

					if (trailingPunctuation.length > 0) {
						appendPlainText(trailingPunctuation);
					}
				}

				lastIndex = pattern.lastIndex;
			}

			appendPlainText(segment.slice(lastIndex));
		};

		const lines = text.split("\n");
		for (let index = 0; index < lines.length; index += 1) {
			renderInline(lines[index], container);
			if (index < lines.length - 1) {
				container.createEl("br");
			}
		}
	}

	private formatReleaseDate(date: string): string | null {
		const parsedDate = new Date(`${date}T00:00:00`);
		if (Number.isNaN(parsedDate.getTime())) {
			return null;
		}

		return parsedDate.toLocaleDateString(undefined, {
			month: "short",
			day: "numeric",
		});
	}

	onOpen(): void {
		const { contentEl, modalEl, titleEl } = this;
		const pluginName = this.options.pluginName?.trim();

		contentEl.empty();
		modalEl.addClass("smart-export-whats-new-modal");
		titleEl.setText(pluginName ? `What's new in ${pluginName}` : "What's new");

		const scrollContainer = contentEl.createDiv({
			cls: "smart-export-whats-new-scroll",
		});

		for (const note of this.releaseNotes) {
			const versionEl = scrollContainer.createDiv({
				cls: "smart-export-whats-new-version",
			});

			const formattedDate = this.formatReleaseDate(note.date);
			versionEl.createEl("h3", {
				text: formattedDate
					? `Version ${note.version} (${formattedDate})`
					: `Version ${note.version}`,
			});

			if (note.info) {
				const paragraphs = note.info.split(/\n\s*\n/);
				for (const paragraph of paragraphs) {
					const paragraphEl = versionEl.createEl("p", {
						cls: "smart-export-whats-new-info",
					});
					this.renderFormattedText(paragraphEl, paragraph);
				}
			}

			const categories: Array<{
				label: string;
				items: string[] | undefined;
			}> = [
				{ label: "New", items: note.new },
				{ label: "Improved", items: note.improved },
				{ label: "Changed", items: note.changed },
				{ label: "Fixed", items: note.fixed },
			];

			for (const category of categories) {
				if (!category.items || category.items.length === 0) {
					continue;
				}

				versionEl.createEl("h4", {
					cls: "smart-export-whats-new-category",
					text: category.label,
				});

				const listEl = versionEl.createEl("ul", {
					cls: "smart-export-whats-new-features",
				});

				for (const item of category.items) {
					const itemEl = listEl.createEl("li");
					this.renderFormattedText(itemEl, item);
				}
			}
		}

		contentEl.createDiv({
			cls: "smart-export-whats-new-divider",
		});

		const supportContainer = contentEl.createDiv({
			cls: "smart-export-whats-new-support",
		});
		supportContainer.createEl("p", {
			cls: "smart-export-whats-new-support-text",
			text: pluginName
				? `If ${pluginName} is useful in your workflow, you can support development here.`
				: "If this plugin is useful in your workflow, you can support development here.",
		});

		const buttonsEl = contentEl.createDiv({
			cls: "smart-export-whats-new-buttons",
		});

		if (this.options.fundingUrl) {
			const fundingUrl = this.options.fundingUrl;
			const supportLink = buttonsEl.createEl("a", {
				cls: "smart-export-support-button-small mod-cta",
				href: fundingUrl,
				attr: {
					target: "_blank",
					rel: "noopener noreferrer",
				},
			});

			supportLink.createSpan({
				cls: "smart-export-support-button-icon",
				text: "☕",
			});
			supportLink.createSpan({
				cls: "smart-export-support-button-label",
				text: "Buy me a coffee",
			});
		}

		this.okButton = buttonsEl.createEl("button", {
			text: "OK",
			cls: "mod-cta",
			attr: {
				type: "button",
			},
		});
		this.okButton.addEventListener("click", () => {
			this.close();
		});
	}

	open(): void {
		super.open();

		this.cancelFocusAnimation();
		const ownerWindow = this.contentEl.win;
		this.focusAnimationWindow = ownerWindow;
		this.focusAnimationFrame = ownerWindow.requestAnimationFrame(() => {
			this.focusAnimationFrame = null;
			this.focusAnimationWindow = null;
			this.okButton?.focus();
		});
	}

	onClose(): void {
		this.cancelFocusAnimation();
		this.contentEl.empty();
		this.modalEl.removeClass("smart-export-whats-new-modal");
		this.okButton = null;
		this.options.onClose?.();
	}

	private cancelFocusAnimation(): void {
		if (this.focusAnimationFrame !== null && this.focusAnimationWindow !== null) {
			this.focusAnimationWindow.cancelAnimationFrame(this.focusAnimationFrame);
		}
		this.focusAnimationFrame = null;
		this.focusAnimationWindow = null;
	}
}
