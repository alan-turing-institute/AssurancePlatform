import {
	type HealthCheck,
	WHOLE_SYSTEM_SCOPE,
} from "@/lib/schemas/health-checks";
import {
	blockIssues,
	checkListIssues,
	type HealthCriteriaSettings,
	issuesToFieldErrors,
	type PartialSettings,
	recommendedCheckParams,
	type ServedSettings,
	type SettingsIssue,
	timingIssues,
} from "@/lib/schemas/health-criteria";
import {
	INDEFINITE,
	type ParamsBag,
	parseDurationSeconds,
} from "@/lib/schemas/health-rules";

/**
 * The settings form's own value: every number is the text the person typed,
 * shares are percentages, and durations are an amount and a unit. It is
 * turned into the wire shape (`analyseDraft`) for validation and for saving,
 * and built from stored settings or a check's recommendation. Everything here
 * is pure, so it is tested without rendering.
 */

export const DURATION_UNITS = ["seconds", "minutes", "hours", "days"] as const;
export type DurationUnit = (typeof DURATION_UNITS)[number];

const UNIT_SECONDS: Record<DurationUnit, number> = {
	seconds: 1,
	minutes: 60,
	hours: 3600,
	days: 86_400,
};
const UNIT_DESIGNATORS: Record<DurationUnit, string> = {
	seconds: "S",
	minutes: "M",
	hours: "H",
	days: "D",
};
const LARGEST_FIRST: DurationUnit[] = ["days", "hours", "minutes", "seconds"];

export interface DurationDraft {
	amount: string;
	unit: DurationUnit;
}

const BLANK_DURATION: DurationDraft = { amount: "", unit: "minutes" };

/** An ISO 8601 duration as the largest single unit that represents it exactly; blank when it is not a duration. */
export function durationToDraft(iso: string | undefined): DurationDraft {
	const seconds = iso === undefined ? null : parseDurationSeconds(iso);
	if (seconds === null) {
		return BLANK_DURATION;
	}
	const unit =
		LARGEST_FIRST.find(
			(candidate) => seconds % UNIT_SECONDS[candidate] === 0
		) ?? "seconds";
	return { amount: String(seconds / UNIT_SECONDS[unit]), unit };
}

const WHOLE_NUMBER = /^\d{1,9}$/;

/** The ISO 8601 text for a draft, or null when the amount is not a whole number. */
function durationFromDraft(draft: DurationDraft): string | null {
	const amount = draft.amount.trim();
	if (!WHOLE_NUMBER.test(amount)) {
		return null;
	}
	const designator = UNIT_DESIGNATORS[draft.unit];
	return draft.unit === "days" ? `P${amount}D` : `PT${amount}${designator}`;
}

// ---------------------------------------------------------------------------
// Draft shapes
// ---------------------------------------------------------------------------

export type RuleShape =
	| "at-least"
	| "at-most"
	| "between"
	| "identity"
	| "one-of";

export interface RuleDraft {
	extra: ParamsBag;
	marginal: string;
	marginalHigh: string;
	marginalList: string;
	marginalLow: string;
	pass: string;
	passHigh: string;
	passList: string;
	passLow: string;
	shape: RuleShape;
}

const REDUCTION_KINDS = [
	"mean",
	"median",
	"max",
	"min",
	"last",
	"sum",
	"percentile",
] as const;
export type ReductionKind = (typeof REDUCTION_KINDS)[number];

export interface ReductionDraft {
	extra: ParamsBag;
	kind: ReductionKind;
	ownRule: boolean;
	percentile: string;
	readingsNeeded: string;
	rule: RuleDraft;
}

export interface AggregationDraft {
	answersNeeded: string;
	extra: ParamsBag;
	threshold: string;
}

export interface ParamDraft {
	amount: string;
	flag: boolean | undefined;
	text: string;
	unit: DurationUnit;
}

