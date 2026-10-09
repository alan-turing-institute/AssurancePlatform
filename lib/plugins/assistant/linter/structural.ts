/**
 * The structural checker plus the question-tier trigger pass. Pure code, no model: every
 * decision here is made from the case JSON alone, so structure decides whether to ask and
 * never the model's own reading of the substance.
 *
 * checkStructure() is deterministic: for the same input and ruleset it always returns the
 * same Report, findings sorted by (element, rule), so two runs over an unedited case are
 * byte-identical.
 */

import type { Ruleset } from "./ruleset";
import type {
	ConformanceFinding,
	ElementType,
	Finding,
	LintCase,
	LintNode,
	Precheck,
	Question,
	Report,
	Severity,
} from "./types";

type CaseExportNested = LintCase;
type TreeNode = LintNode;
type LoadedRuleset = Ruleset;

// ===========================================================================
// Tree-walking utilities
// ===========================================================================

/** One appearance of a node in the tree, with the ancestor chain (root..parent) for that appearance. */
interface Occurrence {
	ancestors: TreeNode[]; // root first, does not include `node` itself
	node: TreeNode;
	parent: TreeNode | null;
}

/** Walks the whole tree once, depth-first, root first. Duplicated evidence yields one Occurrence per appearance. */
function walk(root: TreeNode): Occurrence[] {
	const out: Occurrence[] = [];
	const visit = (
		node: TreeNode,
		parent: TreeNode | null,
		ancestors: TreeNode[]
	): void => {
		out.push({ node, parent, ancestors });
		for (const child of node.children) {
			visit(child, node, [...ancestors, node]);
		}
	};
	visit(root, null, []);
	return out;
}

/**
 * Occurrences with one entry per distinct id, first appearance kept. Nested export duplicates
 * multi-linked evidence (same id, several parents); most per-element checks (a rule that asks
 * something about the element itself, not about a specific parent relationship) must not
 * re-report the same element once per appearance.
 */
function uniqueById(occurrences: Occurrence[]): Occurrence[] {
	const seen = new Set<string>();
	const out: Occurrence[] = [];
	for (const occ of occurrences) {
		if (seen.has(occ.node.id)) {
			continue;
		}
		seen.add(occ.node.id);
		out.push(occ);
	}
	return out;
}

function isClaim(type: ElementType): boolean {
	return type === "GOAL" || type === "PROPERTY_CLAIM";
}

function normalise(text: string): string {
	return text.trim().toLowerCase();
}

const NON_ALPHANUMERIC = /[^a-z0-9]+/;

function wordTokens(text: string): Set<string> {
	return new Set(
		text
			.toLowerCase()
			.split(NON_ALPHANUMERIC)
			.filter((t) => t.length > 0)
	);
}

function jaccard(a: Set<string>, b: Set<string>): number {
	if (a.size === 0 || b.size === 0) {
		return 0;
	}
	let intersection = 0;
	for (const t of a) {
		if (b.has(t)) {
			intersection++;
		}
	}
	const union = a.size + b.size - intersection;
	return union === 0 ? 0 : intersection / union;
}

function nonEmpty(s: string | null | undefined): boolean {
	return typeof s === "string" && s.trim().length > 0;
}

/**
 * A claim has real downstream development if it has an Evidence or Property Claim child
 * directly, or a Strategy child that is itself non-empty. An empty Strategy child does not
 * rescue the parent — the branch dead-ends there just as surely as if the claim had no
 * child at all. This is the reading that reconciles TREE03/EVID01 with a real captured case
 * (a captured case): a claim whose only child is a Strategy with zero children of
 * its own is an ackable finding alongside that Strategy's own TREE03
 * finding — a literal "children.length === 0" test would miss P1.3 entirely. TREE04
 * ("undeveloped") is deliberately blunter and does not use this helper — see checkTREE04.
 */
function hasRealSupport(node: TreeNode): boolean {
	return node.children.some((child) => {
		if (child.type === "EVIDENCE" || child.type === "PROPERTY_CLAIM") {
			return true;
		}
		if (child.type === "STRATEGY") {
			return child.children.length > 0;
		}
		return false;
	});
}

function sandboxFlag(node: TreeNode): true | undefined {
	return node.inSandbox === true ? true : undefined;
}

// ===========================================================================
// Ruleset lookups
// ===========================================================================

function severityOf(ruleset: LoadedRuleset, id: string): Severity {
	const rule = ruleset.rules.get(id);
	if (!rule) {
		throw new Error(
			`structural: rule ${id} is not in the loaded ruleset — cannot emit a finding without a severity. ` +
				"This checker never hard-codes severities; regenerate the ruleset so the rule is present."
		);
	}
	return rule.severity;
}

function fixFor(ruleset: LoadedRuleset, id: string, fallback: string): string {
	return ruleset.rules.get(id)?.fix ?? fallback;
}

function questionTextFor(
	ruleset: LoadedRuleset,
	id: string,
	fallback: string
): string {
	return ruleset.rules.get(id)?.question_text ?? fallback;
}

