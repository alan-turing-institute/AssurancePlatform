/**
 * Version detection for case import JSON files.
 *
 * Detects whether an imported JSON is:
 * - "flat" (internal V2 format with elements array)
 * - "nested" (tree format with version "1.0")
 *
 * Also provides validation against the appropriate schema.
 */

import {
	type CaseExportNested,
	CaseExportNestedSchema,
	type CaseExportV2,
	CaseExportV2Schema,
	type ImportValidationResult,
	type ValidationError,
} from "./case-export";

export type CaseFormatVersion = "flat" | "nested";

export type VersionDetectionResult =
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
 * Detects the format version of an imported case JSON.
 *
 * Detection strategy:
 * 1. Check for nested format (version: "1.0" or tree structure)
 * 2. Check for flat format (version: "2.0" or elements + evidenceLinks)
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
	// flat
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

	// Unknown format - try each schema in order (nested -> flat)
	for (const version of ["nested", "flat"] as CaseFormatVersion[]) {
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
					"Could not parse import format. Ensure the JSON has a 'tree' object (nested) or 'elements' array (flat).",
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

	return {
		isValid: true,
		version: result.version,
		errors: [],
		warnings: [],
	};
}
