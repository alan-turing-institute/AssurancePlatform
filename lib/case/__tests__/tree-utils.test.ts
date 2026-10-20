import { describe, expect, it } from "vitest";
import type {
	AssuranceCaseResponse,
	GoalResponse,
} from "@/lib/services/case-response-types";
import {
	addHiddenProp,
	toggleHiddenForChildren,
	toggleHiddenForParent,
} from "../tree-utils";
import type { ReactFlowNode } from "../types";

const NAMED_ENTRY = { id: "k3f9x2m7qa", name: "window", text: "the interval" };

function buildCase(): AssuranceCaseResponse {
	const goal = {
		id: "goal-1",
		type: "goal",
		name: "G1",
		description: "Goal",
		assuranceCaseId: "case-1",
		keywords: "",
		context: ["plain", { ...NAMED_ENTRY }],
		strategies: [],
		propertyClaims: [
			{
				id: "claim-1",
				type: "property_claim",
				name: "P1",
				description: "Claim",
				context: [{ ...NAMED_ENTRY, id: "p4n8c2d6xz" }],
				propertyClaims: [],
				strategies: [],
				evidence: [],
			},
		],
	} as unknown as GoalResponse;
	return {
		id: "case-1",
		type: "AssuranceCase",
		name: "Case",
		goals: [goal],
	} as unknown as AssuranceCaseResponse;
}

function contextOf(assuranceCase: AssuranceCaseResponse, claim = false) {
	const goal = assuranceCase.goals?.[0];
	return claim ? goal?.propertyClaims[0]?.context : goal?.context;
}

describe("tree utilities and context entries", () => {
	it("addHiddenProp flags the elements but never a named context entry", () => {
		const result = addHiddenProp(buildCase()) as AssuranceCaseResponse;

		expect(result.goals?.[0]?.hidden).toBe(false);
		expect(result.goals?.[0]?.propertyClaims[0]?.hidden).toBe(false);
		expect(contextOf(result)).toEqual(["plain", NAMED_ENTRY]);
		expect(contextOf(result, true)).toEqual([
			{ ...NAMED_ENTRY, id: "p4n8c2d6xz" },
		]);
	});

	it("toggleHiddenForChildren hides the children but leaves named entries alone", () => {
		const flagged = addHiddenProp(buildCase()) as AssuranceCaseResponse;

		const result = toggleHiddenForChildren(flagged, "goal-1");

		expect(result.goals?.[0]?.propertyClaims[0]?.hidden).toBe(true);
		expect(contextOf(result)).toEqual(["plain", NAMED_ENTRY]);
		expect(contextOf(result, true)).toEqual([
			{ ...NAMED_ENTRY, id: "p4n8c2d6xz" },
		]);
	});

	it("toggleHiddenForParent does not treat a goal's context as child elements", () => {
		const flagged = addHiddenProp(buildCase()) as AssuranceCaseResponse;
		const node = {
			data: { id: "claim-1", type: "property_claim" },
		} as unknown as ReactFlowNode;

		const result = toggleHiddenForParent(node, flagged);

		expect(contextOf(result)).toEqual(["plain", NAMED_ENTRY]);
		expect(result.goals?.[0]?.hidden).toBe(false);
	});
});