export interface CriteriaDraft {
	aggregation: AggregationDraft;
	indefinite: boolean;
	integrationId: string;
	params: Record<string, ParamDraft>;
	reduction: ReductionDraft;
	reductionOn: boolean;
	rule: RuleDraft;
	/**
	 * Values the settings hold for the check's own settings that the check's
	 * description no longer lists. They are sent as they stand, so the shared
	 * checks report each one beside its row until it is removed.
	 */
	unlistedParams?: Record<string, string | number | boolean>;
	validFor: DurationDraft;
	window: DurationDraft;
}

export type ValueType = HealthCheck["value"]["type"];

export function isWholeSystem(check: HealthCheck): boolean {
	return check.scope === WHOLE_SYSTEM_SCOPE;
}

/** Whether step 2 can be used at all: not for a whole-system check or one that returns text. */
export function reductionAvailable(check: HealthCheck): boolean {
	return !isWholeSystem(check) && check.value.type !== "string";
}

/** Whether the limits of a rule that judges the combined value are shares, shown as percentages. */
export function reductionRuleIsShare(
	valueType: ValueType,
	kind: ReductionKind
): boolean {
	return valueType === "boolean" && kind === "mean";
}

const BLANK_RULE: RuleDraft = {
	shape: "at-least",
	pass: "",
	marginal: "",
	passLow: "",
	passHigh: "",
	marginalLow: "",
	marginalHigh: "",
	passList: "",
	marginalList: "",
	extra: {},
};

function blankRule(shape: RuleShape = "at-least"): RuleDraft {
	return { ...BLANK_RULE, shape, extra: {} };
}

function defaultShape(valueType: ValueType): RuleShape {
	if (valueType === "boolean") {
		return "identity";
	}
	return valueType === "string" ? "one-of" : "at-least";
}

const BLANK_PARAM: ParamDraft = {
	text: "",
	flag: undefined,
	amount: "",
	unit: "minutes",
};

/** The draft of one of the check's own settings; blank when the draft has none for the key. */
export function paramDraftOf(draft: CriteriaDraft, key: string): ParamDraft {
	return draft.params[key] ?? BLANK_PARAM;
}

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

const PLAIN_DECIMAL = /^-?(\d+(\.\d*)?|\.\d+)$/;

/** A plain decimal number with an optional leading minus sign; hexadecimal, exponent and other forms are not numbers here. */
function parseNumber(text: string): number | null {
	const trimmed = text.trim();
	if (!PLAIN_DECIMAL.test(trimmed)) {
		return null;
	}
	const value = Number(trimmed);
	return Number.isFinite(value) ? value : null;
}

const PRECISION = 12;

function clean(value: number): number {
	return Number(value.toPrecision(PRECISION));
}

const LEADING_ZEROS = /^0+(?=\d)/;
const TRAILING_ZEROS = /0+$/;
const NUMBER_PARTS = /^(-?)(\d*)\.?(\d*)(?:e([+-]?\d+))?$/i;

/** Moves the decimal point of a number's text by `places` digits, without arithmetic, so no digit is lost. */
function shiftPoint(text: string, places: number): string {
	const parts = NUMBER_PARTS.exec(text.trim());
	if (!parts) {
		return text;
	}
	const [, sign = "", whole = "", fraction = "", exponent = "0"] = parts;
	const digits = `${whole}${fraction}`;
	const point = whole.length + Number(exponent) + places;
	let shifted: string;
	if (point <= 0) {
		shifted = `0.${"0".repeat(-point)}${digits}`;
	} else if (point >= digits.length) {
		shifted = `${digits}${"0".repeat(point - digits.length)}`;
	} else {
		shifted = `${digits.slice(0, point)}.${digits.slice(point)}`;
	}
	const [integer = "", decimals = ""] = shifted.split(".");
	const trimmedInteger = integer.replace(LEADING_ZEROS, "");
	const trimmedDecimals = decimals.replace(TRAILING_ZEROS, "");
	const magnitude = trimmedDecimals
		? `${trimmedInteger}.${trimmedDecimals}`
		: trimmedInteger;
	return magnitude === "0" ? magnitude : `${sign}${magnitude}`;
}

/** A fraction as the percentage text shown in the form; every digit of the stored number is kept. */
function fractionToPercent(value: unknown): string {
	return typeof value === "number" && Number.isFinite(value)
		? shiftPoint(String(value), 2)
		: "";
}

