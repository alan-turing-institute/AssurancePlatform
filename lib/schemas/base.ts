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
	.transform((v) => v.toLowerCase().trim())
	.describe("Valid email address");

/**
 * UUID v4 format
 */
export const uuidSchema = z
	.string()
	.uuid("Invalid ID format")
	.describe("UUID v4 identifier");

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
		.transform((v) => v.trim())
		.describe(`Required ${fieldName} field`);

/**
 * Optional trimmed string (empty string becomes undefined, null becomes undefined)
 */
export const optionalString = (maxLength = 2000) =>
	z
		.string()
		.max(maxLength, `Must be less than ${maxLength} characters`)
		.nullable()
		.transform((v) => (v?.trim() ? v.trim() : undefined))
		.optional()
		.describe("Optional string field");

/**
 * Valid username — letters, numbers, underscores, and hyphens only.
 */
export const usernameSchema = z
	.string()
	.min(3, "Username must be at least 3 characters")
	.max(50, "Username must be at most 50 characters")
	.regex(
		/^[a-zA-Z0-9_-]+$/,
		"Username can only contain letters, numbers, underscores, and hyphens"
	)
	.transform((v) => v.trim())
	.describe("Valid username");

/**
 * Non-empty string identifier (for non-UUID IDs like tour names)
 */
export const stringIdSchema = z
	.string()
	.min(1, "ID is required")
	.max(100, "ID must be less than 100 characters")
	.transform((v) => v.trim())
	.describe("Non-empty string identifier");

/**
 * Matches a URI scheme immediately followed by "//" (e.g. "https://",
 * "ftp://") — used to detect whether a user-supplied address already
 * carries a scheme before we consider prepending one.
 */
const URL_SCHEME_PREFIX = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//;

const URL_ERROR_MESSAGE = "Enter a web address, such as example.com/report.pdf";

/**
 * Web address, lenient about the scheme — most people type "example.com",
 * not "https://example.com". Trims, prepends "https://" when no scheme is
 * present, then validates as a URL. The normalised value (always carrying a
 * scheme) is what gets stored, so there is no silent divergence between what
 * a user typed and what is saved.
 */
export const lenientUrlSchema = z
	.string()
	.trim()
	.transform((v) => (URL_SCHEME_PREFIX.test(v) ? v : `https://${v}`))
	.pipe(z.string().url(URL_ERROR_MESSAGE))
	.describe("Web address, normalised to always include a scheme");

/**
 * Optional web address field (empty string, null, or undefined all become
 * undefined). Non-empty values are validated and normalised via
 * lenientUrlSchema.
 */
export const optionalUrlSchema = z
	.string()
	.nullable()
	.optional()
	.transform((v) => (v?.trim() ? v.trim() : undefined))
	.pipe(z.union([z.undefined(), lenientUrlSchema]))
	.optional()
	.describe("Optional web address field");

// ============================================
// Number Primitives
// ============================================

/**
 * Positive integer ID
 */
export const positiveIntSchema = z
	.number()
	.int("Must be a whole number")
	.positive("Must be a positive number")
	.describe("Positive integer identifier");

/**
 * Coerce string to positive integer (for query params and FormData)
 */
export const coercePositiveInt = z.coerce
	.number()
	.int("Must be a whole number")
	.positive("Must be a positive number")
	.describe("Positive integer coerced from string");

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
	.transform((v) => v === "true")
	.describe("Boolean coerced from string");

// ============================================
// Enums
// ============================================

/**
 * Permission levels
 */
export const permissionLevelSchema = z
	.enum(["VIEW", "COMMENT", "EDIT", "ADMIN"], {
		message: "Invalid permission level",
	})
	.describe("Permission level for case access");

/**
 * Team roles
 */
export const teamRoleSchema = z
	.enum(["ADMIN", "MEMBER"], {
		message: "Invalid team role",
	})
	.describe("Role within a team");
