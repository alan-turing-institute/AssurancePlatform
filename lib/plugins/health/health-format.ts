import type { HealthEvidenceRecord } from "@/lib/schemas/health-evidence";
import type {
	HealthRevocationCause,
	HealthStatus,
	HealthVerdict,
} from "./health-types";

export const VERDICT_DOT_CLASSES: Record<HealthVerdict, string> = {
	pass: "bg-success",
	marginal: "bg-warning",
	fail: "bg-destructive",
	indeterminate: "bg-muted-foreground",
};

export const VERDICT_WORDS: Record<HealthVerdict, string> = {
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
export function durationSeconds(text: string): number | null {
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

/**
 * What the rule the record names asks of a value, in words: "at least 0.8"
 * for a maximising threshold, "at most" for a minimising one, "exactly" for
 * a target, "between a and b" for a band, "one of ..." for a membership
 * rule. The record's own rule is used when it judges, otherwise the
 * reduction's.
 */
export function describeRule(record: Record1): string | null {
	const rule =
		record.rule.kind === "identity" ? record.reduction?.rule : record.rule;
	const pass = rule?.params?.pass_values;
	if (!rule || pass === undefined) {
		return null;
	}
	if (rule.kind === "threshold" && rule.direction) {
		return `${DIRECTION_PHRASES[rule.direction]} ${scalarText(pass)}`;
	}
	if (rule.kind === "band" && Array.isArray(pass)) {
		return `between ${pass[0]} and ${pass[1]}`;
	}
	if (rule.kind === "membership" && Array.isArray(pass)) {
		return `one of ${pass.map(scalarText).join(", ")}`;
	}
	return null;
}

function quantileLabel(key: string): string {
	const number = Number(key);
	return Number.isFinite(number) && number <= 1
		? `${Math.round(number * 1000) / 10}%`
		: key;
}

/** The uncertainty's interval, spread, quantiles or probability, as text. */
export function describeUncertaintyShape(
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
