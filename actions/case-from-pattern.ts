"use server";

import { validateSession } from "@/lib/auth/validate-session";
import type { PatternVariable } from "@/lib/case/pattern-variables";
import type { ActionResult } from "@/lib/errors";
import {
	type CreateCaseFromPatternInput,
	createCaseFromPatternSchema,
	patternSourceSchema,
} from "@/lib/schemas/case-from-pattern";
import type { ViewablePattern } from "@/lib/services/case-from-pattern-service";
import { validateInput } from "@/lib/validation/input-validation";

/**
 * Lists the patterns the signed-in user can start a case from, for the
 * new-case dialog's picker. Null when there is no session or the lookup fails.
 */
export const fetchViewablePatterns = async (): Promise<
	ViewablePattern[] | null
> => {
	const validated = await validateSession();
	if (!validated) {
		return null;
	}

	const { listViewablePatterns } = await import(
		"@/lib/services/case-from-pattern-service"
	);
	const result = await listViewablePatterns(validated.userId);
	if ("error" in result) {
		return null;
	}
	return result.data;
};

/**
 * Lists the variables of a pattern the signed-in user can start a case from,
 * for the new-case dialog's fields. Null when there is no session, the user
 * cannot read the pattern, or the lookup fails.
 */
export const fetchPatternVariables = async (
	source: CreateCaseFromPatternInput["source"]
): Promise<PatternVariable[] | null> => {
	const validated = await validateSession();
	if (!validated) {
		return null;
	}

	const validation = validateInput(source, patternSourceSchema);
	if (!validation.success) {
		return null;
	}

	const { readPatternVariables } = await import(
		"@/lib/services/case-from-pattern-service"
	);
	const result = await readPatternVariables(validated.userId, validation.data);
	if ("error" in result) {
		return null;
	}
	return result.data;
};

/**
 * Starts a new case from a pattern: one the user can view (`patternCaseId`) or
 * one published on Discover (`publishedSlug`). `variableValues` gives values to
 * the pattern's variables by the id of the entry that defines each. `warnings`
 * names references the pattern held to cases the user cannot view, which the
 * new case does not keep.
 */
export const createCaseFromPattern = async (
	source: CreateCaseFromPatternInput["source"],
	name: string,
	description: string,
	variableValues: CreateCaseFromPatternInput["variableValues"] = {}
): Promise<ActionResult<{ id: string; warnings: string[] }>> => {
	const validated = await validateSession();
	if (!validated) {
		return { success: false, error: "Invalid session" };
	}

	const validation = validateInput(
		{ source, name, description, variableValues },
		createCaseFromPatternSchema
	);
	if (!validation.success) {
		return {
			success: false,
			// The dialog shows this under its fields, so it carries the problem
			// alone, without the "name:" or "description:" path prefix.
			error: Object.values(validation.fieldErrors ?? {})[0] ?? validation.error,
			fieldErrors: validation.fieldErrors,
		};
	}

	const { createCaseFromPattern: startCaseFromPattern } = await import(
		"@/lib/services/case-from-pattern-service"
	);
	const result = await startCaseFromPattern(
		validated.userId,
		validation.data.source,
		validation.data.name,
		validation.data.description,
		validation.data.variableValues
	);
	if ("error" in result) {
		return { success: false, error: result.error };
	}

	return { success: true, data: result.data };
};
