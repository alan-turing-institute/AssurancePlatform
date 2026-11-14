import type { Edge, Node } from "reactflow";
import { describe, expect, it } from "vitest";
import { summariseSelectedNode } from "../selected-element";

const node = (
	id: string,
	type: string,
	data: Record<string, unknown> = {}
): Node => ({
	id,
	type,
	position: { x: 0, y: 0 },
	data: { name: id.toUpperCase(), ...data },
});

const edge = (source: string, target: string, type = "support"): Edge => ({
	id: `${source}-${target}-${type}`,
	source,
	target,
	type,
});

describe("summariseSelectedNode (adversarial)", () => {
	it("reports no parent for the root goal", () => {
		const g1 = node("g1", "goal");
		const s1 = node("s1", "strategy");
		const result = summariseSelectedNode(g1, [g1, s1], [edge("g1", "s1")]);
		expect(result.parent).toBeNull();
	});

	it("never treats a challenges edge as a parent or a child", () => {
		const g1 = node("g1", "goal");
		const p1 = node("p1", "property");
		const d1 = node("d1", "property", { isDefeater: true });
		const nodes = [g1, p1, d1];
		const edges = [edge("g1", "p1"), edge("d1", "p1", "challenges")];

		const target = summariseSelectedNode(p1, nodes, edges);
		expect(target.parent?.name).toBe("G1");

		const source = summariseSelectedNode(d1, nodes, edges);
		expect(source.parent).toBeNull();
		expect(source.children).toEqual([]);
		expect(summariseSelectedNode(g1, nodes, edges).children).toEqual([
			{ name: "P1", type: "property" },
		]);
	});

	it("orders children by name regardless of edge order", () => {
		const g1 = node("g1", "goal");
		const kids = ["s3", "s1", "s2"].map((id) => node(id, "strategy"));
		const edges = kids.map((k) => edge("g1", k.id));
		const result = summariseSelectedNode(g1, [g1, ...kids], edges);
		expect(result.children.map((c) => c.name)).toEqual(["S1", "S2", "S3"]);
	});

	it("reports zero context for an empty list, and counts a populated one", () => {
		const empty = node("g1", "goal", { context: [] });
		expect(summariseSelectedNode(empty, [empty], []).attributes.context).toBe(
			0
		);
		const two = node("g2", "goal", { context: ["a", "b"] });
		expect(summariseSelectedNode(two, [two], []).attributes.context).toBe(2);
	});

	it("treats a whitespace-only assumption or justification as absent", () => {
		const p1 = node("p1", "property", {
			assumption: "   \n\t",
			justification: "  ",
		});
		const { attributes } = summariseSelectedNode(p1, [p1], []);
		expect(attributes.assumption).toBe(false);
		expect(attributes.justification).toBe(false);
	});

	it("passes isDefeater through", () => {
		const d1 = node("d1", "property", { isDefeater: true });
		const p1 = node("p1", "property");
		expect(summariseSelectedNode(d1, [d1], []).isDefeater).toBe(true);
		expect(summariseSelectedNode(p1, [p1], []).isDefeater).toBe(false);
	});

	it("does not throw on an unknown node type, and passes it through", () => {
		const odd = node("x1", "mystery");
		const result = summariseSelectedNode(odd, [odd], []);
		expect(result.type).toBe("mystery");
	});
});