function declaredSeverityFor(
	ruleset: LoadedRuleset,
	id: string,
	fallback: Severity
): Severity {
	return ruleset.rules.get(id)?.severity ?? fallback;
}

function isAckable(ruleset: LoadedRuleset, id: string): boolean {
	return ruleset.ackableIds.has(id);
}

// ===========================================================================
// Finding builder
// ===========================================================================

function conformanceFinding(args: {
	rule: string;
	element: string;
	element_type: string;
	text: string;
	reason: string;
	severity: Severity;
	fix: string;
	field?: string;
	sandbox?: true;
	acked?: true;
	elements?: string[];
}): ConformanceFinding {
	const finding: ConformanceFinding = {
		kind: "conformance",
		rule: args.rule,
		element: args.element,
		element_type: args.element_type,
		text: args.text,
		reason: args.reason,
		severity: args.severity,
		fix: args.fix,
		checker: "structural",
	};
	if (args.field !== undefined) {
		finding.field = args.field;
	}
	if (args.sandbox !== undefined) {
		finding.sandbox = args.sandbox;
	}
	if (args.elements !== undefined) {
		finding.elements = args.elements;
	}
	if (args.acked !== undefined) {
		finding.acked = args.acked;
		finding.acked_by = "assertionStatus:NEEDS_SUPPORT";
	}
	return finding;
}

/**
 * Builds a whole-case (case-scope) conformance finding: case-scope rules are reported once
 * per case rather than once per node. `elements` lists every implicated node id in tree
 * order; never acked (only EVID01's per-node claim findings carry `acked`).
 */
function caseLevelFinding(args: {
	rule: string;
	doc: CaseExportNested;
	elements: string[];
	reason: string;
	severity: Severity;
	fix: string;
}): ConformanceFinding {
	return conformanceFinding({
		rule: args.rule,
		element: "case",
		element_type: args.doc.tree.type,
		text: args.doc.tree.description,
		reason: args.reason,
		severity: args.severity,
		fix: args.fix,
		elements: args.elements,
		sandbox: sandboxFlag(args.doc.tree),
	});
}

/** Applies the acking rule to an EVID01/TREE03 finding in place: if the node's own
 * assertionStatus is NEEDS_SUPPORT, mark it acked (never suppressed — see checkStructure's
 * counting pass, which still lists it, just under `counts.acked` rather than `surfaced`). */
function ackIfNeedsSupport(
	finding: ConformanceFinding,
	node: TreeNode,
	ruleset: LoadedRuleset
): ConformanceFinding {
	if (
		isAckable(ruleset, finding.rule) &&
		node.assertionStatus === "NEEDS_SUPPORT"
	) {
		finding.acked = true;
		finding.acked_by = "assertionStatus:NEEDS_SUPPORT";
	}
	return finding;
}

// ===========================================================================
// TREE01 — one root
// ===========================================================================

function checkTREE01(
	doc: CaseExportNested,
	ruleset: LoadedRuleset,
	occurrences: Occurrence[]
): Finding[] {
	const root = doc.tree;
	// Tree order: `occurrences` is a root-first DFS walk already.
	const topLevelNodes = uniqueById(
		occurrences.filter((o) => o.node.role === "TOP_LEVEL")
	);

	const problems: string[] = [];
	const elements: string[] = [];
	if (root.type !== "GOAL") {
		problems.push(`the root element is type ${root.type}, not GOAL`);
		elements.push(root.id);
	}
	if (root.role !== "TOP_LEVEL") {
		problems.push("the root element's role is not TOP_LEVEL");
		if (!elements.includes(root.id)) {
			elements.push(root.id);
		}
	}
	if (topLevelNodes.length > 1) {
		const others = topLevelNodes.map((o) => o.node.name ?? o.node.id);
		problems.push(
			`${topLevelNodes.length} elements carry role TOP_LEVEL (${others.join(", ")})`
		);
		for (const o of topLevelNodes) {
			if (!elements.includes(o.node.id)) {
				elements.push(o.node.id);
			}
		}
	}

	if (problems.length === 0) {
		return [];
	}
	return [
		caseLevelFinding({
			rule: "TREE01",
			doc,
			elements,
			reason: `A case must have exactly one root, a Goal with role TOP_LEVEL: ${problems.join("; ")}.`,
			severity: severityOf(ruleset, "TREE01"),
			fix: fixFor(ruleset, "TREE01", "Give the case a single top-level Goal."),
		}),
	];
}

// ===========================================================================
// TREE02 — acyclic
// ===========================================================================

