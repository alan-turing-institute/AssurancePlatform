import { z } from "zod";
import { coercePositiveInt, optionalString, requiredString } from "./base";

/**
 * Parse assurance case IDs from JSON array or comma-separated string
 */
const assuranceCaseIdsSchema = z
	.string()
	.optional()
	.nullable()
	.transform((val): string[] => {
		if (!val) {
			return [];
		}
		try {
			const parsed = JSON.parse(val);
			if (Array.isArray(parsed)) {
				return parsed.filter((id): id is string => typeof id === "string");
			}
		} catch {
			// Not JSON, try comma-separated
		}
		return val
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
	});

/**
 * Case study ID parameter (for single ID validation)
 */
export const caseStudyIdSchema = coercePositiveInt;

/**
 * Create case study input schema
 */
export const createCaseStudySchema = z.object({
	title: requiredString("Title", 1, 255),
	description: optionalString(5000),
	authors: optionalString(255),
	category: optionalString(100),
	sector: optionalString(100),
	contact: optionalString(254),
	type: optionalString(100),
	published: z
		.string()
		.optional()
		.nullable()
		.transform((v) => v === "true"),
	assurance_cases: assuranceCaseIdsSchema,
});

export type CreateCaseStudyInput = z.input<typeof createCaseStudySchema>;
export type CreateCaseStudyData = z.output<typeof createCaseStudySchema>;

/**
 * Update case study input schema (all fields optional except id)
 */
export const updateCaseStudySchema = z
	.object({
		id: coercePositiveInt,
		title: requiredString("Title", 1, 255).optional(),
		description: optionalString(5000),
		authors: optionalString(255),
		category: optionalString(100),
		sector: optionalString(100),
		contact: optionalString(254),
		type: optionalString(100),
		published: z
			.string()
			.optional()
			.nullable()
			.transform((v) => (v === null ? undefined : v === "true")),
		assurance_cases: assuranceCaseIdsSchema.optional(),
	})
	.refine(
		(data) => {
			const { id: _id, ...rest } = data;
			return Object.values(rest).some((v) => v !== undefined);
		},
		{ message: "At least one field to update must be provided" }
	);

export type UpdateCaseStudyInput = z.input<typeof updateCaseStudySchema>;
export type UpdateCaseStudyData = z.output<typeof updateCaseStudySchema>;
