import { describe, expect, it } from "vitest";
import {
	caseDoc,
	claim,
	evidence,
	goal,
	strategy,
} from "../linter/__tests__/builders";
import { lintCase } from "../linter/lint-case";

const MANY = 120;

function unsupportedClaims(count: number) {
	return Array.from({ length: count }, (_, i) =>
		claim(`P${i + 1}`, `Claim ${i + 1}.`)
	);
}

describe("lintCase bounds", () => {
	it("keeps the first 100 findings and reports how many were dropped", () => {
		const result = lintCase(
			caseDoc(
				"Many",
				goal("G1", "Top.", {
					context: ["Scope."],
					children: [
						strategy("S1", "Argue.", { children: unsupportedClaims(MANY) }),
					],
				})
			)
		);

		const evid01 = result.findings.filter((f) => f.ruleId === "EVID01");
		expect(result.findings).toHaveLength(100);
		expect(evid01.length).toBeGreaterThan(90);
		expect(result.truncated).toBeGreaterThanOrEqual(MANY - 100);
	});

	it("reports truncated as 0 when nothing was dropped", () => {
		const result = lintCase(
			caseDoc("Few", evidence("E1", "Audit.", { url: "https://example.org" }))
		);

		expect(result.truncated).toBe(0);
	});

	it("cuts a 1,000-character label to 200 characters plus an ellipsis", () => {
		const long = "x".repeat(1000);
		const result = lintCase(
			caseDoc(
				"Long",
				goal("G1", "Top.", {
					context: ["Scope."],
					children: [
						strategy("S1", "Argue.", {
							children: [
								claim(long, "Unsupported."),
								claim("P2", "Held.", { assertionStatus: "NEEDS_SUPPORT" }),
							],
						}),
					],
				})
			)
		);

		const labelled = result.findings.find((f) =>
			f.elementLabel.startsWith("xxx")
		);
		expect(labelled?.elementLabel).toBe(`${"x".repeat(200)}…`);
		expect(
			[...result.findings, ...result.acknowledgedGaps].every(
				(f) => f.elementLabel.length <= 201
			)
		).toBe(true);
	});

	it("returns the checker's prechecks with a label, rule id and detail", () => {
		const result = lintCase(
			caseDoc("Bare", goal("G1", "Top.", { children: [] }))
		);

		expect(result.prechecks).toContainEqual({
			ruleId: "SCOP01",
			elementLabel: "G1",
			detail: "context list is empty",
		});
	});

	it("treats an element whose assertionStatus is null as unacknowledged", () => {
		const result = lintCase(
			caseDoc(
				"Null status",
				goal("G1", "Top.", {
					context: ["Scope."],
					children: [
						strategy("S1", "Argue.", {
							children: [claim("P1", "Open.", { assertionStatus: null })],
						}),
					],
				})
			)
		);

		expect(
			result.findings.some(
				(f) => f.ruleId === "EVID01" && f.elementLabel === "P1"
			)
		).toBe(true);
		expect(result.acknowledgedGaps).toEqual([]);
	});
});
