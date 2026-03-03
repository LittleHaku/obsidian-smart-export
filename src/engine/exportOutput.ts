import { LlmMarkdownExporter } from "./LlmMarkdownExporter";
import { PrintFriendlyMarkdownExporter } from "./PrintFriendlyMarkdownExporter";
import { XMLExporter } from "./XMLExporter";
import { ExportNode, SmartExportSettings } from "../types";

const VALID_EXPORT_FORMATS = new Set(["xml", "llm-markdown", "print-friendly-markdown"]);

export type ExportFormat = SmartExportSettings["defaultExportFormat"];

export interface BuildExportOutputOptions {
	rootNode: ExportNode;
	vaultPath: string;
	format: unknown;
	llmMarkdownTemplate?: string | null;
	missingNotesCount?: number;
	onInvalidFormat?: (fallbackFormat: ExportFormat) => void;
}

/**
 * Normalizes persisted/user-provided export format values into a supported format.
 */
export function normalizeExportFormat(value: unknown): ExportFormat {
	if (typeof value === "string" && VALID_EXPORT_FORMATS.has(value)) {
		return value as ExportFormat;
	}
	return "xml";
}

/**
 * Builds export output for a note tree using the selected format with safe XML fallback.
 */
export function buildExportOutput(options: BuildExportOutputOptions): string {
	const missingNotesCount = options.missingNotesCount ?? 0;
	const normalizedFormat = normalizeExportFormat(options.format);
	if (normalizedFormat !== options.format) {
		options.onInvalidFormat?.(normalizedFormat);
	}

	switch (normalizedFormat) {
		case "xml":
			return new XMLExporter().export(options.rootNode, options.vaultPath, missingNotesCount);
		case "llm-markdown":
			return new LlmMarkdownExporter().export(
				options.rootNode,
				options.vaultPath,
				missingNotesCount,
				options.llmMarkdownTemplate ?? undefined
			);
		case "print-friendly-markdown":
			return new PrintFriendlyMarkdownExporter().export(options.rootNode);
		default: {
			const exhaustiveFormat: never = normalizedFormat;
			throw new Error(`Unsupported export format: ${String(exhaustiveFormat)}`);
		}
	}
}
