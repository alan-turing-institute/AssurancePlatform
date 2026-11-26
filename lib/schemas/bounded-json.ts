import { z } from "zod";

/**
 * Shared building blocks for bounded JSON values: the limits on nesting
 * depth, keys per object, items per array and string length
 * (`BOUNDED_JSON_MAX_DEPTH`, `BOUNDED_JSON_MAX_KEYS`,
 * `BOUNDED_JSON_MAX_ARRAY_ITEMS`, `BOUNDED_JSON_MAX_STRING_LENGTH`), the
 * recursive rule built from them (`boundedJsonValueSchema`), and a helper
 * that measures a value's size once written out (`serializedByteLength`).
 * Each caller chooses its own size limit. Other rules in `lib/schemas` build
 * on these.
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
