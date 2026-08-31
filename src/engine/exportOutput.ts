import { LlmMarkdownExporter } from "./LlmMarkdownExporter";
import { MermaidExporter } from "./MermaidExporter";
import { PrintFriendlyMarkdownExporter } from "./PrintFriendlyMarkdownExporter";
import { XMLExporter } from "./XMLExporter";
import {
	ContentRedactionOptions,
	ExportFormat,
	ExportNode,
	PrintFriendlyMarkdownOptions,
} from "../types";
import { redactExportTreeContent } from "../utils/contentRedaction";

const VALID_EXPORT_FORMATS = new Set(["xml", "llm-markdown", "print-friendly-markdown", "mermaid"]);

export interface BuildExportOutputOptions {
	rootNode: ExportNode;
	vaultPath: string;
	format: unknown;
	llmMarkdownTemplate?: string | null;
	printFriendlyMarkdownOptions?: PrintFriendlyMarkdownOptions | null;
	contentRedactionOptions?: ContentRedactionOptions | null;
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
	const rootNode = redactExportTreeContent(options.rootNode, options.contentRedactionOptions);
	if (normalizedFormat !== options.format) {
		options.onInvalidFormat?.(normalizedFormat);
	}

	// Record<ExportFormat, ...> keeps dispatch exhaustive at compile time.
	const exporters: Record<ExportFormat, () => string> = {
		xml: () => new XMLExporter().export(rootNode, options.vaultPath, missingNotesCount),
		"llm-markdown": () =>
			new LlmMarkdownExporter().export(
				rootNode,
				options.vaultPath,
				missingNotesCount,
				options.llmMarkdownTemplate ?? undefined
			),
		"print-friendly-markdown": () =>
			new PrintFriendlyMarkdownExporter().export(
				rootNode,
				options.printFriendlyMarkdownOptions ?? undefined
			),
		mermaid: () => new MermaidExporter().export(rootNode),
	};

	return exporters[normalizedFormat]();
}
