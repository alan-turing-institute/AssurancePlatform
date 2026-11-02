import { z } from "zod";
import { newCaseDescriptionSchema, newCaseNameSchema } from "./assurance-case";
import { uuidSchema } from "./base";
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
 * Schema for starting a new case from a pattern.
 */
export const createCaseFromPatternSchema = z
	.strictObject({
		source: patternSourceSchema,
		name: startedCaseNameSchema,
		description: startedCaseDescriptionSchema,
	})
	.describe("Input schema for starting a new assurance case from a pattern");

export type CreateCaseFromPatternInput = z.input<
	typeof createCaseFromPatternSchema
>;