/** A typed percentage as the fraction it stands for, by moving the decimal point only. */
function percentToFraction(text: string): number | null {
	return parseNumber(text) === null ? null : Number(shiftPoint(text, -2));
}

function numberText(value: unknown): string {
	return typeof value === "number" && Number.isFinite(value)
		? String(value)
		: "";
}

function scaledText(value: unknown, share: boolean): string {
	return share ? fractionToPercent(value) : numberText(value);
}

function listText(value: unknown): string {
	return Array.isArray(value) ? value.map(String).join("\n") : "";
}

function pairParts(value: unknown, share: boolean): [string, string] {
	return Array.isArray(value) && value.length === 2
		? [scaledText(value[0], share), scaledText(value[1], share)]
		: ["", ""];
}

// ---------------------------------------------------------------------------
// Rule: stored block <-> draft
// ---------------------------------------------------------------------------

type RuleBlock = NonNullable<PartialSettings["rule"]>;

const RULE_KNOWN_PARAMS = new Set(["pass_values", "marginal_values"]);

function extraParams(
	params: ParamsBag | undefined,
	known: Set<string>
): ParamsBag {
	return Object.fromEntries(
		Object.entries(params ?? {}).filter(([key]) => !known.has(key))
	);
}

function shapeOfRule(rule: RuleBlock): RuleShape {
	if (rule.kind === "identity") {
		return "identity";
	}
	if (rule.kind === "band") {
		return "between";
	}
	if (rule.kind === "membership") {
		return "one-of";
	}
	return rule.direction === "minimize" ? "at-most" : "at-least";
}

/** A stored rule as a draft; `share` shows pass and marginal limits as percentages. */
function ruleToDraft(
	rule: RuleBlock | undefined,
	share: boolean
): RuleDraft | null {
	if (!rule) {
		return null;
	}
	const draft = blankRule(shapeOfRule(rule));
	const pass = rule.params?.pass_values;
	const marginal = rule.params?.marginal_values;
	draft.extra = extraParams(rule.params, RULE_KNOWN_PARAMS);
	if (rule.kind === "threshold") {
		draft.pass = scaledText(pass, share);
		draft.marginal = scaledText(marginal, share);
	} else if (rule.kind === "band") {
		[draft.passLow, draft.passHigh] = pairParts(pass, share);
		[draft.marginalLow, draft.marginalHigh] = pairParts(marginal, share);
	} else if (rule.kind === "membership") {
		draft.passList = listText(pass);
		draft.marginalList = listText(marginal);
	}
	return draft;
}

/** The same rule with its limits multiplied by `factor` (used when a share becomes a plain number and back). */
export function rescaleRule(rule: RuleDraft, factor: number): RuleDraft {
	const scale = (text: string) => {
		const value = parseNumber(text);
		return value === null ? text : String(clean(value * factor));
	};
	return {
		...rule,
		pass: scale(rule.pass),
		marginal: scale(rule.marginal),
		passLow: scale(rule.passLow),
		passHigh: scale(rule.passHigh),
		marginalLow: scale(rule.marginalLow),
		marginalHigh: scale(rule.marginalHigh),
	};
}

type Problems = Record<string, string>;

interface RuleBuildOptions {
	/** The values of a "one of" rule are numbers. */
	numeric: boolean;
	/** The limits are typed as percentages and sent as fractions. */
	share: boolean;
}

const NOT_A_NUMBER = "must be a number";

function limit(
	text: string,
	options: RuleBuildOptions,
	path: string,
	problems: Problems
): number | undefined {
	if (text.trim() === "") {
		return undefined;
	}
	const value = options.share ? percentToFraction(text) : parseNumber(text);
	if (value === null) {
		problems[path] = NOT_A_NUMBER;
		return undefined;
	}
	return value;
}

function pair(
	low: string,
	high: string,
	options: RuleBuildOptions,
	path: string,
	problems: Problems
): [number, number] | undefined {
	const a = limit(low, options, path, problems);
	const b = limit(high, options, path, problems);
	if ((low.trim() === "") !== (high.trim() === "") && !problems[path]) {
		problems[path] = "needs both ends";
	}
	return a === undefined || b === undefined ? undefined : [a, b];
}

