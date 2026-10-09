import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RULESET } from "../ruleset";
import { checkStructure } from "../structural";
import { caseDoc, claim, evidence, goal, strategy } from "./builders";

const IMPURE = /from "node:(fs|path|os)|require\(|process\.env|fetch\(/;

function wellFormed() {
	return caseDoc(
		"Well formed",
		goal("G1", "The system is acceptably fair.", {
			context: ["Deployed in one hospital."],
			children: [
				strategy("S1", "Argue over fairness measures.", {
					children: [
						claim("P1", "Group accuracy gaps are small.", {
							children: [
								evidence("E1", "Audit report of accuracy by group.", {
									url: "https://example.org/a",
								}),
							],
						}),
						claim("P2", "Calibration holds across groups.", {
							children: [
								evidence("E2", "Calibration study.", {
									url: "https://example.org/b",
								}),
							],
						}),
					],
				}),
			],
		})
	);
}

describe("checkStructure", () => {
	it("yields no findings for a well-formed small case", () => {
		expect(checkStructure(wellFormed(), RULESET).findings).toEqual([]);
	});

	it("reports a missing root (TREE01) and an orphan (TREE03) for a case rooted at evidence", () => {
		// no top-level goal exists, and the evidence at the root supports nothing
		const doc = caseDoc(
			"Broken",
			evidence("G1", "Audit report.", { url: "https://example.org/a" })
		);
		const report = checkStructure(doc, RULESET);
		expect(report.findings.map((f) => f.rule).sort()).toEqual([
			"TREE01",
			"TREE03",
		]);
		for (const f of report.findings) {
			expect(f.acked).toBeUndefined();
			expect(f.elements).toContain(doc.tree.id);
		}
	});

	it("puts a NEEDS_SUPPORT claim under acknowledged gaps, not findings", () => {
		const doc = caseDoc(
			"Gap",
			goal("G1", "The system is acceptably fair.", {
				context: ["Deployed in one hospital."],
				children: [
					strategy("S1", "Argue over measures.", {
						children: [
							claim("P1", "Gaps are small.", {
								assertionStatus: "NEEDS_SUPPORT",
							}),
							claim("P2", "Calibration holds.", {
								children: [
									evidence("E2", "Study.", { url: "https://example.org/b" }),
								],
							}),
						],
					}),
				],
			})
		);
		const report = checkStructure(doc, RULESET);
		const acked = report.findings.filter((f) => f.acked);
		expect(acked.map((f) => f.rule)).toContain("EVID01");
		expect(
			report.findings.filter((f) => !f.acked).map((f) => f.rule)
		).not.toContain("EVID01");
	});

	it("is pure: same input gives identical output and the input is untouched", () => {
		const doc = wellFormed();
		const before = JSON.stringify(doc);
		const a = checkStructure(doc, RULESET);
		const b = checkStructure(doc, RULESET);
		expect(b).toEqual(a);
		expect(JSON.stringify(doc)).toBe(before);
		expect(JSON.stringify(checkStructure(JSON.parse(before), RULESET))).toBe(
			JSON.stringify(a)
		);
	});

	it("imports no filesystem, path or environment access", () => {
		const src = readFileSync(
			join(import.meta.dirname, "..", "structural.ts"),
			"utf8"
		);
		expect(src).not.toMatch(IMPURE);
	});
});
