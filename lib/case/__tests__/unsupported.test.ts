import type { Node } from "reactflow";
import { describe, expect, it } from "vitest";
import { isUnsupported } from "../unsupported";

/** A canvas node: `type` is the card's kind, `parentId` the node id of the card it sits beneath. */
function node(
	id: string,
	type: string,
	parentId: string | null,
	data: Record<string, unknown> = {},
	hidden?: boolean
): Node {
	return {
		id,
		type,
		position: { x: 0, y: 0 },
		data: { parentId, ...data },
		hidden,
	};
}

const goal = (data: Record<string, unknown> = {}) =>
	node("goal-1", "goal", null, data);

describe("isUnsupported — which cards carry the marker", () => {
	it("marks a top goal with nothing beneath it", () => {
		expect(isUnsupported([goal()], "goal-1")).toBe(true);
	});

	it("marks a strategy with nothing beneath it, and not the goal above it", () => {
		const nodes = [goal(), node("strategy-1", "strategy", "goal-1")];

		expect(isUnsupported(nodes, "strategy-1")).toBe(true);
		expect(isUnsupported(nodes, "goal-1")).toBe(false);
	});

	it("marks a property claim with nothing beneath it, and not the strategy above it", () => {
		const nodes = [
			goal(),
			node("strategy-1", "strategy", "goal-1"),
			node("property-1", "property", "strategy-1"),
		];

		expect(isUnsupported(nodes, "property-1")).toBe(true);
		expect(isUnsupported(nodes, "strategy-1")).toBe(false);
		expect(isUnsupported(nodes, "goal-1")).toBe(false);
	});

	it("clears the marker once evidence sits beneath the claim", () => {
		const nodes = [
			goal(),
			node("property-1", "property", "goal-1"),
			node("evidence-1", "evidence", "property-1"),
		];

		expect(isUnsupported(nodes, "property-1")).toBe(false);
	});

	it("counts evidence shared with another claim for both claims", () => {
		// Evidence linked to two claims is two entries with one node id, each with its own claim as parent.
		const nodes = [
			goal(),
			node("property-1", "property", "goal-1"),
			node("property-2", "property", "goal-1"),
			node("evidence-1", "evidence", "property-1"),
			node("evidence-1", "evidence", "property-2"),
		];

		expect(isUnsupported(nodes, "property-1")).toBe(false);
		expect(isUnsupported(nodes, "property-2")).toBe(false);
	});

	it("does not count a child of a different element", () => {
		const nodes = [
			goal(),
			node("property-1", "property", "goal-1"),
			node("property-2", "property", "goal-1"),
			node("evidence-1", "evidence", "property-2"),
		];

		expect(isUnsupported(nodes, "property-1")).toBe(true);
	});

	it.each([
		["a strategy", "strategy"],
		["a property claim", "property"],
		["an away goal", "awayGoal"],
		["a module", "module"],
	])("counts %s beneath it as support", (_label, type) => {
		const nodes = [goal(), node("child-1", type, "goal-1")];

		expect(isUnsupported(nodes, "goal-1")).toBe(false);
	});

	it.each([
		["an away goal", "awayGoal", { citedElementId: null }],
		["a module", "module", { moduleReferenceId: null }],
	])("counts %s whose link is broken as support", (_label, type, data) => {
		const nodes = [
			goal(),
			node("property-1", "property", "goal-1"),
			node("child-1", type, "property-1", data),
		];

		expect(isUnsupported(nodes, "property-1")).toBe(false);
	});

	it("does not count a goal drawn beneath an element as support", () => {
		const nodes = [goal(), node("goal-2", "goal", "goal-1")];

		expect(isUnsupported(nodes, "goal-1")).toBe(true);
	});

	it("never marks an unknown id", () => {
		expect(isUnsupported([goal()], "property-9")).toBe(false);
		expect(isUnsupported([], "goal-1")).toBe(false);
	});
});

describe("isUnsupported — defeaters", () => {
	it.each([
		["property", "claim"],
		["goal", "goal"],
		["evidence", "piece of evidence"],
	])("does not count a defeater of kind %s (%s) as support", (type) => {
		const nodes = [
			goal(),
			node("property-1", "property", "goal-1"),
			node("defeater-1", type, "property-1", {
				isDefeater: true,
				defeatsElementId: "property-1",
			}),
		];

		expect(isUnsupported(nodes, "property-1")).toBe(true);
	});

	it("counts real support beside a defeater", () => {
		const nodes = [
			goal(),
			node("property-1", "property", "goal-1"),
			node("defeater-1", "property", "property-1", { isDefeater: true }),
			node("evidence-1", "evidence", "property-1"),
		];

		expect(isUnsupported(nodes, "property-1")).toBe(false);
	});

	it("never marks a defeater itself", () => {
		const nodes = [
			goal(),
			node("property-1", "property", "goal-1"),
			node("defeater-1", "property", "property-1", { isDefeater: true }),
		];

		expect(isUnsupported(nodes, "defeater-1")).toBe(false);
	});
});

describe("isUnsupported — elements that end a branch by design", () => {
	it.each(["evidence", "awayGoal", "module"])("never marks a %s", (type) => {
		const nodes = [goal(), node("end-1", type, "goal-1")];

		expect(isUnsupported(nodes, "end-1")).toBe(false);
	});
});

describe("isUnsupported — the author's status", () => {
	it.each([
		"NEEDS_SUPPORT",
		"ASSUMED",
		"AXIOMATIC",
		"DEFEATED",
		"AS_CITED",
	])("shows no marker when the status is %s", (assertionStatus) => {
		expect(isUnsupported([goal({ assertionStatus })], "goal-1")).toBe(false);
	});

	it.each([
		["missing", {}],
		["null", { assertionStatus: null }],
		["ASSERTED", { assertionStatus: "ASSERTED" }],
	])("treats a %s status as the default and marks the element", (_label, data) => {
		expect(isUnsupported([goal(data)], "goal-1")).toBe(true);
	});

	it("applies the status to strategies and claims as well as goals", () => {
		const nodes = [
			goal(),
			node("strategy-1", "strategy", "goal-1", {
				assertionStatus: "ASSUMED",
			}),
			node("property-1", "property", "goal-1", {
				assertionStatus: "NEEDS_SUPPORT",
			}),
		];

		expect(isUnsupported(nodes, "strategy-1")).toBe(false);
		expect(isUnsupported(nodes, "property-1")).toBe(false);
	});
});

describe("isUnsupported — a collapsed branch", () => {
	it("still counts children hidden by collapsing, so the collapsed element is not marked", () => {
		const nodes = [
			goal(),
			node("property-1", "property", "goal-1"),
			node("evidence-1", "evidence", "property-1", {}, true),
			node("property-2", "property", "property-1", {}, true),
		];

		expect(isUnsupported(nodes, "property-1")).toBe(false);
		expect(isUnsupported(nodes, "goal-1")).toBe(false);
	});

	it("leaves a hidden descendant's own marker to the descendant", () => {
		const nodes = [
			goal(),
			node("property-1", "property", "goal-1"),
			node("property-2", "property", "property-1", {}, true),
		];

		expect(isUnsupported(nodes, "property-2")).toBe(true);
		expect(isUnsupported(nodes, "property-1")).toBe(false);
	});
});
