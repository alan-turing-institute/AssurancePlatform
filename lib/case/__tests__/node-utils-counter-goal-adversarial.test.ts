import { describe, expect, it } from "vitest";
import type { AssuranceCaseResponse } from "@/lib/services/case-response-types";
import { removeAssuranceCaseNode } from "../node-utils";

/**
 * Removing a node from the stored case (after a delete or a detach) finds it
 * wherever it hangs, including beneath a counter-goal.
 */

function claim(id: string, children: Record<string, unknown[]> = {}) {
	return {
		id,
		type: "property_claim",
		propertyClaims: [],
		strategies: [],
		evidence: [],
		...children,
	};
}

function buildCase(): AssuranceCaseResponse {
	return {
		id: "case-1",
		type: "assurance_case",
		goals: [
			{
				id: "G1",
				type: "goal",
				strategies: [],
				propertyClaims: [claim("P1")],
				goals: [
					{
						id: "CG1",
						type: "goal",
						isDefeater: true,
						strategies: [
							{
								id: "S2",
								type: "strategy",
								propertyClaims: [claim("P4")],
							},
						],
						propertyClaims: [
							claim("P3", {
								evidence: [{ id: "E3", type: "evidence" }],
							}),
						],
					},
				],
			},
		],
	} as unknown as AssuranceCaseResponse;
}

function counterGoalOf(assuranceCase: AssuranceCaseResponse) {
	return (
		assuranceCase.goals?.[0] as unknown as {
			goals: {
				propertyClaims: { id: string; evidence: { id: string }[] }[];
				strategies: { propertyClaims: { id: string }[] }[];
			}[];
		}
	).goals[0];
}

describe("removeAssuranceCaseNode beneath a counter-goal", () => {
	it("removes a claim that supports the counter-goal", () => {
		const result = removeAssuranceCaseNode(buildCase(), "P3", "property_claim");

		expect(counterGoalOf(result)?.propertyClaims).toEqual([]);
	});

	it("removes evidence that supports a claim beneath the counter-goal", () => {
		const result = removeAssuranceCaseNode(buildCase(), "E3", "evidence");

		expect(counterGoalOf(result)?.propertyClaims[0]?.evidence).toEqual([]);
	});

	it("removes a claim beneath a strategy that supports the counter-goal", () => {
		const result = removeAssuranceCaseNode(buildCase(), "P4", "property_claim");

		expect(counterGoalOf(result)?.strategies[0]?.propertyClaims).toEqual([]);
	});

	it("still removes a claim under the top goal and leaves the counter-goal's claims alone", () => {
		const result = removeAssuranceCaseNode(buildCase(), "P1", "property_claim");

		expect(result.goals?.[0]?.propertyClaims).toEqual([]);
		expect(counterGoalOf(result)?.propertyClaims.map((c) => c.id)).toEqual([
			"P3",
		]);
	});
});
