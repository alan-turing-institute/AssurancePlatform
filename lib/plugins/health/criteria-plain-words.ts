import type { HealthCheck } from "@/lib/schemas/health-checks";
import type { PartialSettings } from "@/lib/schemas/health-criteria";
import type { HealthVerdict } from "@/lib/schemas/health-evidence";
import { INDEFINITE } from "@/lib/schemas/health-rules";
import {
	isWholeSystem,
	type ReductionKind,
	reductionRuleIsShare,
} from "./criteria-draft";
import { describeDuration } from "./health-format";

/**
 * The settings in plain words, from the settings and the check's entry in
 * its check list. Subject words come from the check's own labels, and every
 * number in the settings appears with its direction in words. A value that
 * has not been entered yet reads "(not set)", so the sentences follow the
 * form as it is being filled in.
 */

type RuleBlock = NonNullable<PartialSettings["rule"]>;

export interface PlainSentence {
	key:
		| "answers-needed"
		| "check-settings"
		| "claim"
		| "reading"
		| "readings-needed"
		| "reduction"
		| "rule"
		| "validity"
		| "window";
	text: string;
}

export interface RuleOutcome {
	text: string;
	verdict: Extract<HealthVerdict, "fail" | "marginal" | "pass">;
}

const NOT_SET = "(not set)";
const PERCENT = 100;
const PRECISION = 12;

interface Scale {
	/** Limits are shares, written as percentages. */
	share: boolean;
	unit: string | undefined;
}

function writeNumber(value: unknown, scale: Scale): string {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		return NOT_SET;
	}
	if (scale.share) {
		return `${Number((value * PERCENT).toPrecision(PRECISION))}%`;
	}
	return scale.unit ? `${value} ${scale.unit}` : String(value);
}

function writeShare(value: unknown): string {
	return writeNumber(value, { share: true, unit: undefined });
}

function writePair(value: unknown, scale: Scale): [string, string] {
	return Array.isArray(value) && value.length === 2
		? [writeNumber(value[0], scale), writeNumber(value[1], scale)]
		: [NOT_SET, NOT_SET];
}

function writeList(value: unknown): string {
	return Array.isArray(value) && value.length > 0
		? value.map(String).join(", ")
		: NOT_SET;
}

function hasValue(value: unknown): boolean {
	return value !== undefined && value !== null;
}

function thresholdOutcomes(rule: RuleBlock, scale: Scale): RuleOutcome[] {
	const pass = writeNumber(rule.params?.pass_values, scale);
	const marginalGiven = hasValue(rule.params?.marginal_values);
	const marginal = writeNumber(rule.params?.marginal_values, scale);
	if (rule.direction === "minimize") {
		return [
			{ verdict: "pass", text: `it is at most ${pass}` },
			...(marginalGiven
				? [
						{
							verdict: "marginal" as const,
							text: `it is above ${pass} but at most ${marginal}`,
						},
					]
				: []),
			{
				verdict: "fail",
				text: `it is above ${marginalGiven ? marginal : pass}`,
			},
		];
	}
	return [
		{ verdict: "pass", text: `it is at least ${pass}` },
		...(marginalGiven
			? [
					{
						verdict: "marginal" as const,
						text: `it is at least ${marginal} but below ${pass}`,
					},
				]
			: []),
		{ verdict: "fail", text: `it is below ${marginalGiven ? marginal : pass}` },
	];
}

function bandOutcomes(rule: RuleBlock, scale: Scale): RuleOutcome[] {
	const [passLow, passHigh] = writePair(rule.params?.pass_values, scale);
	const marginalGiven = hasValue(rule.params?.marginal_values);
	const [marginalLow, marginalHigh] = writePair(
		rule.params?.marginal_values,
		scale
	);
	const outer = marginalGiven
		? `${marginalLow} and ${marginalHigh}`
		: `${passLow} and ${passHigh}`;
	return [
		{ verdict: "pass", text: `it is between ${passLow} and ${passHigh}` },
		...(marginalGiven
			? [
					{
						verdict: "marginal" as const,
						text: `it is between ${marginalLow} and ${marginalHigh} but not between ${passLow} and ${passHigh}`,
					},
				]
			: []),
		{ verdict: "fail", text: `it is not between ${outer}` },
	];
}

/**
 * What a rule counts as a pass, as marginal and as a fail, as short phrases
 * that follow "when" ("it is at least 40 items/min"). The settings form
 * shows the same phrases beside coloured verdict words.
 */
export function ruleOutcomes(rule: RuleBlock, scale: Scale): RuleOutcome[] {
	if (rule.kind === "threshold") {
		return thresholdOutcomes(rule, scale);
	}
	if (rule.kind === "band") {
		return bandOutcomes(rule, scale);
	}
	if (rule.kind === "membership") {
		const marginalGiven = hasValue(rule.params?.marginal_values);
		return [
			{
				verdict: "pass",
				text: `it is one of ${writeList(rule.params?.pass_values)}`,
			},
			...(marginalGiven
				? [
						{
							verdict: "marginal" as const,
							text: `it is one of ${writeList(rule.params?.marginal_values)}`,
						},
					]
				: []),
			{
				verdict: "fail",
				text: marginalGiven
					? "it is in neither list"
					: "it is not in that list",
			},
		];
	}
	return [
		{ verdict: "pass", text: "the answer is yes" },
		{ verdict: "fail", text: "the answer is no" },
	];
}

