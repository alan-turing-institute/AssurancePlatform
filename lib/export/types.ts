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
export type HeadingBlock = {
	type: "heading";
	level: 1 | 2 | 3 | 4 | 5 | 6;
	text: string;
};

/**
 * Paragraph content block
 */
export type ParagraphBlock = {
	type: "paragraph";
	text: string;
};

/**
 * List content block (ordered or unordered)
 */
export type ListBlock = {
	type: "list";
	ordered: boolean;
	items: string[];
};

/**
 * Table content block
 */
export type TableBlock = {
	type: "table";
	headers: string[];
	rows: string[][];
};

/**
 * Image content block
 */
export type ImageBlock = {
	type: "image";
	src: string;
	alt: string;
	caption?: string;
};

/**
 * Divider/horizontal rule content block
 */
export type DividerBlock = {
	type: "divider";
};

/**
 * Metadata key-value content block
 */
export type MetadataBlock = {
	type: "metadata";
	key: string;
	value: string;
};

/**
 * Element content block - renders a TreeNode element
 */
export type ElementBlock = {
	type: "element";
	node: TreeNode;
	depth: number;
};

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
export type RenderedSection = {
	type: SectionType;
	title: string;
	blocks: ContentBlock[];
};

/**
 * Document metadata included in exports
 */
export type DocumentMetadata = {
	caseName: string;
	caseDescription: string;
	exportedAt: string;
	exportedBy?: string;
	version: string;
	elementCount: number;
	format: ExportFormat;
};

/**
 * Resolved branding with defaults applied
 */
export type ResolvedBranding = {
	primaryColour: string;
	secondaryColour: string;
	logoUrl?: string;
	logoBase64?: string;
	organisationName?: string;
	footerText: string;
	fontFamily: string;
};

/**
 * Complete rendered document ready for export
 */
export type RenderedDocument = {
	metadata: DocumentMetadata;
	branding: ResolvedBranding;
	sections: RenderedSection[];
};

/**
 * Diagram image data for embedding in exports
 */
export type DiagramImage = {
	data: string;
	format: "png" | "svg";
};

/**
 * Section overrides to enable/disable specific sections
 */
export type SectionOverrides = Record<string, boolean>;

/**
 * Input for template rendering
 */
export type TemplateInput = {
	caseData: import("@/lib/schemas/case-export").CaseExportNested;
	diagramImage?: DiagramImage;
	exportedBy?: string;
	sectionOverrides?: SectionOverrides;
};

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
export type ExportOptions = {
	caseName: string;
	timestamp?: Date;
};

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
