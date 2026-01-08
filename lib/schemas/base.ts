import { z } from "zod";

// ============================================
// String Primitives
// ============================================

/**
 * Valid email address
 */
export const emailSchema = z
	.string()
	.min(1, "Email is required")
	.email("Please enter a valid email address")
	.max(254, "Email must be less than 254 characters")
	.transform((v) => v.toLowerCase().trim());

/**
 * UUID v4 format
 */
export const uuidSchema = z.string().uuid("Invalid ID format");

/**
 * Non-empty trimmed string
 */
export const requiredString = (
	fieldName: string,
	minLength = 1,
	maxLength = 500
) =>
	z
		.string()
		.min(minLength, `${fieldName} is required`)
		.max(maxLength, `${fieldName} must be less than ${maxLength} characters`)
		.transform((v) => v.trim());

/**
 * Optional trimmed string (empty string becomes undefined, null becomes undefined)
 */
export const optionalString = (maxLength = 2000) =>
	z
		.string()
		.max(maxLength, `Must be less than ${maxLength} characters`)
		.optional()
		.nullable()
		.transform((v) => (v?.trim() ? v.trim() : undefined));

// ============================================
// Number Primitives
// ============================================

/**
 * Positive integer ID
 */
export const positiveIntSchema = z
	.number()
	.int("Must be a whole number")
	.positive("Must be a positive number");

/**
 * Coerce string to positive integer (for query params and FormData)
 */
export const coercePositiveInt = z.coerce
	.number()
	.int("Must be a whole number")
	.positive("Must be a positive number");

// ============================================
// Boolean Primitives
// ============================================

/**
 * Coerce string to boolean (for FormData where "true"/"false" are strings)
 */
export const coerceBoolean = z
	.string()
	.optional()
	.nullable()
	.transform((v) => v === "true");

// ============================================
// Enums
// ============================================

/**
 * Permission levels
 */
export const permissionLevelSchema = z.enum(
	["VIEW", "COMMENT", "EDIT", "ADMIN"],
	{
		errorMap: () => ({ message: "Invalid permission level" }),
	}
);

/**
 * Team roles
 */
export const teamRoleSchema = z.enum(["ADMIN", "MEMBER"], {
	errorMap: () => ({ message: "Invalid team role" }),
});
