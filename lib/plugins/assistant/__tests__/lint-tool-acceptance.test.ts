import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	caseDoc,
	claim,
	evidence,
	goal,
	strategy,
} from "../linter/__tests__/builders";
import { lintCase } from "../linter/lint-case";

const exportCase = vi.fn();
vi.mock("@/lib/services/case-export-service", () => ({
	exportCase: (...args: unknown[]) => exportCase(...args),
}));

import { buildSystemPrompt, createCaseTools } from "../tools";

const ASSISTANT_SYSTEM_PROMPT = buildSystemPrompt(
	Object.keys(createCaseTools("u", "c"))
);

// The generator's own name pattern, when the environment provides it.
const NAME_PATTERN = process.env.RULESET_NAME_CHECK?.trim();

const SEVERITY = /^(error|warning|style)$/;
const CALL_ONCE = /call it once/;
const NEVER_ADEQUATE = /Never say whether the case is adequate/;

function brokenDoc() {
	// evidence at the root: no top-level goal, and the evidence supports nothing
	return caseDoc(
		"Broken",
		evidence("G1", "Audit report.", { url: "https://example.org/a" })
	);
}

function gapDoc() {
	return caseDoc(
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
}

describe("lintCase", () => {
	it("returns the documented result shape with findings carrying every field", () => {
		const result = lintCase(brokenDoc());
		expect(Object.keys(result).sort()).toEqual([
			"acknowledgedGaps",
			"findings",
			"judgementRules",
			"prechecks",
			"questions",
			"truncated",
		]);
		expect(result.findings.map((f) => f.ruleId).sort()).toEqual([
			"TREE01",
			"TREE03",
		]);
		for (const f of result.findings) {
			expect(f).toEqual({
				ruleId: expect.any(String),
				elementLabel: expect.any(String),
				severity: expect.stringMatching(SEVERITY),
				reason: expect.any(String),
				fix: expect.any(String),
			});
		}
	});

	it("labels a whole-case finding by the element's name", () => {
		const result = lintCase(brokenDoc());
		for (const f of result.findings) {
			expect(f.elementLabel).toBe("G1");
		}
	});

	it("falls back to the id when the name is blank", () => {
		const doc = caseDoc(
			"Blank",
			evidence("   ", "Audit report.", { id: "ev-blank-id" })
		);
		const result = lintCase(doc);
		expect(result.findings.length).toBeGreaterThan(0);
		expect(
			result.findings.some((f) => f.elementLabel.includes("ev-blank-id"))
		).toBe(true);
		const nullNamed = lintCase(
			caseDoc("Null", evidence(null, "Audit.", { id: "ev-null-id" }))
		);
		expect(
			nullNamed.findings.some((f) => f.elementLabel.includes("ev-null-id"))
		).toBe(true);
	});

	it("moves a NEEDS_SUPPORT claim to acknowledgedGaps with its name", () => {
		const result = lintCase(gapDoc());
		expect(result.findings.map((f) => f.ruleId)).not.toContain("EVID01");
		const gap = result.acknowledgedGaps.find((g) => g.ruleId === "EVID01");
		expect(gap?.elementLabel).toBe("P1");
	});

	it("supplies judgement rules as text", () => {
		const { judgementRules } = lintCase(brokenDoc());
		expect(typeof judgementRules).toBe("string");
		expect(judgementRules.length).toBeGreaterThan(200);
	});

	it.skipIf(!NAME_PATTERN)(
		"supplies judgement rules text that does not match the name-check pattern",
		() => {
			const { judgementRules } = lintCase(brokenDoc());
			expect(judgementRules).not.toMatch(
				new RegExp(`\\b(?:${NAME_PATTERN})\\b`, "i")
			);
		}
	);
});

describe("lint_case tool", () => {
	beforeEach(() => {
		exportCase.mockReset();
	});

	const run = (userId = "u1", caseId = "c1") =>
		createCaseTools(userId, caseId).lint_case.execute!(
			{},
			{
				toolCallId: "t",
				messages: [],
			}
		);

	it("takes no input", () => {
		const schema = createCaseTools("u", "c").lint_case.inputSchema as {
			safeParse: (v: unknown) => { success: boolean };
		};
		expect(schema.safeParse({}).success).toBe(true);
	});

	it("lints only the permission-checked export without comments", async () => {
		exportCase.mockResolvedValue({ data: brokenDoc() });
		const out = (await run("user-7", "case-9")) as Record<string, unknown>;
		expect(exportCase).toHaveBeenCalledTimes(1);
		expect(exportCase).toHaveBeenCalledWith("user-7", "case-9", {
			includeComments: false,
		});
		expect(out.found).toBe(true);
		expect((out.findings as unknown[]).length).toBe(2);
		expect(typeof out.judgementRules).toBe("string");
	});

	it("returns the not-found result, without throwing, when the user cannot read the case", async () => {
		exportCase.mockResolvedValue({ error: "Permission denied" });
		const out = await run();
		expect(out).toEqual({ found: false, message: "Not found in this case." });
	});
});

describe("ASSISTANT_SYSTEM_PROMPT", () => {
	it("tells the model to call lint_case once and list findings as RULEID on ELEMENT: reason", () => {
		expect(ASSISTANT_SYSTEM_PROMPT).toContain("lint_case");
		expect(ASSISTANT_SYSTEM_PROMPT).toMatch(CALL_ONCE);
		expect(ASSISTANT_SYSTEM_PROMPT).toContain('"RULEID on ELEMENT: reason"');
	});

	it("tells the model to apply judgementRules under a Judgement findings heading", () => {
		expect(ASSISTANT_SYSTEM_PROMPT).toContain("judgementRules");
		expect(ASSISTANT_SYSTEM_PROMPT).toContain('"Judgement findings"');
	});

	it("forbids saying whether the case is adequate", () => {
		expect(ASSISTANT_SYSTEM_PROMPT).toMatch(NEVER_ADEQUATE);
	});
});
