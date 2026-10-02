import { z } from "zod";
import { serializedByteLength } from "@/lib/schemas/bounded-json";

/**
 * Shapes shared by everything that describes how a health check's readings
 * are judged: the rule applied to each reading, the reduction of one
 * subject's readings in a window, the aggregation over subjects, and the
 * ISO 8601 duration used for windows and validity. All field names are the
 * snake_case wire names.
 *
 * On a record these are checked only for the keys their `kind` needs;
 * everything else inside `params` is kept verbatim, bounded in size.
 */

const PARAMS_MAX_BYTES = 4096;
const VERSION_MAX_LENGTH = 200;

// ---------------------------------------------------------------------------
// Durations
// ---------------------------------------------------------------------------

/**
 * `P[nW][nD][T[nH][nM][nS]]`. Months and years are not accepted: their
 * length depends on the calendar, so a duration in them has no fixed
 * meaning.
 */
const DURATION_PATTERN =
	/^P(?:(\d{1,9})W)?(?:(\d{1,9})D)?(?:T(?:(\d{1,9})H)?(?:(\d{1,9})M)?(?:(\d{1,9})S)?)?$/;

const SECONDS_PER_UNIT = [604_800, 86_400, 3600, 60, 1] as const;

/**
 * Length of an ISO 8601 duration in seconds, or `null` when the text is not
 * a duration in the accepted form or its length is not greater than zero.
 */
export function parseDurationSeconds(text: string): number | null {
	const match = DURATION_PATTERN.exec(text);
	if (!match || text.endsWith("T")) {
		return null;
	}
	let total = 0;
	let anyPart = false;
	for (const [i, unitSeconds] of SECONDS_PER_UNIT.entries()) {
		const part = match[i + 1];
		if (part !== undefined) {
			anyPart = true;
			total += Number(part) * unitSeconds;
		}
	}
	return anyPart && total > 0 ? total : null;
}

export const DURATION_FORMAT_MESSAGE =
	"must be an ISO 8601 duration in weeks, days, hours, minutes and seconds (for example PT5M), greater than zero; months and years are not accepted";

export const durationSchema = z
	.string()
	.max(64)
	.refine((text) => parseDurationSeconds(text) !== null, {
		message: DURATION_FORMAT_MESSAGE,
	});

export const INDEFINITE = "indefinite";

/** A duration, or the literal `indefinite`. */
export const validForSchema = z
	.string()
	.max(64)
	.refine(
		(text) => text === INDEFINITE || parseDurationSeconds(text) !== null,
		{
			message: `must be "${INDEFINITE}" or ${DURATION_FORMAT_MESSAGE}`,
		}
	);

// ---------------------------------------------------------------------------
// Parameter bags
// ---------------------------------------------------------------------------

/** A free-form parameter object, kept verbatim and bounded to 4 KB. */
export const paramsBagSchema = z
	.record(z.string().max(200), z.json())
	.refine((obj) => serializedByteLength(obj) <= PARAMS_MAX_BYTES, {
		message: `must serialize to at most ${PARAMS_MAX_BYTES} bytes`,
	});

type ParamsBag = z.infer<typeof paramsBagSchema>;

const versionSchema = z
	.string()
	.min(1, "is required")
	.max(VERSION_MAX_LENGTH, `must be at most ${VERSION_MAX_LENGTH} characters`);

function isNumberPair(value: unknown): boolean {
	return (
		Array.isArray(value) &&
		value.length === 2 &&
		value.every((entry) => typeof entry === "number" && Number.isFinite(entry))
	);
}

function isNonEmptyArray(value: unknown): boolean {
	return Array.isArray(value) && value.length > 0;
}

// ---------------------------------------------------------------------------
// Rule
// ---------------------------------------------------------------------------

export const RULE_KINDS = [
	"identity",
	"threshold",
	"band",
	"membership",
	"target",
] as const;

export const RULE_DIRECTIONS = ["maximize", "minimize"] as const;

/**
 * Checks that `params` carries what a rule of `kind` needs. `target` is
 * stored when a record carries it but is not otherwise interpreted.
 */
