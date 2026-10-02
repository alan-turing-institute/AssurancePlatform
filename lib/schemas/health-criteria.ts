import { z } from "zod";
import { canonicalJSON } from "@/lib/health-canonical-json";
import { uuidSchema } from "@/lib/schemas/base";
import {
	type CheckParamType,
	type HealthCheck,
	WHOLE_SYSTEM_SCOPE,
} from "@/lib/schemas/health-checks";
import {
	checkStorableStrings,
	checkTextString,
	reasonSchema,
} from "@/lib/schemas/health-evidence";
import {
	aggregationBaseSchema,
	aggregationParamIssues,
	durationSchema,
	INDEFINITE,
	paramsBagSchema,
	parseDurationSeconds,
	reductionBaseSchema,
	ruleBaseSchema,
	ruleParamIssues,
	validForSchema,
} from "@/lib/schemas/health-rules";

/**
 * A claim's evidence settings: which check to run, how each reading is
 * judged, how a subject's readings are combined, how subjects are combined
 * into the claim's result, and how long a result counts. The shapes here are
 * stricter than a record's: a record reports what a pipeline did, settings
 * tell it what to do, so only combinations the pipeline can carry out are
 * accepted. Version labels are never part of the request; the server builds
 * them from counters (`servedSettings`).
 */

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

export interface SettingsIssue {
	message: string;
	path: (string | number)[];
}

const checkBlockSchema = z.strictObject({
	name: checkTextString("name"),
	version: checkTextString("version"),
	scope: checkTextString("scope").optional(),
	params: paramsBagSchema.optional(),
});

const settingsReductionSchema = reductionBaseSchema.extend({
	rule: ruleBaseSchema.optional(),
});

type RuleBlock = z.output<typeof ruleBaseSchema>;
type ReductionBlock = z.output<typeof settingsReductionSchema>;
type AggregationBlock = z.output<typeof aggregationBaseSchema>;

/** The blocks of settings that can be checked without the check list; each may be absent. */
export interface SettingsBlocks {
	aggregation?: AggregationBlock;
	reduction?: ReductionBlock;
	rule?: RuleBlock;
	valid_for?: string;
	window?: string;
}

const RULE_KINDS_FOR_REDUCTION = ["threshold", "band"];
const FIELD_NOT_AVAILABLE = "is not available in evidence settings";

function prefixed(path: (string | number)[], issues: SettingsIssue[]) {
	return issues.map((issue) => ({
		path: [...path, ...issue.path],
		message: issue.message,
	}));
}

function isNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

function pairOf(value: unknown): [number, number] | null {
	return Array.isArray(value) &&
		value.length === 2 &&
		isNumber(value[0]) &&
		isNumber(value[1])
		? [value[0], value[1]]
		: null;
}

function thresholdLimitIssues(rule: RuleBlock): SettingsIssue[] {
	const pass = rule.params?.pass_values;
	const marginal = rule.params?.marginal_values;
	if (!(isNumber(pass) && isNumber(marginal))) {
		return [];
	}
	const fails =
		rule.direction === "minimize" ? marginal <= pass : marginal >= pass;
	if (!fails || rule.direction === undefined) {
		return [];
	}
	return [
		{
			path: ["params", "marginal_values"],
			message: `must lie on the failing side of pass_values (${rule.direction === "minimize" ? "above" : "below"} it)`,
		},
	];
}

function bandLimitIssues(rule: RuleBlock): SettingsIssue[] {
	const pass = pairOf(rule.params?.pass_values);
	const marginal = pairOf(rule.params?.marginal_values);
	const issues: SettingsIssue[] = [];
	if (pass && pass[0] > pass[1]) {
		issues.push({
			path: ["params", "pass_values"],
			message: "must be a [low, high] pair with low not above high",
		});
	}
	if (marginal && marginal[0] > marginal[1]) {
		issues.push({
			path: ["params", "marginal_values"],
			message: "must be a [low, high] pair with low not above high",
		});
	} else if (
		pass &&
		marginal &&
		pass[0] <= pass[1] &&
		(marginal[0] > pass[0] || marginal[1] < pass[1])
	) {
		issues.push({
			path: ["params", "marginal_values"],
			message: "must contain the pass_values band",
		});
	}
	return issues;
}

