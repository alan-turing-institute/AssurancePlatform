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
	/** How many acknowledged gaps were dropped to keep to MAX_FINDINGS. */
	acknowledgedGapsTruncated: number;
	/** At most MAX_FINDINGS, in the checker's order. */
	findings: LintFinding[];
	/** The judgement rules, as text for the model to apply to the case itself. */
	judgementRules: string;
	/** Mechanical facts the judgement rules refer to; not verdicts. At most MAX_FINDINGS. Left out when there are none. */
	prechecks?: LintPrecheck[];
	/** How many prechecks were dropped to keep to MAX_FINDINGS. Present exactly when `prechecks` is. */
	prechecksTruncated?: number;
	/** At most MAX_FINDINGS. */
	questions: LintQuestion[];
	/** How many questions were dropped to keep to MAX_FINDINGS. */
	questionsTruncated: number;
	/** How many findings were dropped to keep to MAX_FINDINGS. */
	truncated: number;
}

const MAX_FINDINGS = 100;
const MAX_LABEL_LENGTH = 200;
const MAX_TEXT_LENGTH = 500;

function capText(text: string): string {
	return text.length > MAX_TEXT_LENGTH
		? `${text.slice(0, MAX_TEXT_LENGTH)}…`
		: text;
}

function capList<T>(items: T[]): { dropped: number; kept: T[] } {
	return {
		kept: items.slice(0, MAX_FINDINGS),
		dropped: Math.max(0, items.length - MAX_FINDINGS),
	};
}

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
			reason: capText(f.reason),
		};
		if (f.acked) {
			acknowledgedGaps.push(base);
		} else {
			findings.push({ ...base, fix: f.fix });
		}
	}
	const prechecks = capList(
		report.prechecks.map((p) => ({
			ruleId: p.id,
			elementLabel: labelFor(p.element),
			detail: capText(p.detail),
		}))
	);
	const questions = capList(
		report.questions.map((q) => ({
			ruleId: q.rule,
			elementLabel: labelFor(q.element),
			question: capText(q.question),
		}))
	);
	const gaps = capList(acknowledgedGaps);
	return {
		findings: findings.slice(0, MAX_FINDINGS),
		truncated: Math.max(0, findings.length - MAX_FINDINGS),
		...(prechecks.kept.length > 0
			? { prechecks: prechecks.kept, prechecksTruncated: prechecks.dropped }
			: {}),
		acknowledgedGaps: gaps.kept,
		acknowledgedGapsTruncated: gaps.dropped,
		questions: questions.kept,
		questionsTruncated: questions.dropped,
		judgementRules: JUDGEMENT_PROMPT,
	};
}
