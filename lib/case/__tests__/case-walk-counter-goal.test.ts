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
 * A counter-goal hangs from the node it challenges: a claim, a strategy, a
 * piece of evidence, an away goal or a module, as well as a goal. The walkers
 * that add to the stored case or remove from it find a node beneath each of
 * them.
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
 * One counter-goal hangs from a claim (P1), one from a strategy (S1), one from
 * a piece of evidence (E1), one from an away goal (AG1) and one from a module
 * (M1); each is supported by a claim and, in the strategy's case, by strategies
 * of its own. P0 is a claim with no counter-goal.
 */
function buildCase() {
	const assuranceCase = {
		id: "case-1",
		type: "assurance_case",
		goals: [
			{
				id: "G1",
				type: "goal",
				awayGoals: [
					{
						id: "AG1",
						type: "away_goal",
						goals: [counterGoal("CG4", { propertyClaims: [claim("P6")] })],
					},
				],
				modules: [
					{
						id: "M1",
						type: "module",
						goals: [counterGoal("CG5", { propertyClaims: [claim("P7")] })],
					},
				],
				strategies: [
					{
						id: "S1",
						type: "strategy",
						goals: [
							counterGoal("CG2", {
								propertyClaims: [claim("P3")],
								strategies: [
									{ id: "S2", type: "strategy", propertyClaims: [] },
									{
										id: "S3",
										type: "strategy",
										propertyClaims: [claim("P9")],
									},
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
					claim("P0"),
					claim("P1", {
						goals: [
							counterGoal("CG1", {
								propertyClaims: [
									claim("P2"),
									claim("P8", { evidence: [{ id: "E2", type: "evidence" }] }),
								],
							}),
						],
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
	["an away goal", "P6"],
	["a module", "P7"],
] as const;

/** What can be removed from the case, with the type the canvas names it by. */
const REMOVABLE = [
	...SUPPORTING_CLAIMS.map(
		([label, id]) =>
			[
				`the claim beneath a counter-goal hung from ${label}`,
				id,
				"property_claim",
			] as const
	),
	["evidence that supports a counter-goal's claim", "E2", "evidence"],
	["a claim beneath a counter-goal's own strategy", "P9", "property_claim"],
	["a claim that carries no counter-goal", "P0", "property_claim"],
] as const;

const NEW_EVIDENCE = { id: "E9", type: "evidence" } as EvidenceResponse;
const NEW_CLAIM = {
	id: "P-new",
	type: "property_claim",
} as PropertyClaimResponse;

function nodeOf(goals: GoalResponse[], id: string): Loose {
	return findCaseNode(goals, id) as unknown as Loose;
}

const CHILD_KEYS = [
	"propertyClaims",
	"strategies",
	"evidence",
	"goals",
	"awayGoals",
	"modules",
];

/** Every id in the case, however deep. */
function allIds(nodes: unknown[]): string[] {
	return nodes.flatMap((node) => {
		const item = node as Loose;
		const below = CHILD_KEYS.flatMap((key) =>
			Array.isArray(item[key]) ? allIds(item[key] as unknown[]) : []
		);
		return [item.id as string, ...below];
	});
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
		REMOVABLE
	)("removeAssuranceCaseNode removes %s and nothing else", (_label, id, type) => {
		const { assuranceCase } = buildCase();
		const before = allIds(assuranceCase.goals ?? []);

		const result = removeAssuranceCaseNode(assuranceCase, id, type);

		expect(allIds(result.goals ?? [])).toEqual(
			before.filter((other) => other !== id)
		);
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
