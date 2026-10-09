"use client";

interface LintRow {
	elementLabel: string;
	reason: string;
	ruleId: string;
}

interface PrecheckRow {
	detail: string;
	elementLabel: string;
	ruleId: string;
}

export interface LintOutput {
	acknowledgedGaps: LintRow[];
	findings: LintRow[];
	prechecks: PrecheckRow[];
	questions: unknown[];
}

function isPrecheckList(value: unknown): value is PrecheckRow[] {
	return (
		Array.isArray(value) &&
		value.every(
			(row) =>
				typeof row === "object" &&
				row !== null &&
				typeof row.ruleId === "string" &&
				typeof row.elementLabel === "string" &&
				typeof row.detail === "string"
		)
	);
}

const FAMILY_NAMES: Record<string, string> = {
	WORD: "Wording",
	PLAC: "Misplacement",
	STEP: "Decomposition",
	EVID: "Support",
	SCOP: "Scope and inheritance",
	TREE: "Structure",
	CONF: "Confidence and defeat",
};

const FAMILY_CODE_LENGTH = 4;

function isRowList(value: unknown): value is LintRow[] {
	return (
		Array.isArray(value) &&
		value.every(
			(row) =>
				typeof row === "object" &&
				row !== null &&
				typeof row.ruleId === "string" &&
				typeof row.elementLabel === "string" &&
				typeof row.reason === "string"
		)
	);
}

/** The lint_case result when it has the expected shape, otherwise null. */
export function parseLintOutput(output: unknown): LintOutput | null {
	if (typeof output !== "object" || output === null) {
		return null;
	}
	const { findings, acknowledgedGaps, questions, prechecks } = output as Record<
		string,
		unknown
	>;
	if (!(isRowList(findings) && isRowList(acknowledgedGaps))) {
		return null;
	}
	return {
		findings,
		acknowledgedGaps,
		prechecks: isPrecheckList(prechecks) ? prechecks : [],
		questions: Array.isArray(questions) ? questions : [],
	};
}

function groupByFamily(findings: LintRow[]): Map<string, LintRow[]> {
	const groups = new Map<string, LintRow[]>();
	for (const finding of findings) {
		const code = finding.ruleId.slice(0, FAMILY_CODE_LENGTH);
		groups.set(code, [...(groups.get(code) ?? []), finding]);
	}
	return groups;
}

/** A lint_case result as findings grouped by rule family. */
export function LintCaseResult({ result }: { result: LintOutput }) {
	const groups = groupByFamily(result.findings);
	return (
		<div className="mt-1 space-y-2" data-testid="assistant-lint-result">
			{groups.size === 0 && <p>No structural findings.</p>}
			{[...groups].map(([code, rows]) => (
				<section key={code}>
					<h4 className="font-semibold">
						{code} {FAMILY_NAMES[code] ?? ""}
					</h4>
					<ul className="ml-4 list-disc">
						{rows.map((row) => (
							<li
								className="break-words"
								key={`${row.ruleId}-${row.elementLabel}-${row.reason}`}
							>
								<span className="font-mono">{row.ruleId}</span> on{" "}
								<span className="break-all font-mono">{row.elementLabel}</span>:{" "}
								{row.reason}
							</li>
						))}
					</ul>
				</section>
			))}
			{result.prechecks.length > 0 && (
				<section>
					<h4 className="font-semibold">Prechecks</h4>
					<ul className="ml-4 list-disc">
						{result.prechecks.map((row) => (
							<li
								className="break-words"
								key={`${row.ruleId}-${row.elementLabel}-${row.detail}`}
							>
								<span className="font-mono">{row.ruleId}</span> on{" "}
								<span className="break-all font-mono">{row.elementLabel}</span>:{" "}
								{row.detail}
							</li>
						))}
					</ul>
				</section>
			)}
			<p className="text-muted-foreground">
				{result.acknowledgedGaps.length} acknowledged gaps,{" "}
				{result.questions.length} questions
			</p>
		</div>
	);
}
