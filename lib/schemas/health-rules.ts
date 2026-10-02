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

/** The longest accepted duration: 100 years of 365 days. */
const MAX_DURATION_SECONDS = 100 * 365 * 86_400;

/**
 * Length of an ISO 8601 duration in seconds, or `null` when the text is not
 * a duration in the accepted form, its length is not greater than zero, or it
 * exceeds 100 years.
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
	return anyPart && total > 0 && total <= MAX_DURATION_SECONDS ? total : null;
}

const DURATION_FORMAT_MESSAGE =
	"must be an ISO 8601 duration in weeks, days, hours, minutes and seconds (for example PT5M), greater than zero and at most 100 years; months and years are not accepted";

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

export type ParamsBag = z.infer<typeof paramsBagSchema>;

const versionSchema = z
	.string()
	.min(1, "is required")
	.max(VERSION_MAX_LENGTH, `must be at most ${VERSION_MAX_LENGTH} characters`);

const isFiniteNumber = (value: unknown): boolean =>
	typeof value === "number" && Number.isFinite(value);

const isNumberPair = (value: unknown): boolean =>
	Array.isArray(value) && value.length === 2 && value.every(isFiniteNumber);

const isNonEmptyArray = (value: unknown): boolean =>
	Array.isArray(value) && value.length > 0;

export interface ParamIssue {
	message: string;
	path: (string | number)[];
}

/** An issue for `params[key]` when it is missing (and required) or present but not valid. */
function paramIssue(
	params: ParamsBag,
	key: string,
	isValid: (value: unknown) => boolean,
	message: string,
	required: boolean
): ParamIssue[] {
	const value = params[key];
	if (value === undefined ? !required : isValid(value)) {
		return [];
	}
	return [{ path: ["params", key], message }];
}

// ---------------------------------------------------------------------------
// Rule
// ---------------------------------------------------------------------------

const RULE_KINDS = ["identity", "threshold", "band", "membership"] as const;

const RULE_DIRECTIONS = ["maximize", "minimize", "target"] as const;

export interface RuleInput {
	direction?: (typeof RULE_DIRECTIONS)[number];
	kind: (typeof RULE_KINDS)[number];
	params?: ParamsBag;
}

/**
 * What each kind of rule needs in `params`.
 */
const RULE_PARAM_CHECKS: Record<
	RuleInput["kind"],
	(rule: RuleInput, params: ParamsBag) => ParamIssue[]
> = {
	identity: () => [],
	threshold: (rule, params) => [
		...(rule.direction
			? []
			: [{ path: ["direction"], message: "is required for a threshold rule" }]),
		...paramIssue(
			params,
			"pass_values",
			isFiniteNumber,
			"must be a number",
			true
		),
		...paramIssue(
			params,
			"marginal_values",
			isFiniteNumber,
			"must be a number",
			false
		),
	],
	band: (_rule, params) => [
		...paramIssue(
			params,
			"pass_values",
			isNumberPair,
			"must be a [low, high] pair of numbers",
			true
		),
		...paramIssue(
			params,
			"marginal_values",
			isNumberPair,
			"must be a [low, high] pair of numbers",
			false
		),
	],
	membership: (_rule, params) => [
		...paramIssue(
			params,
			"pass_values",
			isNonEmptyArray,
			"must be a non-empty list",
			true
		),
		...paramIssue(
			params,
			"marginal_values",
			Array.isArray,
			"must be a list",
			false
		),
	],
};

/** What `rule` is missing or has wrong for its kind, as issues relative to the rule. */
export function ruleParamIssues(rule: RuleInput): ParamIssue[] {
	return RULE_PARAM_CHECKS[rule.kind](rule, rule.params ?? {});
}

export function checkRuleParams(rule: RuleInput, ctx: z.RefinementCtx): void {
	for (const issue of ruleParamIssues(rule)) {
		ctx.addIssue({ code: "custom", ...issue });
	}
}

/** A rule without its version label and without the per-kind parameter checks. */
export const ruleBaseSchema = z.strictObject({
	kind: z.enum(RULE_KINDS, {
		message: `must be one of ${RULE_KINDS.join(", ")}`,
	}),
	direction: z
		.enum(RULE_DIRECTIONS, {
			message: "must be maximize, minimize or target",
		})
		.optional(),
	params: paramsBagSchema.optional(),
});

export const ruleSchema = ruleBaseSchema
	.extend({ version: versionSchema })
	.superRefine(checkRuleParams);

// ---------------------------------------------------------------------------
// Reduction
// ---------------------------------------------------------------------------

const REDUCTION_KINDS = [
	"sum",
	"mean",
	"max",
	"min",
	"median",
	"percentile",
	"last",
] as const;

/** A reduction without its own rule and without its version label. */
export const reductionBaseSchema = z.strictObject({
	kind: z.enum(REDUCTION_KINDS, {
		message: `must be one of ${REDUCTION_KINDS.join(", ")}`,
	}),
	params: paramsBagSchema.optional(),
});

export const reductionSchema = reductionBaseSchema.extend({
	rule: ruleSchema.optional(),
	version: versionSchema,
});

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

const AGGREGATION_KINDS = ["proportion", "worst-of", "percentile"] as const;

export function isFraction(value: unknown): boolean {
	return typeof value === "number" && value >= 0 && value <= 1;
}

export interface AggregationInput {
	kind: (typeof AGGREGATION_KINDS)[number];
	params: ParamsBag;
}

/** What `aggregation` has wrong in its `params` for its kind, as issues relative to the aggregation. */
export function aggregationParamIssues(
	aggregation: AggregationInput
): ParamIssue[] {
	const { params } = aggregation;
	const issues: ParamIssue[] = [];
	const fail = (key: string, message: string) =>
		issues.push({ path: ["params", key], message });

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
	return issues;
}

function checkAggregationParams(
	aggregation: AggregationInput,
	ctx: z.RefinementCtx
): void {
	for (const issue of aggregationParamIssues(aggregation)) {
		ctx.addIssue({ code: "custom", ...issue });
	}
}

/** An aggregation without its version label and without the per-kind parameter checks. */
export const aggregationBaseSchema = z.strictObject({
	kind: z.enum(AGGREGATION_KINDS, {
		message: `must be one of ${AGGREGATION_KINDS.join(", ")}`,
	}),
	params: paramsBagSchema,
});

export const aggregationSchema = aggregationBaseSchema
	.extend({ version: versionSchema })
	.superRefine(checkAggregationParams);
