import { z } from "zod";
import { optionalString } from "./base";

/**
 * Element type enum — accepts various frontend formats
 */
const elementTypeSchema = z
	.string()
	.min(1, "Element type is required")
	.describe("Element type (e.g. goal, strategy, property, evidence)");

/**
 * Optional parent reference — accepts UUID string or legacy numeric ID
 */
const parentRefSchema = z
	.union([z.string(), z.number()])
	.nullable()
	.optional()
	.transform((v) => (v != null ? String(v) : v));

/**
 * Optional array parent reference — handles evidence's array format
 */
const arrayParentRefSchema = z
	.union([z.string(), z.number(), z.array(z.union([z.string(), z.number()]))])
	.nullable()
	.optional();

/**
 * Create element input schema
 */
export const createElementSchema = z.object({
	// Type (required)
	type: elementTypeSchema.optional(),
	elementType: elementTypeSchema.optional(),

	// Names/descriptions
	name: optionalString(500),
	description: optionalString(5000),
	short_description: optionalString(5000),
	long_description: optionalString(10_000),

	// Parent references
	parentId: z.string().nullable().optional(),
	goal_id: parentRefSchema,
	strategy_id: parentRefSchema,
	property_claim_id: arrayParentRefSchema,
	assurance_case_id: z.union([z.string(), z.number()]).optional(),

	// Evidence-specific
	url: optionalString(2000),
	URL: optionalString(2000),
	urls: z.array(z.string().url()).optional(),

	// GSN-specific
	assumption: optionalString(5000),
	justification: optionalString(5000),
	context: z.array(z.string()).optional(),
});

export type CreateElementSchemaInput = z.input<typeof createElementSchema>;

/**
 * Update element input schema
 */
export const updateElementSchema = z.object({
	// Names/descriptions (camelCase and snake_case accepted)
	name: optionalString(500),
	description: optionalString(5000),
	short_description: optionalString(5000),
	long_description: optionalString(10_000),
	shortDescription: optionalString(5000),
	longDescription: optionalString(10_000),

	// Parent references
	parentId: z.string().nullable().optional(),
	goal_id: parentRefSchema,
	strategy_id: parentRefSchema,
	property_claim_id: arrayParentRefSchema,

	// Evidence-specific
	url: optionalString(2000),
	URL: optionalString(2000),
	urls: z.array(z.string().url()).optional(),

	// GSN-specific
	assumption: optionalString(5000),
	justification: optionalString(5000),
	context: z.array(z.string()).optional(),

	// Sandbox flag (camelCase and snake_case)
	inSandbox: z.boolean().optional(),
	in_sandbox: z.boolean().optional(),
});

export type UpdateElementSchemaInput = z.input<typeof updateElementSchema>;
