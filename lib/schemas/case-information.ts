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