/** What is wrong with one rule, relative to the rule. */
function ruleIssues(rule: RuleBlock): SettingsIssue[] {
	const issues: SettingsIssue[] = [...ruleParamIssues(rule)];
	if (rule.direction === "target") {
		issues.push({
			path: ["direction"],
			message: `"target" ${FIELD_NOT_AVAILABLE}`,
		});
	} else if (rule.direction !== undefined && rule.kind !== "threshold") {
		issues.push({
			path: ["direction"],
			message: "is only used by a threshold rule",
		});
	}
	if (rule.kind === "threshold") {
		issues.push(...thresholdLimitIssues(rule));
	}
	if (rule.kind === "band") {
		issues.push(...bandLimitIssues(rule));
	}
	return issues;
}

function reductionIssues(reduction: ReductionBlock): SettingsIssue[] {
	const issues: SettingsIssue[] = [];
	const { params } = reduction;
	if (reduction.kind === "percentile") {
		const p = params?.p;
		if (!isNumber(p) || p < 0 || p > 100) {
			issues.push({
				path: ["params", "p"],
				message: "must be a number from 0 to 100 for a percentile",
			});
		}
	}
	const floor = params?.avail_floor;
	if (floor !== undefined && !(isNumber(floor) && floor >= 0 && floor <= 1)) {
		issues.push({
			path: ["params", "avail_floor"],
			message: "must be a number from 0 to 1",
		});
	}
	if (reduction.rule) {
		if (!RULE_KINDS_FOR_REDUCTION.includes(reduction.rule.kind)) {
			issues.push({
				path: ["rule", "kind"],
				message: "must be threshold or band",
			});
		}
		issues.push(...prefixed(["rule"], ruleIssues(reduction.rule)));
	}
	return issues;
}

function aggregationIssues(aggregation: AggregationBlock): SettingsIssue[] {
	if (aggregation.kind !== "proportion") {
		return [{ path: ["kind"], message: "must be proportion" }];
	}
	const issues: SettingsIssue[] = [];
	const { params } = aggregation;
	if (params.marginal_threshold !== undefined) {
		issues.push({
			path: ["params", "marginal_threshold"],
			message: FIELD_NOT_AVAILABLE,
		});
	}
	for (const issue of aggregationParamIssues(aggregation)) {
		if (issue.path.at(-1) !== "marginal_threshold") {
			issues.push(issue);
		}
	}
	if (params.use_verdict === undefined) {
		issues.push({
			path: ["params", "use_verdict"],
			message: "is required and must be true",
		});
	} else if (params.use_verdict === false) {
		issues.push({ path: ["params", "use_verdict"], message: "must be true" });
	}
	return issues;
}

/** Checks on the blocks that need nothing but the blocks themselves. */
export function blockIssues(blocks: SettingsBlocks): SettingsIssue[] {
	return [
		...prefixed(["rule"], blocks.rule ? ruleIssues(blocks.rule) : []),
		...prefixed(
			["reduction"],
			blocks.reduction ? reductionIssues(blocks.reduction) : []
		),
		...prefixed(
			["aggregation"],
			blocks.aggregation ? aggregationIssues(blocks.aggregation) : []
		),
	];
}

/** Checks on the two durations, for the blocks that are present. */
export function timingIssues(blocks: SettingsBlocks): SettingsIssue[] {
	const issues: SettingsIssue[] = [];
	if (
		blocks.window !== undefined &&
		!durationSchema.safeParse(blocks.window).success
	) {
		issues.push({ path: ["window"], message: "is not a valid duration" });
	}
	if (
		blocks.valid_for !== undefined &&
		!validForSchema.safeParse(blocks.valid_for).success
	) {
		issues.push({
			path: ["valid_for"],
			message: `must be "${INDEFINITE}" or a valid duration`,
		});
	}
	return issues;
}

export const healthCriteriaSettingsSchema = z
	.strictObject({
		check: checkBlockSchema,
		rule: ruleBaseSchema,
		reduction: settingsReductionSchema.optional(),
		aggregation: aggregationBaseSchema.optional(),
		window: durationSchema,
		valid_for: validForSchema,
	})
	.superRefine((settings, ctx) => {
		for (const issue of blockIssues(settings)) {
			ctx.addIssue({ code: "custom", ...issue });
		}
		checkStorableStrings(settings, [], ctx);
	});

