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
export type CreateElementSchemaOutput = z.output<typeof createElementSchema>;

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
export type UpdateElementSchemaOutput = z.output<typeof updateElementSchema>;

// ============================================
// Element Form Schemas (used by UI components)
// ============================================

/**
 * Description field schema — used across create/edit forms
 */
export const elementDescriptionFormSchema = z.object({
	description: z.string().min(2, {
		message: "Description must be at least 2 characters",
	}),
});

export type ElementDescriptionFormInput = z.input<
	typeof elementDescriptionFormSchema
>;
export type ElementDescriptionFormOutput = z.output<
	typeof elementDescriptionFormSchema
>;

/**
 * Attributes schema — assumption, justification, context (goal/strategy/property only)
 */
export const elementAttributesFormSchema = z.object({
	assumption: z.string().optional(),
	justification: z.string().optional(),
	context: z.array(z.string()).optional(),
});

export type ElementAttributesFormInput = z.input<
	typeof elementAttributesFormSchema
>;
export type ElementAttributesFormOutput = z.output<
	typeof elementAttributesFormSchema
>;

/**
 * URLs field array schema — used in evidence edit/create forms
 */
export const elementUrlsFormSchema = z.object({
	urls: z.array(z.object({ value: z.string() })),
});

export type ElementUrlsFormInput = z.input<typeof elementUrlsFormSchema>;
export type ElementUrlsFormOutput = z.output<typeof elementUrlsFormSchema>;

/**
 * Combined node edit form schema — description + attributes + urls
 * Used by NodeEditDialog and EditForm components
 */
export const nodeEditFormSchema = z.object({
	description: z.string().min(2, {
		message: "Description must be at least 2 characters",
	}),
	assumption: z.string().optional(),
	justification: z.string().optional(),
	context: z.array(z.string()).optional(),
	urls: z.array(z.object({ value: z.string() })),
});

export type NodeEditFormInput = z.input<typeof nodeEditFormSchema>;
export type NodeEditFormOutput = z.output<typeof nodeEditFormSchema>;