function listValues(
	text: string,
	options: RuleBuildOptions,
	path: string,
	problems: Problems
): (string | number)[] {
	const lines = text
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line !== "");
	if (!options.numeric) {
		return lines;
	}
	const numbers: number[] = [];
	for (const line of lines) {
		const value = parseNumber(line);
		if (value === null) {
			problems[path] = "every value must be a number";
			return [];
		}
		numbers.push(value);
	}
	return numbers;
}

function ruleParams(
	draft: RuleDraft,
	options: RuleBuildOptions,
	prefix: string,
	problems: Problems
): ParamsBag {
	const at = (key: string) => `${prefix}.params.${key}`;
	const params: ParamsBag = { ...draft.extra };
	const set = (
		key: string,
		value: number[] | (string | number)[] | number | undefined
	) => {
		if (value !== undefined) {
			params[key] = value;
		}
	};
	if (draft.shape === "at-least" || draft.shape === "at-most") {
		set("pass_values", limit(draft.pass, options, at("pass_values"), problems));
		set(
			"marginal_values",
			limit(draft.marginal, options, at("marginal_values"), problems)
		);
	} else if (draft.shape === "between") {
		set(
			"pass_values",
			pair(draft.passLow, draft.passHigh, options, at("pass_values"), problems)
		);
		set(
			"marginal_values",
			pair(
				draft.marginalLow,
				draft.marginalHigh,
				options,
				at("marginal_values"),
				problems
			)
		);
	} else if (draft.shape === "one-of") {
		const pass = listValues(
			draft.passList,
			options,
			at("pass_values"),
			problems
		);
		const marginal = listValues(
			draft.marginalList,
			options,
			at("marginal_values"),
			problems
		);
		set("pass_values", pass.length > 0 ? pass : undefined);
		set("marginal_values", marginal.length > 0 ? marginal : undefined);
	}
	return params;
}

function buildRule(
	draft: RuleDraft,
	options: RuleBuildOptions,
	prefix: string,
	problems: Problems
): RuleBlock {
	const params = ruleParams(draft, options, prefix, problems);
	const withParams = Object.keys(params).length > 0 ? { params } : {};
	switch (draft.shape) {
		case "at-least":
			return { kind: "threshold", direction: "maximize", ...withParams };
		case "at-most":
			return { kind: "threshold", direction: "minimize", ...withParams };
		case "between":
			return { kind: "band", ...withParams };
		case "one-of":
			return { kind: "membership", ...withParams };
		default:
			return { kind: "identity", ...withParams };
	}
}

// ---------------------------------------------------------------------------
// Reduction and aggregation
// ---------------------------------------------------------------------------

const REDUCTION_KNOWN_PARAMS = new Set(["avail_floor", "p"]);
const AGGREGATION_KNOWN_PARAMS = new Set([
	"threshold",
	"avail_floor",
	"use_verdict",
	"marginal_threshold",
]);

type ReductionBlock = NonNullable<PartialSettings["reduction"]>;
type AggregationBlock = NonNullable<PartialSettings["aggregation"]>;

function isReductionKind(kind: string): kind is ReductionKind {
	return (REDUCTION_KINDS as readonly string[]).includes(kind);
}

const BLANK_REDUCTION: ReductionDraft = {
	kind: "mean",
	percentile: "",
	readingsNeeded: "",
	ownRule: false,
	rule: blankRule(),
	extra: {},
};

function reductionToDraft(
	reduction: ReductionBlock | undefined,
	valueType: ValueType
): ReductionDraft {
	if (!reduction) {
		return { ...BLANK_REDUCTION, rule: blankRule(), extra: {} };
	}
	const kind = isReductionKind(reduction.kind) ? reduction.kind : "mean";
	const share = reductionRuleIsShare(valueType, kind);
	const own = ruleToDraft(reduction.rule, share);
	return {
		kind,
		percentile: numberText(reduction.params?.p),
		readingsNeeded: fractionToPercent(reduction.params?.avail_floor),
		ownRule: own !== null,
		rule: own ?? blankRule(),
		extra: extraParams(reduction.params, REDUCTION_KNOWN_PARAMS),
	};
}

