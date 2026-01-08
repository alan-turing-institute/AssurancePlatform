import type { ZodError, ZodType, ZodTypeDef } from "zod";

/**
 * Result of validating Server Action input
 */
export type ValidationResult<T> =
	| { success: true; data: T }
	| { success: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Validate input against a Zod schema for Server Actions
 * Uses separate input (I) and output (O) types to handle transformations
 */
export function validateInput<O, D extends ZodTypeDef, I>(
	input: unknown,
	schema: ZodType<O, D, I>
): ValidationResult<O> {
	const result = schema.safeParse(input);

	if (!result.success) {
		return {
			success: false,
			error: formatZodError(result.error),
			fieldErrors: extractFieldErrors(result.error),
		};
	}

	return {
		success: true,
		data: result.data,
	};
}

/**
 * Validate FormData against a Zod schema
 * Converts FormData to object, then validates
 */
export function validateFormData<O, D extends ZodTypeDef, I>(
	formData: FormData,
	schema: ZodType<O, D, I>
): ValidationResult<O> {
	const data = Object.fromEntries(formData.entries());
	return validateInput(data, schema);
}

/**
 * Format Zod errors into user-friendly message (British English)
 */
function formatZodError(error: ZodError): string {
	const messages = error.errors.map((err) => {
		const path = err.path.join(".");
		return path ? `${path}: ${err.message}` : err.message;
	});
	return messages[0] || "Validation failed";
}

/**
 * Extract field-specific errors for form integration
 */
function extractFieldErrors(error: ZodError): Record<string, string> {
	const fieldErrors: Record<string, string> = {};
	for (const err of error.errors) {
		const path = err.path.join(".");
		if (path && !fieldErrors[path]) {
			fieldErrors[path] = err.message;
		}
	}
	return fieldErrors;
}