export type HealthCriteriaSettings = z.output<
	typeof healthCriteriaSettingsSchema
>;

/** The body of `PUT /api/elements/[id]/health/criteria`. */
export const criteriaSaveRequestSchema = z.strictObject({
	integration_id: uuidSchema,
	settings: healthCriteriaSettingsSchema,
	accept: z.boolean({ error: "must be true or false" }),
});

/** The body of `POST /api/elements/[id]/health/criteria/retirement`. */
export const criteriaRetirementRequestSchema = z.strictObject({
	reason: reasonSchema.optional(),
});

// ---------------------------------------------------------------------------
// Checks that need the check list
// ---------------------------------------------------------------------------

type ValueType = HealthCheck["value"]["type"];

const RULE_KINDS_FOR_VALUE: Record<ValueType, string[]> = {
	boolean: ["identity"],
	number: ["threshold", "band", "membership"],
	string: ["membership"],
	datetime: [],
};

const VALUE_WORDS: Record<ValueType, string> = {
	boolean: "yes-or-no",
	number: "numeric",
	string: "text",
	datetime: "date-and-time",
};

/** Readings combined into a number that an identity or membership rule cannot judge. */
const NUMERIC_REDUCTIONS = ["sum", "mean", "median", "percentile"];

function paramFits(
	type: CheckParamType,
	value: unknown,
	options: string[] | undefined
): boolean {
	switch (type) {
		case "string":
			return typeof value === "string";
		case "number":
			return isNumber(value);
		case "boolean":
			return typeof value === "boolean";
		case "duration":
			return typeof value === "string" && parseDurationSeconds(value) !== null;
		case "enum":
			return typeof value === "string" && !!options?.includes(value);
		default:
			return false;
	}
}

function checkParamIssues(
	given: Record<string, unknown> | undefined,
	described: HealthCheck["params"]
): SettingsIssue[] {
	const issues: SettingsIssue[] = [];
	for (const [key, value] of Object.entries(given ?? {})) {
		const spec = described?.find((param) => param.key === key);
		if (!spec) {
			issues.push({
				path: ["check", "params", key],
				message: "is not a setting this check describes",
			});
		} else if (!paramFits(spec.type, value, spec.options)) {
			issues.push({
				path: ["check", "params", key],
				message: `must be a value of type ${spec.type}`,
			});
		}
	}
	return issues;
}

function structureIssues(
	settings: PartialSettings,
	check: HealthCheck,
	partial: boolean
): SettingsIssue[] {
	const issues: SettingsIssue[] = [];
	const valueType = check.value.type;
	const wholeSystem = check.scope === WHOLE_SYSTEM_SCOPE;

	if (wholeSystem) {
		for (const block of ["reduction", "aggregation"] as const) {
			if (settings[block]) {
				issues.push({
					path: [block],
					message: "is not used by a whole-system check",
				});
			}
		}
		return issues;
	}
	if (!(settings.aggregation || partial)) {
		issues.push({ path: ["aggregation"], message: "is required" });
	}
	if (settings.reduction && valueType === "string") {
		issues.push({
			path: ["reduction"],
			message: "is not used by a check that returns text",
		});
	} else if (
		settings.reduction &&
		settings.rule &&
		!settings.reduction.rule &&
		["identity", "membership"].includes(settings.rule.kind) &&
		NUMERIC_REDUCTIONS.includes(settings.reduction.kind)
	) {
		issues.push({
			path: ["reduction", "rule"],
			message: `is required: a ${settings.rule.kind} rule cannot judge the ${settings.reduction.kind} of several readings`,
		});
	}
	return issues;
}

export type PartialSettings = SettingsBlocks & {
	check?: z.output<typeof checkBlockSchema>;
};

/**
 * What is wrong with `settings` for `check`, one entry per field. With
 * `partial`, blocks that are absent are not reported as missing, which is how
 * a check's recommendation is judged: it may name only some of the blocks.
 */
