/**
 * Core type definitions for the document export template system.
 *
 * These types define format-agnostic structures that templates produce
 * and exporters consume. The separation allows templates to focus on
 * content/structure while exporters handle format-specific rendering.
 */

import type { ElementType, TreeNode } from "@/lib/schemas/case-export";

/**
 * Supported export formats
 */
export type ExportFormat = "pdf" | "docx" | "markdown";

/**
 * Section types that can appear in a report
 */
export type SectionType =
	| "title-page"
	| "table-of-contents"
	| "diagram"
	| "executive-summary"
	| "assurance-case-structure"
	| "goals"
	| "strategies"
	| "property-claims"
	| "evidence"
	| "comments"
	| "metadata"
	| "appendix";

/**
 * Heading content block
 */
export interface HeadingBlock {
	level: 1 | 2 | 3 | 4 | 5 | 6;
	text: string;
	type: "heading";
}

/**
 * Paragraph content block
 */
export interface ParagraphBlock {
	text: string;
	type: "paragraph";
}

/**
 * List content block (ordered or unordered)
 */
export interface ListBlock {
	items: string[];
	ordered: boolean;
	type: "list";
}

/**
 * Table content block
 */
export interface TableBlock {
	headers: string[];
	rows: string[][];
	type: "table";
}

/**
 * Image content block
 */
export interface ImageBlock {
	alt: string;
	caption?: string;
	src: string;
	type: "image";
}

/**
 * Divider/horizontal rule content block
 */
export interface DividerBlock {
	type: "divider";
}

/**
 * Metadata key-value content block
 */
export interface MetadataBlock {
	key: string;
	type: "metadata";
	value: string;
}

/**
 * Element content block - renders a TreeNode element
 */
export interface ElementBlock {
	depth: number;
	node: TreeNode;
	type: "element";
}

/**
 * Union of all content block types
 */
export type ContentBlock =
	| HeadingBlock
	| ParagraphBlock
	| ListBlock
	| TableBlock
	| ImageBlock
	| DividerBlock
	| MetadataBlock
	| ElementBlock;

/**
 * Rendered section - contains multiple content blocks
 */
export interface RenderedSection {
	blocks: ContentBlock[];
	title: string;
	type: SectionType;
}

/**
 * Document metadata included in exports
 */
export interface DocumentMetadata {
	caseDescription: string;
	caseName: string;
	elementCount: number;
	exportedAt: string;
	exportedBy?: string;
	format: ExportFormat;
	version: string;
}

/**
 * Resolved branding with defaults applied
 */
export interface ResolvedBranding {
	fontFamily: string;
	footerText: string;
	logoBase64?: string;
	logoUrl?: string;
	organisationName?: string;
	primaryColour: string;
	secondaryColour: string;
}

/**
 * Complete rendered document ready for export
 */
export interface RenderedDocument {
	branding: ResolvedBranding;
	metadata: DocumentMetadata;
	sections: RenderedSection[];
}

/**
 * Diagram image data for embedding in exports
 */
export interface DiagramImage {
	data: string;
	format: "png" | "svg";
}

/**
 * Diagram image with a label, used for per-branch multi-page exports
 */
export type LabelledDiagramImage = DiagramImage & {
	title: string;
};

/**
 * Section overrides to enable/disable specific sections
 */
export type SectionOverrides = Record<string, boolean>;

/**
 * Input for template rendering
 */
export interface TemplateInput {
	branchDiagrams?: LabelledDiagramImage[];
	caseData: import("@/lib/schemas/case-export").CaseExportNested;
	diagramImage?: DiagramImage;
	exportedBy?: string;
	sectionOverrides?: SectionOverrides;
}

/**
 * Export result - either success with blob/string or failure with error
 */
export type ExportResult =
	| { success: true; blob: Blob; filename: string; mimeType: string }
	| { success: true; content: string; filename: string; mimeType: string }
	| { success: false; error: string };

/**
 * Export options passed to exporters
 */
export interface ExportOptions {
	caseName: string;
	timestamp?: Date;
}

/**
 * Element type labels for human-readable output
 */
export const ELEMENT_TYPE_LABELS: Record<ElementType, string> = {
	GOAL: "Goal",
	CONTEXT: "Context",
	STRATEGY: "Strategy",
	PROPERTY_CLAIM: "Property Claim",
	EVIDENCE: "Evidence",
	JUSTIFICATION: "Justification",
	ASSUMPTION: "Assumption",
	MODULE: "Module",
	AWAY_GOAL: "Away Goal",
	CONTRACT: "Contract",
};
