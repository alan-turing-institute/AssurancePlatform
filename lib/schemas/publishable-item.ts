import { z } from "zod";

/**
 * A publishable item's concrete type (ADR 0003 §5), mirrored from the
 * `PublishableItemType` Prisma enum as a plain string union — kept
 * independent of the generated client, matching the convention in
 * `lib/services/case-response-types.ts` (see `PublishStatusType`) of
 * UI-facing types staying Prisma-free. Only `ASSURANCE_CASE` ships in 1.0;
 * `ARGUMENT_PATTERN` is a discriminator placeholder for the fast-follow
 * issue that publishes reusable pattern templates.
 */
export const publishableItemTypeSchema = z.enum([
	"ASSURANCE_CASE",
	"ARGUMENT_PATTERN",
]);

export type PublishableItemTypeResponse = z.infer<
	typeof publishableItemTypeSchema
>;

/**
 * Slug parameter for a publishable item (ADR 0003 §6) — matches the shape
 * `slugify()` produces in `slug-service.ts`: lowercase alphanumerics
 * separated by single hyphens, with numeric collision suffixes (`-2`, `-3`,
 * …). Deliberately accepts any string of this shape, including purely
 * numeric ones — the old `/discover/[id]` route is retired outright (Chris's
 * G1 ruling, 2026-08-11), so there is no numeric-id special case to guard
 * against here: a numeric-looking path either matches a real slug or falls
 * through to the standard "not found" 404, exactly like any other unknown
 * slug.
 */
export const publishableItemSlugSchema = z
	.string()
	.min(1, "Slug is required")
	.max(255, "Slug must be less than 255 characters")
	.regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Invalid slug format");

export type PublishableItemSlug = z.infer<typeof publishableItemSlugSchema>;

/**
 * The subset of a published snapshot's frozen JSON `content`
 * (`composeSnapshotContent` in `publish-service.ts`) that Discover renders:
 * the source case's own name/description (always present) and the curated,
 * public-facing case information (ADR 0003 §1 — present only when the case
 * was curated before publishing). Parsed defensively — every field is
 * optional, and unrecognised keys (the rest of the snapshot: `tree`,
 * `pluginData`, …) are simply stripped, since only `case`/`caseInformation`
 * are ever read back out — so a malformed or legacy-shaped snapshot
 * degrades to missing fields rather than throwing.
 */
export const publishedSnapshotMetaSchema = z.object({
	case: z
		.object({
			name: z.string().optional(),
			description: z.string().optional(),
		})
		.optional(),
	caseInformation: z
		.object({
			description: z.string().nullable().optional(),
			authors: z.string().nullable().optional(),
			sector: z.string().nullable().optional(),
			featureImageUrl: z.string().nullable().optional(),
		})
		.optional(),
});

export type PublishedSnapshotMeta = z.infer<typeof publishedSnapshotMetaSchema>;