const VERDICT_VERBS = {
	pass: "passes",
	marginal: "is marginal",
	fail: "fails",
} as const;

/** "passes when it is at least 5, is marginal when it is at least 3 but below 5, and fails when it is below 3". */
function outcomesClause(outcomes: RuleOutcome[]): string {
	const parts = outcomes.map(
		({ verdict, text }) => `${VERDICT_VERBS[verdict]} when ${text}`
	);
	if (parts.length <= 2) {
		return parts.join(" and ");
	}
	return `${parts.slice(0, -1).join(", ")}, and ${parts.at(-1)}`;
}

function capitalise(text: string): string {
	return text.charAt(0).toUpperCase() + text.slice(1);
}

const SOUNDS_LIKE_CONSONANT = /^(uni|use|usu|uti|eu|one|once)/i;
const SOUNDS_LIKE_VOWEL = /^(hour|honest|honou?r|heir)/i;
const LEADING_NUMBER = /^\d+/;
const VOWEL_START = /^[aeiou]/i;

/** The word with "a" or "an" before it, chosen by how the word starts when spoken. */
function withArticle(word: string): string {
	const number = LEADING_NUMBER.exec(word)?.[0];
	let an: boolean;
	if (number !== undefined) {
		an = number.startsWith("8") || number === "11" || number === "18";
	} else if (SOUNDS_LIKE_CONSONANT.test(word)) {
		an = false;
	} else {
		an = VOWEL_START.test(word) || SOUNDS_LIKE_VOWEL.test(word);
	}
	return `${an ? "an" : "a"} ${word}`;
}

const WINDOW_PATTERN = /^(\d+) (second|minute|hour|day|week)s?$/;

/** "10-minute" for a single-unit length, the length in words otherwise. */
function windowAdjective(iso: string | undefined): string {
	if (iso === undefined) {
		return NOT_SET;
	}
	const words = describeDuration(iso);
	const match = WINDOW_PATTERN.exec(words);
	return match ? `${match[1]}-${match[2]}` : words;
}

function lengthWords(iso: string | undefined): string {
	return iso === undefined ? NOT_SET : describeDuration(iso);
}

export interface Subjects {
	many: string;
	one: string;
}

/** The words for one subject and for all of them: the check's labels, or its scope word. */
export function subjectsOf(check: HealthCheck): Subjects {
	return {
		one: check.scope_label?.one ?? check.scope,
		many: check.scope_label?.many ?? `${check.scope} subjects`,
	};
}

/** The unit readings of a check are written in; none for a check without one. */
export function readingUnit(check: HealthCheck): string | undefined {
	return check.value.type === "number" ? check.value.unit : undefined;
}

const REDUCTION_WORDS: Record<Exclude<ReductionKind, "percentile">, string> = {
	mean: "the average",
	median: "the median",
	max: "the highest reading",
	min: "the lowest reading",
	last: "the latest reading",
	sum: "the sum",
};

const ORDINAL_SUFFIXES = ["th", "st", "nd", "rd"];

function ordinal(value: unknown): string {
	if (typeof value !== "number" || !Number.isInteger(value)) {
		return typeof value === "number" ? `${value}th` : NOT_SET;
	}
	const tens = value % 100;
	const suffix =
		ORDINAL_SUFFIXES[
			tens >= 11 && tens <= 13 ? 0 : Math.min(value % 10, 4) % 4
		] ?? "th";
	return `${value}${suffix}`;
}

/** What a combined value is called: "the average", "the 95th percentile". */
function reductionName(
	reduction: NonNullable<PartialSettings["reduction"]>
): string {
	if (reduction.kind === "percentile") {
		return `the ${ordinal(reduction.params?.p)} percentile`;
	}
	return REDUCTION_WORDS[reduction.kind];
}

function reductionScale(
	check: HealthCheck,
	reduction: NonNullable<PartialSettings["reduction"]>
): Scale {
	const share = reductionRuleIsShare(check.value.type, reduction.kind);
	return { share, unit: share ? undefined : readingUnit(check) };
}

function paramText(
	spec: NonNullable<HealthCheck["params"]>[number],
	value: unknown
): string {
	if (typeof value === "boolean") {
		return value ? "yes" : "no";
	}
	if (spec.type === "duration" && typeof value === "string") {
		return describeDuration(value);
	}
	return spec.unit ? `${String(value)} ${spec.unit}` : String(value);
}

function checkSettingsSentence(
	settings: PartialSettings,
	check: HealthCheck
): PlainSentence | null {
	const given = settings.check?.params ?? {};
	const parts = (check.params ?? [])
		.filter((spec) => hasValue(given[spec.key]))
		.map((spec) => `${spec.label} set to ${paramText(spec, given[spec.key])}`);
	return parts.length === 0
		? null
		: {
				key: "check-settings",
				text: `The check runs with ${parts.join(", ")}.`,
			};
}

