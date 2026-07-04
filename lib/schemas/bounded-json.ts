import { z } from "zod";

/**
 * Shared recursive "bounded JSON" building blocks (vincent finding, backend
 * review m8): `lib/schemas/plugin.ts`'s `settings` (capped at 4096 bytes) and
 * `lib/schemas/health-evidence.ts`'s `provenance` (capped at 8192 bytes) are
 * structurally the SAME bounded-JSON shape — same depth, per-object key
 * count, per-array item count, and per-string length caps; only the final
 * serialized-byte cap differs per call site (a settings blob and a
 * regulator-grade evidence provenance payload have different generous-but-
 * bounded budgets). Extracted here so both schemas define the recursive
 * shape exactly once. Callers parameterise only the byte cap — everything
 * else is fixed and shared.
 */

export const BOUNDED_JSON_MAX_DEPTH = 4;
export const BOUNDED_JSON_MAX_KEYS = 20;
export const BOUNDED_JSON_MAX_ARRAY_ITEMS = 20;
export const BOUNDED_JSON_MAX_STRING_LENGTH = 500;

const jsonPrimitiveSchema = z.union([
	z.string().max(BOUNDED_JSON_MAX_STRING_LENGTH),
	z.number(),
	z.boolean(),
	z.null(),
]);

/**
 * A bounded JSON value, at most `depth` further levels of array/object
 * nesting below this call — `depth <= 0` collapses to primitives only, so
 * the recursion structurally terminates rather than relying on a runtime
 * counter. Each level down is a fresh schema (cheap: `BOUNDED_JSON_MAX_DEPTH`
 * is small and fixed), not unbounded recursion.
 */
// biome-ignore lint/suspicious/noExplicitAny: Required for Zod recursive schema typing (same pattern as lib/schemas/case-export.ts's TreeNodeSchema)
export function boundedJsonValueSchema(depth: number): z.ZodType<any> {
	if (depth <= 0) {
		return jsonPrimitiveSchema;
	}
	return z.lazy(() =>
		z.union([
			jsonPrimitiveSchema,
			z
				.array(boundedJsonValueSchema(depth - 1))
				.max(BOUNDED_JSON_MAX_ARRAY_ITEMS),
			z
				.record(z.string(), boundedJsonValueSchema(depth - 1))
				.refine((obj) => Object.keys(obj).length <= BOUNDED_JSON_MAX_KEYS, {
					message: `Must have at most ${BOUNDED_JSON_MAX_KEYS} keys`,
				}),
		])
	);
}

/**
 * Serialized UTF-8 byte length of `value` — the final belt-and-braces bound
 * every bounded-JSON schema applies on top of its per-node caps (a payload
 * could satisfy every per-node cap and still be enormous via many small
 * keys; this closes that gap).
 */
export function serializedByteLength(value: unknown): number {
	return new TextEncoder().encode(JSON.stringify(value)).length;
}
