import { z } from "zod";
import {
	checkStorableStrings,
	checkTextString,
	nameString,
} from "@/lib/schemas/health-evidence";
import {
	aggregationBaseSchema,
	isPlainObject,
	normaliseCombiningBlocks,
	PROTOTYPE_KEY,
	PROTOTYPE_KEY_MESSAGE,
	parseDurationSeconds,
	reductionBaseSchema,
	ruleBaseSchema,
} from "@/lib/schemas/health-rules";

/**
 * The list of checks a pipeline publishes to say what it can run. Field names
 * are the snake_case wire names. Unknown keys are refused at every level
 * except inside `params` bags, which are kept as given. The `recommended`
 * block is checked for shape only: whether its numbers would pass as
 * evidence settings is reported as a warning when the list is published, so
 * one unusable recommendation does not block the whole list.
 *
 * A check may describe its own settings as a list of `{key, label, type, ...}`
 * entries or as a plain object of name to default value, which is converted to
 * the list. A value type of `scalar` is stored as `number`, and version labels
 * inside a recommendation are accepted and dropped.
 */

export const MAX_PUBLISHED_CHECKS = 200;
/** A published check list may be at most this many bytes. */
export const CHECK_LIST_MAX_BYTES = 256 * 1024;

const DESCRIPTION_MAX_LENGTH = 2000;
const LABEL_MAX_LENGTH = 200;
const UNIT_MAX_LENGTH = 100;
const MAX_PARAMS_PER_CHECK = 50;
const MAX_OPTIONS = 100;
const MAX_ALLOWED_VALUES = 200;
const VALUE_TEXT_MAX_LENGTH = 500;

const PARAM_TYPES = [
	"string",
	"number",
	"boolean",
	"duration",
	"enum",
] as const;
export type CheckParamType = (typeof PARAM_TYPES)[number];

const label = (name: string) =>
	z
		.string()
		.min(1, `${name} is required`)
		.max(
			LABEL_MAX_LENGTH,
			`${name} must be at most ${LABEL_MAX_LENGTH} characters`
		);

const valueTypeSchema = z.discriminatedUnion(
	"type",
	[
		z.strictObject({ type: z.literal("boolean") }),
		z.strictObject({
			type: z.literal("number"),
			unit: z.string().max(UNIT_MAX_LENGTH).optional(),
		}),
		z.strictObject({
			type: z.literal("string"),
			allowed: z
				.array(z.string().max(VALUE_TEXT_MAX_LENGTH))
				.max(MAX_ALLOWED_VALUES)
				.optional(),
		}),
		z.strictObject({ type: z.literal("datetime") }),
	],
	{ error: "type must be one of boolean, number, string, datetime" }
);

/** A check that returns a number may call its value type `scalar`; it is stored as `number`. */
function scalarAsNumber(value: unknown): unknown {
	return isPlainObject(value) && value.type === "scalar"
		? { ...value, type: "number" }
		: value;
}

const paramSpecSchema = z
	.strictObject({
		key: checkTextString("key").refine((key) => key !== PROTOTYPE_KEY, {
			message: PROTOTYPE_KEY_MESSAGE,
		}),
		label: label("label"),
		type: z.enum(PARAM_TYPES, {
			message: `must be one of ${PARAM_TYPES.join(", ")}`,
		}),
		unit: z.string().max(UNIT_MAX_LENGTH).optional(),
		default: z
			.union([
				z.string().max(VALUE_TEXT_MAX_LENGTH),
				z.number().finite(),
				z.boolean(),
			])
			.optional(),
		options: z
			.array(z.string().min(1).max(LABEL_MAX_LENGTH))
			.min(1)
			.max(MAX_OPTIONS)
			.optional(),
	})
	.superRefine((param, ctx) => {
		const fail = (path: string, message: string) =>
			ctx.addIssue({ code: "custom", path: [path], message });
		if (param.type === "enum" && !param.options) {
			fail("options", "is required for an enum setting");
		}
		if (param.type !== "enum" && param.options) {
			fail("options", "is only used by an enum setting");
		}
		if (param.default !== undefined && !defaultFitsType(param)) {
			fail("default", `must be a value of type ${param.type}`);
		}
	});

type ParamSpecInput = z.input<typeof paramSpecSchema>;

function defaultFitsType(param: ParamSpecInput): boolean {
	const value = param.default;
	switch (param.type) {
		case "string":
			return typeof value === "string";
		case "number":
			return typeof value === "number";
		case "boolean":
			return typeof value === "boolean";
		case "duration":
			return typeof value === "string" && value.length > 0;
		case "enum":
			return typeof value === "string" && !!param.options?.includes(value);
		default:
			return false;
	}
}

// ---------------------------------------------------------------------------
// Check settings
// ---------------------------------------------------------------------------

const paramListSchema = z
	.array(paramSpecSchema, {
		error:
			"must be a list of settings or an object of setting names to default values",
	})
	.max(
		MAX_PARAMS_PER_CHECK,
		`must have at most ${MAX_PARAMS_PER_CHECK} entries`
	);

const PLAIN_PARAM_MESSAGE =
	"must have a default that is text, a number or true or false; use the list form for a setting with no default or with a fixed set of choices";