function checkRuleParams(
	rule: {
		kind: (typeof RULE_KINDS)[number];
		direction?: (typeof RULE_DIRECTIONS)[number];
		params?: ParamsBag;
	},
	ctx: z.RefinementCtx
): void {
	const params = rule.params ?? {};
	const fail = (path: (string | number)[], message: string) =>
		ctx.addIssue({ code: "custom", path, message });

	switch (rule.kind) {
		case "identity":
		case "target":
			return;
		case "threshold":
			if (!rule.direction) {
				fail(["direction"], "is required for a threshold rule");
			}
			if (typeof params.pass_values !== "number") {
				fail(["params", "pass_values"], "must be a number");
			}
			if (
				params.marginal_values !== undefined &&
				typeof params.marginal_values !== "number"
			) {
				fail(["params", "marginal_values"], "must be a number");
			}
			return;
		case "band":
			if (!isNumberPair(params.pass_values)) {
				fail(
					["params", "pass_values"],
					"must be a [low, high] pair of numbers"
				);
			}
			if (
				params.marginal_values !== undefined &&
				!isNumberPair(params.marginal_values)
			) {
				fail(
					["params", "marginal_values"],
					"must be a [low, high] pair of numbers"
				);
			}
			return;
		case "membership":
			if (!isNonEmptyArray(params.pass_values)) {
				fail(["params", "pass_values"], "must be a non-empty list");
			}
			if (
				params.marginal_values !== undefined &&
				!Array.isArray(params.marginal_values)
			) {
				fail(["params", "marginal_values"], "must be a list");
			}
			return;
		default:
			return;
	}
}

export const ruleSchema = z
	.strictObject({
		kind: z.enum(RULE_KINDS, {
			message: `must be one of ${RULE_KINDS.join(", ")}`,
		}),
		direction: z
			.enum(RULE_DIRECTIONS, { message: "must be maximize or minimize" })
			.optional(),
		params: paramsBagSchema.optional(),
		version: versionSchema,
	})
	.superRefine(checkRuleParams);

// ---------------------------------------------------------------------------
// Reduction
// ---------------------------------------------------------------------------

export const REDUCTION_KINDS = [
	"sum",
	"mean",
	"max",
	"min",
	"median",
	"percentile",
	"last",
] as const;

export const reductionSchema = z.strictObject({
	kind: z.enum(REDUCTION_KINDS, {
		message: `must be one of ${REDUCTION_KINDS.join(", ")}`,
	}),
	params: paramsBagSchema.optional(),
	rule: ruleSchema.optional(),
	version: versionSchema,
});

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

export const AGGREGATION_KINDS = [
	"proportion",
	"worst-of",
	"percentile",
] as const;

function isFraction(value: unknown): boolean {
	return typeof value === "number" && value >= 0 && value <= 1;
}

function checkAggregationParams(
	aggregation: {
		kind: (typeof AGGREGATION_KINDS)[number];
		params: ParamsBag;
	},
	ctx: z.RefinementCtx
): void {
	const { params } = aggregation;
	const fail = (key: string, message: string) =>
		ctx.addIssue({ code: "custom", path: ["params", key], message });

	if (params.avail_floor !== undefined && !isFraction(params.avail_floor)) {
		fail("avail_floor", "must be a number from 0 to 1");
	}
	if (
		params.use_verdict !== undefined &&
		typeof params.use_verdict !== "boolean"
	) {
		fail("use_verdict", "must be true or false");
	}
	if (aggregation.kind === "proportion") {
		if (!isFraction(params.threshold)) {
			fail("threshold", "must be a number from 0 to 1");
		}
		if (
			params.marginal_threshold !== undefined &&
			!isFraction(params.marginal_threshold)
		) {
			fail("marginal_threshold", "must be a number from 0 to 1");
		}
	}
	if (aggregation.kind === "percentile") {
		const percentile = params.percentile;
		if (typeof percentile !== "number" || percentile < 0 || percentile > 100) {
			fail("percentile", "must be a number from 0 to 100");
		}
	}
}

export const aggregationSchema = z
	.strictObject({
		kind: z.enum(AGGREGATION_KINDS, {
			message: `must be one of ${AGGREGATION_KINDS.join(", ")}`,
		}),
		params: paramsBagSchema,
		version: versionSchema,
	})
	.superRefine(checkAggregationParams);

export type HealthRule = z.infer<typeof ruleSchema>;
export type HealthReduction = z.infer<typeof reductionSchema>;
export type HealthAggregation = z.infer<typeof aggregationSchema>;
