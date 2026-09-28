import { z } from "zod";

/**
 * The delete dialog's choice for a published case's Discover copy (design
 * note, Chris's ruling 1, 2026-09-28): remove it, or keep it archived.
 * `"remove"` is the default everywhere this is optional — the pre-existing
 * behaviour, and the API's default (ruling 6).
 */
export const publishedCopyChoiceSchema = z.enum(["archive", "remove"]);

export type PublishedCopyChoice = z.infer<typeof publishedCopyChoiceSchema>;

/** `actions/cases.ts`'s `deleteAssuranceCase` options — validated before reaching `softDeleteCase`. */
export const deleteCaseOptionsSchema = z.strictObject({
	publishedCopy: publishedCopyChoiceSchema.optional(),
});

export type DeleteCaseOptionsInput = z.input<typeof deleteCaseOptionsSchema>;