function readingSentence(
	check: HealthCheck,
	subjects: Subjects
): PlainSentence {
	const about = isWholeSystem(check)
		? "the whole system"
		: `one ${subjects.one}`;
	return {
		key: "reading",
		text: check.description
			? `Each reading is about ${about}: “${check.description}”`
			: `Each reading is about ${about}.`,
	};
}

function reductionSentences(
	settings: PartialSettings,
	check: HealthCheck,
	subjects: Subjects
): PlainSentence[] {
	const { reduction } = settings;
	if (!reduction) {
		return [];
	}
	const name = reductionName(reduction);
	const rule = reduction.rule ?? settings.rule;
	const scale = reduction.rule
		? reductionScale(check, reduction)
		: { share: false, unit: readingUnit(check) };
	const sentences: PlainSentence[] = [
		{
			key: "reduction",
			text: `For each ${subjects.one}, the readings in each ${windowAdjective(settings.window)} window are combined by taking ${name}${rule ? `; ${name} ${outcomesClause(ruleOutcomes(rule, scale))}` : ""}.`,
		},
	];
	const floor = reduction.params?.avail_floor;
	if (hasValue(floor)) {
		sentences.push({
			key: "readings-needed",
			text: `If fewer than ${writeShare(floor)} of ${withArticle(subjects.one)}'s readings have an answer, that ${subjects.one} has no answer.`,
		});
	}
	return sentences;
}

function claimSentences(
	settings: PartialSettings,
	subjects: Subjects
): PlainSentence[] {
	const { aggregation } = settings;
	if (!aggregation) {
		return [];
	}
	const sentences: PlainSentence[] = [
		{
			key: "claim",
			text: `The claim passes when at least ${writeShare(aggregation.params.threshold)} of the ${subjects.many} pass, and fails otherwise.`,
		},
	];
	if (hasValue(aggregation.params.avail_floor)) {
		sentences.push({
			key: "answers-needed",
			text: `If fewer than ${writeShare(aggregation.params.avail_floor)} of the ${subjects.many} have an answer, the claim has no result.`,
		});
	}
	return sentences;
}

function validitySentence(settings: PartialSettings): PlainSentence {
	return {
		key: "validity",
		text:
			settings.valid_for === INDEFINITE
				? "A result counts until someone withdraws it."
				: `A result counts for ${lengthWords(settings.valid_for)}.`,
	};
}

/**
 * The whole summary, in the order a reader needs it: what a reading is, how
 * the check is set up, how a reading is judged, how readings are combined,
 * when the claim passes, what happens when too few have an answer, and how
 * long a result counts.
 */
export function plainWords(
	settings: PartialSettings,
	check: HealthCheck
): PlainSentence[] {
	const subjects = subjectsOf(check);
	const sentences: PlainSentence[] = [readingSentence(check, subjects)];
	const own = checkSettingsSentence(settings, check);
	if (own) {
		sentences.push(own);
	}
	if (settings.rule) {
		sentences.push({
			key: "rule",
			text: `${capitalise(`a reading ${outcomesClause(ruleOutcomes(settings.rule, { share: false, unit: readingUnit(check) }))}`)}.`,
		});
	}
	if (isWholeSystem(check)) {
		sentences.push({
			key: "window",
			text: `The claim takes the latest reading in each ${windowAdjective(settings.window)} window as its result.`,
		});
	} else if (settings.reduction) {
		sentences.push(...reductionSentences(settings, check, subjects));
	} else {
		sentences.push({
			key: "window",
			text: `Each result uses the readings in ${withArticle(windowAdjective(settings.window))} window.`,
		});
	}
	sentences.push(
		...claimSentences(settings, subjects),
		validitySentence(settings)
	);
	return sentences;
}

export interface SummaryLine {
	label: string;
	text: string;
}

/** One line for each block the short view does not edit. */
export function remainingLines(
	settings: PartialSettings,
	check: HealthCheck
): SummaryLine[] {
	const subjects = subjectsOf(check);
	const lines: SummaryLine[] = [
		{
			label: "Evidence source",
			text: `${check.name}, version ${check.version}`,
		},
	];
	if (settings.rule) {
		lines.push({
			label: "Judging each reading",
			text: `A reading ${outcomesClause(ruleOutcomes(settings.rule, { share: false, unit: readingUnit(check) }))}`,
		});
	}
	if (isWholeSystem(check)) {
		lines.push({ label: "Combining readings", text: "Not used" });
		return lines;
	}
	const reduction = settings.reduction
		? reductionSentences(settings, check, subjects)
		: [];
	lines.push({
		label: `Combining each ${subjects.one}'s readings`,
		text:
			reduction.length > 0
				? reduction.map((s) => s.text).join(" ")
				: "Not used",
	});
	const needed = settings.aggregation?.params.avail_floor;
	if (hasValue(needed)) {
		lines.push({
			label: "Answers needed",
			text: `At least ${writeShare(needed)} of the ${subjects.many} need an answer.`,
		});
	}
	return lines;
}
