import type {
	HealthEvidenceRecord,
	HealthVerdict,
} from "@/lib/schemas/health-evidence";
import type { HealthRevocationCause, HealthStatus } from "./health-types";

export const VERDICT_DOT_CLASSES: Record<HealthVerdict, string> = {
	pass: "bg-success",
	marginal: "bg-warning",
	fail: "bg-destructive",
	indeterminate: "bg-muted-foreground",
};

const VERDICT_WORDS: Record<HealthVerdict, string> = {
	pass: "passing",
	marginal: "marginal",
	fail: "failing",
	indeterminate: "indeterminate",
};

export const VERDICT_LABELS: Record<HealthVerdict, string> = {
	pass: "Pass",
	marginal: "Marginal",
	fail: "Fail",
	indeterminate: "Indeterminate",
};

export const CAUSE_LABELS: Record<HealthRevocationCause, string> = {
	"evidence-defect": "Evidence defect",
	"binding-defect": "Binding defect",
	duplicate: "Duplicate",
	superseded: "Superseded",
	other: "Other",
};

const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
	dateStyle: "medium",
	timeStyle: "short",
});

/** A timestamp for people, in the viewer's time zone; the original text when it is not a date. */
export function formatDateTime(iso: string): string {
	const date = new Date(iso);
	return Number.isNaN(date.getTime()) ? iso : dateTimeFormat.format(date);
}

const DURATION_PATTERN =
	/^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/;
const DURATION_UNITS = [
	{ seconds: 604_800, name: "week" },
	{ seconds: 86_400, name: "day" },
	{ seconds: 3600, name: "hour" },
	{ seconds: 60, name: "minute" },
	{ seconds: 1, name: "second" },
] as const;

/** Length of a week/day/hour/minute/second ISO 8601 duration, or null. */
function durationSeconds(text: string): number | null {
	const match = DURATION_PATTERN.exec(text);
	if (!match || text === "P" || text.endsWith("T")) {
		return null;
	}
	let total = 0;
	for (const [index, unit] of DURATION_UNITS.entries()) {
		total += Number(match[index + 1] ?? 0) * unit.seconds;
	}
	return total;
}

/** "PT1H" as "1 hour"; the original text when it is not a duration. */
export function describeDuration(text: string): string {
	const match = DURATION_PATTERN.exec(text);
	if (!match || durationSeconds(text) === null) {
		return text;
	}
	const parts: string[] = [];
	for (const [index, unit] of DURATION_UNITS.entries()) {
		const count = Number(match[index + 1] ?? 0);
		if (count > 0) {
			parts.push(`${count} ${unit.name}${count === 1 ? "" : "s"}`);
		}
	}
	return parts.join(" ");
}

/** The window a record covers: its timestamp minus `window`, up to the timestamp. */
export function windowRange(
	timestamp: string,
	window: string
): { end: string; start: string } | null {
	const seconds = durationSeconds(window);
	const end = Date.parse(timestamp);
	if (seconds === null || Number.isNaN(end)) {
		return null;
	}
	return {
		start: new Date(end - seconds * 1000).toISOString(),
		end: new Date(end).toISOString(),
	};
}

type Record1 = HealthEvidenceRecord;

function scalarText(value: unknown): string {
	return typeof value === "string" ? value : JSON.stringify(value);
}

/** A record's value with its unit; null when the record carries no value. */
export function describeValue(record: Record1): string | null {
	const { value } = record;
	if (value === undefined) {
		return null;
	}
	if (typeof value === "object") {
		return value.unit ? `${value.number} ${value.unit}` : String(value.number);
	}
	return String(value);
}

const DIRECTION_PHRASES = {
	maximize: "at least",
	minimize: "at most",
	target: "exactly",
} as const;

type Rule1 = Record1["rule"];

const MARGINAL_PHRASES = {
	maximize: "marginal from",
	minimize: "marginal up to",
	target: "marginal at",
} as const;

function pairText(pair: unknown): string {
	return Array.isArray(pair) ? `${pair[0]} and ${pair[1]}` : scalarText(pair);
}

function listText(list: unknown): string {
	return Array.isArray(list)
		? list.map(scalarText).join(", ")
		: scalarText(list);
}

/**
 * A rule in words: "passes when true" for identity, "at least N", "at most
 * N" or "exactly N" for a threshold by direction, "between a and b" for a
 * band, "one of ..." for a membership rule. A marginal limit is added in
 * brackets when the rule has one.
 */
function describeRuleWords(rule: Rule1): string {
	const pass = rule.params?.pass_values;
	const marginal = rule.params?.marginal_values;
	let text = "passes when true";
	let marginalText: string | null = null;
	if (rule.kind === "threshold" && rule.direction && pass !== undefined) {
		text = `${DIRECTION_PHRASES[rule.direction]} ${scalarText(pass)}`;
		if (marginal !== undefined) {
			marginalText = `${MARGINAL_PHRASES[rule.direction]} ${scalarText(marginal)}`;
		}
	} else if (rule.kind === "band" && pass !== undefined) {
		text = `between ${pairText(pass)}`;
		if (marginal !== undefined) {
			marginalText = `marginal between ${pairText(marginal)}`;
		}
	} else if (rule.kind === "membership" && pass !== undefined) {
		text = `one of ${listText(pass)}`;
		if (marginal !== undefined) {
			marginalText = `marginal: ${listText(marginal)}`;
		}
	}
	return marginalText ? `${text} (${marginalText})` : text;
}