function aggregationToDraft(
	aggregation: AggregationBlock | undefined
): AggregationDraft {
	return {
		threshold: fractionToPercent(aggregation?.params.threshold),
		answersNeeded: fractionToPercent(aggregation?.params.avail_floor),
		extra: extraParams(aggregation?.params, AGGREGATION_KNOWN_PARAMS),
	};
}

/**
 * Whether the reading rule cannot judge the combined value, so step 2 needs
 * a rule of its own. Decided by the shared check, so the rule lives in one
 * place.
 */
export function ownRuleRequired(
	readingShape: RuleShape,
	kind: ReductionKind,
	check: HealthCheck
): boolean {
	if (readingShape !== "identity" && readingShape !== "one-of") {
		return false;
	}
	const probe: PartialSettings = {
		rule: { kind: readingShape === "identity" ? "identity" : "membership" },
		reduction: { kind },
	};
	return checkListIssues(probe, check, true).some(
		(issue) => issue.path.join(".") === "reduction.rule"
	);
}

const KIND_OF_SHAPE: Record<
	RuleShape,
	"band" | "identity" | "membership" | "threshold"
> = {
	identity: "identity",
	"at-least": "threshold",
	"at-most": "threshold",
	between: "band",
	"one-of": "membership",
};

/** Whether a rule shape can judge this check's readings, by the shared check. */
export function shapeFitsCheck(shape: RuleShape, check: HealthCheck): boolean {
	const kind = KIND_OF_SHAPE[shape];
	return !checkListIssues({ rule: { kind } }, check, true).some(
		(issue) => issue.path.join(".") === "rule.kind"
	);
}

// ---------------------------------------------------------------------------
// Check parameters
// ---------------------------------------------------------------------------

function paramToDraft(
	spec: NonNullable<HealthCheck["params"]>[number],
	value: unknown
): ParamDraft {
	const draft = { ...BLANK_PARAM };
	if (value === undefined) {
		return draft;
	}
	if (spec.type === "boolean") {
		draft.flag = typeof value === "boolean" ? value : undefined;
	} else if (spec.type === "duration") {
		const parts = durationToDraft(
			typeof value === "string" ? value : undefined
		);
		draft.amount = parts.amount;
		draft.unit = parts.unit;
	} else {
		draft.text = String(value);
	}
	return draft;
}

function paramsToDraft(
	check: HealthCheck,
	values: Record<string, unknown>
): Record<string, ParamDraft> {
	return Object.fromEntries(
		(check.params ?? []).map((spec) => [
			spec.key,
			paramToDraft(spec, values[spec.key]),
		])
	);
}

function paramValue(
	spec: NonNullable<HealthCheck["params"]>[number],
	draft: ParamDraft,
	problems: Problems
): string | number | boolean | undefined {
	const path = `check.params.${spec.key}`;
	if (spec.type === "boolean") {
		return draft.flag;
	}
	if (spec.type === "duration") {
		if (draft.amount.trim() === "") {
			return undefined;
		}
		const iso = durationFromDraft(draft);
		if (iso === null) {
			problems[path] = "must be a whole number";
		}
		return iso ?? undefined;
	}
	if (draft.text === "") {
		return undefined;
	}
	if (spec.type === "number") {
		const value = parseNumber(draft.text);
		if (value === null) {
			problems[path] = NOT_A_NUMBER;
		}
		return value ?? undefined;
	}
	return draft.text;
}

// ---------------------------------------------------------------------------
// Whole draft
// ---------------------------------------------------------------------------

function defaultRuleFor(check: HealthCheck): RuleDraft {
	return blankRule(defaultShape(check.value.type));
}

