import type { HealthCheck } from "@/lib/schemas/health-checks";
import {
	type PartialSettings,
	recommendedCheckParams,
	type ServedSettings,
} from "@/lib/schemas/health-criteria";
import { parseDurationSeconds } from "@/lib/schemas/health-rules";
import {
	analyseDraft,
	type CriteriaDraft,
	draftFromCheck,
	draftFromStored,
	isWholeSystem,
	reductionAvailable,
} from "./criteria-draft";
import {
	type PlainSentence,
	plainWords,
	subjectsOf,
} from "./criteria-plain-words";

/**
 * Moving accepted settings to a different version of their check. The person
 * compares each block of their accepted settings with what the new version
 * recommends and keeps or takes it; `mergeVersionMove` turns those choices
 * into the draft the settings form holds, unsaved. Everything here is pure.
 */

const MOVE_BLOCKS = [
	"check",
	"rule",
	"reduction",
	"aggregation",
	"timing",
] as const;
export type MoveBlock = (typeof MOVE_BLOCKS)[number];

export type MoveChoice = "keep" | "take";
export type MoveChoices = Partial<Record<MoveBlock, MoveChoice>>;

/** A row's heading, in the check's own words for what one reading is about. */
function blockLabel(block: MoveBlock, check: HealthCheck): string {
	const subjects = subjectsOf(check);
	switch (block) {
		case "check":
			return "The check's own settings";
		case "rule":
			return "Step 1: judging each reading";
		case "reduction":
			return `Step 2: combining one ${subjects.one}'s readings`;
		case "aggregation":
			return `Step 3: combining ${subjects.many}`;
		default:
			return "Timing";
	}
}

function recommendsBlock(entry: HealthCheck, block: MoveBlock): boolean {
	const { recommended } = entry;
	switch (block) {
		case "check":
			return Object.keys(recommendedCheckParams(entry)).length > 0;
		case "rule":
			return recommended?.rule !== undefined;
		case "reduction":
			return recommended?.reduction !== undefined && reductionAvailable(entry);
		case "aggregation":
			return recommended?.aggregation !== undefined && !isWholeSystem(entry);
		default:
			return (
				recommended?.window !== undefined ||
				recommended?.valid_for !== undefined
			);
	}
}

function withoutUnlisted(draft: CriteriaDraft): CriteriaDraft {
	const { unlistedParams: _removed, ...rest } = draft;
	return rest;
}

/** The draft with one block replaced by the recommendation's; timing replaces only the parts the recommendation gives. */
function takeBlock(
	yours: CriteriaDraft,
	recommended: CriteriaDraft,
	entry: HealthCheck,
	block: MoveBlock
): CriteriaDraft {
	switch (block) {
		case "check":
			return withoutUnlisted({ ...yours, params: recommended.params });
		case "rule":
			return { ...yours, rule: recommended.rule };
		case "reduction":
			return {
				...yours,
				reductionOn: recommended.reductionOn,
				reduction: recommended.reduction,
			};
		case "aggregation":
			return { ...yours, aggregation: recommended.aggregation };
		default: {
			const timing = { ...yours };
			if (entry.recommended?.window !== undefined) {
				timing.window = recommended.window;
			}
			if (entry.recommended?.valid_for !== undefined) {
				timing.validFor = recommended.validFor;
				timing.indefinite = recommended.indefinite;
			}
			return timing;
		}
	}
}

type ParamSpec = NonNullable<HealthCheck["params"]>[number];

/** Whether a stored value is of the kind the check's description now gives the setting. */
function valueFitsSpec(spec: ParamSpec, value: unknown): boolean {
	switch (spec.type) {
		case "boolean":
			return typeof value === "boolean";
		case "number":
			return typeof value === "number";
		case "duration":
			return typeof value === "string" && parseDurationSeconds(value) !== null;
		default:
			return typeof value === "string";
	}
}

/** The kept settings the new version does not describe, or describes as another kind of value; they are carried as they are. */
function unlistedParamsOf(
	accepted: ServedSettings,
	entry: HealthCheck
): Record<string, string | number | boolean> {
	const specs = new Map((entry.params ?? []).map((spec) => [spec.key, spec]));
	const unlisted: Record<string, string | number | boolean> = {};
	for (const [key, value] of Object.entries(accepted.check.params ?? {})) {
		const spec = specs.get(key);
		if (
			(typeof value === "string" ||
				typeof value === "number" ||
				typeof value === "boolean") &&
			!(spec && valueFitsSpec(spec, value))
		) {
			unlisted[key] = value;
		}
	}
	return unlisted;
}

/** The accepted settings as a draft against the new version's description. */
function yoursAgainst(
	accepted: ServedSettings,
	entry: HealthCheck,
	integrationId: string
): CriteriaDraft {
	const unlisted = unlistedParamsOf(accepted, entry);
	if (Object.keys(unlisted).length === 0) {
		return draftFromStored(accepted, entry, integrationId);
	}
	const params = Object.fromEntries(
		Object.entries(accepted.check.params ?? {}).filter(
			([key]) => !(key in unlisted)
		)
	);
	return {
		...draftFromStored(
			{ ...accepted, check: { ...accepted.check, params } },
			entry,
			integrationId
		),
		unlistedParams: unlisted,
	};
}

export interface MergeInput {
	accepted: ServedSettings;
	/** A choice for each block; a block without one is kept. */
	choices: MoveChoices;
	/** The new version's entry in the check list. */
	entry: HealthCheck;
	integrationId: string;
}

