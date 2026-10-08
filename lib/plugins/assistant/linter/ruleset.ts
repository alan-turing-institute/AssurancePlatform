import { RULESET_DATA } from "./ruleset-data";
import type { RuleData, RulesetData } from "./ruleset-types";

/** The generated ruleset indexed for the structural checker. */
export interface Ruleset {
	/** Ids of rules whose findings may be acknowledged by NEEDS_SUPPORT. */
	ackableIds: Set<string>;
	date: string;
	rules: Map<string, RuleData>;
	version: string;
}

export function buildRuleset(data: RulesetData): Ruleset {
	return {
		version: data.version,
		date: data.date,
		rules: new Map(data.rules.map((r) => [r.id, r])),
		ackableIds: new Set(data.rules.filter((r) => r.ackable).map((r) => r.id)),
	};
}

export const RULESET: Ruleset = buildRuleset(RULESET_DATA);
