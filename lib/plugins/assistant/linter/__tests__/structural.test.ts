/**
 * Tests for checkStructure() and the question-tier trigger pass, against the generated
 * ruleset.
 */

import { describe, expect, test } from "vitest";
import { RULESET } from "../ruleset";
import { checkStructure } from "../structural";
import type { ConformanceFinding, LintCase } from "../types";
import { awayGoal, caseDoc, claim, evidence, goal, strategy } from "./builders";

const ruleset = RULESET;
type CaseExportNested = LintCase;

function findingsFor(
	doc: CaseExportNested,
	rule: string
): ConformanceFinding[] {
	return checkStructure(doc, ruleset).findings.filter(
		(f): f is ConformanceFinding => f.kind === "conformance" && f.rule === rule
	);
}

// ---------------------------------------------------------------------------
// TREE01 — one root
// ---------------------------------------------------------------------------

describe("TREE01 — one root", () => {
	test("pass: a Goal root with role TOP_LEVEL", () => {
		const doc = caseDoc(
			"t",
			goal("G1", "top", { children: [strategy("S1", "argument over x")] })
		);
		expect(findingsFor(doc, "TREE01")).toHaveLength(0);
	});

	test("fail: root is not a Goal", () => {
		const doc = caseDoc("t", claim("P1", "not a goal", { role: "TOP_LEVEL" }));
		const findings = findingsFor(doc, "TREE01");
		expect(findings).toHaveLength(1);
		expect(findings[0]?.severity).toBe("warning");
		expect(findings[0]?.element).toBe("case");
	});

	test("fail: two elements carry role TOP_LEVEL, and the finding names both", () => {
		const second = goal("G2", "another top", {});
		const doc = caseDoc("t", goal("G1", "top", { children: [second] }));
		const findings = findingsFor(doc, "TREE01");
		expect(findings).toHaveLength(1);
		expect(findings[0]?.elements).toEqual([doc.tree.id, second.id]);
		expect(findings[0]?.reason).toContain(
			"2 elements carry role TOP_LEVEL (G1, G2)"
		);
	});
});

// ---------------------------------------------------------------------------
// TREE02 — acyclic
// ---------------------------------------------------------------------------

describe("TREE02 — acyclic", () => {
	test("pass: no reference edges", () => {
		const doc = caseDoc(
			"t",
			goal("G1", "top", {
				children: [claim("P1", "sub", { children: [evidence("E1", "ev")] })],
			})
		);
		expect(findingsFor(doc, "TREE02")).toHaveLength(0);
	});

	test("fail: a citedElementId points back up the tree, closing a cycle", () => {
		// Case-scope, once per case: ONE record, naming both cyclic
		// elements in `elements` (tree order), not one record each.
		const rootId = "cycle-root";
		const child = claim("P1", "cites its own ancestor", {
			citedElementId: rootId,
		});
		const doc = caseDoc(
			"t",
			goal("G1", "top", { id: rootId, children: [child] })
		);
		const findings = findingsFor(doc, "TREE02");
		expect(findings).toHaveLength(1);
		expect(findings[0]?.element).toBe("case");
		expect(findings[0]?.elements).toEqual([rootId, child.id]);
		expect(findings[0]?.severity).toBe("error");
	});
});

// ---------------------------------------------------------------------------
// TREE03 — no orphan or dangling elements
// ---------------------------------------------------------------------------

