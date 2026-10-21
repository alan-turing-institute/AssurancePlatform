import { describe, expect, it } from "vitest";
import type {
	AssuranceCaseResponse,
	EvidenceResponse,
	GoalResponse,
	PropertyClaimResponse,
} from "@/lib/services/case-response-types";
import { findCaseNode } from "../case-walk";
import { addEvidenceToClaim } from "../evidence";
import { removeAssuranceCaseNode } from "../node-utils";
import { addPropertyClaimToNested } from "../property-claims";

/**
 * A counter-goal hangs from the node it challenges: a claim, a strategy or a
 * piece of evidence, as well as a goal. The walkers that add to the stored
 * case or remove from it find a node beneath each of them.
 */

type Loose = Record<string, unknown>;

function claim(id: string, extra: Loose = {}): Loose {
	return {
		id,
		type: "property_claim",
		propertyClaims: [],
		strategies: [],
		evidence: [],
		...extra,
	};
}

function counterGoal(id: string, extra: Loose): Loose {
	return {
		id,
		type: "goal",
		isDefeater: true,
		strategies: [],
		propertyClaims: [],
		...extra,
	};
}

/**
 * One counter-goal hangs from a claim (P1), one from a strategy (S1) and one
 * from a piece of evidence (E1); each is supported by a claim and, in the
 * strategy's case, by a strategy of its own.
 */
function buildCase() {
	const assuranceCase = {
		id: "case-1",
		type: "assurance_case",
		goals: [
			{
				id: "G1",
				type: "goal",
				strategies: [
					{
						id: "S1",
						type: "strategy",
						goals: [
							counterGoal("CG2", {
								propertyClaims: [claim("P3")],
								strategies: [
									{ id: "S2", type: "strategy", propertyClaims: [] },
								],
							}),
						],
						propertyClaims: [
							claim("P4", {
								evidence: [
									{
										id: "E1",
										type: "evidence",
										goals: [
											counterGoal("CG3", { propertyClaims: [claim("P5")] }),
										],
									},
								],
							}),
						],
					},
				],
				propertyClaims: [
					claim("P1", {
						goals: [counterGoal("CG1", { propertyClaims: [claim("P2")] })],
					}),
				],
			},
		],
	} as unknown as AssuranceCaseResponse;
	return { assuranceCase, goals: assuranceCase.goals as GoalResponse[] };
}

const SUPPORTING_CLAIMS = [
	["a claim", "P2"],
	["a strategy", "P3"],
	["a piece of evidence", "P5"],
] as const;

const NEW_EVIDENCE = { id: "E9", type: "evidence" } as EvidenceResponse;
const NEW_CLAIM = { id: "P9", type: "property_claim" } as PropertyClaimResponse;

function nodeOf(goals: GoalResponse[], id: string): Loose {
	return findCaseNode(goals, id) as unknown as Loose;
}

describe("findCaseNode", () => {
	it("returns nothing when no node has the id", () => {
		expect(findCaseNode(buildCase().goals, "missing")).toBeNull();
	});
});

describe("walking the case beneath a counter-goal hung from", () => {
	it.each(
		SUPPORTING_CLAIMS
	)("%s: addEvidenceToClaim adds evidence to the supporting claim", (_label, id) => {
		const { goals } = buildCase();

		const added = addEvidenceToClaim(goals, id, NEW_EVIDENCE);

		expect(added).toBe(true);
		expect(nodeOf(goals, id).evidence).toEqual([NEW_EVIDENCE]);
	});

	it.each(
		SUPPORTING_CLAIMS
	)("%s: addPropertyClaimToNested adds a claim to the supporting claim", (_label, id) => {
		const { goals } = buildCase();

		const added = addPropertyClaimToNested(goals, id, NEW_CLAIM);

		expect(added).toBe(true);
		expect(nodeOf(goals, id).propertyClaims).toEqual([NEW_CLAIM]);
	});

	it("a strategy: addPropertyClaimToNested adds a claim to the counter-goal's own strategy", () => {
		const { goals } = buildCase();

		const added = addPropertyClaimToNested(goals, "S2", NEW_CLAIM);

		expect(added).toBe(true);
		expect(nodeOf(goals, "S2").propertyClaims).toEqual([NEW_CLAIM]);
	});

	it.each(
		SUPPORTING_CLAIMS
	)("%s: removeAssuranceCaseNode removes the supporting claim and nothing else", (_label, id) => {
		const { assuranceCase } = buildCase();

		const result = removeAssuranceCaseNode(assuranceCase, id, "property_claim");

		const goals = result.goals ?? [];
		expect(findCaseNode(goals, id)).toBeNull();
		for (const other of ["P1", "S1", "P4", "E1", "CG1", "CG2", "CG3", "S2"]) {
			expect(findCaseNode(goals, other)?.id, other).toBe(other);
		}
	});

	it("leaves the case alone when the node is not there", () => {
		const { assuranceCase, goals } = buildCase();
		const before = JSON.stringify(assuranceCase);

		expect(addEvidenceToClaim(goals, "missing", NEW_EVIDENCE)).toBe(false);
		expect(addPropertyClaimToNested(goals, "missing", NEW_CLAIM)).toBe(false);
		removeAssuranceCaseNode(assuranceCase, "missing", "property_claim");

		expect(JSON.stringify(assuranceCase)).toBe(before);
	});
});
