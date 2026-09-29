import { z } from "zod";
import { uuidSchema } from "@/lib/schemas/base";

/**
 * The delete dialog's choice for a published case's Discover copy: remove
 * it, or keep it archived. `"remove"` is the default everywhere this is
 * optional — the pre-existing behaviour, and the API's default. Not
 * exported itself — only `PublishedCopyChoice`, the type it infers, is a
 * cross-module dependency.
 */
const publishedCopyChoiceSchema = z.enum(["archive", "remove"]);

export type PublishedCopyChoice = z.infer<typeof publishedCopyChoiceSchema>;

/**
 * `actions/cases.ts`'s `deleteAssuranceCase` options — validated before
 * reaching `softDeleteCase`. Not exported itself — nested inside
 * `deleteCaseRequestSchema` below, the schema actually used at the call
 * site, and `DeleteCaseOptionsInput` (its inferred type) is what the
 * service layer imports.
 */
const deleteCaseOptionsSchema = z.strictObject({
	publishedCopy: publishedCopyChoiceSchema.optional(),
});

export type DeleteCaseOptionsInput = z.input<typeof deleteCaseOptionsSchema>;

/**
 * The case id and delete options together, validated in one pass by
 * `deleteAssuranceCase` — distinguishing an invalid id from invalid options
 * needs only checking which field a failing issue's path names.
 */
export const deleteCaseRequestSchema = z.strictObject({
	caseId: uuidSchema,
	options: deleteCaseOptionsSchema.default({}),
});
