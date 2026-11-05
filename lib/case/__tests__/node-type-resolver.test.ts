import { describe, expect, it } from "vitest";
import {
	elementKindRank,
	nodeKindRank,
	resolveReactFlowNodeType,
} from "../node-type-resolver";

describe("resolveReactFlowNodeType (ADR 0005 D5)", () => {
	it.each([
		["goal", "goal"],
		["GOAL", "goal"],
		["strategy", "strategy"],
		["property_claim", "property"],
		["PROPERTY_CLAIM", "property"],
		["propertyClaim", "property"],
		["property", "property"],
		["evidence", "evidence"],
		["away_goal", "awayGoal"],
		["AWAY_GOAL", "awayGoal"],
		["awayGoal", "awayGoal"],
		["module", "module"],
		["MODULE", "module"],
	])("resolves %s to %s", (input, expected) => {
		expect(resolveReactFlowNodeType(input)).toBe(expected);
	});

	it("falls back to the property claim renderer for an unrecognised type", () => {
		expect(resolveReactFlowNodeType("contract")).toBe("property");
		expect(resolveReactFlowNodeType("something-unknown")).toBe("property");
	});

	it("accepts flags without changing the 1.0 core resolution (seam for D6)", () => {
		expect(
			resolveReactFlowNodeType("property_claim", { isDefeater: true })
		).toBe("property");
		expect(resolveReactFlowNodeType("goal", { isDefeater: false })).toBe(
			"goal"
		);
	});
});

describe("sibling rank by kind", () => {
	it("ranks strategies and claims, then evidence, then away goals and modules", () => {
		expect(nodeKindRank("strategy")).toBe(0);
		expect(nodeKindRank("property")).toBe(0);
		expect(nodeKindRank("evidence")).toBe(1);
		expect(nodeKindRank("awayGoal")).toBe(2);
		expect(nodeKindRank("module")).toBe(2);
	});

	it("ties a goal, an unknown kind and no kind at rank 0", () => {
		expect(nodeKindRank("goal")).toBe(0);
		expect(nodeKindRank("something-unknown")).toBe(0);
		expect(nodeKindRank(undefined)).toBe(0);
	});

	it("gives an element type the rank of the node kind it is drawn as", () => {
		expect(elementKindRank("STRATEGY")).toBe(0);
		expect(elementKindRank("PROPERTY_CLAIM")).toBe(0);
		expect(elementKindRank("EVIDENCE")).toBe(1);
		expect(elementKindRank("AWAY_GOAL")).toBe(2);
		expect(elementKindRank("MODULE")).toBe(2);
		expect(elementKindRank("CONTRACT")).toBe(0);
	});
});
