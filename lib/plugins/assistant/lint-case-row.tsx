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
	/** How many acknowledged gaps the tool left out of `acknowledgedGaps`. */
	acknowledgedGapsTruncated: number;
	findings: LintRow[];
	prechecks: PrecheckRow[];
	questions: unknown[];
	/** How many questions the tool left out of `questions`. */
	questionsTruncated: number;
	/** How many findings the tool left out of `findings`. */
	truncated: number;
}

/** A count the tool reports, or 0 when it is absent or not a positive number. */
function leftOut(value: unknown): number {
	return typeof value === "number" && Number.isFinite(value) && value > 0
		? Math.floor(value)
		: 0;
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

/**
 * The lint_case result when it has the expected shape, otherwise null. A result
 * with no prechecks field, which is how the tool reports none, or a malformed one,
 * parses with an empty list.
 */
export function parseLintOutput(output: unknown): LintOutput | null {
	if (typeof output !== "object" || output === null) {
		return null;
	}
	const {
		findings,
		acknowledgedGaps,
		questions,
		prechecks,
		truncated,
		acknowledgedGapsTruncated,
		questionsTruncated,
	} = output as Record<string, unknown>;
	if (!(isRowList(findings) && isRowList(acknowledgedGaps))) {
		return null;
	}
	return {
		findings,
		acknowledgedGaps,
		prechecks: isPrecheckList(prechecks) ? prechecks : [],
		questions: Array.isArray(questions) ? questions : [],
		truncated: leftOut(truncated),
		acknowledgedGapsTruncated: leftOut(acknowledgedGapsTruncated),
		questionsTruncated: leftOut(questionsTruncated),
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

interface ListedRow {
	elementLabel: string;
	ruleId: string;
	text: string;
}

/** Lines of "RULE on ELEMENT: text", each keyed by its values and its position so identical rows do not collide. */
function RowList({ rows }: { rows: ListedRow[] }) {
	const keyed = rows.map((row, position) => ({
		key: `${row.ruleId}-${row.elementLabel}-${row.text}-${position}`,
		row,
	}));
	return (
		<ul className="ml-4 list-disc">
			{keyed.map(({ key, row }) => (
				<li className="break-words" key={key}>
					<span className="font-mono">{row.ruleId}</span> on{" "}
					<span className="break-all font-mono">{row.elementLabel}</span>:{" "}
					{row.text}
				</li>
			))}
		</ul>
	);
}

/** The note after a count when the tool left some entries out. */
function notShown(count: number): string {
	return count > 0 ? ` (${count} more not shown)` : "";
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
					<RowList
						rows={rows.map((row) => ({
							ruleId: row.ruleId,
							elementLabel: row.elementLabel,
							text: row.reason,
						}))}
					/>
				</section>
			))}
			{result.truncated > 0 && (
				<p className="text-muted-foreground">
					{result.truncated} more not shown
				</p>
			)}
			{result.prechecks.length > 0 && (
				<section>
					<h4 className="font-semibold">Prechecks</h4>
					<RowList
						rows={result.prechecks.map((row) => ({
							ruleId: row.ruleId,
							elementLabel: row.elementLabel,
							text: row.detail,
						}))}
					/>
				</section>
			)}
			<p className="text-muted-foreground">
				{result.acknowledgedGaps.length} acknowledged gaps
				{notShown(result.acknowledgedGapsTruncated)}, {result.questions.length}{" "}
				questions
				{notShown(result.questionsTruncated)}
			</p>
		</div>
	);
}
