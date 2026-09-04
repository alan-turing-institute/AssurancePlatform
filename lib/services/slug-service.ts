import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/services/slug";

export { slugify } from "@/lib/services/slug";

// Derived from `prisma.$transaction`'s own callback parameter, the same
// pattern `case-batch-update-service.ts` uses — `Prisma.TransactionClient`
// (the generated client's own type) does not structurally match this
// project's client, which is `.$extends()`-wrapped with the element
// validation extension in `lib/prisma.ts`.
type TransactionCallback = Parameters<typeof prisma.$transaction>[0];
type TransactionClient = TransactionCallback extends (
	tx: infer T
) => Promise<unknown>
	? T
	: never;

/**
 * Generates a slug for `name` that is unique among existing CURRENT
 * `PublishedAssuranceCase` slugs, appending a numeric suffix (`-2`, `-3`, …)
 * on collision (ADR 0003 §6). Checked against `isCurrent: true` rows only —
 * that is the actual uniqueness domain the schema enforces (a partial index,
 * not a plain `@@unique`): historical/superseded rows are expected to share
 * a slug with their own case's current row, and are no longer publicly
 * addressable, so they cannot collide with a brand-new case's fresh slug.
 *
 * Call this ONCE, at first publish only. Every later republish of the same
 * source case must carry its existing slug forward verbatim instead of
 * calling this again — see `publishAssuranceCase` / `updatePublishedCase` in
 * `publish-service.ts` — so a case's public address survives any number of
 * renames.
 *
 * Accepts an optional transaction client so the uniqueness check and the
 * row insert that consumes its result can run inside the same transaction
 * (`publishAssuranceCase` does this) without a TOCTOU gap between the two.
 */
export async function generateUniqueSlug(
	name: string,
	client: TransactionClient = prisma
): Promise<string> {
	const base = slugify(name);
	let candidate = base;
	let suffix = 1;

	// A loop, not a single "count existing + 1": unpublishing deletes rows,
	// so a straight count can still collide if earlier suffixes were freed
	// up and reused elsewhere in the meantime. This stays correct regardless,
	// bounded by however many collisions actually exist, not by case volume.
	// Sequential awaits are deliberate: each iteration depends on the
	// previous candidate's collision result, so this cannot be parallelised.
	while (
		(await client.publishedAssuranceCase.findFirst({
			where: { slug: candidate, isCurrent: true },
			select: { id: true },
		})) !== null
	) {
		suffix += 1;
		candidate = `${base}-${suffix}`;
	}

	return candidate;
}
