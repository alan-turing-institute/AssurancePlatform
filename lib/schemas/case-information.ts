import { z } from "zod";
import { optionalString } from "./base";

/**
 * Case information fields (ADR 0003 §1): description, authors, sector, and a
 * feature image URL. Mirrors the field inventory the retired case-study form
 * collected (`app/(authenticated)/dashboard/case-studies/_components/_form/form-schema.ts`),
 * minus fields that were specific to the old case-study/case-study-linking
 * model (`category`, `contact`, `type`) — those are not part of the ADR's
 * named case-information set and are not carried forward.
 */
export const caseInformationSchema = z.object({
	description: optionalString(5000),
	authors: optionalString(255),
	sector: optionalString(100),
	// Distinct from `optionalString`: the image field needs a genuine
	// null-vs-undefined distinction so a caller can explicitly *clear* the
	// image (`null`) without that being indistinguishable from "leave the
	// existing image untouched" (`undefined` — the key omitted).
	// `optionalString` collapses both `null` and `""` to `undefined`, which
	// is exactly the ambiguity that used to force the image DELETE handler
	// to bypass this schema and write an empty string directly.
	featureImageUrl: z
		.string()
		.max(2000, "Must be less than 2000 characters")
		.nullable()
		.optional()
		.describe(
			"Feature image URL — null clears it, omitted leaves it untouched"
		),
});

/**
 * Create-or-update input. A case's information is a single optional 1:1
 * record edited in place (ADR §1: "editable any time") — there is no
 * separate create-vs-update distinction at the API boundary, only "save
 * whatever fields are provided". At least one field must be provided, same
 * rule as `updateCaseStudySchema`.
 */
export const upsertCaseInformationSchema = caseInformationSchema.refine(
	(data) => Object.values(data).some((v) => v !== undefined),
	{ message: "At least one field must be provided" }
);

export type CaseInformationInput = z.input<typeof upsertCaseInformationSchema>;
export type CaseInformationData = z.output<typeof upsertCaseInformationSchema>;

/**
 * Fields required before a case can be published (ADR 0003 §4 — "the
 * admission ticket to Discover"): a description, so nothing reaches the
 * public page without explanation. Authors, sector and the feature image
 * stay optional curation. Mirrors the one field the retired case-study form
 * enforced beyond its own title
 * (`app/(authenticated)/dashboard/case-studies/_components/_form/form-schema.ts`'s
 * `description: z.string().min(1, ...)`) — title has no case-information
 * analogue because the assurance case already carries a required `name`.
 *
 * Kept as an array (not a single constant) so a future required field only
 * needs adding here — the publish flow and its "surface exactly the missing
 * fields" UI both read this list rather than hard-coding "description".
 */
export const REQUIRED_CASE_INFORMATION_FIELDS = ["description"] as const;

export type RequiredCaseInformationField =
	(typeof REQUIRED_CASE_INFORMATION_FIELDS)[number];

/** Human-readable label for a required field, for publish-gate UI copy. */
export const CASE_INFORMATION_FIELD_LABELS: Record<
	RequiredCaseInformationField,
	string
> = {
	description: "Description",
};

/**
 * Returns the required case-information fields that are missing or blank —
 * exactly the gaps the publish flow surfaces in place (ADR 0003 §2), rather
 * than a from-scratch questionnaire. A case with no case-information record
 * at all (`information` is `null`/`undefined`) is every required field
 * missing.
 */
export function getMissingCaseInformationFields(
	information: { description?: string | null } | null | undefined
): RequiredCaseInformationField[] {
	return REQUIRED_CASE_INFORMATION_FIELDS.filter(
		(field) => !information?.[field]?.trim()
	);
}