function checkTREE02(
	doc: CaseExportNested,
	occurrences: Occurrence[],
	ruleset: LoadedRuleset
): Finding[] {
	// Dependency edges, in the direction "depends on": a parent depends on (is supported by)
	// its children, and a citing/defeating element depends on the element it names. A tree's
	// own child edges can never cycle on their own; a cycle needs a citedElementId/
	// defeatsElementId edge pointing from a descendant back up to one of its own ancestors,
	// which — combined with the ancestor's ordinary tree-edges back down to that descendant —
	// closes the loop. This is "no element's id appears among its own ancestors" read as a
	// graph-reachability question in the dependency direction, not the parent-chain direction.
	const dependsOn = new Map<string, Set<string>>();
	const nodeById = new Map<string, TreeNode>();

	const addEdge = (from: string, to: string): void => {
		let set = dependsOn.get(from);
		if (!set) {
			set = new Set();
			dependsOn.set(from, set);
		}
		set.add(to);
	};

	for (const occ of occurrences) {
		nodeById.set(occ.node.id, occ.node);
		for (const child of occ.node.children) {
			addEdge(occ.node.id, child.id);
		}
		if (occ.node.defeatsElementId) {
			addEdge(occ.node.id, occ.node.defeatsElementId);
		}
		if (occ.node.citedElementId) {
			addEdge(occ.node.id, occ.node.citedElementId);
		}
	}

	const combined = (id: string): Set<string> =>
		dependsOn.get(id) ?? new Set<string>();

	// Standard DFS cycle detection (white/gray/black) over the combined graph.
	const color = new Map<string, "gray" | "black">();
	const cyclic = new Set<string>();
	const stack: string[] = [];

	const dfs = (id: string): void => {
		color.set(id, "gray");
		stack.push(id);
		for (const next of combined(id)) {
			const c = color.get(next);
			if (c === undefined) {
				dfs(next);
			} else if (c === "gray") {
				const idx = stack.indexOf(next);
				if (idx >= 0) {
					for (const entry of stack.slice(idx)) {
						cyclic.add(entry);
					}
				}
			}
		}
		stack.pop();
		color.set(id, "black");
	};

	for (const id of nodeById.keys()) {
		if (color.get(id) === undefined) {
			dfs(id);
		}
	}

	if (cyclic.size === 0) {
		return [];
	}

	// Tree order, not DFS-visit order: re-derive from the occurrence walk.
	const elements = uniqueById(occurrences)
		.map((o) => o.node.id)
		.filter((id) => cyclic.has(id));

	return [
		caseLevelFinding({
			rule: "TREE02",
			doc,
			elements,
			reason: `${elements.length} element(s)' ids appear among their own ancestors, via a tree parent chain and/or a defeatsElementId or citedElementId reference — the argument is circular.`,
			severity: severityOf(ruleset, "TREE02"),
			fix: fixFor(
				ruleset,
				"TREE02",
				"Remove the reference that closes the cycle."
			),
		}),
	];
}

// ===========================================================================
// TREE03 / EVID01 — no orphan or dangling elements
// ===========================================================================

/**
 * TREE03 covers GOAL claims, Strategy nodes with no children, and Evidence found at the tree
 * root. It deliberately does NOT re-check PROPERTY_CLAIM: EVID01 is that check's element-level
 * twin, and firing both on the same leaf would double-count a single violation (a case of
 * NEEDS_SUPPORT leaves yields one ackable finding per leaf, not two).
 *
 * Case-scope, once per case — but TREE03 is ALSO ack-able, and one finding cannot carry a
 * single `acked` flag for a mixed list. So this emits UP TO TWO case-level records: one surfaced (strategies with no children,
 * orphan evidence, and a childless goal that is not NEEDS_SUPPORT), one acked (a childless
 * goal that IS NEEDS_SUPPORT — the only category acking can ever apply to, since strategies
 * and evidence are not claims). Either list may be empty, in which case that record is
 * omitted rather than emitted empty.
 */
interface TREE03Scan {
	ackedId: string | undefined;
	emptyStrategyCount: number;
	surfacedIds: string[];
	surfacedParts: string[];
}

/** Single ordered pass over the tree (root first) so `elements` lists ids in tree order. */
function scanTREE03(
	doc: CaseExportNested,
	occurrences: Occurrence[]
): TREE03Scan {
	const scan: TREE03Scan = {
		surfacedIds: [],
		surfacedParts: [],
		ackedId: undefined,
		emptyStrategyCount: 0,
	};
	for (const occ of uniqueById(occurrences)) {
		const node = occ.node;
		const isRoot = node.id === doc.tree.id;

		if (isRoot && node.type === "EVIDENCE") {
			// Root Evidence: orphan by construction, since nested export only reaches Evidence via
			// a parent's children array. Not a claim — never ackable.
			scan.surfacedIds.push(node.id);
			scan.surfacedParts.push(
				"an Evidence node is the root of the case, so it supports nothing"
			);
		} else if (isRoot && node.type === "GOAL" && !hasRealSupport(node)) {
			// Covers the "GOAL claim" half of TREE03's statement — a Goal never appears anywhere but
			// the root in TEA's nested export, per CASE-FORMAT.md.
			if (node.assertionStatus === "NEEDS_SUPPORT") {
				scan.ackedId = node.id;
			} else {
				scan.surfacedIds.push(node.id);
				scan.surfacedParts.push(
					"the top goal has no strategy, sub-claim or evidence beneath it"
				);
			}
		} else if (node.type === "STRATEGY" && node.children.length === 0) {
			scan.surfacedIds.push(node.id);
			scan.emptyStrategyCount++;
		}
	}
	return scan;
}

