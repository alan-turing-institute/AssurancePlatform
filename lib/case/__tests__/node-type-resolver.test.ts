import { describe, expect, it } from "vitest";
import { resolveReactFlowNodeType } from "../node-type-resolver";

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
