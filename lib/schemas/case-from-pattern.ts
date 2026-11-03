import { z } from "zod";
import { newCaseDescriptionSchema, newCaseNameSchema } from "./assurance-case";
import { uuidSchema } from "./base";
import {
	CONTEXT_ENTRY_VALUE_MAX_LENGTH,
	trimEntryValue,
} from "./context-entry";
import { publishableItemSlugSchema } from "./publishable-item";

/**
 * Where a pattern is read from: a pattern case the user can view, or a
 * pattern published on Discover, named by its public slug. Exactly one of the
 * two keys is allowed.
 */
export const patternSourceSchema = z
	.union(
		[
			z.strictObject({ patternCaseId: uuidSchema }),
			z.strictObject({ publishedSlug: publishableItemSlugSchema }),
		],
		{ error: "Choose a pattern to start from" }
	)
	.describe("The pattern to start a case from");

export type PatternSource = z.infer<typeof patternSourceSchema>;

/**
 * The name and description of a case started from a pattern. They follow the
 * rules for creating any other case and must also be non-empty once trimmed:
 * the import takes them as given, so a blank value would name the new case
 * with nothing.
 */
export const startedCaseNameSchema = newCaseNameSchema.refine(
	(name) => name.length > 0,
	"Case name is required"
);
export const startedCaseDescriptionSchema = newCaseDescriptionSchema.refine(
	(description) => description.length > 0,
	"Description is required"
);

/**
 * What is said to someone who gives a value to something that is not one of
 * the pattern's variables.
 */
export const NOT_A_VARIABLE_MESSAGE =
	"That pattern has no variable to give that value to";

/**
 * The values to give a pattern's variables in the new case, by the id of the
 * entry that defines each. A value is trimmed, of spaces and of zero-width
 * characters, and may be at most as long as any context entry's value; a blank
 * one leaves the variable without a value.
 */
export const variableValuesSchema = z
	.record(
		z.string(),
		z
			.string()
			.overwrite(trimEntryValue)
			.max(
				CONTEXT_ENTRY_VALUE_MAX_LENGTH,
				`Variable values must be at most ${CONTEXT_ENTRY_VALUE_MAX_LENGTH} characters`
			)
	)
	.describe("Values for the pattern's variables, by entry id");

export type VariableValues = z.infer<typeof variableValuesSchema>;

/**
 * The refusal for values that carry an own key called `__proto__`, or nothing
 * when they do not. Parsing drops such a key without a word, so it has to be
 * looked for before the values are parsed; it is never the id of an entry.
 */
export function protoKeyProblem(values: unknown): string | undefined {
	return typeof values === "object" &&
		values !== null &&
		Object.hasOwn(values, "__proto__")
		? NOT_A_VARIABLE_MESSAGE
		: undefined;
}

/**
 * Schema for starting a new case from a pattern.
 */
export const createCaseFromPatternSchema = z
	.strictObject({
		source: patternSourceSchema,
		name: startedCaseNameSchema,
		description: startedCaseDescriptionSchema,
		variableValues: variableValuesSchema.default({}),
	})
	.describe("Input schema for starting a new assurance case from a pattern");

export type CreateCaseFromPatternInput = z.input<
	typeof createCaseFromPatternSchema
>;