function checkTREE03(
	doc: CaseExportNested,
	occurrences: Occurrence[],
	ruleset: LoadedRuleset
): Finding[] {
	const findings: Finding[] = [];
	const { surfacedIds, surfacedParts, ackedId, emptyStrategyCount } =
		scanTREE03(doc, occurrences);

	if (emptyStrategyCount > 0) {
		surfacedParts.push(
			`${emptyStrategyCount} strateg${emptyStrategyCount === 1 ? "y has" : "ies have"} no children`
		);
	}

	if (surfacedIds.length > 0) {
		findings.push(
			caseLevelFinding({
				rule: "TREE03",
				doc,
				elements: surfacedIds,
				reason: `${surfacedIds.length} element(s) are orphaned or dangling: ${surfacedParts.join("; ")}.`,
				severity: severityOf(ruleset, "TREE03"),
				fix: fixFor(
					ruleset,
					"TREE03",
					"Add a strategy or evidence beneath the goal, attach evidence, or develop the empty strategy."
				),
			})
		);
	}

	if (ackedId !== undefined) {
		const acked = caseLevelFinding({
			rule: "TREE03",
			doc,
			elements: [ackedId],
			reason:
				"The top goal has no strategy, sub-claim or evidence beneath it, and is marked NEEDS_SUPPORT — the violation stands; only the per-node report is suppressed.",
			severity: severityOf(ruleset, "TREE03"),
			fix: fixFor(
				ruleset,
				"TREE03",
				"Add a strategy or evidence beneath the goal."
			),
		});
		acked.acked = true;
		acked.acked_by = "assertionStatus:NEEDS_SUPPORT";
		findings.push(acked);
	}

	return findings;
}

function checkEVID01(
	occurrences: Occurrence[],
	ruleset: LoadedRuleset
): Finding[] {
	const findings: Finding[] = [];
	for (const occ of uniqueById(occurrences)) {
		const node = occ.node;
		if (node.type !== "PROPERTY_CLAIM") {
			continue;
		}
		if (hasRealSupport(node)) {
			continue;
		}
		const f = conformanceFinding({
			rule: "EVID01",
			element: node.id,
			element_type: node.type,
			text: node.description,
			reason:
				"This is a leaf property claim (no strategy, sub-claim or evidence beneath it) — it is unsupported.",
			severity: severityOf(ruleset, "EVID01"),
			fix: fixFor(
				ruleset,
				"EVID01",
				"Attach an Evidence node, or mark the claim as needing support."
			),
			sandbox: sandboxFlag(node),
		});
		findings.push(ackIfNeedsSupport(f, node, ruleset));
	}
	return findings;
}

// ===========================================================================
// TREE04 — undeveloped branches are marked
// ===========================================================================

/**
 * Deliberately blunter than TREE03/EVID01's hasRealSupport: TREE04's own wording is "a
 * strategy or claim with no children", a literal test, not the "no real downstream
 * development" test TREE03/EVID01 need to catch a claim whose only child is itself an empty
 * strategy. Never ackable: "A case may be acked at every leaf and still fail
 * TREE04."
 */
function checkTREE04(
	doc: CaseExportNested,
	occurrences: Occurrence[],
	ruleset: LoadedRuleset
): Finding[] {
	const elements: string[] = [];
	let needsSupportCount = 0;
	for (const occ of uniqueById(occurrences)) {
		const node = occ.node;
		if (!isClaim(node.type) && node.type !== "STRATEGY") {
			continue;
		}
		if (node.children.length > 0) {
			continue;
		}
		elements.push(node.id);
		if (node.assertionStatus === "NEEDS_SUPPORT") {
			needsSupportCount++;
		}
	}

	if (elements.length === 0) {
		return [];
	}

	const needsSupportClause =
		needsSupportCount === 0
			? "none of these carry assertionStatus NEEDS_SUPPORT"
			: `${needsSupportCount} of these carry assertionStatus NEEDS_SUPPORT, which does not satisfy TREE04`;

	return [
		caseLevelFinding({
			rule: "TREE04",
			doc,
			elements,
			reason: `${elements.length} branch(es) have no support beneath them and no undeveloped marker — TEA has none; ${needsSupportClause}.`,
			severity: severityOf(ruleset, "TREE04"),
			fix: fixFor(
				ruleset,
				"TREE04",
				"Develop each branch, or record that it is deliberately left undeveloped."
			),
		}),
	];
}

// ===========================================================================
// TREE05 — away elements (single-case run: skipped, not silent)
// ===========================================================================

function checkTREE05(occurrences: Occurrence[]): string[] {
	const hasAway = occurrences.some(
		(o) => o.node.type === "AWAY_GOAL" || o.node.type === "MODULE"
	);
	return hasAway ? ["TREE05 skipped: single-case run"] : [];
}

// ===========================================================================
// CONTRACT — present, not checked
// ===========================================================================

function checkContract(occurrences: Occurrence[]): string[] {
	const hasContract = occurrences.some((o) => o.node.type === "CONTRACT");
	return hasContract ? ["CONTRACT elements present, not checked"] : [];
}