export function checkListIssues(
	settings: PartialSettings,
	check: HealthCheck,
	partial = false
): SettingsIssue[] {
	const issues: SettingsIssue[] = [];
	if (
		settings.check?.scope !== undefined &&
		settings.check.scope !== check.scope
	) {
		issues.push({
			path: ["check", "scope"],
			message: `must be ${check.scope}, the scope the check list gives`,
		});
	}
	issues.push(...checkParamIssues(settings.check?.params, check.params));
	if (settings.rule) {
		const allowed = RULE_KINDS_FOR_VALUE[check.value.type];
		if (!allowed.includes(settings.rule.kind)) {
			issues.push({
				path: ["rule", "kind"],
				message:
					allowed.length === 0
						? "a check that returns a date and time cannot be set up yet"
						: `a ${VALUE_WORDS[check.value.type]} check is judged by a ${allowed.join(" or ")} rule, not ${settings.rule.kind}`,
			});
		}
	}
	issues.push(...structureIssues(settings, check, partial));
	return issues;
}

/** Field errors keyed by dotted path; the first message for a path wins. */
export function issuesToFieldErrors(
	issues: SettingsIssue[]
): Record<string, string> {
	const fieldErrors: Record<string, string> = {};
	for (const issue of issues) {
		fieldErrors[issue.path.join(".") || "(settings)"] ??= issue.message;
	}
	return fieldErrors;
}

/** The parameter values a check names as defaults, as the starting point for its settings. */
export function recommendedCheckParams(
	check: HealthCheck
): Record<string, string | number | boolean> {
	const defaults: Record<string, string | number | boolean> = {};
	for (const param of check.params ?? []) {
		if (param.default !== undefined) {
			defaults[param.key] = param.default;
		}
	}
	return defaults;
}

// ---------------------------------------------------------------------------
// Version labels
// ---------------------------------------------------------------------------

export interface VersionCounters {
	aggregation: number;
	reduction: number;
	rule: number;
}

const same = (a: unknown, b: unknown): boolean =>
	canonicalJSON(a ?? null) === canonicalJSON(b ?? null);

/**
 * The counters after saving `next`. A counter starts at 0 and goes up by one
 * each time a save changes its block (a first save counts as a change for
 * every block present). A block that is absent keeps its counter, and adding
 * it back counts as a change. Changing the check's name raises all three. A
 * counter never goes back, so a label never means two different things.
 */
export function nextCounters(
	previous: {
		counters: VersionCounters;
		settings: HealthCriteriaSettings;
	} | null,
	next: HealthCriteriaSettings
): VersionCounters {
	if (!previous) {
		return {
			rule: 1,
			reduction: next.reduction ? 1 : 0,
			aggregation: next.aggregation ? 1 : 0,
		};
	}
	const { counters, settings } = previous;
	if (settings.check.name !== next.check.name) {
		return {
			rule: counters.rule + 1,
			reduction: counters.reduction + 1,
			aggregation: counters.aggregation + 1,
		};
	}
	const bump = (count: number, before: unknown, after: unknown): number =>
		after !== undefined && !same(before, after) ? count + 1 : count;
	return {
		rule: bump(counters.rule, settings.rule, next.rule),
		reduction: bump(counters.reduction, settings.reduction, next.reduction),
		aggregation: bump(
			counters.aggregation,
			settings.aggregation,
			next.aggregation
		),
	};
}

const ruleLabel = (n: number) => `r${n}`;
const reductionLabel = (n: number) => `d${n}`;
const aggregationLabel = (n: number) => `a${n}`;

export interface ServedSettings {
	aggregation?: AggregationBlock & { version: string };
	check: {
		name: string;
		params?: Record<string, unknown>;
		scope?: string;
		version: string;
	};
	reduction?: Omit<ReductionBlock, "rule"> & {
		rule?: RuleBlock & { version: string };
		version: string;
	};
	rule: RuleBlock & { version: string };
	valid_for: string;
	window: string;
}

/** The settings as they are handed to a pipeline and recorded in the history: the stored blocks with their version labels in place. */
export function servedSettings(
	settings: HealthCriteriaSettings,
	counters: VersionCounters
): ServedSettings {
	const reductionVersion = reductionLabel(counters.reduction);
	const { rule: reductionRule, ...reduction } = settings.reduction ?? {};
	return {
		check: settings.check,
		rule: { ...settings.rule, version: ruleLabel(counters.rule) },
		...(settings.reduction && {
			reduction: {
				...reduction,
				kind: settings.reduction.kind,
				...(reductionRule && {
					rule: { ...reductionRule, version: reductionVersion },
				}),
				version: reductionVersion,
			},
		}),
		...(settings.aggregation && {
			aggregation: {
				...settings.aggregation,
				version: aggregationLabel(counters.aggregation),
			},
		}),
		window: settings.window,
		valid_for: settings.valid_for,
	};
}