/** The type and default a plain setting's value stands for, or null when the value cannot be a default. */
function plainDefault(
	value: unknown
): Pick<ParamSpecInput, "default" | "type"> | null {
	if (typeof value === "boolean") {
		return { type: "boolean", default: value };
	}
	if (typeof value === "number") {
		return Number.isFinite(value) ? { type: "number", default: value } : null;
	}
	if (typeof value === "string") {
		const type = parseDurationSeconds(value) === null ? "string" : "duration";
		return { type, default: value };
	}
	return null;
}

/** A setting's name as the label shown beside it: underscores become spaces, the first letter is a capital and the rest are lower case. */
function labelOfKey(key: string): string {
	const [first = "", ...rest] = key.replaceAll("_", " ");
	return first.toUpperCase() + rest.join("").toLowerCase();
}

/**
 * A plain object of setting name to default value, as the list of settings it
 * stands for. Every other kind of value is returned as it came, so the list
 * schema reports it.
 */
function toParamList(value: unknown, ctx: z.RefinementCtx): unknown {
	if (!isPlainObject(value)) {
		return value;
	}
	const specs: ParamSpecInput[] = [];
	for (const [key, given] of Object.entries(value)) {
		const plain = plainDefault(given);
		const label = labelOfKey(key);
		if (key === "") {
			ctx.addIssue({
				code: "custom",
				message: "must not have a setting with an empty name",
			});
		} else if (plain === null) {
			ctx.addIssue({
				code: "custom",
				path: [key],
				message: PLAIN_PARAM_MESSAGE,
			});
		} else if (label.length > LABEL_MAX_LENGTH) {
			ctx.addIssue({
				code: "custom",
				path: [key],
				message: `is too long: its label would exceed ${LABEL_MAX_LENGTH} characters`,
			});
		} else {
			specs.push({ key, label, ...plain });
		}
	}
	return specs;
}

const paramsSchema = z.unknown().transform(toParamList).pipe(paramListSchema);

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

/** A version label inside a recommendation: accepted and dropped, since labels are counted by this server. */
const ignoredVersion = { version: z.string().max(LABEL_MAX_LENGTH).optional() };

function withoutVersion<T extends { version?: string | undefined }>(
	value: T
): Omit<T, "version"> {
	const { version: _dropped, ...rest } = value;
	return rest;
}

const recommendedRuleSchema = ruleBaseSchema
	.extend(ignoredVersion)
	.transform(withoutVersion);

/** The shape of a recommendation; any block may be absent. */
const recommendedSchema = z.strictObject({
	rule: recommendedRuleSchema.optional(),
	reduction: reductionBaseSchema
		.extend({ ...ignoredVersion, rule: recommendedRuleSchema.optional() })
		.transform(withoutVersion)
		.optional(),
	aggregation: aggregationBaseSchema
		.extend({ ...ignoredVersion, rule: recommendedRuleSchema.optional() })
		.transform(withoutVersion)
		.optional(),
	window: z.string().max(64).optional(),
	valid_for: z.string().max(64).optional(),
});

const checkEntrySchema = z.strictObject({
	name: checkTextString("name"),
	version: checkTextString("version"),
	description: z
		.string()
		.max(
			DESCRIPTION_MAX_LENGTH,
			`must be at most ${DESCRIPTION_MAX_LENGTH} characters`
		)
		.optional(),
	scope: checkTextString("scope"),
	scope_label: z
		.strictObject({ one: label("one"), many: label("many") })
		.optional(),
	value: z.preprocess(scalarAsNumber, valueTypeSchema),
	params: paramsSchema.optional(),
	recommended: recommendedSchema.optional(),
});

export type HealthCheck = z.output<typeof checkEntrySchema>;

/** A whole-system check is the one whose scope is the word `environment`. */
export const WHOLE_SYSTEM_SCOPE = "environment";

export const healthCheckListSchema = z
	.strictObject({
		pipeline: nameString("pipeline"),
		checks: z
			.array(checkEntrySchema)
			.max(
				MAX_PUBLISHED_CHECKS,
				`must have at most ${MAX_PUBLISHED_CHECKS} checks`
			),
	})
	.superRefine((list, ctx) => {
		const seen = new Set<string>();
		for (const [i, check] of list.checks.entries()) {
			if (seen.has(check.name)) {
				ctx.addIssue({
					code: "custom",
					path: ["checks", i, "name"],
					message: "is listed more than once",
				});
			}
			seen.add(check.name);
			const keys = new Set<string>();
			for (const [j, param] of (check.params ?? []).entries()) {
				if (keys.has(param.key)) {
					ctx.addIssue({
						code: "custom",
						path: ["checks", i, "params", j, "key"],
						message: "is listed more than once",
					});
				}
				keys.add(param.key);
			}
		}
		checkStorableStrings(list, [], ctx);
	});

export type HealthCheckList = z.output<typeof healthCheckListSchema>;

/**
 * A check's entry with its recommendation brought up to date: a share's pass
 * mark becomes the aggregation's own rule and a reduction's `p` becomes
 * `percentile`. An entry of any other shape is returned as it came.
 */
export function normaliseRecommendation(check: HealthCheck): HealthCheck;
export function normaliseRecommendation(check: unknown): unknown;
export function normaliseRecommendation(check: unknown): unknown {
	if (!(isPlainObject(check) && isPlainObject(check.recommended))) {
		return check;
	}
	const recommended = normaliseCombiningBlocks(check.recommended);
	return recommended === check.recommended ? check : { ...check, recommended };
}