// ===========================================================================
// CONF03 — defeated elements reported, not propagated
// ===========================================================================

function checkCONF03(
	doc: CaseExportNested,
	occurrences: Occurrence[],
	ruleset: LoadedRuleset
): Finding[] {
	const elements: string[] = [];
	const parts: string[] = [];
	for (const occ of uniqueById(occurrences)) {
		const node = occ.node;
		if (node.assertionStatus !== "DEFEATED") {
			continue;
		}
		const parentLabel = occ.parent
			? (occ.parent.name ?? occ.parent.id)
			: "case root";
		elements.push(node.id);
		parts.push(`${node.name ?? node.id} (parent: ${parentLabel})`);
	}

	if (elements.length === 0) {
		return [];
	}

	return [
		caseLevelFinding({
			rule: "CONF03",
			doc,
			elements,
			reason: `${elements.length} element(s) are marked DEFEATED: ${parts.join("; ")}. Ancestors are not automatically marked unsupported — whether and how far the defeat propagates is a reader's judgement.`,
			severity: severityOf(ruleset, "CONF03"),
			fix: fixFor(
				ruleset,
				"CONF03",
				"Decide, and record, whether each defeat should propagate to its parent."
			),
		}),
	];
}

// ===========================================================================
// TREE06 — display labels index from 1
//
// TEA labels never carry a
// trailing letter suffix, and only GOAL/STRATEGY/PROPERTY_CLAIM/EVIDENCE are elements with a
// `name` in the nested tree (Context/Assumption/Justification are fields, not nodes). These
// display labels (G1, S1, P1, E1) are TEA element labels, unrelated to this catalogue's rule
// ids.
// ===========================================================================

const LABEL_RE = /^[GPSE]\d+(?:\.\d+)*$/;
const LABELLED_TYPES: ReadonlySet<ElementType> = new Set([
	"GOAL",
	"STRATEGY",
	"PROPERTY_CLAIM",
	"EVIDENCE",
]);

function hasZeroSegment(label: string): boolean {
	const numeric = label.slice(1); // drop the leading letter
	return numeric.split(".").some((seg) => Number(seg) === 0);
}

type LabelProblem = "unlabelled" | "notG1" | "zeroSegment";

function labelProblem(node: TreeNode, rootId: string): LabelProblem | null {
	if (
		node.name === null ||
		node.name === undefined ||
		node.name.trim() === ""
	) {
		return "unlabelled";
	}
	if (node.id === rootId && node.name !== "G1") {
		return "notG1";
	}
	return LABEL_RE.test(node.name) && hasZeroSegment(node.name)
		? "zeroSegment"
		: null;
}

function checkTREE06(
	doc: CaseExportNested,
	occurrences: Occurrence[],
	ruleset: LoadedRuleset
): Finding[] {
	const elements: string[] = [];
	let unlabelledCount = 0;
	let notG1Count = 0;
	let zeroSegmentCount = 0;

	for (const occ of uniqueById(occurrences)) {
		const node = occ.node;
		if (!LABELLED_TYPES.has(node.type)) {
			continue;
		}
		const problem = labelProblem(node, doc.tree.id);
		if (problem === null) {
			continue;
		}
		elements.push(node.id);
		if (problem === "unlabelled") {
			unlabelledCount++;
		} else if (problem === "notG1") {
			notG1Count++;
		} else {
			zeroSegmentCount++;
		}
	}

	if (elements.length === 0) {
		return [];
	}

	const parts: string[] = [];
	if (unlabelledCount > 0) {
		parts.push(`${unlabelledCount} unlabelled`);
	}
	if (notG1Count > 0) {
		parts.push("the top goal's label is not G1");
	}
	if (zeroSegmentCount > 0) {
		parts.push(`${zeroSegmentCount} contain a zero segment`);
	}

	return [
		caseLevelFinding({
			rule: "TREE06",
			doc,
			elements,
			reason: `${elements.length} element(s) have a labelling problem (labels index from 1): ${parts.join("; ")}.`,
			severity: severityOf(ruleset, "TREE06"),
			fix: fixFor(ruleset, "TREE06", "Renumber from 1."),
		}),
	];
}

// ===========================================================================
// SCOP02 — restated context (exact match only; narrowing is SCOP04's business)
// ===========================================================================

interface ContextWithAncestors {
	ancestorEntries: string[];
	context: string[];
	node: TreeNode;
}

/** Elements that have context entries of their own and at least one ancestor context entry. */
function withInheritedContext(
	occurrences: Occurrence[]
): ContextWithAncestors[] {
	const out: ContextWithAncestors[] = [];
	for (const occ of uniqueById(occurrences)) {
		const node = occ.node;
		const context = node.context ?? [];
		const ancestorEntries = occ.ancestors.flatMap((a) => a.context ?? []);
		if (context.length > 0 && ancestorEntries.length > 0) {
			out.push({ node, context, ancestorEntries });
		}
	}
	return out;
}

