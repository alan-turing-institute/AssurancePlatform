import { z } from "zod";
import { uuidSchema } from "@/lib/schemas/base";

/**
 * Zod schema for `docs/specs/evidence-format-v0.1.md` — the FROZEN
 * ingestion contract for `POST /api/machine/health/elements/[id]/evidence`.
 * Implemented exactly: unknown top-level fields are rejected (`.strict()`),
 * unknown `provenance` keys are preserved verbatim (`.catchall()`, not
 * `.strip()`). Any deviation from the spec is a question back to cid, not a
 * unilateral change — see the health-plugin delegation brief.
 *
 * Fields the spec says a producer does NOT send (`recordHash`,
 * `previousRecordHash`, `createdAt`, `createdById`) are simply absent from
 * this schema — they are set server-side by `health-evidence-service.ts`
 * and would be rejected anyway by `.strict()` if a caller tried to smuggle
 * them in.
 */

export const EVIDENCE_FORMAT_VERSION = "0.1";

const METRIC_NAME_MAX_LENGTH = 200;
const SOURCE_SYSTEM_MAX_LENGTH = 100;
const ODD_DIMENSION_MAX_ITEMS = 50;
const ODD_DIMENSION_MAX_LENGTH = 200;

/**
 * Bounded-JSON caps for `provenance` (vincent's settings-cap review finding,
 * same pattern as `lib/schemas/plugin.ts`'s `boundedJsonValueSchema`):
 * `provenance` is regulator-grade and stored verbatim, but "verbatim" must
 * not mean "unbounded" on a machine-write endpoint. `check` and `runId` are
 * required (evidence-format-v0.1); every other key is free-form but capped
 * in depth/count/length/bytes exactly like the plugin-settings JSON.
 */
const PROVENANCE_MAX_DEPTH = 4;
const PROVENANCE_MAX_KEYS = 20;
const PROVENANCE_MAX_ARRAY_ITEMS = 20;
const PROVENANCE_MAX_STRING_LENGTH = 500;
/** Final belt-and-braces bound on the whole object, serialized as UTF-8 bytes. */
const PROVENANCE_MAX_BYTES = 8192;

const jsonPrimitiveSchema = z.union([
	z.string().max(PROVENANCE_MAX_STRING_LENGTH),
	z.number(),
	z.boolean(),
	z.null(),
]);

/**
 * A bounded JSON value, at most `depth` further levels of array/object
 * nesting below this call — `depth <= 0` collapses to primitives only, so
 * the recursion structurally terminates. Mirrors `lib/schemas/plugin.ts`'s
 * `boundedJsonValueSchema` (kept as a separate, smaller copy here rather
 * than a shared import: this schema's caps and required-key shape are
 * specific to `provenance`, not the generic plugin-settings blob).
 */
// biome-ignore lint/suspicious/noExplicitAny: Required for Zod recursive schema typing (same pattern as lib/schemas/plugin.ts)
function boundedJsonValueSchema(depth: number): z.ZodType<any> {
	if (depth <= 0) {
		return jsonPrimitiveSchema;
	}
	return z.lazy(() =>
		z.union([
			jsonPrimitiveSchema,
			z
				.array(boundedJsonValueSchema(depth - 1))
				.max(PROVENANCE_MAX_ARRAY_ITEMS),
			z
				.record(z.string(), boundedJsonValueSchema(depth - 1))
				.refine((obj) => Object.keys(obj).length <= PROVENANCE_MAX_KEYS, {
					message: `Must have at most ${PROVENANCE_MAX_KEYS} keys`,
				}),
		])
	);
}

function serializedByteLength(value: unknown): number {
	return new TextEncoder().encode(JSON.stringify(value)).length;
}

/**
 * `provenance` — evidence-format-v0.1 requires at least `check` and `runId`
 * (strings); further keys are "recommended and preserved verbatim". Zod's
 * `.catchall()` gives exactly that shape: named required keys, plus any
 * additional key validated (and KEPT, never stripped) against the bounded
 * JSON schema above.
 */
const provenanceSchema = z
	.object({
		check: z
			.string()
			.min(1, "provenance.check is required")
			.max(PROVENANCE_MAX_STRING_LENGTH),
		runId: z
			.string()
			.min(1, "provenance.runId is required")
			.max(PROVENANCE_MAX_STRING_LENGTH),
	})
	.catchall(boundedJsonValueSchema(PROVENANCE_MAX_DEPTH - 1))
	.refine((obj) => Object.keys(obj).length <= PROVENANCE_MAX_KEYS, {
		message: `provenance must have at most ${PROVENANCE_MAX_KEYS} keys`,
	})
	.refine((obj) => serializedByteLength(obj) <= PROVENANCE_MAX_BYTES, {
		message: `provenance must serialize to at most ${PROVENANCE_MAX_BYTES} bytes`,
	});

/**
 * One evidence-format-v0.1 item, exactly as documented. `claimId` is
 * required here (a producer supplies it), but its equality with the path
 * `[id]` is enforced at the ROUTE layer (`app/api/machine/health/elements/
 * [id]/evidence/route.ts`) — the spec is explicit that this is not
 * expressible in the body schema alone, since path and body are parsed
 * separately.
 */
export const healthEvidenceItemSchema = z
	.object({
		formatVersion: z.literal(EVIDENCE_FORMAT_VERSION, {
			message: `formatVersion must be "${EVIDENCE_FORMAT_VERSION}"`,
		}),
		claimId: uuidSchema,
		metricName: z
			.string()
			.min(1, "metricName is required")
			.max(
				METRIC_NAME_MAX_LENGTH,
				`metricName must be at most ${METRIC_NAME_MAX_LENGTH} characters`
			),
		value: z.number().finite().optional(),
		threshold: z.number().finite().optional(),
		verdict: z.enum(["PASS", "FAIL", "DEGRADED"], {
			message: "verdict must be PASS, FAIL, or DEGRADED",
		}),
		oddDimensions: z
			.array(
				z
					.string()
					.min(1)
					.max(
						ODD_DIMENSION_MAX_LENGTH,
						`Each oddDimensions entry must be at most ${ODD_DIMENSION_MAX_LENGTH} characters`
					)
			)
			.max(
				ODD_DIMENSION_MAX_ITEMS,
				`oddDimensions must have at most ${ODD_DIMENSION_MAX_ITEMS} entries`
			)
			.default([]),
		sourceSystem: z
			.string()
			.min(1, "sourceSystem is required")
			.max(
				SOURCE_SYSTEM_MAX_LENGTH,
				`sourceSystem must be at most ${SOURCE_SYSTEM_MAX_LENGTH} characters`
			),
		provenance: provenanceSchema,
		// "ISO 8601 UTC" (spec) — no offset variants accepted, matching the
		// spec's own example ("...T09:41:07Z").
		evaluatedAt: z
			.string()
			.datetime({ message: "evaluatedAt must be an ISO 8601 UTC timestamp" }),
	})
	.strict();

export type HealthEvidenceItemInput = z.infer<typeof healthEvidenceItemSchema>;
