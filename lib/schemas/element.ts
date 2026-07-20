import { z } from "zod";
import { lenientUrlSchema, optionalString, optionalUrlSchema } from "./base";
import { AssertionStatusSchema } from "./case-export";

/**
 * Per-assertion status on create/update input (ADR 0004 D3). Author-writable
 * via the standard element mutation path only — element-service.ts rejects
 * this field when the acting principal is a machine/integration system user.
 */
const assertionStatusInputSchema = AssertionStatusSchema.nullable().optional();

/**
 * Element type enum — accepts various frontend formats
 */
const elementTypeSchema = z
	.string()
	.min(1, "Element type is required")
	.describe("Element type (e.g. goal, strategy, property, evidence)");

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

	// Parent reference
	parentId: z.string().nullable().optional(),

	// Evidence-specific
	url: optionalUrlSchema,
	URL: optionalUrlSchema,
	urls: z.array(lenientUrlSchema).optional(),

	// GSN-specific
	assumption: optionalString(5000),
	justification: optionalString(5000),
	context: z.array(z.string()).optional(),

	// Per-assertion status (ADR 0004 D3)
	assertionStatus: assertionStatusInputSchema,
	// Element-level citation (ADR 0004 D5) — AWAY_GOAL only; applicability,
	// existence, and self-citation are enforced in element-service.ts.
	citedElementId: z.string().uuid().nullable().optional(),
	// Module reference — MODULE and AWAY_GOAL only; required for both on
	// create (mirrors the batch path's AwayGoalSchema/ModuleSchema in
	// lib/schemas/element-validation.ts). Only shape is validated here;
	// applicability, requiredness, and existence are enforced in
	// element-service.ts, matching the citedElementId pattern above.
	moduleReferenceId: z.string().uuid().nullable().optional(),
});

export type CreateElementSchemaInput = z.input<typeof createElementSchema>;
export type CreateElementSchemaOutput = z.output<typeof createElementSchema>;

/**
 * Update element input schema
 */
export const updateElementSchema = z.object({
	// Names/descriptions
	name: optionalString(500),
	description: optionalString(5000),
	shortDescription: optionalString(5000),
	longDescription: optionalString(10_000),

	// Parent reference
	parentId: z.string().nullable().optional(),

	// Evidence-specific
	url: optionalUrlSchema,
	URL: optionalUrlSchema,
	urls: z.array(lenientUrlSchema).optional(),

	// GSN-specific
	assumption: optionalString(5000),
	justification: optionalString(5000),
	context: z.array(z.string()).optional(),

	// Per-assertion status (ADR 0004 D3)
	assertionStatus: assertionStatusInputSchema,
	// Element-level citation (ADR 0004 D5) — AWAY_GOAL only; applicability,
	// existence, and self-citation are enforced in element-service.ts.
	citedElementId: z.string().uuid().nullable().optional(),
	// Module reference — MODULE and AWAY_GOAL only. No requiredness check on
	// update (mirrors the batch update path, case-batch-update-service.ts,
	// which allows changing/clearing it without a required-field guard);
	// applicability and existence are still enforced in element-service.ts.
	moduleReferenceId: z.string().uuid().nullable().optional(),

	// Sandbox flag
	inSandbox: z.boolean().optional(),
});

export type UpdateElementSchemaInput = z.input<typeof updateElementSchema>;
export type UpdateElementSchemaOutput = z.output<typeof updateElementSchema>;

/**
 * Move element input schema
 */
export const moveElementSchema = z.object({
	parentId: z.string().uuid("Invalid parent ID format"),
});

export type MoveElementSchemaInput = z.input<typeof moveElementSchema>;
export type MoveElementSchemaOutput = z.output<typeof moveElementSchema>;

/**
 * Attach element input schema
 */
export const attachElementSchema = z.object({
	parentId: z.string().uuid("Invalid parent ID format"),
});

export type AttachElementSchemaInput = z.input<typeof attachElementSchema>;
export type AttachElementSchemaOutput = z.output<typeof attachElementSchema>;

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
