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
export {
	AbstractExporter,
	type Exporter,
	ExporterRegistry,
	exporterRegistry,
	MarkdownExporter,
	PDFDocumentComponent,
	type PDFDocumentProps,
	PDFExporter,
	renderBlock,
} from "./exporters";

// Register exporters with the global registry
import { exporterRegistry, MarkdownExporter, PDFExporter } from "./exporters";

exporterRegistry.register(new MarkdownExporter());
exporterRegistry.register(new PDFExporter());

// Schemas
export {
	type BrandingConfig,
	BrandingConfigSchema,
	type CommentsSectionConfig,
	CommentsSectionConfigSchema,
	type CommentsSectionOptions,
	CommentsSectionOptionsSchema,
	DEFAULT_BRANDING,
	DEFAULT_SECTIONS_EVIDENCE_LIST,
	DEFAULT_SECTIONS_FULL,
	DEFAULT_SECTIONS_SUMMARY,
	type DiagramSectionConfig,
	DiagramSectionConfigSchema,
	type DiagramSectionOptions,
	DiagramSectionOptionsSchema,
	type ElementFilter,
	ElementFilterSchema,
	type EvidenceSectionConfig,
	EvidenceSectionConfigSchema,
	type EvidenceSectionOptions,
	EvidenceSectionOptionsSchema,
	resolveBranding,
	type SectionConfig,
	SectionConfigSchema,
	type SectionsConfig,
	SectionsConfigSchema,
	type TemplateConfig,
	TemplateConfigSchema,
	type TemplatePreset,
	TemplatePresetSchema,
	validateTemplateConfig,
} from "./schemas";

// Templates
export {
	BaseTemplate,
	collectAllComments,
	collectElementsByType,
	countElementsByType,
	createTemplateFromPreset,
	EVIDENCE_LIST_CONFIG,
	EvidenceListTemplate,
	FULL_REPORT_CONFIG,
	FullReportTemplate,
	getAvailablePresets,
	getTotalElementCount,
	getTreeDepth,
	type RenderedElement,
	renderElementAsBlocks,
	renderHierarchicalTree,
	renderTreeAsBlocks,
	SUMMARY_CONFIG,
	SummaryTemplate,
	shouldIncludeElement,
	type TreeRenderOptions,
} from "./templates";
// Core types
export {
	type ContentBlock,
	type DiagramImage,
	type DividerBlock,
	type DocumentMetadata,
	ELEMENT_TYPE_LABELS,
	type ElementBlock,
	type ExportFormat,
	type ExportOptions,
	type ExportResult,
	type HeadingBlock,
	type ImageBlock,
	type ListBlock,
	type MetadataBlock,
	type ParagraphBlock,
	type RenderedDocument,
	type RenderedSection,
	type ResolvedBranding,
	type SectionType,
	type TableBlock,
	type TemplateInput,
} from "./types";

// Utilities
export {
	calculateTreeDepth,
	escapeMarkdown,
	flattenText,
	flattenTree,
	formatDate,
	formatDateTime,
	getDateString,
	getElementTitle,
	getElementTypeLabel,
	getISODateString,
	sanitiseForFilename,
	stripHtml,
	truncateText,
} from "./utils";
