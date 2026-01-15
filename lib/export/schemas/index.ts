/**
 * Schema exports for the document export template system.
 */

export {
	type BrandingConfig,
	BrandingConfigSchema,
	DEFAULT_BRANDING,
	resolveBranding,
} from "./branding-config";
export {
	type CommentsSectionConfig,
	CommentsSectionConfigSchema,
	type CommentsSectionOptions,
	CommentsSectionOptionsSchema,
	DEFAULT_SECTIONS_EVIDENCE_LIST,
	DEFAULT_SECTIONS_FULL,
	DEFAULT_SECTIONS_SUMMARY,
	type DiagramSectionConfig,
	DiagramSectionConfigSchema,
	type DiagramSectionOptions,
	DiagramSectionOptionsSchema,
	type EvidenceSectionConfig,
	EvidenceSectionConfigSchema,
	type EvidenceSectionOptions,
	EvidenceSectionOptionsSchema,
	type SectionConfig,
	SectionConfigSchema,
	type SectionsConfig,
	SectionsConfigSchema,
} from "./section-config";

export {
	type ElementFilter,
	ElementFilterSchema,
	type TemplateConfig,
	TemplateConfigSchema,
	type TemplatePreset,
	TemplatePresetSchema,
	validateTemplateConfig,
} from "./template-config";