function checkSCOP02(
	occurrences: Occurrence[],
	ruleset: LoadedRuleset
): Finding[] {
	const findings: Finding[] = [];
	for (const { node, context, ancestorEntries } of withInheritedContext(
		occurrences
	)) {
		const ancestorNormalised = ancestorEntries.map(normalise);

		context.forEach((entry, i) => {
			const norm = normalise(entry);
			if (ancestorNormalised.includes(norm)) {
				findings.push(
					conformanceFinding({
						rule: "SCOP02",
						element: node.id,
						element_type: node.type,
						text: entry,
						reason: `context[${i}] restates a context entry already inherited from an ancestor: "${entry.trim()}".`,
						severity: severityOf(ruleset, "SCOP02"),
						fix: fixFor(
							ruleset,
							"SCOP02",
							"Remove the restated entry; it is already inherited."
						),
						field: `context[${i}]`,
						sandbox: sandboxFlag(node),
					})
				);
			}
		});
	}
	return findings;
}

// ===========================================================================
// Prechecks — mechanical facts for the judgement pass (§5), not verdicts.
// ===========================================================================

function precheckSCOP01(doc: CaseExportNested): Precheck[] {
	const context = doc.tree.context ?? [];
	if (context.length === 0) {
		return [
			{ id: "SCOP01", element: doc.tree.id, detail: "context list is empty" },
		];
	}
	return [];
}

function precheckSTEP07(occurrences: Occurrence[]): Precheck[] {
	const out: Precheck[] = [];
	for (const occ of uniqueById(occurrences)) {
		const node = occ.node;
		if (!isClaim(node.type)) {
			continue;
		}
		const claimChildren = node.children.filter(
			(c) => c.type === "PROPERTY_CLAIM"
		);
		const strategyChildren = node.children.filter((c) => c.type === "STRATEGY");
		if (claimChildren.length > 0 && strategyChildren.length === 0) {
			out.push({
				id: "STEP07",
				element: node.id,
				detail: `${claimChildren.length} claim child(ren), no strategy node`,
			});
		}
	}
	return out;
}

const SCOP04_MIN_SIMILARITY = 0.6;

interface SCOP04Candidate {
	ancestorEntry: string;
	childEntry: string;
	childIndex: number;
	node: TreeNode;
	similarity: number;
}

/** Shared by the SCOP04 precheck and the STEP01/STEP10 narrowing question — computed once. */
function findSCOP04Candidates(occurrences: Occurrence[]): SCOP04Candidate[] {
	const out: SCOP04Candidate[] = [];
	for (const { node, context, ancestorEntries } of withInheritedContext(
		occurrences
	)) {
		context.forEach((childEntry, i) => {
			const childNorm = normalise(childEntry);
			const childTokens = wordTokens(childEntry);
			let best: { entry: string; score: number } | null = null;
			for (const ancestorEntry of ancestorEntries) {
				if (normalise(ancestorEntry) === childNorm) {
					continue; // exact match is SCOP02's business
				}
				const score = jaccard(childTokens, wordTokens(ancestorEntry));
				if (
					score >= SCOP04_MIN_SIMILARITY &&
					(best === null || score > best.score)
				) {
					best = { entry: ancestorEntry, score };
				}
			}
			if (best) {
				out.push({
					node,
					childIndex: i,
					childEntry,
					ancestorEntry: best.entry,
					similarity: best.score,
				});
			}
		});
	}
	return out;
}

function precheckSCOP04(candidates: SCOP04Candidate[]): Precheck[] {
	return candidates.map((c) => ({
		id: "SCOP04",
		element: c.node.id,
		detail: `context[${c.childIndex}] shares ${Math.round(c.similarity * 100)}% of its words with an inherited context ("${c.ancestorEntry.trim()}" vs "${c.childEntry.trim()}") — narrowing/relaxing candidate, reader decides`,
	}));
}

function precheckEvidenceUrl(occurrences: Occurrence[]): Precheck[] {
	const out: Precheck[] = [];
	for (const occ of uniqueById(occurrences)) {
		const node = occ.node;
		if (node.type !== "EVIDENCE") {
			continue;
		}
		if (!nonEmpty(node.url)) {
			out.push({ id: "E-slot", element: node.id, detail: "url is empty" });
		}
	}
	return out;
}

// ===========================================================================
// Question-tier trigger pass — deterministic, structural triggers only.
// ===========================================================================

/**
 * Matches a strategy description that argues over the members of a set (hazards, functions,
 * lifecycle stages, ...). Heuristic, no source offers a test for this;
 * false positives and false negatives are an accepted cost, not a bug to chase.
 */
const SET_ARGUING_RE =
	/\b(?:argument|argue|arguing)\s+(?:over|across|by|for each)\b|\bover (?:the|each|all)\b/i;

function question(args: {
	rule: string;
	element: string;
	element_type: string;
	text: string;
	trigger: string;
	question: string;
	declared_severity?: Severity;
}): Question {
	const q: Question = {
		kind: "question",
		rule: args.rule,
		element: args.element,
		element_type: args.element_type,
		text: args.text,
		trigger: args.trigger,
		question: args.question,
		checker: "structural",
	};
	if (args.declared_severity !== undefined) {
		q.declared_severity = args.declared_severity;
	}
	return q;
}