/**
 * The draft for the new version: every block as accepted, except the blocks
 * the person chose to take from the recommendation. A block the new version
 * does not recommend is always kept. A kept setting the new version no longer
 * describes stays in the draft, so the form reports it.
 */
export function mergeVersionMove({
	accepted,
	choices,
	entry,
	integrationId,
}: MergeInput): CriteriaDraft {
	const recommended = draftFromCheck(entry, integrationId);
	let draft = yoursAgainst(accepted, entry, integrationId);
	for (const block of MOVE_BLOCKS) {
		if (choices[block] === "take" && recommendsBlock(entry, block)) {
			draft = takeBlock(draft, recommended, entry, block);
		}
	}
	return draft;
}

/** What a row of the compare view offers: nothing to choose, or a choice. */
export type RowKind = "none" | "pick" | "same";

export interface BlockRow {
	block: MoveBlock;
	kind: RowKind;
	label: string;
	/** The new version's recommendation for the block, in plain words. */
	recommended: string[];
	/** The accepted settings for the block, in plain words. */
	yours: string[];
}

const BLOCK_SENTENCES: Record<MoveBlock, PlainSentence["key"][]> = {
	check: ["check-settings"],
	rule: ["rule"],
	reduction: ["reduction", "readings-needed"],
	aggregation: ["claim", "answers-needed"],
	timing: ["window", "validity"],
};

/** The settings that make up one block alone, so its sentences describe nothing else. */
function onlyBlock(
	settings: PartialSettings,
	block: MoveBlock
): PartialSettings {
	switch (block) {
		case "check":
			return settings.check ? { check: settings.check } : {};
		case "rule":
			return settings.rule ? { rule: settings.rule } : {};
		case "reduction":
			return {
				...(settings.rule && { rule: settings.rule }),
				...(settings.reduction && { reduction: settings.reduction }),
				...(settings.window && { window: settings.window }),
			};
		case "aggregation":
			return settings.aggregation ? { aggregation: settings.aggregation } : {};
		default:
			return {
				...(settings.window && { window: settings.window }),
				...(settings.valid_for && { valid_for: settings.valid_for }),
			};
	}
}

const ABSENT: Record<MoveBlock, string> = {
	check: "No settings",
	rule: "Not set",
	reduction: "Not used",
	aggregation: "Not used",
	timing: "Not set",
};

/** One block of a draft's settings in plain words, using the existing summary. */
function describeBlock(
	draft: CriteriaDraft,
	check: HealthCheck,
	block: MoveBlock
): string[] {
	const settings = analyseDraft(draft, check).settings;
	const keys = BLOCK_SENTENCES[block];
	const sentences = plainWords(onlyBlock(settings, block), check)
		.filter((sentence) => keys.includes(sentence.key))
		.map((sentence) => sentence.text);
	return sentences.length > 0 ? sentences : [ABSENT[block]];
}

function partsOf(draft: CriteriaDraft, block: MoveBlock): unknown {
	switch (block) {
		case "check":
			return [draft.params, draft.unlistedParams ?? {}];
		case "rule":
			return draft.rule;
		case "reduction":
			return [draft.reductionOn, draft.reductionOn ? draft.reduction : null];
		case "aggregation":
			return draft.aggregation;
		default:
			return [draft.window, draft.validFor, draft.indefinite];
	}
}

function hasBlock(draft: CriteriaDraft, block: MoveBlock): boolean {
	switch (block) {
		case "check":
			return (
				Object.keys(draft.unlistedParams ?? {}).length > 0 ||
				Object.values(draft.params).some(
					(param) =>
						param.text !== "" || param.amount !== "" || param.flag !== undefined
				)
			);
		case "reduction":
			return draft.reductionOn;
		default:
			return true;
	}
}

export interface CompareInput {
	accepted: ServedSettings;
	/** The check's entry as the accepted settings were made against it. */
	acceptedCheck: HealthCheck;
	/** The new version's entry in the check list. */
	entry: HealthCheck;
	integrationId: string;
}

/**
 * One row for each block that either the accepted settings or the new
 * version's recommendation has. A row is "same" when taking the
 * recommendation would change nothing, and "none" when the new version
 * recommends nothing for the block; only a "pick" row offers a choice.
 */
export function compareBlocks({
	accepted,
	acceptedCheck,
	entry,
	integrationId,
}: CompareInput): BlockRow[] {
	const yours = yoursAgainst(accepted, entry, integrationId);
	const yoursAsAccepted = draftFromStored(
		accepted,
		acceptedCheck,
		integrationId
	);
	const recommended = draftFromCheck(entry, integrationId);
	const rows: BlockRow[] = [];
	for (const block of MOVE_BLOCKS) {
		const recommends = recommendsBlock(entry, block);
		if (!(recommends || hasBlock(yours, block))) {
			continue;
		}
		let kind: RowKind = "pick";
		if (!recommends) {
			kind = "none";
		} else if (
			JSON.stringify(partsOf(yours, block)) ===
			JSON.stringify(
				partsOf(takeBlock(yours, recommended, entry, block), block)
			)
		) {
			kind = "same";
		}
		rows.push({
			block,
			kind,
			label: blockLabel(block, entry),
			yours: describeBlock(yoursAsAccepted, acceptedCheck, block),
			recommended: recommends
				? describeBlock(recommended, entry, block)
				: ["The new version recommends nothing for this."],
		});
	}
	return rows;
}