/** A draft filled from a check's own recommendation and parameter defaults. */
export function draftFromCheck(
	check: HealthCheck,
	integrationId: string
): CriteriaDraft {
	const { recommended } = check;
	const valueType = check.value.type;
	const reductionOn =
		reductionAvailable(check) && recommended?.reduction !== undefined;
	return {
		integrationId,
		params: paramsToDraft(check, recommendedCheckParams(check)),
		rule: ruleToDraft(recommended?.rule, false) ?? defaultRuleFor(check),
		reductionOn,
		reduction: reductionToDraft(recommended?.reduction, valueType),
		aggregation: aggregationToDraft(recommended?.aggregation),
		window: durationToDraft(recommended?.window),
		validFor: validForToDraft(recommended?.valid_for),
		indefinite: recommended?.valid_for === INDEFINITE,
	};
}

function validForToDraft(value: string | undefined): DurationDraft {
	return value === INDEFINITE ? BLANK_DURATION : durationToDraft(value);
}

/** The settings as stored (and served), as a draft. */
export function draftFromStored(
	settings: ServedSettings,
	check: HealthCheck,
	integrationId: string
): CriteriaDraft {
	return {
		integrationId,
		params: paramsToDraft(check, settings.check.params ?? {}),
		rule: ruleToDraft(settings.rule, false) ?? defaultRuleFor(check),
		reductionOn: settings.reduction !== undefined,
		reduction: reductionToDraft(settings.reduction, check.value.type),
		aggregation: aggregationToDraft(settings.aggregation),
		window: durationToDraft(settings.window),
		validFor: validForToDraft(settings.valid_for),
		indefinite: settings.valid_for === INDEFINITE,
	};
}

function checkBlock(
	draft: CriteriaDraft,
	check: HealthCheck,
	problems: Problems
): NonNullable<PartialSettings["check"]> {
	const params: Record<string, string | number | boolean> = {
		...draft.unlistedParams,
	};
	for (const spec of check.params ?? []) {
		const value = paramValue(
			spec,
			draft.params[spec.key] ?? BLANK_PARAM,
			problems
		);
		if (value !== undefined) {
			params[spec.key] = value;
		}
	}
	return {
		name: check.name,
		version: check.version,
		scope: check.scope,
		...(Object.keys(params).length > 0 && { params }),
	};
}

function reductionBlock(
	draft: CriteriaDraft,
	check: HealthCheck,
	problems: Problems
): ReductionBlock {
	const { reduction } = draft;
	const params: ParamsBag = { ...reduction.extra };
	const floor = reduction.readingsNeeded.trim();
	if (floor !== "") {
		const value = percentToFraction(floor);
		if (value === null) {
			problems["reduction.params.avail_floor"] = NOT_A_NUMBER;
		} else {
			params.avail_floor = value;
		}
	}
	if (reduction.kind === "percentile") {
		const value = parseNumber(reduction.percentile);
		if (value === null) {
			problems["reduction.params.p"] = NOT_A_NUMBER;
		} else {
			params.p = value;
		}
	}
	const own =
		reduction.ownRule ||
		ownRuleRequired(draft.rule.shape, reduction.kind, check);
	const share = reductionRuleIsShare(check.value.type, reduction.kind);
	return {
		kind: reduction.kind,
		...(Object.keys(params).length > 0 && { params }),
		...(own && {
			rule: buildRule(
				reduction.rule,
				{ share, numeric: true },
				"reduction.rule",
				problems
			),
		}),
	};
}

/** Whether the draft's step 3 holds any value, as opposed to being blank. */
export function aggregationIsHeld(aggregation: AggregationDraft): boolean {
	return (
		aggregation.threshold.trim() !== "" ||
		aggregation.answersNeeded.trim() !== "" ||
		Object.keys(aggregation.extra).length > 0
	);
}

/** Step 3 with nothing in it. */
export const BLANK_AGGREGATION: AggregationDraft = {
	answersNeeded: "",
	extra: {},
	threshold: "",
};

