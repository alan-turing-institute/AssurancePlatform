/**
 * Zod schemas for template configuration.
 *
 * Templates define the structure and content of exported documents.
 * This schema supports built-in presets and future user-defined templates.
 */

import { z } from "zod";
import { ElementTypeSchema } from "@/lib/schemas/case-export";
import { SectionsConfigSchema } from "./section-config";

/**
 * Element filtering options to control which elements are included
 */
export const ElementFilterSchema = z
	.object({
		includeTypes: z
			.array(ElementTypeSchema)
			.optional()
			.describe("Element types to include (default: all)"),
		excludeTypes: z
			.array(ElementTypeSchema)
			.optional()
			.describe("Element types to exclude"),
		includeSandbox: z
			.boolean()
			.optional()
			.describe("Whether to include sandbox/draft elements (default: false)"),
		maxDepth: z
			.number()
			.int()
			.positive()
			.optional()
			.describe("Maximum tree depth to include (1 = root only)"),
	})
	.describe("Filtering options for which elements to include");

export type ElementFilter = z.infer<typeof ElementFilterSchema>;

/**
 * Template preset identifiers
 */
export const TemplatePresetSchema = z.enum([
	"full-report",
	"summary",
	"evidence-list",
]);

export type TemplatePreset = z.infer<typeof TemplatePresetSchema>;

/**
 * Full template configuration schema
 */
export const TemplateConfigSchema = z
	.object({
		name: z
			.string()
			.min(1, "Template name is required")
			.describe("Human-readable template name"),
		description: z
			.string()
			.optional()
			.describe("Description of what this template produces"),
		preset: TemplatePresetSchema.optional().describe(
			"Built-in preset identifier (for preset templates)"
		),
		format: z
			.enum(["pdf", "docx", "markdown"])
			.optional()
			.describe("Target format (can be set at export time)"),
		sections: SectionsConfigSchema.describe(
			"Configuration for report sections"
		),
		elementFilter: ElementFilterSchema.optional().describe(
			"Global element filtering options"
		),
	})
	.describe("Complete template configuration");

export type TemplateConfig = z.infer<typeof TemplateConfigSchema>;

/**
 * Validate a template configuration
 */
export function validateTemplateConfig(
	config: unknown
):
	| { success: true; data: TemplateConfig }
	| { success: false; errors: string[] } {
	const result = TemplateConfigSchema.safeParse(config);
	if (result.success) {
		return { success: true, data: result.data };
	}
	return {
		success: false,
		errors: result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
	};
}