// ---------------------------------------------------------------------------
// Where each block came from
// ---------------------------------------------------------------------------

export type BlockSource = "recommended" | "edited" | "hand";

export interface SettingsSource {
	aggregation?: BlockSource;
	check_params?: BlockSource;
	check_version: string;
	kind: BlockSource;
	reduction?: BlockSource;
	rule: BlockSource;
	timing: BlockSource;
}

const BLOCK_KEYS = [
	"check_params",
	"rule",
	"reduction",
	"aggregation",
	"timing",
] as const;

function compareBlock(
	recommended: unknown,
	current: unknown
): BlockSource | null {
	if (recommended === undefined && current === undefined) {
		return null;
	}
	if (recommended === undefined) {
		return "hand";
	}
	return same(recommended, current) ? "recommended" : "edited";
}

function overallKind(
	source: Record<string, BlockSource | undefined>
): BlockSource {
	const values = BLOCK_KEYS.map((key) => source[key]).filter(
		(value): value is BlockSource => value !== undefined
	);
	if (values.every((value) => value === "recommended")) {
		return "recommended";
	}
	return values.every((value) => value === "hand") ? "hand" : "edited";
}

function blocksOf(settings: HealthCriteriaSettings) {
	return {
		check_params:
			settings.check.params && Object.keys(settings.check.params).length > 0
				? settings.check.params
				: undefined,
		rule: settings.rule,
		reduction: settings.reduction,
		aggregation: settings.aggregation,
		timing: { window: settings.window, valid_for: settings.valid_for },
	};
}

function recommendedBlocks(check: HealthCheck) {
	const { recommended } = check;
	const defaults = recommendedCheckParams(check);
	return {
		check_params: Object.keys(defaults).length > 0 ? defaults : undefined,
		rule: recommended?.rule,
		reduction: recommended?.reduction,
		aggregation: recommended?.aggregation,
		timing:
			recommended?.window === undefined && recommended?.valid_for === undefined
				? undefined
				: { window: recommended?.window, valid_for: recommended?.valid_for },
	};
}

type SourceByKey = Record<string, BlockSource | undefined>;

function sourceAgainstCheck(
	current: ReturnType<typeof blocksOf>,
	check: HealthCheck
): SourceByKey {
	const recommended = recommendedBlocks(check);
	const result: SourceByKey = {};
	for (const key of BLOCK_KEYS) {
		result[key] = compareBlock(recommended[key], current[key]) ?? undefined;
	}
	return result;
}

function sourceAgainstPrevious(
	current: ReturnType<typeof blocksOf>,
	previous: { settings: HealthCriteriaSettings; source: SettingsSource } | null
): SourceByKey {
	const before = previous ? blocksOf(previous.settings) : null;
	const result: SourceByKey = {};
	for (const key of BLOCK_KEYS) {
		if (current[key] === undefined) {
			continue;
		}
		const earlier = previous?.source[key];
		if (before && same(before[key], current[key])) {
			result[key] = earlier;
		} else {
			result[key] =
				earlier === "recommended" || earlier === "edited" ? "edited" : "hand";
		}
	}
	return result;
}

/**
 * For each block, whether it equals what the check recommends, differs from
 * it, or was written by hand because the check recommends none. A block that
 * is absent on both sides is left out. When the check is no longer in the
 * list, a block that has not changed since the previous save keeps its label
 * and a changed block is `edited` if it had a recommendation behind it.
 */
export function computeSource(
	settings: HealthCriteriaSettings,
	check: HealthCheck | null,
	previous: { settings: HealthCriteriaSettings; source: SettingsSource } | null
): SettingsSource {
	const current = blocksOf(settings);
	const result = check
		? sourceAgainstCheck(current, check)
		: sourceAgainstPrevious(current, previous);
	return {
		kind: overallKind(result),
		check_version: settings.check.version,
		rule: result.rule ?? "hand",
		timing: result.timing ?? "hand",
		...(result.check_params && { check_params: result.check_params }),
		...(result.reduction && { reduction: result.reduction }),
		...(result.aggregation && { aggregation: result.aggregation }),
	};
}

// ---------------------------------------------------------------------------
// The echo check
// ---------------------------------------------------------------------------

