import { JUDGEMENT_PROMPT } from "./judgement-prompt";
import { RULESET } from "./ruleset";
import { checkStructure } from "./structural";
import type { LintCase, LintNode, Severity } from "./types";

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

export interface LintPrecheck {
	detail: string;
	elementLabel: string;
	ruleId: string;
}

export interface LintResult {
	/** Gaps the author has marked NEEDS_SUPPORT; reported, not counted as findings. */
	acknowledgedGaps: Omit<LintFinding, "fix">[];
	/** At most MAX_FINDINGS, in the checker's order. */
	findings: LintFinding[];
	/** The judgement rules, as text for the model to apply to the case itself. */
	judgementRules: string;
	/** Mechanical facts the judgement rules refer to; not verdicts. */
	prechecks: LintPrecheck[];
	questions: LintQuestion[];
	/** How many findings were dropped to keep to MAX_FINDINGS. */
	truncated: number;
}

const MAX_FINDINGS = 100;
const MAX_LABEL_LENGTH = 200;

function capLabel(label: string): string {
	return label.length > MAX_LABEL_LENGTH
		? `${label.slice(0, MAX_LABEL_LENGTH)}…`
		: label;
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
			return capLabel(elements.map(labelOf).join(", "));
		}
		return element === "case" ? "case" : capLabel(labelOf(element));
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
		findings: findings.slice(0, MAX_FINDINGS),
		truncated: Math.max(0, findings.length - MAX_FINDINGS),
		prechecks: report.prechecks.map((p) => ({
			ruleId: p.id,
			elementLabel: labelFor(p.element),
			detail: p.detail,
		})),
		acknowledgedGaps,
		questions: report.questions.map((q) => ({
			ruleId: q.rule,
			elementLabel: labelFor(q.element),
			question: q.question,
		})),
		judgementRules: JUDGEMENT_PROMPT,
	};
}
