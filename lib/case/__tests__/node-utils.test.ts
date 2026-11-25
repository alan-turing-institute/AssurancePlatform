import { describe, expect, it } from "vitest";
import type { AssuranceCaseResponse } from "@/lib/services/case-response-types";
import { removeAssuranceCaseNode } from "../node-utils";

type Loose = Record<string, unknown>;

function caseOf(goals: Loose[]): AssuranceCaseResponse {
	return {
		id: "case",
		type: "assurance_case",
		goals,
	} as unknown as AssuranceCaseResponse;
}

function goalIds(result: AssuranceCaseResponse): unknown[] {
	return (result.goals as unknown as Loose[]).map((goal) => goal.id);
}

describe("removeAssuranceCaseNode", () => {
	it("removes a top-level goal by id and type", () => {
		const result = removeAssuranceCaseNode(
			caseOf([
				{ id: "G1", type: "goal" },
				{ id: "G2", type: "goal" },
			]),
			"G2",
			"goal"
		);

		expect(goalIds(result)).toStrictEqual(["G1"]);
	});

	it("keeps a top-level goal that has the same id but another type", () => {
		const result = removeAssuranceCaseNode(
			caseOf([
				{ id: "X", type: "goal" },
				{ id: "X", type: "other" },
			]),
			"X",
			"goal"
		);

		expect(result.goals as unknown as Loose[]).toStrictEqual([
			{ id: "X", type: "other" },
		]);
	});

	it("removes a strategy and a counter-goal, and keeps one with the same id and another type", () => {
		const goal = {
			id: "G1",
			type: "goal",
			strategies: [
				{ id: "X", type: "strategy" },
				{ id: "X", type: "other" },
				{ id: "S2", type: "strategy", goals: [{ id: "CG", type: "goal" }] },
			],
		};

		const withoutStrategy = removeAssuranceCaseNode(
			caseOf([goal]),
			"X",
			"strategy"
		);
		const strategies = (withoutStrategy.goals?.[0] as unknown as Loose)
			.strategies as Loose[];
		expect(strategies.map((s) => `${s.id}/${s.type}`)).toStrictEqual([
			"X/other",
			"S2/strategy",
		]);

		const withoutCounter = removeAssuranceCaseNode(
			withoutStrategy,
			"CG",
			"goal"
		);
		const left = (withoutCounter.goals?.[0] as unknown as Loose)
			.strategies as Loose[];
		expect(left[1]?.goals).toStrictEqual([]);
	});

	it("passes over elements whose child lists are null", () => {
		const nodes = [
			{
				id: "G1",
				type: "goal",
				propertyClaims: null,
				strategies: null,
				goals: null,
				evidence: null,
			},
			{
				id: "G2",
				type: "goal",
				propertyClaims: [{ id: "P", type: "property_claim", evidence: null }],
			},
		];

		const result = removeAssuranceCaseNode(caseOf(nodes), "G2", "goal");

		expect(goalIds(result)).toStrictEqual(["G1"]);
	});

	it("passes over an element that has none of the child lists", () => {
		const result = removeAssuranceCaseNode(
			caseOf([{ id: "G1", type: "goal" }]),
			"nothing",
			"goal"
		);

		expect(result.goals as unknown as Loose[]).toStrictEqual([
			{ id: "G1", type: "goal" },
		]);
	});
});
