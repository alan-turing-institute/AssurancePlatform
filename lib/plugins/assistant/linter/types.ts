/**
 * Input and output types for the structural checker.
 *
 * The input is the case export's nested tree. One widening from
 * `lib/schemas/case-export.ts`: its hand-written `TreeNode` types
 * `assertionStatus` as `AssertionStatus | undefined`, while the zod schema
 * beside it marks the field `.nullable().optional()` and real exports carry
 * `null`. `LintNode` accepts what the schema accepts.
 */

import type {
	AssertionStatus,
	CaseExportNested,
	TreeNode,
} from "@/lib/schemas/case-export";

export type { ElementType } from "@/lib/schemas/case-export";

export type LintNode = Omit<TreeNode, "assertionStatus" | "children"> & {
	assertionStatus?: AssertionStatus | null;
	children: LintNode[];
};

export type LintCase = Omit<CaseExportNested, "tree"> & { tree: LintNode };

export type Severity = "error" | "warning" | "style";

interface FindingCommon {
	checker: "structural";
	/** The TEA element id, or "case" for a whole-case finding. */
	element: string;
	element_type: string;
	/** The offending element ids, in tree order, for a whole-case finding. */
	elements?: string[];
	field?: string;
	reason: string;
	rule: string;
	sandbox?: true;
	text: string;
}

export interface ConformanceFinding extends FindingCommon {
	acked?: true;
	acked_by?: "assertionStatus:NEEDS_SUPPORT";
	fix: string;
	kind: "conformance";
	severity: Severity;
}

export type Finding = ConformanceFinding;

export interface Question {
	checker: "structural";
	declared_severity?: Severity;
	element: string;
	element_type: string;
	kind: "question";
	question: string;
	rule: string;
	text: string;
	trigger: string;
}

export interface Precheck {
	detail: string;
	element: string;
	id: string;
}

export interface Report {
	case: { name: string; exportedAt: string };
	counts: {
		surfaced: { error: number; warning: number; style: number };
		acked: { error: number; warning: number; style: number };
		questions: number;
	};
	findings: Finding[];
	incomplete: { acked_claims: number };
	input: { schema: "tea-nested"; version: "1.0" };
	/** Rules a reader must apply, computed from the ruleset. */
	judgement_rules: string[];
	prechecks: Precheck[];
	questions: Question[];
	ruleset: { version: string; date: string };
	unchecked: string[];
}
