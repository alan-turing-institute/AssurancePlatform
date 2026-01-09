/**
 * Type-specific validation for AssuranceElement.
 *
 * Defines which fields are valid/required for each element type and provides
 * validation functions for use in Prisma middleware and service layer.
 */

import { z } from "zod";

// ============================================
// ELEMENT TYPE DEFINITIONS
// ============================================

export const ELEMENT_TYPES = [
	"GOAL",
	"STRATEGY",
	"PROPERTY_CLAIM",
	"EVIDENCE",
	"JUSTIFICATION",
	"ASSUMPTION",
	"MODULE",
	"AWAY_GOAL",
	"CONTRACT",
] as const;

export type ElementType = (typeof ELEMENT_TYPES)[number];

// ============================================
// FIELD APPLICABILITY
// ============================================

/**
 * Maps type-specific fields to the element types they apply to.
 * Fields not in this map apply to all element types.
 */
export const FIELD_APPLICABILITY: Record<string, Set<string>> = {
	url: new Set(["EVIDENCE"]),
	urls: new Set(["EVIDENCE"]),
	justification: new Set([
		"GOAL",
		"STRATEGY",
		"PROPERTY_CLAIM",
		"JUSTIFICATION",
	]),
	assumption: new Set([
		"GOAL",
		"STRATEGY",
		"PROPERTY_CLAIM",
		"ASSUMPTION",
		"AWAY_GOAL",
	]),
	context: new Set(["GOAL", "STRATEGY", "PROPERTY_CLAIM"]),
	level: new Set(["PROPERTY_CLAIM"]),
	role: new Set(["GOAL"]),
	moduleReferenceId: new Set(["MODULE", "AWAY_GOAL"]),
	moduleEmbedType: new Set(["MODULE"]),
	modulePublicSummary: new Set(["MODULE"]),
};

/**
 * Element types that are "attribute-like" - they attach to other elements
 * but cannot have children of their own.
 */
export const ATTRIBUTE_ELEMENT_TYPES = new Set(["JUSTIFICATION", "ASSUMPTION"]);

/**
 * Fields that require non-null values for specific element types.
 */