export interface EchoDifference {
	declared: unknown;
	field: string;
	used: unknown;
}

/** The parts of a record the echo check reads. */
export interface EchoRecord {
	aggregation?: { version: string };
	check: { params?: Record<string, unknown>; version: string };
	reduction?: { version: string };
	rule: { version: string };
	valid_for: string;
	window: string;
}

function sameLength(declared: string, used: string): boolean {
	const a = parseDurationSeconds(declared);
	const b = parseDurationSeconds(used);
	return a !== null && b !== null ? a === b : declared === used;
}

function blockDifferences(
	field: "reduction" | "aggregation",
	declared: { version: string } | undefined,
	used: { version: string } | undefined
): EchoDifference[] {
	if (!(declared || used)) {
		return [];
	}
	if (!(declared && used)) {
		return [
			{
				field,
				declared: declared?.version ?? null,
				used: used?.version ?? null,
			},
		];
	}
	return declared.version === used.version
		? []
		: [
				{
					field: `${field}.version`,
					declared: declared.version,
					used: used.version,
				},
			];
}

/**
 * How a record differs from the settings declared for its claim: the
 * check's version and settings, the three block versions (and whether the
 * reduction and aggregation are used at all), and the window and validity
 * compared as lengths of time. An empty list means the record is a match.
 * A record's check name needs no comparison, since the claim's binding
 * already refuses a record naming another check.
 */
export function compareEcho(
	record: EchoRecord,
	declared: ServedSettings
): EchoDifference[] {
	const differences: EchoDifference[] = [];
	if (record.check.version !== declared.check.version) {
		differences.push({
			field: "check.version",
			declared: declared.check.version,
			used: record.check.version,
		});
	}
	const declaredParams = declared.check.params ?? {};
	const usedParams = record.check.params ?? {};
	if (!same(declaredParams, usedParams)) {
		differences.push({
			field: "check.params",
			declared: declaredParams,
			used: usedParams,
		});
	}
	if (record.rule.version !== declared.rule.version) {
		differences.push({
			field: "rule.version",
			declared: declared.rule.version,
			used: record.rule.version,
		});
	}
	differences.push(
		...blockDifferences("reduction", declared.reduction, record.reduction),
		...blockDifferences("aggregation", declared.aggregation, record.aggregation)
	);
	if (!sameLength(declared.window, record.window)) {
		differences.push({
			field: "window",
			declared: declared.window,
			used: record.window,
		});
	}
	if (!sameLength(declared.valid_for, record.valid_for)) {
		differences.push({
			field: "valid_for",
			declared: declared.valid_for,
			used: record.valid_for,
		});
	}
	return differences;
}

// ---------------------------------------------------------------------------
// Comparing a record with a stored row
// ---------------------------------------------------------------------------

/** The columns of a stored settings row that the echo check reads. */
export interface StoredCriteria {
	aggregationVersion: number;
	reductionVersion: number;
	revision: number;
	ruleVersion: number;
	settings: unknown;
	state: "SUGGESTED" | "ACCEPTED" | "INACTIVE";
}

export function countersOf(row: StoredCriteria): VersionCounters {
	return {
		rule: row.ruleVersion,
		reduction: row.reductionVersion,
		aggregation: row.aggregationVersion,
	};
}

/** A stored row's settings, with version labels in place. */
export function servedFromStored(row: StoredCriteria): ServedSettings {
	return servedSettings(
		row.settings as HealthCriteriaSettings,
		countersOf(row)
	);
}

export type EchoState = "MATCH" | "MISMATCH" | "UNDECLARED";

/**
 * The comparison of `record` with the settings accepted for its claim:
 * undeclared when there is no row or the row is not accepted, otherwise a
 * match or a mismatch with the differences listed.
 */
export function echoAgainst(
	record: EchoRecord,
	row: StoredCriteria | null
): {
	differences: EchoDifference[] | null;
	revision: number | null;
	state: EchoState;
} {
	if (!row || row.state !== "ACCEPTED") {
		return { state: "UNDECLARED", differences: null, revision: null };
	}
	const differences = compareEcho(record, servedFromStored(row));
	return differences.length === 0
		? { state: "MATCH", differences: null, revision: row.revision }
		: { state: "MISMATCH", differences, revision: row.revision };
}
