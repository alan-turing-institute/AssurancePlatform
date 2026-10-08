export type Severity = "error" | "warning" | "style";

export interface RuleApply {
	look_for: string;
	not_when: string;
	wording?: string;
}

/** One rule, reduced to the fields the linter uses. */
export interface RuleData {
	ackable: boolean;
	applies_to: string[];
	apply?: RuleApply;
	fix?: string;
	id: string;
	mechanism: "structural" | "judgement";
	mode: string[];
	/** Present only on rules the author wants raised as a question. */
	question_text?: string;
	scope: "case" | "element";
	severity: Severity;
	statement?: string;
	title: string;
}

export interface FamilyData {
	defect: string;
	name: string;
	prefix: string;
}

export interface RulesetData {
	date: string;
	families: FamilyData[];
	rules: RuleData[];
	version: string;
}
