/**
 * Per-assertion status (ADR 0004 D3) — shared client-side vocabulary.
 *
 * Single source of truth for the UI's badge labels/colours and for the
 * setter's allowed values. Mirrors `AssertionStatusSchema`
 * (lib/schemas/case-export.ts), which mirrors the Prisma `AssertionStatus`
 * enum.
 */

import { z } from "zod";
import { AssertionStatusSchema } from "@/lib/schemas/case-export";

export type AssertionStatusValue = z.infer<typeof AssertionStatusSchema>;

const ASSERTION_STATUS_VALUES = AssertionStatusSchema.options;

/**
 * The five author-declarable values (ADR 0004 D3). `AS_CITED` is
 * DERIVED-ONLY — the server computes it transitively from the cited
 * claim's own status, and rejects a hand-declared `AS_CITED`
 * (`element-service.ts`'s `rejectDeclaredAsCited`). Deliberately
 * hand-listed rather than derived from `ASSERTION_STATUS_VALUES` by
 * filtering: the setter's allowed-value list is a security-relevant
 * allowlist, not a byproduct of the full enum minus one entry.
 */
export const AuthorAssertionStatusSchema = z.enum([
	"ASSERTED",
	"NEEDS_SUPPORT",
	"ASSUMED",
	"AXIOMATIC",
	"DEFEATED",
]);

export type AuthorAssertionStatusValue = z.infer<
	typeof AuthorAssertionStatusSchema
>;

export const AUTHOR_ASSERTION_STATUS_VALUES =
	AuthorAssertionStatusSchema.options;

/** Short label shown on the badge and in the setter's dropdown. */
export const ASSERTION_STATUS_LABELS: Record<AssertionStatusValue, string> = {
	ASSERTED: "Asserted",
	NEEDS_SUPPORT: "Needs support",
	ASSUMED: "Assumed",
	AXIOMATIC: "Axiomatic",
	DEFEATED: "Defeated",
	AS_CITED: "As cited",
};

/** Longer, plain-English description shown on hover. */
export const ASSERTION_STATUS_DESCRIPTIONS: Record<
	AssertionStatusValue,
	string
> = {
	ASSERTED: "The author's stated position — the default status.",
	NEEDS_SUPPORT: "Flagged by the author as needing further support.",
	ASSUMED: "Taken as given by the author rather than argued for.",
	AXIOMATIC: "Treated by the author as self-evidently true in this case.",
	DEFEATED: "Marked by the author as refuted or withdrawn.",
	AS_CITED:
		"Computed automatically from the status of the claim this element cites — not set directly by an author.",
};

/** Type guard for narrowing an unknown value (e.g. React Flow node data). */
export function isAssertionStatusValue(
	value: unknown
): value is AssertionStatusValue {
	return (
		typeof value === "string" &&
		(ASSERTION_STATUS_VALUES as readonly string[]).includes(value)
	);
}

/** Type guard for the five author-declarable values. */
export function isAuthorAssertionStatusValue(
	value: unknown
): value is AuthorAssertionStatusValue {
	return (
		typeof value === "string" &&
		(AUTHOR_ASSERTION_STATUS_VALUES as readonly string[]).includes(value)
	);
}