/**
 * STEP08 trigger → questions STEP01 and STEP10 (two separate records, unlike the
 * SCOP04-narrowing trigger, which is one record, rule STEP01, mentioning STEP10 in its
 * question). A strategy that already names its set-determining Context/Assumption/
 * Justification, or that has one, does not trigger — STEP08 itself is satisfied by any of
 * those homes.
 *
 * Heuristic note: the "no child mentions the set" clause is deliberately NOT implemented —
 * no source offers a test for "this child's text is a
 * member of that set", so it would just be more surface for a false negative to hide behind.
 */
function triggerSTEP08(
	occurrences: Occurrence[],
	ruleset: LoadedRuleset
): Question[] {
	const out: Question[] = [];
	for (const occ of uniqueById(occurrences)) {
		const node = occ.node;
		if (node.type !== "STRATEGY") {
			continue;
		}
		if (!SET_ARGUING_RE.test(node.description)) {
			continue;
		}
		if ((node.context ?? []).length > 0) {
			continue;
		}
		if (nonEmpty(node.assumption)) {
			continue;
		}
		if (nonEmpty(node.justification)) {
			continue;
		}

		out.push(
			question({
				rule: "STEP01",
				element: node.id,
				element_type: node.type,
				text: node.description,
				trigger: "STEP08",
				question: questionTextFor(
					ruleset,
					"STEP01",
					"If all the sub-claims under this strategy were true, would the parent be established — what is missing?"
				),
				declared_severity: declaredSeverityFor(ruleset, "STEP01", "error"),
			})
		);
		out.push(
			question({
				rule: "STEP10",
				element: node.id,
				element_type: node.type,
				text: node.description,
				trigger: "STEP08",
				question: questionTextFor(
					ruleset,
					"STEP10",
					"If every member of this set were established, would the parent claim hold — and what is being assumed in saying so?"
				),
				declared_severity: declaredSeverityFor(ruleset, "STEP10", "warning"),
			})
		);
	}
	return out;
}

/** A strategy with exactly one child — "a decomposition of one is a rename". */
function triggerSingleChildStrategy(
	occurrences: Occurrence[],
	ruleset: LoadedRuleset
): Question[] {
	const out: Question[] = [];
	for (const occ of uniqueById(occurrences)) {
		const node = occ.node;
		if (node.type !== "STRATEGY") {
			continue;
		}
		if (node.children.length !== 1) {
			continue;
		}
		out.push(
			question({
				rule: "STEP01",
				element: node.id,
				element_type: node.type,
				text: node.description,
				trigger: "single-child-strategy",
				question:
					"This strategy has exactly one child — is this a genuine decomposition, or could the child simply replace it?",
				declared_severity: declaredSeverityFor(ruleset, "STEP01", "error"),
			})
		);
	}
	return out;
}

/** A sibling set (≥2 property claims under one strategy) with no Assumption anywhere on the path to the root. */
function triggerSiblingSetNoAssumption(
	occurrences: Occurrence[],
	ruleset: LoadedRuleset
): Question[] {
	const out: Question[] = [];
	for (const occ of uniqueById(occurrences)) {
		const node = occ.node;
		if (node.type !== "STRATEGY") {
			continue;
		}
		const claimChildren = node.children.filter(
			(c) => c.type === "PROPERTY_CLAIM"
		);
		if (claimChildren.length < 2) {
			continue;
		}

		const pathHasAssumption =
			nonEmpty(node.assumption) ||
			occ.ancestors.some((a) => nonEmpty(a.assumption));
		if (pathHasAssumption) {
			continue;
		}

		out.push(
			question({
				rule: "STEP01",
				element: node.id,
				element_type: node.type,
				text: node.description,
				trigger: "sibling-set-no-assumption",
				question:
					"These sibling claims are jointly relied on to establish the parent, and nothing on the path to the root states what is being assumed — is the decomposition really gap-free?",
				declared_severity: declaredSeverityFor(ruleset, "STEP01", "error"),
			})
		);
	}
	return out;
}

/** SCOP04-narrowing candidate → one combined STEP01/STEP10 question. */
function triggerSCOP04Narrowing(
	candidates: SCOP04Candidate[],
	ruleset: LoadedRuleset
): Question[] {
	return candidates.map((c) =>
		question({
			rule: "STEP01",
			element: c.node.id,
			element_type: c.node.type,
			text: c.childEntry,
			trigger: "SCOP04-narrowing",
			question: `This context narrows an inherited one ("${c.ancestorEntry.trim()}" -> "${c.childEntry.trim()}") — does the narrower scope still cover what the parent claims (STEP01), and does the claimed property still distribute over the reduced set (STEP10)?`,
			declared_severity: declaredSeverityFor(ruleset, "STEP01", "error"),
		})
	);
}

