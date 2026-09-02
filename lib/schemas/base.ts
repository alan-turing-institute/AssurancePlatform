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

/**
 * Matches any URI scheme prefix, with or without the following "//" (e.g.
 * "mailto:", "javascript:", "https://"). Used together with
 * URL_SCHEME_PREFIX to detect a scheme that is NOT followed by "//" — those
 * are non-web addresses (mailto:, javascript:, data:, …) and must never be
 * silently rewritten into "https://mailto:..." nonsense.
 */
const URL_SCHEME_ONLY = /^[a-zA-Z][a-zA-Z\d+\-.]*:/;

/**
 * Protocol allowlist applied to the final, normalised value. Only http(s)
 * addresses are ever stored — closes the javascript:// stored-XSS surface,
 * since zod's url() check accepts any WHATWG-parseable URL (including
 * javascript: and other non-web schemes) and evidence hrefs are rendered
 * raw.
 */
const URL_ALLOWED_PROTOCOL = /^https?:\/\//i;

const URL_ERROR_MESSAGE = "Enter a web address, such as example.com/report.pdf";

/**
 * Web address, lenient about the scheme — most people type "example.com",
 * not "https://example.com". Trims, prepends "https://" when no scheme is
 * present (or just "https:" for a protocol-relative "//example.com"), then
 * validates as a URL and checks the result against the http(s) allowlist.
 * The normalised value (always carrying a scheme) is what gets stored, so
 * there is no silent divergence between what a user typed and what is
 * saved. A scheme that isn't followed by "//" (mailto:, javascript:,
 * data:, …) is rejected outright rather than mangled.
 *
 * Import paths (DOIs, URNs, file paths) deliberately do NOT use this
 * schema — see element-validation.ts's BaseElementSchema `url` comment for
 * the reverse pointer. This schema, and the two below it, are for entry
 * points that mean "a web address": UI forms and the batch-update route.
 */
export const lenientUrlSchema = z
	.string()
	.trim()
	.refine(
		(v) => !(URL_SCHEME_ONLY.test(v) && !URL_SCHEME_PREFIX.test(v)),
		URL_ERROR_MESSAGE
	)
	.transform((v) => {
		if (v.startsWith("//")) {
			return `https:${v}`;
		}
		return URL_SCHEME_PREFIX.test(v) ? v : `https://${v}`;
	})
	.pipe(
		z
			.string()
			.url(URL_ERROR_MESSAGE)
			.refine((v) => URL_ALLOWED_PROTOCOL.test(v), URL_ERROR_MESSAGE)
	)
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
	// NOTE (V3, reverted): dropping this trailing .optional() was flagged by
	// review as "redundant" because the piped union already accepts
	// undefined at RUNTIME. It is not redundant for TYPE INFERENCE: zod only
	// treats a z.object() field as an optional key (`url?:`) when the field
	// schema is itself ZodOptional at the top level. Without this wrapper,
	// `url`/`URL` on CreateElementInput/UpdateElementInput flip from an
	// optional key to a required-but-possibly-undefined key, which broke
	// tsc across 70 call sites in three integration test files outside this
	// batch's scope (case-crud.test.ts, element-service.test.ts,
	// identifier-service.test.ts) that construct input objects without
	// url/URL. Kept in place; reported to cid rather than touching those
	// files.
	.optional()
	.describe("Optional web address field");

/**
 * Nullable web address field — for entry points where `null` is a
 * meaningful instruction to CLEAR an existing value, not "no opinion".
 *
 * Do NOT reuse optionalUrlSchema here: it folds null to undefined, and any
 * caller that treats undefined as "leave unchanged" (e.g. the batch-update
 * service's field loop) would then be unable to clear a URL at all. This
 * schema keeps null distinct from undefined all the way through:
 *   - undefined -> undefined (field genuinely absent — leave unchanged)
 *   - null, "", or whitespace-only -> null (explicit clear)
 *   - anything else -> validated/normalised via lenientUrlSchema
 */
export const nullableUrlSchema = z
	.string()
	.nullable()
	.optional()
	// A z.union([z.undefined(), z.null(), lenientUrlSchema]).pipe(...) reads
	// more like optionalUrlSchema's pattern, but zod's union error-picking
	// swallows lenientUrlSchema's specific message (falls back to a generic
	// "Invalid input") whenever the failure comes from lenientUrlSchema's
	// leading .refine() rather than its trailing .url() check — e.g.
	// "mailto:…". Calling lenientUrlSchema directly inside the transform and
	// re-raising its own issues keeps the friendly message in every failure
	// case.
	.transform((v, ctx) => {
		if (v === undefined) {
			return undefined;
		}
		const trimmed = v?.trim();
		if (!trimmed) {
			return null;
		}
		const result = lenientUrlSchema.safeParse(trimmed);
		if (!result.success) {
			for (const issue of result.error.issues) {
				ctx.addIssue({ code: "custom", message: issue.message });
			}
			return z.NEVER;
		}
		return result.data;
	})
	// See optionalUrlSchema's NOTE above — kept for the same type-inference
	// reason (an optional key on the object schema, not required|undefined).
	.optional()
	.describe("Nullable web address field — null means 'clear this value'");

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
