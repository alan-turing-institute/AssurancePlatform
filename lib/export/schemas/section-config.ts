/**
 * Zod schemas for section configuration.
 *
 * Sections are the building blocks of report templates.
 * Each section can be enabled/disabled and customised.
 */

import { z } from "zod";

/**
 * Base section configuration - controls whether a section is included
 * and allows title customisation.
 */
const SectionConfigSchema = z
	.object({
		enabled: z
			.boolean()
			.default(true)
			.describe("Whether this section is included in the report"),
		title: z
			.string()
			.optional()
			.describe("Custom title override for the section"),
	})
	.describe("Configuration for a single report section");

/**
 * Diagram section options
 */
const DiagramSectionOptionsSchema = z
	.object({
		includeImage: z
			.boolean()
			.default(true)
			.describe("Whether to include the diagram image"),
		imageFormat: z
			.enum(["png", "svg"])
			.default("png")
			.describe("Format for the diagram image"),
		imageScale: z
			.number()
			.int()
			.min(1)
			.max(3)
			.default(2)
			.describe("Scale factor for PNG images (1x, 2x, or 3x)"),
	})
	.describe("Options specific to the diagram section");

/**
 * Evidence section options
 */
const EvidenceSectionOptionsSchema = z
	.object({
		includeUrls: z
			.boolean()
			.default(true)
			.describe("Whether to include evidence URLs"),
		groupByType: z
			.boolean()
			.default(false)
			.describe("Whether to group evidence by type"),
	})
	.describe("Options specific to the evidence section");

/**
 * Comments section options
 */
const CommentsSectionOptionsSchema = z
	.object({
		includeAuthor: z
			.boolean()
			.default(true)
			.describe("Whether to include comment author names"),
		includeTimestamp: z
			.boolean()
			.default(true)
			.describe("Whether to include comment timestamps"),
	})
	.describe("Options specific to the comments section");

/**
 * Extended section configs with type-specific options
 */
const DiagramSectionConfigSchema = SectionConfigSchema.extend({
	options: DiagramSectionOptionsSchema.optional(),
});

const EvidenceSectionConfigSchema = SectionConfigSchema.extend({
	options: EvidenceSectionOptionsSchema.optional(),
});

const CommentsSectionConfigSchema = SectionConfigSchema.extend({
	options: CommentsSectionOptionsSchema.optional(),
});

/**
 * All sections configuration
 */
export const SectionsConfigSchema = z
	.object({
		titlePage: SectionConfigSchema.optional(),
		tableOfContents: SectionConfigSchema.optional(),
		diagram: DiagramSectionConfigSchema.optional(),
		executiveSummary: SectionConfigSchema.optional(),
		assuranceCaseStructure: SectionConfigSchema.optional(),
		goals: SectionConfigSchema.optional(),
		strategies: SectionConfigSchema.optional(),
		propertyClaims: SectionConfigSchema.optional(),
		evidence: EvidenceSectionConfigSchema.optional(),
		comments: CommentsSectionConfigSchema.optional(),
		metadata: SectionConfigSchema.optional(),
		appendix: SectionConfigSchema.optional(),
	})
	.describe("Configuration for all report sections");

export type SectionsConfig = z.infer<typeof SectionsConfigSchema>;

/**
 * Default section configurations for each preset
 */
export const DEFAULT_SECTIONS_FULL: SectionsConfig = {
	titlePage: { enabled: true },
	tableOfContents: { enabled: true },
	diagram: {
		enabled: true,
		options: { includeImage: true, imageFormat: "png", imageScale: 2 },
	},
	executiveSummary: { enabled: true },
	assuranceCaseStructure: { enabled: true },
	goals: { enabled: false },
	strategies: { enabled: false },
	propertyClaims: { enabled: false },
	evidence: {
		enabled: false,
		options: { includeUrls: true, groupByType: false },
	},
	comments: {
		enabled: true,
		options: { includeAuthor: true, includeTimestamp: true },
	},
	metadata: { enabled: true },
};

export const DEFAULT_SECTIONS_SUMMARY: SectionsConfig = {
	titlePage: { enabled: true },
	tableOfContents: { enabled: false },
	diagram: {
		enabled: true,
		options: { includeImage: true, imageFormat: "png", imageScale: 2 },
	},
	executiveSummary: { enabled: true },
	goals: { enabled: true },
	strategies: { enabled: false },
	propertyClaims: { enabled: false },
	evidence: {
		enabled: true,
		options: { includeUrls: true, groupByType: true },
	},
	comments: { enabled: false },
	metadata: { enabled: false },
};

export const DEFAULT_SECTIONS_EVIDENCE_LIST: SectionsConfig = {
	titlePage: { enabled: true },
	tableOfContents: { enabled: false },
	diagram: { enabled: false },
	executiveSummary: { enabled: false },
	goals: { enabled: false },
	strategies: { enabled: false },
	propertyClaims: { enabled: false },
	evidence: {
		enabled: true,
		title: "Evidence Register",
		options: { includeUrls: true, groupByType: false },
	},
	comments: { enabled: false },
	metadata: { enabled: true },
};