function describeReduction(
	reduction: NonNullable<Record1["reduction"]>
): string {
	const p = reduction.params?.p;
	const kind =
		reduction.kind === "percentile" && p !== undefined
			? `percentile ${scalarText(p)}`
			: reduction.kind;
	const judged = reduction.rule
		? describeRuleWords(reduction.rule)
		: "judged by the reading rule";
	return `${kind}, ${judged} \u00b7 ${reduction.version}`;
}

function describeAggregation(
	aggregation: NonNullable<Record1["aggregation"]>
): string {
	const { params } = aggregation;
	let text: string = aggregation.kind;
	if (aggregation.kind === "proportion") {
		text = `share passing at least ${scalarText(params.threshold)}`;
		if (params.marginal_threshold !== undefined) {
			text += ` (marginal from ${scalarText(params.marginal_threshold)})`;
		}
	} else if (aggregation.kind === "percentile") {
		text = `the ${scalarText(params.percentile)}th percentile, judged by the rule above`;
	} else if (aggregation.kind === "worst-of") {
		text = "the worst value, judged by the rule above";
	}
	return `${text} \u00b7 ${aggregation.version}`;
}

/**
 * One line per level of judgement the record has, in the order the evidence
 * flows: each reading, each subject over the window (when a reduction is
 * present), then across all subjects (when an aggregation is present). The
 * scope word is the record's own, unaltered.
 */
export function describeLevels(
	record: Record1
): { label: string; text: string }[] {
	const { scope } = record.check;
	const levels = [
		{
			label: "Each reading",
			text: `${describeRuleWords(record.rule)} \u00b7 ${record.rule.version}`,
		},
	];
	if (record.reduction) {
		levels.push({
			label: `Each ${scope} over the window`,
			text: describeReduction(record.reduction),
		});
	}
	if (record.aggregation) {
		levels.push({
			label: `Across all ${scope} subjects`,
			text: describeAggregation(record.aggregation),
		});
	}
	return levels;
}

function quantileLabel(key: string): string {
	const number = Number(key);
	return Number.isFinite(number) && number <= 1
		? `${Math.round(number * 1000) / 10}%`
		: key;
}

/** The uncertainty's interval, spread, quantiles or probability, as text. */
function describeUncertaintyShape(
	uncertainty: NonNullable<Record1["uncertainty"]>
): string {
	const { kind, params } = uncertainty;
	if (kind === "interval") {
		return `interval ${scalarText(params.lower)} to ${scalarText(params.upper)}`;
	}
	if (kind === "std") {
		return `± ${scalarText(params.std)} (standard deviation)`;
	}
	if (kind === "probability") {
		return `probability ${scalarText(params.p)}`;
	}
	const quantiles =
		typeof params.q === "object" &&
		params.q !== null &&
		!Array.isArray(params.q)
			? Object.entries(params.q)
			: [];
	return `quantiles ${quantiles
		.map(([key, value]) => `${quantileLabel(key)}: ${scalarText(value)}`)
		.join(", ")}`;
}

const INAPPLICABLE_PATTERN = /^\s*inapplicable/i;

/** The uncertainty in full: its shape, then level, method, nature and whether it was validated. */
export function describeUncertainty(
	uncertainty: NonNullable<Record1["uncertainty"]>
): string {
	let validation: string | null = null;
	if (uncertainty.validated !== undefined) {
		validation = uncertainty.validated ? "validated" : "not validated";
	}
	const notes = [
		uncertainty.level === undefined
			? null
			: `${Math.round(uncertainty.level * 1000) / 10}% level`,
		`method ${uncertainty.method}`,
		`${uncertainty.nature} uncertainty`,
		validation,
	].filter((note): note is string => note !== null);
	return `${describeUncertaintyShape(uncertainty)} (${notes.join(", ")})`;
}

/** Whether an indeterminate record is saying its check did not apply. */
export function isInapplicable(record: Record1): boolean {
	return (
		record.verdict === "indeterminate" &&
		INAPPLICABLE_PATTERN.test(record.comment ?? "")
	);
}

/** Only an explicit http or https address is made a link. */
export function isWebAddress(text: string): boolean {
	return text.startsWith("http://") || text.startsWith("https://");
}

/** True once the status is stale by the server, or its expiry has passed on this clock. */
export function isStatusStale(status: HealthStatus, now: number): boolean {
	return (
		status.stale ||
		(status.expires_at !== null && Date.parse(status.expires_at) <= now)
	);
}

/**
 * The dot's accessible label: the verdict in words, "stale since <time>" for
 * a stale one, or "all evidence revoked" when no verdict is left.
 */
export function describeBadge(status: HealthStatus, stale: boolean): string {
	if (status.verdict === null) {
		return "Health: all evidence revoked";
	}
	const label = `Health: ${VERDICT_WORDS[status.verdict]}`;
	if (!stale) {
		return label;
	}
	const since = status.stale_since ?? status.expires_at;
	return since
		? `${label}, stale since ${formatDateTime(since)}`
		: `${label}, stale`;
}