export const REQUIRED_FIELDS: Record<string, Set<string>> = {
	moduleReferenceId: new Set(["MODULE", "AWAY_GOAL"]),
	moduleEmbedType: new Set(["MODULE"]),
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Checks if a field applies to a given element type.
 *
 * @param field - The field name to check
 * @param elementType - The element type
 * @returns true if the field is applicable to this element type
 */
export function fieldAppliesTo(field: string, elementType: string): boolean {
	// Dialogical reasoning fields apply to all types
	if (field === "defeatsElementId" || field === "isDefeater") {
		return true;
	}

	// Check if field is in the applicability map
	const applicableTypes = FIELD_APPLICABILITY[field];
	if (!applicableTypes) {
		// Field not in map - assume it applies to all types (base fields)
		return true;
	}

	return applicableTypes.has(elementType);
}

/**
 * Checks if a field is required for a given element type.
 *
 * @param field - The field name to check
 * @param elementType - The element type
 * @returns true if the field is required for this element type
 */
export function fieldRequiredFor(field: string, elementType: string): boolean {
	const requiredTypes = REQUIRED_FIELDS[field];
	if (!requiredTypes) {
		return false;
	}
	return requiredTypes.has(elementType);
}

/**
 * Checks if an element type is "attribute-like" (cannot have children).
 */
export function isAttributeType(elementType: string): boolean {
	return ATTRIBUTE_ELEMENT_TYPES.has(elementType);
}

// ============================================
// VALIDATION TYPES
// ============================================

export type ValidationResult =
	| { valid: true }
	| { valid: false; errors: string[] };

// ============================================
// ZOD SCHEMAS
// ============================================

const ElementRoleSchema = z.enum(["TOP_LEVEL", "SUPPORTING"]);
const ModuleEmbedTypeSchema = z.enum(["COPY", "REFERENCE"]);

/**
 * Base fields common to all element types.
 */
const BaseElementSchema = z.object({
	name: z.string().nullable().optional(),
	description: z.string(),
	inSandbox: z.boolean().default(false),
	fromPattern: z.boolean().default(false),
	modifiedFromPattern: z.boolean().default(false),
	// Dialogical reasoning - available to all types
	isDefeater: z.boolean().default(false),
	defeatsElementId: z.string().uuid().nullable().optional(),
});

/**
 * Type-specific schemas using discriminated union.
 */
const GoalSchema = BaseElementSchema.extend({
	elementType: z.literal("GOAL"),
	role: ElementRoleSchema.nullable().optional(),
	assumption: z.string().nullable().optional(),
	justification: z.string().nullable().optional(),
	context: z.array(z.string()).optional(),
});

const StrategySchema = BaseElementSchema.extend({
	elementType: z.literal("STRATEGY"),
	assumption: z.string().nullable().optional(),
	justification: z.string().nullable().optional(),
	context: z.array(z.string()).optional(),
});

const PropertyClaimSchema = BaseElementSchema.extend({
	elementType: z.literal("PROPERTY_CLAIM"),
	assumption: z.string().nullable().optional(),
	justification: z.string().nullable().optional(),
	level: z.number().int().min(1).nullable().optional(),
	context: z.array(z.string()).optional(),
});

const EvidenceSchema = BaseElementSchema.extend({
	elementType: z.literal("EVIDENCE"),
	url: z.string().nullable().optional(),
	urls: z
		.array(
			z.string().refine(
				(val) => {
					if (!val) {
						return true;
					}
					try {
						const parsed = new URL(val);
						return parsed.protocol === "http:" || parsed.protocol === "https:";
					} catch {
						return false;
					}
				},
				{ message: "Must be a valid http or https URL" }
			)
		)
		.default([]),
});

const JustificationSchema = BaseElementSchema.extend({
	elementType: z.literal("JUSTIFICATION"),
	justification: z.string().nullable().optional(),
});

const AssumptionSchema = BaseElementSchema.extend({
	elementType: z.literal("ASSUMPTION"),
	assumption: z.string().nullable().optional(),
});

const ModuleSchema = BaseElementSchema.extend({
	elementType: z.literal("MODULE"),
	moduleReferenceId: z.string().uuid(),
	moduleEmbedType: ModuleEmbedTypeSchema,
	modulePublicSummary: z.string().nullable().optional(),
});

const AwayGoalSchema = BaseElementSchema.extend({
	elementType: z.literal("AWAY_GOAL"),
	assumption: z.string().nullable().optional(),
	moduleReferenceId: z.string().uuid(),
});

const ContractSchema = BaseElementSchema.extend({
	elementType: z.literal("CONTRACT"),
});

/**
 * Discriminated union of all element type schemas.
 */
export const ElementValidationSchema = z.discriminatedUnion("elementType", [
	GoalSchema,
	StrategySchema,
	PropertyClaimSchema,
	EvidenceSchema,
	JustificationSchema,
	AssumptionSchema,
	ModuleSchema,
	AwayGoalSchema,
	ContractSchema,
]);

// ============================================
// VALIDATION FUNCTIONS
// ============================================

/**
 * Validates element data against the type-specific schema.
 *
 * @param elementType - The element type
 * @param data - The data to validate
 * @returns Validation result with errors if invalid
 */
export function validateElementData(
	elementType: string,
	data: Record<string, unknown>
): ValidationResult {
	// Ensure elementType is in the data for discriminated union
	const dataWithType = { ...data, elementType };

	const result = ElementValidationSchema.safeParse(dataWithType);

	if (result.success) {
		return { valid: true };
	}

	return {
		valid: false,
		errors: result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
	};
}

/**
 * Cleans element data by removing fields that don't apply to the element type.
 * Returns a new object with only applicable fields.
 *
 * @param elementType - The element type
 * @param data - The data to clean
 * @returns Cleaned data with only applicable fields
 */
export function cleanElementDataForType(
	elementType: string,
	data: Record<string, unknown>
): Record<string, unknown> {
	const cleaned: Record<string, unknown> = {};

	// Type-specific fields that may need to be removed
	const typeSpecificFields = [
		"url",
		"urls",
		"justification",
		"assumption",
		"context",
		"level",
		"role",
		"moduleReferenceId",
		"moduleEmbedType",
		"modulePublicSummary",
	];

	for (const [key, value] of Object.entries(data)) {
		// Skip undefined values
		if (value === undefined) {
			continue;
		}

		// For type-specific fields, only include if applicable
		if (typeSpecificFields.includes(key)) {
			if (fieldAppliesTo(key, elementType)) {
				cleaned[key] = value;
			}
			// Skip field if not applicable (don't include in cleaned data)
		} else {
			// Include all other fields
			cleaned[key] = value;
		}
	}

	return cleaned;
}

/**
 * Gets the list of fields that are valid for a given element type.
 *
 * @param elementType - The element type
 * @returns Array of field names that are valid for this type
 */
export function getValidFieldsForType(elementType: string): string[] {
	const baseFields = [
		"id",
		"caseId",
		"elementType",
		"parentId",
		"name",
		"description",
		"inSandbox",
		"fromPattern",
		"modifiedFromPattern",
		"isDefeater",
		"defeatsElementId",
		"createdAt",
		"updatedAt",
		"createdById",
	];

	const typeSpecificFields: string[] = [];

	for (const [field, types] of Object.entries(FIELD_APPLICABILITY)) {
		if (types.has(elementType)) {
			typeSpecificFields.push(field);
		}
	}

	return [...baseFields, ...typeSpecificFields];
}
