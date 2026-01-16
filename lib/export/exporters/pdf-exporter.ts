/**
 * PDF exporter for document generation.
 *
 * Uses @react-pdf/renderer to convert RenderedDocument structures
 * into professionally styled PDF documents.
 */

import { pdf } from "@react-pdf/renderer";
import type { ExportOptions, ExportResult, RenderedDocument } from "../types";
import type { Exporter } from "./base-exporter";
import { PDFDocumentComponent } from "./pdf-components";

/**
 * Exporter that converts RenderedDocument to PDF format.
 *
 * Features:
 * - Professional styling with branding support
 * - Title page with logo and metadata
 * - Consistent heading hierarchy
 * - Tables, lists, and structured content
 * - Page numbers and footer text
 *
 * Note: This exporter implements the Exporter interface directly rather than
 * extending AbstractExporter, as PDF rendering uses React components rather
 * than the string-based renderSection/renderBlock pattern.
 */
export class PDFExporter implements Exporter {
	readonly format = "pdf" as const;
	readonly mimeType = "application/pdf";
	readonly fileExtension = "pdf";

	/**
	 * Export a rendered document to PDF format.
	 *
	 * Uses the browser-compatible pdf().toBlob() API from @react-pdf/renderer.
	 */
	async export(
		document: RenderedDocument,
		options: ExportOptions
	): Promise<ExportResult> {
		try {
			// Render the PDF document to a blob using browser-compatible API
			const blob = await pdf(PDFDocumentComponent({ document })).toBlob();

			return {
				success: true,
				blob,
				filename: this.generateFilename(options.caseName, options.timestamp),
				mimeType: this.mimeType,
			};
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Unknown error occurred";
			return {
				success: false,
				error: `PDF export failed: ${message}`,
			};
		}
	}

	/**
	 * Generate a filename for the export.
	 */
	private generateFilename(caseName: string, timestamp?: Date): string {
		const sanitised = caseName
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/(^-|-$)/g, "");

		const dateStr = (timestamp ?? new Date()).toISOString().split("T")[0];
		return `${sanitised}-${dateStr}.${this.fileExtension}`;
	}
}
