/**
 * Document Export Template System
 *
 * This module provides a comprehensive system for generating reports from
 * assurance cases in multiple formats (PDF, Word, Markdown).
 *
 * ## Architecture
 *
 * The system separates concerns into three layers:
 *
 * 1. **Templates** - Define WHAT content to include and HOW to structure it
 * 2. **Renderers** - Transform case data into format-agnostic content blocks
 * 3. **Exporters** - Convert content blocks to specific output formats
 *
 * ## Usage
 *
 * ```typescript
 * import {
 *   createTemplateFromPreset,
 *   exporterRegistry,
 * } from '@/lib/export';
 *
 * // Create a template from a preset
 * const template = createTemplateFromPreset('full-report', {
 *   organisationName: 'Acme Corp',
 *   primaryColour: '#1e40af',
 * });
 *
 * // Render the template with case data
 * const document = await template.render({
 *   caseData: exportedCase,
 *   diagramImage: { data: base64Png, format: 'png' },
 * });
 *
 * // Export to a specific format
 * const exporter = exporterRegistry.get('pdf');
 * const result = await exporter.export(document, { caseName: 'My Case' });
 * ```
 *
 * ## Available Presets
 *
 * - `full-report` - Comprehensive document with all sections
 * - `summary` - Condensed overview with goals and evidence
 * - `evidence-list` - Focused list of evidence items
 *
 * @module lib/export
 */

// Exporters
export { exporterRegistry } from "./exporters";

// Register exporters with the global registry
import {
	exporterRegistry,
	MarkdownExporter,
	PDFExporter,
	WordExporter,
} from "./exporters";

exporterRegistry.register(new MarkdownExporter());
exporterRegistry.register(new PDFExporter());
exporterRegistry.register(new WordExporter());

// Schemas
export type { BrandingConfig, TemplatePreset } from "./schemas";

// Templates
export { createTemplateFromPreset } from "./templates";
// Core types
export type { DiagramImage, ExportFormat } from "./types";