function aggregationBlock(
	draft: CriteriaDraft,
	problems: Problems
): AggregationBlock {
	const { aggregation } = draft;
	const params: ParamsBag = { ...aggregation.extra };
	if (aggregation.threshold.trim() === "") {
		problems["aggregation.params.threshold"] = "is required";
	}
	for (const [text, key] of [
		[aggregation.threshold, "threshold"],
		[aggregation.answersNeeded, "avail_floor"],
	] as const) {
		if (text.trim() === "") {
			continue;
		}
		const value = percentToFraction(text);
		if (value === null) {
			problems[`aggregation.params.${key}`] = NOT_A_NUMBER;
		} else {
			params[key] = value;
		}
	}
	params.use_verdict = true;
	return { kind: "proportion", params };
}

function durationProblem(draft: DurationDraft): string {
	return draft.amount.trim() === ""
		? "is required"
		: "must be a whole number greater than zero";
}

export interface DraftAnalysis {
	/** The settings as far as the draft can be turned into them; complete when `errors` is empty. */
	complete: HealthCriteriaSettings | null;
	/** Problems by dotted path, without the `settings.` prefix the server adds. */
	errors: Record<string, string>;
	settings: PartialSettings;
}

function isComplete(
	settings: PartialSettings
): settings is HealthCriteriaSettings {
	return (
		settings.check !== undefined &&
		settings.rule !== undefined &&
		settings.window !== undefined &&
		settings.valid_for !== undefined
	);
}

function issuesOf(
	settings: PartialSettings,
	check: HealthCheck
): SettingsIssue[] {
	return [
		...blockIssues(settings),
		...timingIssues(settings),
		...checkListIssues(settings, check),
	];
}

/**
 * Turns the form's value into settings and checks them with the same
 * functions the server uses. A field whose text cannot be read is left out
 * of the settings and reported under its own path.
 */
export function analyseDraft(
	draft: CriteriaDraft,
	check: HealthCheck
): DraftAnalysis {
	const problems: Problems = {};
	const valueType = check.value.type;
	const settings: PartialSettings = {
		check: checkBlock(draft, check, problems),
		rule: buildRule(
			draft.rule,
			{ share: false, numeric: valueType === "number" },
			"rule",
			problems
		),
	};
	// A combining step the check cannot use is still sent when the draft holds
	// it, so the shared checks report it and the person can remove it.
	if (draft.reductionOn) {
		settings.reduction = reductionBlock(draft, check, problems);
	}
	if (!isWholeSystem(check) || aggregationIsHeld(draft.aggregation)) {
		settings.aggregation = aggregationBlock(draft, problems);
	}
	const window = durationFromDraft(draft.window);
	if (window === null) {
		problems.window = durationProblem(draft.window);
	} else {
		settings.window = window;
	}
	if (draft.indefinite) {
		settings.valid_for = INDEFINITE;
	} else {
		const validFor = durationFromDraft(draft.validFor);
		if (validFor === null) {
			problems.valid_for = durationProblem(draft.validFor);
		} else {
			settings.valid_for = validFor;
		}
	}
	const errors = {
		...issuesToFieldErrors(issuesOf(settings, check)),
		...problems,
	};
	return {
		settings,
		errors,
		complete:
			Object.keys(errors).length === 0 && isComplete(settings)
				? settings
				: null,
	};
}

/** Whether the check's own recommendation can be saved as it stands. */
export function recommendationIsUsable(
	check: HealthCheck,
	integrationId: string
): boolean {
	return (
		check.recommended !== undefined &&
		analyseDraft(draftFromCheck(check, integrationId), check).complete !== null
	);
}

export function draftsEqual(a: CriteriaDraft, b: CriteriaDraft): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

const FRIENDLY_NAMES: [string, string][] = [
	["marginal_threshold", "the marginal limit"],
	["marginal_values", "the marginal limit"],
	["pass_values", "the pass limit"],
	["avail_floor", "the share needed"],
];

const SHARE_PATH = /(threshold|avail_floor)$/;

/** A message from the shared checks in the form's own words; shares read as percentages. */
export function friendlyMessage(path: string, message: string): string {
	let text = message;
	for (const [name, words] of FRIENDLY_NAMES) {
		text = text.replaceAll(name, words);
	}
	return SHARE_PATH.test(path)
		? text.replace("from 0 to 1", "from 0 to 100")
		: text;
}
