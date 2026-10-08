import { JUDGEMENT_PROMPT } from "./judgement-prompt";
import { RULESET } from "./ruleset";
import type { Severity } from "./ruleset-types";
import { checkStructure } from "./structural";
import type { LintCase, LintNode } from "./types";

export interface LintFinding {
	elementLabel: string;
	fix: string;
	reason: string;
	ruleId: string;
	severity: Severity;
}

export interface LintQuestion {
	elementLabel: string;
	question: string;
	ruleId: string;
}

export interface LintResult {
	/** Gaps the author has marked NEEDS_SUPPORT; reported, not counted as findings. */
	acknowledgedGaps: Omit<LintFinding, "fix">[];
	findings: LintFinding[];
	/** The judgement rules, as text for the model to apply to the case itself. */
	judgementRules: string;
	questions: LintQuestion[];
}

function collectLabels(node: LintNode, labels: Map<string, string>): void {
	labels.set(node.id, node.name?.trim() || node.id);
	for (const child of node.children) {
		collectLabels(child, labels);
	}
}

/** Runs the structural checker over a case export and shapes the result for the assistant. */
export function lintCase(doc: LintCase): LintResult {
	const labels = new Map<string, string>();
	collectLabels(doc.tree, labels);
	const labelOf = (id: string) => labels.get(id) ?? id;
	const labelFor = (element: string, elements?: string[]) => {
		if (elements && elements.length > 0) {
			return elements.map(labelOf).join(", ");
		}
		return element === "case" ? "case" : labelOf(element);
	};

	const report = checkStructure(doc, RULESET);
	const findings: LintFinding[] = [];
	const acknowledgedGaps: LintResult["acknowledgedGaps"] = [];
	for (const f of report.findings) {
		const base = {
			ruleId: f.rule,
			elementLabel: labelFor(f.element, f.elements),
			severity: f.severity,
			reason: f.reason,
		};
		if (f.acked) {
			acknowledgedGaps.push(base);
		} else {
			findings.push({ ...base, fix: f.fix });
		}
	}
	return {
		findings,
		acknowledgedGaps,
		questions: report.questions.map((q) => ({
			ruleId: q.rule,
			elementLabel: labelFor(q.element),
			question: q.question,
		})),
		judgementRules: JUDGEMENT_PROMPT,
	};
}
