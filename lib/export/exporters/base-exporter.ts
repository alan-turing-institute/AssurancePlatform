/**
 * Base exporter interface and abstract class for document generation.
 *
 * Exporters convert RenderedDocument structures to specific output formats
 * (PDF, Word, Markdown). Each exporter implements format-specific rendering.
 */

import type {
	ContentBlock,
	ExportFormat,
	ExportOptions,
	ExportResult,
	RenderedDocument,
	RenderedSection,
} from "../types";

/**
 * Base exporter type - all format exporters must implement this
 */
export type Exporter = {
	/**
	 * The format this exporter handles
	 */
	readonly format: ExportFormat;

	/**
	 * MIME type for the output
	 */
	readonly mimeType: string;

	/**
	 * File extension for the output (without dot)
	 */
	readonly fileExtension: string;

	/**
	 * Export a rendered document to the target format
	 *
	 * @param document - The format-agnostic rendered document
	 * @param options - Export options including case name for filename
	 * @returns Export result with blob/content or error
	 */
	export(
		document: RenderedDocument,
		options: ExportOptions
	): Promise<ExportResult>;
};

/**
 * Abstract base class providing common exporter functionality
 *
 * Subclasses implement the abstract methods for format-specific rendering.
 */
export abstract class AbstractExporter implements Exporter {
	abstract readonly format: ExportFormat;
	abstract readonly mimeType: string;
	abstract readonly fileExtension: string;

	/**
	 * Export a rendered document to the target format
	 */
	abstract export(
		document: RenderedDocument,
		options: ExportOptions
	): Promise<ExportResult>;

	/**
	 * Render a section to format-specific output
	 *
	 * Subclasses should override this for section-level rendering.
	 */
	protected abstract renderSection(section: RenderedSection): unknown;

	/**
	 * Render a content block to format-specific output
	 *
	 * Subclasses should override this for block-level rendering.
	 */
	protected abstract renderBlock(block: ContentBlock): unknown;

	/**
	 * Generate a filename for the export
	 *
	 * Creates a sanitised filename with the case name and date.
	 *
	 * @param caseName - Name of the case being exported
	 * @param timestamp - Export timestamp (defaults to now)
	 * @returns Filename with appropriate extension
	 */
	protected generateFilename(
		caseName: string,
		timestamp: Date = new Date()
	): string {
		const sanitised = caseName
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/(^-|-$)/g, "");

		const dateStr = timestamp.toISOString().split("T")[0];
		return `${sanitised}-${dateStr}.${this.fileExtension}`;
	}

	/**
	 * Create a success result with a Blob
	 */
	protected successBlob(
		blob: Blob,
		caseName: string,
		timestamp?: Date
	): ExportResult {
		return {
			success: true,
			blob,
			filename: this.generateFilename(caseName, timestamp),
			mimeType: this.mimeType,
		};
	}

	/**
	 * Create a success result with string content (for text formats like Markdown)
	 */
	protected successContent(
		content: string,
		caseName: string,
		timestamp?: Date
	): ExportResult {
		return {
			success: true,
			content,
			filename: this.generateFilename(caseName, timestamp),
			mimeType: this.mimeType,
		};
	}

	/**
	 * Create a failure result
	 */
	protected failure(error: string): ExportResult {
		return {
			success: false,
			error,
		};
	}
}

/**
 * Exporter registry for managing available exporters
 */
export class ExporterRegistry {
	private readonly exporters = new Map<ExportFormat, Exporter>();

	/**
	 * Register an exporter for a format
	 */
	register(exporter: Exporter): void {
		this.exporters.set(exporter.format, exporter);
	}

	/**
	 * Get an exporter for a format
	 */
	get(format: ExportFormat): Exporter | undefined {
		return this.exporters.get(format);
	}

	/**
	 * Check if an exporter is registered for a format
	 */
	has(format: ExportFormat): boolean {
		return this.exporters.has(format);
	}

	/**
	 * Get all registered formats
	 */
	getFormats(): ExportFormat[] {
		return Array.from(this.exporters.keys());
	}
}

/**
 * Global exporter registry instance
 *
 * Exporters should register themselves when imported:
 * ```typescript
 * import { exporterRegistry } from './base-exporter';
 * exporterRegistry.register(new PDFExporter());
 * ```
 */
export const exporterRegistry = new ExporterRegistry();