describe("TREE03 — no orphan or dangling elements", () => {
	test("pass: strategy has children", () => {
		const doc = caseDoc(
			"t",
			goal("G1", "top", {
				children: [
					strategy("S1", "argument", { children: [claim("P1", "x")] }),
				],
			})
		);
		expect(findingsFor(doc, "TREE03")).toHaveLength(0);
	});

	test("fail: a strategy has zero children (case-scope, once per case)", () => {
		// A second, well-supported branch keeps the root itself from also being "no real
		// support" (that combination is covered by its own test below) — isolates S1's finding.
		const s = strategy("S1", "argument over nothing", { children: [] });
		const other = claim("P1", "supported elsewhere", {
			children: [evidence("E1", "e")],
		});
		const doc = caseDoc("t", goal("G1", "top", { children: [s, other] }));
		const findings = findingsFor(doc, "TREE03");
		expect(findings).toHaveLength(1);
		expect(findings[0]?.element).toBe("case");
		expect(findings[0]?.elements).toEqual([s.id]);
		expect(findings[0]?.severity).toBe("error");
		expect(findings[0]?.acked).toBeUndefined();
	});

	test("fail: the root goal has no children at all", () => {
		const doc = caseDoc("t", goal("G1", "top", { children: [] }));
		const findings = findingsFor(doc, "TREE03");
		expect(findings.some((f) => f.elements?.includes(doc.tree.id))).toBe(true);
	});

	test("does not re-fire on a leaf property claim — that is EVID01's job", () => {
		const p = claim("P1", "leaf claim, no evidence", { children: [] });
		const doc = caseDoc(
			"t",
			goal("G1", "top", { children: [strategy("S1", "x", { children: [p] })] })
		);
		expect(
			findingsFor(doc, "TREE03").some((f) => f.elements?.includes(p.id))
		).toBe(false);
		expect(findingsFor(doc, "EVID01").some((f) => f.element === p.id)).toBe(
			true
		);
	});

	test("fires on a claim whose only child is an empty strategy (no real downstream support)", () => {
		const hollow = strategy("S1.1", "argument over nothing", { children: [] });
		const p = claim("P1", "claim with a hollow strategy child", {
			children: [hollow],
		});
		const doc = caseDoc(
			"t",
			goal("G1", "top", { children: [strategy("S1", "x", { children: [p] })] })
		);
		// The hollow strategy fires its own TREE03 (empty strategy)...
		expect(
			findingsFor(doc, "TREE03").some((f) => f.elements?.includes(hollow.id))
		).toBe(true);
		// ...and P1 fires EVID01, because a childless-of-real-content strategy does not rescue it
		// (a hollow strategy beneath a claim).
		expect(findingsFor(doc, "EVID01").some((f) => f.element === p.id)).toBe(
			true
		);
	});

	test("a childless root GOAL marked NEEDS_SUPPORT yields an ACKED TREE03 record", () => {
		// TREE03 is both case-scope (once per case) and ack-able: a mixed list
		// cannot carry one `acked` flag, so an ack-able aggregate rule may emit up to two
		// case-level records. Here there is nothing to surface — only the acked record should
		// appear.
		const doc = caseDoc(
			"t",
			goal("G1", "top", { children: [], assertionStatus: "NEEDS_SUPPORT" })
		);
		const report = checkStructure(doc, ruleset);
		const tree03 = report.findings.filter(
			(f): f is ConformanceFinding =>
				f.kind === "conformance" && f.rule === "TREE03"
		);
		expect(tree03).toHaveLength(1);
		expect(tree03[0]?.acked).toBe(true);
		expect(tree03[0]?.acked_by).toBe("assertionStatus:NEEDS_SUPPORT");
		expect(tree03[0]?.elements).toEqual([doc.tree.id]);
		expect(report.counts.surfaced.error).toBe(0);
		expect(report.counts.acked.error).toBe(1);
		expect(report.incomplete.acked_claims).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// EVID01 — a leaf claim has evidence (+ acking)
// ---------------------------------------------------------------------------

describe("EVID01 — a leaf claim has evidence", () => {
	test("pass: leaf claim has an evidence child", () => {
		const p = claim("P1", "supported", {
			children: [evidence("E1", "artefact")],
		});
		const doc = caseDoc(
			"t",
			goal("G1", "top", { children: [strategy("S1", "x", { children: [p] })] })
		);
		expect(findingsFor(doc, "EVID01")).toHaveLength(0);
	});

	test("fail, surfaced: leaf claim with no evidence and no assertionStatus", () => {
		const p = claim("P1", "unsupported", { children: [] });
		const doc = caseDoc(
			"t",
			goal("G1", "top", { children: [strategy("S1", "x", { children: [p] })] })
		);
		const findings = findingsFor(doc, "EVID01");
		expect(findings).toHaveLength(1);
		expect(findings[0]?.acked).toBeUndefined();
	});

	test("fail, acked: leaf claim marked NEEDS_SUPPORT", () => {
		const p = claim("P1", "planned", {
			children: [],
			assertionStatus: "NEEDS_SUPPORT",
		});
		const doc = caseDoc(
			"t",
			goal("G1", "top", { children: [strategy("S1", "x", { children: [p] })] })
		);
		const findings = findingsFor(doc, "EVID01");
		expect(findings).toHaveLength(1);
		expect(findings[0]?.acked).toBe(true);
		expect(findings[0]?.acked_by).toBe("assertionStatus:NEEDS_SUPPORT");
	});
});

// ---------------------------------------------------------------------------
// TREE04 — undeveloped branches are marked (literal "no children", never acked)
// ---------------------------------------------------------------------------

describe("TREE04 — undeveloped branches are marked", () => {
	test("pass: every branch has children", () => {
		const doc = caseDoc(
			"t",
			goal("G1", "top", {
				children: [
					strategy("S1", "x", {
						children: [claim("P1", "y", { children: [evidence("E1", "z")] })],
					}),
				],
			})
		);
		expect(findingsFor(doc, "TREE04")).toHaveLength(0);
	});

	test("fail: leaf claim is undeveloped even when acked", () => {
		// Case-scope, once per case: one TREE04 record naming the leaf, never acked.
		const p = claim("P1", "planned", {
			children: [],
			assertionStatus: "NEEDS_SUPPORT",
		});
		const doc = caseDoc(
			"t",
			goal("G1", "top", { children: [strategy("S1", "x", { children: [p] })] })
		);
		const findings = findingsFor(doc, "TREE04");
		expect(findings).toHaveLength(1);
		expect(findings[0]?.element).toBe("case");
		expect(findings[0]?.elements).toEqual([p.id]);
		expect(findings[0]?.acked).toBeUndefined();
		expect(findings[0]?.severity).toBe("warning");
		expect(findings[0]?.reason).toContain("1 branch");
		expect(findings[0]?.reason).toContain("NEEDS_SUPPORT");
	});
});

// ---------------------------------------------------------------------------
// TREE05 — away elements (single-case run: skipped, not silent)
// ---------------------------------------------------------------------------

describe("TREE05 — away elements", () => {
	test("no away/module elements: nothing pushed to unchecked", () => {
		const doc = caseDoc("t", goal("G1", "top", { children: [] }));
		const report = checkStructure(doc, ruleset);
		expect(report.unchecked.some((u) => u.startsWith("TREE05"))).toBe(false);
	});

	test("an AWAY_GOAL is present: pushed to unchecked, no finding", () => {
		const doc = caseDoc(
			"t",
			goal("G1", "top", { children: [awayGoal("AG1", "elsewhere")] })
		);
		const report = checkStructure(doc, ruleset);
		expect(report.unchecked).toContain("TREE05 skipped: single-case run");
		expect(report.findings.some((f) => f.rule === "TREE05")).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// CONTRACT — present, not checked
// ---------------------------------------------------------------------------

describe("CONTRACT elements", () => {
	test("present: pushed to unchecked", () => {
		const contract = claim("C1", "x"); // stand-in node, overwrite type below
		contract.type = "CONTRACT";
		const doc = caseDoc("t", goal("G1", "top", { children: [contract] }));
		const report = checkStructure(doc, ruleset);
		expect(report.unchecked).toContain(
			"CONTRACT elements present, not checked"
		);
	});
});

// ---------------------------------------------------------------------------
// CONF03 — defeated elements reported, not propagated
// ---------------------------------------------------------------------------

describe("CONF03 — defeated elements", () => {
	test("pass: nothing is DEFEATED", () => {
		const doc = caseDoc("t", goal("G1", "top", { children: [] }));
		expect(findingsFor(doc, "CONF03")).toHaveLength(0);
	});

	test("fail: a DEFEATED element is flagged and names its parent, ancestors are not marked", () => {
		// Case-scope, once per case: one CONF03 record naming the defeated element.
		const p = claim("P1", "defeated claim", {
			assertionStatus: "DEFEATED",
			children: [evidence("E1", "e")],
		});
		const doc = caseDoc(
			"t",
			goal("G1", "top", { children: [strategy("S1", "x", { children: [p] })] })
		);
		const findings = findingsFor(doc, "CONF03");
		expect(findings).toHaveLength(1);
		expect(findings[0]?.element).toBe("case");
		expect(findings[0]?.elements).toEqual([p.id]);
		expect(findings[0]?.severity).toBe("warning");
		expect(findings[0]?.reason).toContain("parent");
		// The parent (S1) itself must not carry a TREE03/TREE04 finding as a result (it has a child).
		expect(
			checkStructure(doc, ruleset).findings.some((f) =>
				f.elements?.includes(doc.tree.children[0]?.id ?? "")
			)
		).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// TREE06 — display labels index from 1
// ---------------------------------------------------------------------------

describe("TREE06 — display labels index from 1", () => {
	test("pass: G1 root, well-formed descendant labels", () => {
		const doc = caseDoc(
			"t",
			goal("G1", "top", {
				children: [strategy("S1", "x", { children: [claim("P1.1", "y")] })],
			})
		);
		expect(findingsFor(doc, "TREE06")).toHaveLength(0);
	});

	test("fail: top goal is not G1", () => {
		const doc = caseDoc("t", goal("G0", "top", { children: [] }));
		const findings = findingsFor(doc, "TREE06");
		expect(findings.some((f) => f.reason.includes("not G1"))).toBe(true);
	});

	test("fail: a zero segment", () => {
		const p = claim("P1.0", "bad label");
		const doc = caseDoc(
			"t",
			goal("G1", "top", { children: [strategy("S1", "x", { children: [p] })] })
		);
		const findings = findingsFor(doc, "TREE06");
		expect(
			findings.some((f) => f.elements?.includes(p.id) && f.severity === "style")
		).toBe(true);
	});

	test("fail: unlabelled (null name)", () => {
		const p = claim(null, "no name");
		const doc = caseDoc(
			"t",
			goal("G1", "top", { children: [strategy("S1", "x", { children: [p] })] })
		);
		const findings = findingsFor(doc, "TREE06");
		expect(
			findings.some(
				(f) => f.elements?.includes(p.id) && f.reason.includes("unlabelled")
			)
		).toBe(true);
	});

	test("case-scope: several problems collapse into ONE record naming every element", () => {
		const zero = claim("P1.0", "bad label");
		const unlabelled = claim(null, "no name");
		const doc = caseDoc(
			"t",
			goal("G0", "top", {
				children: [strategy("S1", "x", { children: [zero, unlabelled] })],
			})
		);
		const findings = findingsFor(doc, "TREE06");
		expect(findings).toHaveLength(1);
		expect(findings[0]?.element).toBe("case");
		expect(findings[0]?.elements?.sort()).toEqual(
			[doc.tree.id, zero.id, unlabelled.id].sort()
		);
	});
});

// ---------------------------------------------------------------------------
// SCOP02 — restated context (exact match only)
// ---------------------------------------------------------------------------

describe("SCOP02 — restated context", () => {
	test("pass: child context differs from ancestor's (narrowing is SCOP04's business)", () => {
		const p = claim("P1", "x", { context: ["0-25C"] });
		const doc = caseDoc(
			"t",
			goal("G1", "top", {
				context: ["0-40C"],
				children: [strategy("S1", "y", { children: [p] })],
			})
		);
		expect(findingsFor(doc, "SCOP02")).toHaveLength(0);
	});

	test("fail: child context restates an ancestor's, trimmed/case-insensitive", () => {
		const p = claim("P1", "x", { context: ["  Use: research scoping  "] });
		const doc = caseDoc(
			"t",
			goal("G1", "top", {
				context: ["use: research scoping"],
				children: [strategy("S1", "y", { children: [p] })],
			})
		);
		const findings = findingsFor(doc, "SCOP02");
		expect(findings).toHaveLength(1);
		expect(findings[0]?.field).toBe("context[0]");
		expect(findings[0]?.severity).toBe("style");
	});
});

// ---------------------------------------------------------------------------
// Prechecks (facts, not verdicts)
// ---------------------------------------------------------------------------

describe("prechecks", () => {
	test("SCOP01: top goal has an empty context list", () => {
		const doc = caseDoc("t", goal("G1", "top", { children: [] }));
		const report = checkStructure(doc, ruleset);
		expect(
			report.prechecks.some(
				(p) => p.id === "SCOP01" && p.element === doc.tree.id
			)
		).toBe(true);
	});

	test("SCOP01: does not fire when context is non-empty", () => {
		const doc = caseDoc(
			"t",
			goal("G1", "top", { context: ["scope"], children: [] })
		);
		const report = checkStructure(doc, ruleset);
		expect(report.prechecks.some((p) => p.id === "SCOP01")).toBe(false);
	});

	test("STEP07: a claim with claim children and no strategy node", () => {
		const parent = claim("P1", "implicit strategy", {
			children: [claim("P1.1", "child a"), claim("P1.2", "child b")],
		});
		const doc = caseDoc(
			"t",
			goal("G1", "top", {
				children: [strategy("S1", "x", { children: [parent] })],
			})
		);
		const report = checkStructure(doc, ruleset);
		expect(
			report.prechecks.some((p) => p.id === "STEP07" && p.element === parent.id)
		).toBe(true);
	});

	test("SCOP04 candidate: a child context narrows an inherited one (high word overlap, not exact)", () => {
		const p = claim("P1", "x", {
			context: ["the system operates in urban driving conditions"],
		});
		const doc = caseDoc(
			"t",
			goal("G1", "top", {
				context: [
					"the system operates in urban and motorway driving conditions",
				],
				children: [strategy("S1", "y", { children: [p] })],
			})
		);
		const report = checkStructure(doc, ruleset);
		expect(
			report.prechecks.some((pc) => pc.id === "SCOP04" && pc.element === p.id)
		).toBe(true);
	});

	test("E-slot: an evidence node with an empty url", () => {
		const e = evidence("E1", "artefact", { url: "" });
		const doc = caseDoc(
			"t",
			goal("G1", "top", {
				children: [
					strategy("S1", "x", {
						children: [claim("P1", "y", { children: [e] })],
					}),
				],
			})
		);
		const report = checkStructure(doc, ruleset);
		expect(
			report.prechecks.some((p) => p.id === "E-slot" && p.element === e.id)
		).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Question-tier triggers
// ---------------------------------------------------------------------------

describe("question-tier triggers", () => {
	test("STEP08 trigger: set-arguing strategy with no context/assumption/justification asks STEP01 and STEP10", () => {
		const s = strategy("S1", "Argument over the identified hazards.");
		const doc = caseDoc("t", goal("G1", "top", { children: [s] }));
		const report = checkStructure(doc, ruleset);
		const forS = report.questions.filter((q) => q.element === s.id);
		expect(forS.map((q) => q.rule).sort()).toEqual(["STEP01", "STEP10"]);
		expect(forS.every((q) => q.trigger === "STEP08")).toBe(true);
		expect(forS.every((q) => q.kind === "question")).toBe(true);
		// Questions never carry `severity` — only `declared_severity`.
		expect(forS.every((q) => !("severity" in q))).toBe(true);
	});

	test("STEP08 trigger does not fire when the strategy already names its set (a Context entry)", () => {
		const s = strategy("S1", "Argument over the identified hazards.", {
			context: ["Hazard log v4"],
		});
		const doc = caseDoc("t", goal("G1", "top", { children: [s] }));
		const report = checkStructure(doc, ruleset);
		expect(report.questions.some((q) => q.element === s.id)).toBe(false);
	});

	test("single-child-strategy trigger: a strategy with exactly one child asks STEP01", () => {
		const s = strategy("S1", "Decomposes into one thing.", {
			children: [claim("P1", "only child")],
		});
		const doc = caseDoc("t", goal("G1", "top", { children: [s] }));
		const report = checkStructure(doc, ruleset);
		expect(
			report.questions.some(
				(q) =>
					q.element === s.id &&
					q.rule === "STEP01" &&
					q.trigger === "single-child-strategy"
			)
		).toBe(true);
	});

	test("sibling-set-no-assumption trigger: >=2 claim siblings, no assumption on the path to root", () => {
		const s = strategy("S1", "x", {
			children: [claim("P1", "a"), claim("P2", "b")],
		});
		const doc = caseDoc("t", goal("G1", "top", { children: [s] }));
		const report = checkStructure(doc, ruleset);
		expect(
			report.questions.some(
				(q) => q.element === s.id && q.trigger === "sibling-set-no-assumption"
			)
		).toBe(true);
	});

	test("sibling-set-no-assumption does not fire when the root carries an assumption", () => {
		const s = strategy("S1", "x", {
			children: [claim("P1", "a"), claim("P2", "b")],
		});
		const doc = caseDoc(
			"t",
			goal("G1", "top", { assumption: "actuals are faithful", children: [s] })
		);
		const report = checkStructure(doc, ruleset);
		expect(
			report.questions.some((q) => q.trigger === "sibling-set-no-assumption")
		).toBe(false);
	});

	test("SCOP04-narrowing trigger: one combined STEP01 record mentioning STEP10", () => {
		const p = claim("P1", "x", {
			context: ["the system operates in urban driving conditions"],
		});
		const doc = caseDoc(
			"t",
			goal("G1", "top", {
				context: [
					"the system operates in urban and motorway driving conditions",
				],
				children: [strategy("S1", "y", { children: [p] })],
			})
		);
		const report = checkStructure(doc, ruleset);
		const matches = report.questions.filter(
			(q) => q.element === p.id && q.trigger === "SCOP04-narrowing"
		);
		expect(matches).toHaveLength(1);
		expect(matches[0]?.rule).toBe("STEP01");
		expect(matches[0]?.question).toContain("STEP10");
	});

	test("CONF02 trigger: a claim with >=2 evidence children", () => {
		const p = claim("P1", "x", {
			children: [evidence("E1", "a"), evidence("E2", "b")],
		});
		const doc = caseDoc(
			"t",
			goal("G1", "top", { children: [strategy("S1", "y", { children: [p] })] })
		);
		const report = checkStructure(doc, ruleset);
		expect(
			report.questions.some((q) => q.element === p.id && q.rule === "CONF02")
		).toBe(true);
	});

	test("CONF04 trigger: no element anywhere carries isDefeater — one case-level question", () => {
		const doc = caseDoc("t", goal("G1", "top", { children: [] }));
		const report = checkStructure(doc, ruleset);
		const conf04 = report.questions.filter((q) => q.rule === "CONF04");
		expect(conf04).toHaveLength(1);
		expect(conf04[0]?.element).toBe("case");
	});

	test("CONF04 trigger does not fire when a defeater is present", () => {
		const defeater = claim("P2", "defeats P1", {
			isDefeater: true,
			defeatsElementId: "some-id",
		});
		const doc = caseDoc("t", goal("G1", "top", { children: [defeater] }));
		const report = checkStructure(doc, ruleset);
		expect(report.questions.some((q) => q.rule === "CONF04")).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Acked planning case
// ---------------------------------------------------------------------------

describe("acked planning case", () => {
	test("twelve NEEDS_SUPPORT leaves: 0 surfaced errors, 12 acked errors, 12 incomplete acked_claims", () => {
		const leaves = Array.from({ length: 12 }, (_, i) =>
			claim(`P1.${i + 1}`, `planned claim ${i + 1}`, {
				children: [],
				assertionStatus: "NEEDS_SUPPORT",
			})
		);
		const doc = caseDoc(
			"t",
			goal("G1", "top", {
				context: ["scope"],
				children: [
					strategy("S1", "Argument over the twelve planned checks.", {
						context: ["Checklist v1"],
						children: leaves,
					}),
				],
			})
		);
		const report = checkStructure(doc, ruleset);
		expect(report.counts.surfaced.error).toBe(0);
		expect(report.counts.acked.error).toBe(12);
		expect(report.incomplete.acked_claims).toBe(12);
	});
});

// ---------------------------------------------------------------------------
// Reproducibility and ruleset coverage
// ---------------------------------------------------------------------------

describe("reproducibility", () => {
	test("two runs over the same input produce byte-identical reports", () => {
		const doc = caseDoc(
			"t",
			goal("G1", "top", {
				context: ["scope"],
				children: [
					strategy("S1", "Argument over the identified hazards.", {
						children: [
							claim("P1", "a"),
							claim("P2", "b", { children: [evidence("E1", "e")] }),
						],
					}),
				],
			})
		);
		expect(JSON.stringify(checkStructure(doc, ruleset))).toBe(
			JSON.stringify(checkStructure(doc, ruleset))
		);
	});
});

describe("generated ruleset", () => {
	test("carries every rule the structural checks emit, and marks EVID01 and TREE03 ackable", () => {
		for (const id of [
			"TREE01",
			"TREE02",
			"TREE03",
			"TREE04",
			"TREE06",
			"EVID01",
			"CONF03",
			"SCOP02",
		]) {
			expect(ruleset.rules.has(id)).toBe(true);
		}
		expect([...ruleset.ackableIds].sort()).toEqual(["EVID01", "TREE03"]);
	});
});
