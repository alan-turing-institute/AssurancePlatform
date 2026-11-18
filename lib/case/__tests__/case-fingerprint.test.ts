import { describe, expect, it } from "vitest";
import type { AssuranceCaseResponse } from "@/lib/services/case-response-types";
import { caseFingerprint } from "../case-fingerprint";
import { addHiddenProp, toggleHiddenForChildren } from "../tree-utils";

function makeCase(description = "Goal text"): AssuranceCaseResponse {
	return addHiddenProp({
		id: "case-1",
		goals: [
			{
				id: "g1",
				name: "G1",
				description,
				commentCount: 0,
				strategies: [
					{
						id: "s1",
						name: "S1",
						description: "Strategy",
						property_claims: [
							{
								id: "p1",
								name: "P1",
								description: "Claim",
								evidence: [],
								property_claims: [],
							},
						],
					},
				],
				property_claims: [],
			},
		],
	} as unknown as AssuranceCaseResponse) as AssuranceCaseResponse;
}

describe("caseFingerprint", () => {
	it("is the same for the same case", () => {
		expect(caseFingerprint(makeCase(), "TB")).toBe(
			caseFingerprint(makeCase(), "TB")
		);
	});

	it("changes when a description is edited", () => {
		expect(caseFingerprint(makeCase("Edited"), "TB")).not.toBe(
			caseFingerprint(makeCase(), "TB")
		);
	});

	it("is unchanged when a branch is hidden", () => {
		const shown = makeCase();
		const before = caseFingerprint(shown, "TB");
		const hidden = toggleHiddenForChildren(makeCase(), "g1");

		expect(JSON.stringify(hidden)).not.toBe(JSON.stringify(shown));
		expect(caseFingerprint(hidden, "TB")).toBe(before);
	});

	it("is unchanged when a comment count changes", () => {
		const commented = makeCase();
		(commented.goals?.[0] as { commentCount?: number }).commentCount = 7;

		expect(caseFingerprint(commented, "TB")).toBe(
			caseFingerprint(makeCase(), "TB")
		);
	});

	it("changes when the layout direction changes", () => {
		expect(caseFingerprint(makeCase(), "LR")).not.toBe(
			caseFingerprint(makeCase(), "TB")
		);
	});
});
