import type { Edge, Node } from "reactflow";
import { describe, expect, it } from "vitest";
import { ELEMENT_GUIDE } from "@/lib/help/help-guide";
import {
	getAttributeGuide,
	getElementGuide,
	summariseSelectedNode,
} from "../selected-element";

const node = (
	id: string,
	type: string,
	name: string,
	data: Record<string, unknown> = {}
): Node => ({
	id,
	type,
	position: { x: 0, y: 0 },
	data: { name, ...data },
});

const edge = (source: string, target: string, type = "support"): Edge => ({
	id: `${source}-${target}`,
	source,
	target,
	type,
});

const G1 = node("g1", "goal", "G1", {
	context: ["a", "b"],
	assumption: "  ",
	justification: "Because.",
});
const S1 = node("s1", "strategy", "S1");
const P2 = node("p2", "property", "P2");
const P1 = node("p1", "property", "P1");
const E1 = node("e1", "evidence", "E1");
const nodes = [G1, S1, P2, P1, E1];
const edges = [
	edge("g1", "s1"),
	edge("s1", "p2"),
	edge("s1", "p1"),
	edge("p1", "e1"),
];

describe("summariseSelectedNode", () => {
	it("describes a goal with no parent and counts its attributes", () => {
		const summary = summariseSelectedNode(G1, nodes, edges);
		expect(summary.parent).toBeNull();
		expect(summary.children).toEqual([{ name: "S1", type: "strategy" }]);
		expect(summary.attributes).toEqual({
			context: 2,
			assumption: false,
			justification: true,
		});
	});

	it("gives a strategy its parent and its children ordered by name", () => {
		const summary = summariseSelectedNode(S1, nodes, edges);
		expect(summary.parent).toEqual({ name: "G1", type: "goal" });
		expect(summary.children.map((c) => c.name)).toEqual(["P1", "P2"]);
	});

	it("gives an evidence leaf no children", () => {
		const summary = summariseSelectedNode(E1, nodes, edges);
		expect(summary.parent).toEqual({ name: "P1", type: "property" });
		expect(summary.children).toEqual([]);
	});

	it("ignores challenges edges", () => {
		const withChallenge = [...edges, edge("e1", "s1", "challenges")];
		expect(summariseSelectedNode(S1, nodes, withChallenge).parent?.name).toBe(
			"G1"
		);
		expect(summariseSelectedNode(E1, nodes, withChallenge).children).toEqual(
			[]
		);
	});
});

describe("guide lookups", () => {
	it("maps each canvas kind to its help guide entry", () => {
		expect(getElementGuide("property")).toBe(
			ELEMENT_GUIDE.find((g) => g.id === "PROPERTY_CLAIM")
		);
		expect(getElementGuide("awayGoal").id).toBe("AWAY_GOAL");
	});

	it("maps each attribute to its help guide entry", () => {
		expect(getAttributeGuide("assumption").id).toBe("ASSUMPTION");
	});
});
