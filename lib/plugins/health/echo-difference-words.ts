import { INDEFINITE } from "@/lib/schemas/health-rules";
import { describeDuration } from "./health-format";
import type { HealthEchoDifference } from "./health-types";

/**
 * One sentence for each way a result differed from the accepted settings.
 * `past` words the settings side as it stood when the result arrived ("the
 * settings said"), for a line on a stored record; otherwise it is the
 * present ("the settings say"). The text of every value is a pipeline's, so
 * the sentences are only ever rendered as text.
 */

export const NO_SETTINGS_ON_ARRIVAL =
	"No accepted settings when this result arrived.";
export const NO_ACCEPTED_SETTINGS =
	"This claim has no accepted settings. Results are shown, but nobody has accepted how they are judged.";

const STEP_NAMES: Record<string, string> = {
	rule: "rule",
	reduction: "combining step",
	aggregation: "claim-level step",
};

function text(value: unknown): string {
	return typeof value === "string" ? value : JSON.stringify(value);
}

function length(value: unknown): string {
	if (typeof value !== "string") {
		return text(value);
	}
	return value === INDEFINITE ? "no time limit" : describeDuration(value);
}

function versionSentence(
	field: string,
	difference: HealthEchoDifference,
	say: string
): string | null {
	if (!field.endsWith(".version")) {
		return null;
	}
	const used = text(difference.used);
	const declared = text(difference.declared);
	if (field === "check.version") {
		return `The pipeline used version ${used} of the check; the settings ${say} ${declared}.`;
	}
	const name = STEP_NAMES[field.split(".")[0] ?? ""];
	return name
		? `The pipeline used ${name} ${used}; the settings ${say} ${declared}.`
		: null;
}

function presenceSentence(
	field: string,
	difference: HealthEchoDifference,
	past: boolean
): string | null {
	const name = STEP_NAMES[field];
	if (!name || field === "rule") {
		return null;
	}
	const used = difference.used !== null && difference.used !== undefined;
	const have = past ? "had" : "have";
	const doNot = past ? "did not have" : "do not have";
	return used
		? `The pipeline used a ${name}; the settings ${doNot} one.`
		: `The pipeline did not use a ${name}; the settings ${have} one.`;
}

/** The sentence for one difference. */
export function describeDifference(
	difference: HealthEchoDifference,
	past = false
): string {
	const say = past ? "said" : "say";
	const { field } = difference;
	if (field === "check.params") {
		return "The pipeline ran the check with different settings of its own.";
	}
	if (field === "window") {
		return `The pipeline used a window of ${length(difference.used)}; the settings ${say} ${length(difference.declared)}.`;
	}
	if (field === "valid_for") {
		return `The pipeline let the result count for ${length(difference.used)}; the settings ${say} ${length(difference.declared)}.`;
	}
	return (
		versionSentence(field, difference, say) ??
		presenceSentence(field, difference, past) ??
		`The pipeline's result differed from the settings in ${field}.`
	);
}

export function describeDifferences(
	differences: HealthEchoDifference[],
	past = false
): string[] {
	return differences.map((difference) => describeDifference(difference, past));
}
