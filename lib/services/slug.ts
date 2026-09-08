/**
 * Pure slug helper, split out from `slug-service.ts` so it has no Prisma
 * import. `slug-service.ts` imports `@/lib/prisma`, which throws at module
 * load when `DATABASE_URL` is unset — that made `slugify` untestable in
 * isolation even though it touches no database. Keep this file free of any
 * import that reaches `@/lib/prisma`.
 */

/**
 * Converts a name into a URL-safe slug base: lowercase, non-alphanumerics
 * collapsed to single hyphens, leading/trailing hyphens trimmed. An
 * all-punctuation/empty input falls back to "item" so a slug is always
 * produced (ADR 0003 §6 requires every published item to have one). Kept in
 * lockstep with the equivalent backfill expression in this feature's
 * migration (`prisma/migrations/20260716000000_publishing_schema_and_state_model`).
 */
export function slugify(name: string): string {
	const base = name
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return base || "item";
}