/** A claim with ≥2 direct Evidence children. */
function triggerCONF02(
	occurrences: Occurrence[],
	ruleset: LoadedRuleset
): Question[] {
	const out: Question[] = [];
	for (const occ of uniqueById(occurrences)) {
		const node = occ.node;
		if (!isClaim(node.type)) {
			continue;
		}
		const evidenceChildren = node.children.filter((c) => c.type === "EVIDENCE");
		if (evidenceChildren.length < 2) {
			continue;
		}
		out.push(
			question({
				rule: "CONF02",
				element: node.id,
				element_type: node.type,
				text: node.description,
				trigger: "evidence-count",
				question: questionTextFor(
					ruleset,
					"CONF02",
					"Do these lines of evidence share a source, tool, team, dataset or assumption?"
				),
				declared_severity: declaredSeverityFor(ruleset, "CONF02", "style"),
			})
		);
	}
	return out;
}

/** Case-level: no element anywhere carries isDefeater: true. */
function triggerCONF04(
	doc: CaseExportNested,
	occurrences: Occurrence[],
	ruleset: LoadedRuleset
): Question[] {
	const hasDefeater = occurrences.some((o) => o.node.isDefeater === true);
	if (hasDefeater) {
		return [];
	}
	return [
		question({
			rule: "CONF04",
			element: "case",
			element_type: doc.tree.type,
			text: doc.tree.description,
			trigger: "no-defeaters",
			question: questionTextFor(
				ruleset,
				"CONF04",
				"Has the case recorded what could defeat it, and why those defeaters do not succeed?"
			),
			declared_severity: declaredSeverityFor(ruleset, "CONF04", "warning"),
		}),
	];
}

// ===========================================================================
// checkStructure — the public entry point
// ===========================================================================

export function checkStructure(
	doc: CaseExportNested,
	ruleset: LoadedRuleset
): Report {
	const occurrences = walk(doc.tree);

	const findings: Finding[] = [
		...checkTREE01(doc, ruleset, occurrences),
		...checkTREE02(doc, occurrences, ruleset),
		...checkTREE03(doc, occurrences, ruleset),
		...checkEVID01(occurrences, ruleset),
		...checkTREE04(doc, occurrences, ruleset),
		...checkCONF03(doc, occurrences, ruleset),
		...checkTREE06(doc, occurrences, ruleset),
		...checkSCOP02(occurrences, ruleset),
	];

	const scop04Candidates = findSCOP04Candidates(occurrences);

	const questions: Question[] = [
		...triggerSTEP08(occurrences, ruleset),
		...triggerSingleChildStrategy(occurrences, ruleset),
		...triggerSiblingSetNoAssumption(occurrences, ruleset),
		...triggerSCOP04Narrowing(scop04Candidates, ruleset),
		...triggerCONF02(occurrences, ruleset),
		...triggerCONF04(doc, occurrences, ruleset),
	];

	const prechecks: Precheck[] = [
		...precheckSCOP01(doc),
		...precheckSTEP07(occurrences),
		...precheckSCOP04(scop04Candidates),
		...precheckEvidenceUrl(occurrences),
	];

	const unchecked: string[] = [
		...checkTREE05(occurrences),
		...checkContract(occurrences),
	];
	unchecked.push(
		"Sibling-set-changed-since-last-review trigger not implemented: needs run history."
	);
	unchecked.push(
		"STEP08's set-arguing detection has no test in any source; the heuristic regex is a best-effort proxy, not a validated check."
	);

	// Deterministic order: element id, then rule id.
	findings.sort(
		(a, b) => a.element.localeCompare(b.element) || a.rule.localeCompare(b.rule)
	);
	questions.sort(
		(a, b) =>
			a.element.localeCompare(b.element) ||
			a.rule.localeCompare(b.rule) ||
			a.trigger.localeCompare(b.trigger)
	);
	prechecks.sort(
		(a, b) => a.id.localeCompare(b.id) || a.element.localeCompare(b.element)
	);

	const counts = {
		surfaced: { error: 0, warning: 0, style: 0 },
		acked: { error: 0, warning: 0, style: 0 },
		questions: questions.length,
	};
	let ackedClaims = 0;
	for (const f of findings) {
		if (f.kind !== "conformance") {
			continue;
		}
		const bucket = f.acked === true ? counts.acked : counts.surfaced;
		bucket[f.severity]++;
		// An acked case-level record (TREE03) lists its claims in `elements`; count each claim once.
		if (f.acked === true) {
			ackedClaims += f.elements ? f.elements.length : 1;
		}
	}

	const judgementRules = [...ruleset.rules.values()]
		.filter(
			(r) =>
				r.mechanism === "judgement" &&
				r.mode.includes("review") &&
				r.question_text === undefined
		)
		.map((r) => r.id)
		.sort();

	return {
		ruleset: { version: ruleset.version, date: ruleset.date },
		input: { schema: "tea-nested", version: "1.0" },
		case: { name: doc.case.name, exportedAt: doc.exportedAt },
		findings,
		questions,
		counts,
		incomplete: { acked_claims: ackedClaims },
		unchecked,
		prechecks,
		judgement_rules: judgementRules,
	};
}
