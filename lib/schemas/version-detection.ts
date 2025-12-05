/**
 * Version detection for case import JSON files.
 *
 * Detects whether an imported JSON is:
 * - "legacy" (Django format, no version field)
 * - "flat" (internal V2 format with elements array)
 * - "nested" (tree format with version "1.0")
 *
 * Also provides validation against the appropriate schema.
 */

import {
	type CaseExportNested,
	CaseExportNestedSchema,
	type CaseExportV1,
	CaseExportV1Schema,
	type CaseExportV2,
	CaseExportV2Schema,
	type ImportValidationResult,
	type ValidationError,
} from "./case-export";

export type CaseFormatVersion = "legacy" | "flat" | "nested";

export type VersionDetectionResult =
	| { version: "legacy"; data: CaseExportV1; isValid: true }
	| { version: "flat"; data: CaseExportV2; isValid: true }
	| { version: "nested"; data: CaseExportNested; isValid: true }
	| { version: null; isValid: false; errors: ValidationError[] };

/**
 * Check if data matches nested format (tree structure with version "1.0").
 */
function isNestedFormat(obj: Record<string, unknown>): boolean {
	// Explicit version field
	if (obj.version === "1.0") {
		return true;
	}
	// Tree structure with children array
	if ("tree" in obj && typeof obj.tree === "object" && obj.tree !== null) {
		const tree = obj.tree as Record<string, unknown>;
		return "children" in tree && Array.isArray(tree.children);
	}
	return false;
}

/**
 * Check if data matches flat format (elements array, internal V2).
 */
function isFlatFormat(obj: Record<string, unknown>): boolean {
	// Explicit version field
	if (obj.version === "2.0") {
		return true;
	}
	// Flat elements array with evidenceLinks
	return (
		"elements" in obj && Array.isArray(obj.elements) && "evidenceLinks" in obj
	);
}

/**
 * Check if data matches legacy format (Django nested structure).
 */
function isLegacyFormat(obj: Record<string, unknown>): boolean {
	// Has goals array
	if ("goals" in obj && Array.isArray(obj.goals)) {
		return true;
	}
	// Has AssuranceCase type marker
	if (obj.type === "AssuranceCase") {
		return true;
	}
	return false;
}

/**
 * Detects the format version of an imported case JSON.
 *
 * Detection strategy:
 * 1. Check for nested format (version: "1.0" or tree structure)
 * 2. Check for flat format (version: "2.0" or elements + evidenceLinks)
 * 3. Check for legacy format (goals array or AssuranceCase type)
 */
export function detectVersion(data: unknown): CaseFormatVersion | null {
	if (!data || typeof data !== "object") {
		return null;
	}

	const obj = data as Record<string, unknown>;

	if (isNestedFormat(obj)) {
		return "nested";
	}
	if (isFlatFormat(obj)) {
		return "flat";
	}
	if (isLegacyFormat(obj)) {
		return "legacy";
	}

	return null;
}

/**
 * Formats Zod errors into ValidationError array.
 */
function formatZodErrors(error: {
	errors: Array<{ path: (string | number)[]; message: string; code: string }>;
}): ValidationError[] {
	return error.errors.map((err) => ({
		path: err.path.length > 0 ? err.path.join(".") : "root",
		message: err.message,
		code: err.code,
	}));
}

/**
 * Validates data against a specific version schema.
 */
function validateVersion(
	data: unknown,
	version: CaseFormatVersion
): VersionDetectionResult {
	if (version === "nested") {
		const result = CaseExportNestedSchema.safeParse(data);
		if (result.success) {
			return { version: "nested", data: result.data, isValid: true };
		}
		return {
			version: null,
			isValid: false,
			errors: formatZodErrors(result.error),
		};
	}
	if (version === "flat") {
		const result = CaseExportV2Schema.safeParse(data);
		if (result.success) {
			return { version: "flat", data: result.data, isValid: true };
		}
		return {
			version: null,
			isValid: false,
			errors: formatZodErrors(result.error),
		};
	}
	// legacy
	const result = CaseExportV1Schema.safeParse(data);
	if (result.success) {
		return { version: "legacy", data: result.data, isValid: true };
	}
	return {
		version: null,
		isValid: false,
		errors: formatZodErrors(result.error),
	};
}

/**
 * Detects version and validates the imported JSON against the appropriate schema.
 *
 * Returns the validated and typed data if successful, or validation errors if not.
 */
export function detectAndValidate(data: unknown): VersionDetectionResult {
	if (!data || typeof data !== "object") {
		return {
			version: null,
			isValid: false,
			errors: [
				{
					path: "root",
					message: "Invalid input: expected a JSON object",
					code: "invalid_type",
				},
			],
		};
	}

	const detectedVersion = detectVersion(data);

	// If version detected, validate against that schema
	if (detectedVersion !== null) {
		return validateVersion(data, detectedVersion);
	}

	// Unknown format - try each schema in order (nested -> flat -> legacy)
	for (const version of ["nested", "flat", "legacy"] as CaseFormatVersion[]) {
		const result = validateVersion(data, version);
		if (result.isValid) {
			return result;
		}
	}

	// All failed - return helpful error
	return {
		version: null,
		isValid: false,
		errors: [
			{
				path: "root",
				message:
					"Could not parse import format. Ensure the JSON has a 'tree' object (nested), 'elements' array (flat), or 'goals' array (legacy).",
				code: "invalid_format",
			},
		],
	};
}

/**
 * Validates import data and returns a detailed result with warnings.
 *
 * This is the main entry point for import validation.
 */
export function validateImport(data: unknown): ImportValidationResult {
	const result = detectAndValidate(data);

	if (result.isValid === false) {
		return {
			isValid: false,
			version: null,
			errors: result.errors,
			warnings: [],
		};
	}

	const warnings: string[] = [];

	// Generate warnings for legacy imports about ignored fields
	if (result.version === "legacy") {
		const legacyData = result.data as CaseExportV1;

		if (legacyData.owner !== undefined) {
			warnings.push(
				"The 'owner' field will be ignored. You will become the owner of this case."
			);
		}

		if (
			legacyData.edit_groups?.length ||
			legacyData.view_groups?.length ||
			legacyData.review_groups?.length
		) {
			warnings.push(
				"Permission groups will be ignored. Configure sharing after import."
			);
		}

		if (legacyData.permissions !== undefined) {
			warnings.push(
				"The 'permissions' field will be ignored. You will have admin access."
			);
		}

		// Check for deprecated fields in goals
		if (legacyData.goals) {
			const hasKeywords = legacyData.goals.some(
				(g) => g.keywords && g.keywords !== "" && g.keywords !== "N/A"
			);
			if (hasKeywords) {
				warnings.push(
					"The 'keywords' field is deprecated and will be ignored."
				);
			}
		}
	}

	return {
		isValid: true,
		version: result.version,
		errors: [],
		warnings,
	};
}
