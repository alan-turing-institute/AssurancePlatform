import { z } from "zod";
import {
	checkStorableStrings,
	checkTextString,
	nameString,
} from "@/lib/schemas/health-evidence";
import {
	aggregationBaseSchema,
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

const paramSpecSchema = z
	.strictObject({
		key: checkTextString("key"),
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

/** The shape of a recommendation; any block may be absent. */
const recommendedSchema = z.strictObject({
	rule: ruleBaseSchema.optional(),
	reduction: reductionBaseSchema
		.extend({ rule: ruleBaseSchema.optional() })
		.optional(),
	aggregation: aggregationBaseSchema.optional(),
	window: z.string().max(64).optional(),
	valid_for: z.string().max(64).optional(),
});

export type HealthCheckRecommended = z.output<typeof recommendedSchema>;

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
	value: valueTypeSchema,
	params: z
		.array(paramSpecSchema)
		.max(
			MAX_PARAMS_PER_CHECK,
			`must have at most ${MAX_PARAMS_PER_CHECK} entries`
		)
		.optional(),
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
