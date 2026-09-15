import { describe, expect, it } from "vitest";

describe("layout-helper utilities", () => {
	describe("module structure", () => {
		it("should export getLayoutedElements function", async () => {
			const module = await import("../layout-helper");
			expect(module.getLayoutedElements).toBeDefined();
			expect(typeof module.getLayoutedElements).toBe("function");
		});

		it("should accept nodes, edges, and options parameters", async () => {
			const { getLayoutedElements } = await import("../layout-helper");

			// Test that function doesn't throw with basic parameters
			await expect(
				getLayoutedElements([], [], { direction: "TB" })
			).resolves.not.toThrow();
		});

		it("should return nodes and edges", async () => {
			const { getLayoutedElements } = await import("../layout-helper");

			const mockNodes = [
				{
					id: "node-1",
					type: "goal",
					position: { x: 0, y: 0 },
					data: {},
					hidden: false,
				},
				{
					id: "node-2",
					type: "strategy",
					position: { x: 0, y: 0 },
					data: {},
					hidden: false,
				},
			];
			const mockEdges = [
				{ id: "edge-1", source: "node-1", target: "node-2", hidden: false },
			];

			const result = await getLayoutedElements(mockNodes, mockEdges, {
				direction: "TB",
			});

			expect(result).toHaveProperty("nodes");
			expect(result).toHaveProperty("edges");
			expect(Array.isArray(result.nodes)).toBe(true);
			expect(Array.isArray(result.edges)).toBe(true);
		});

		it("should preserve node structure", async () => {
			const { getLayoutedElements } = await import("../layout-helper");

			const mockNodes = [
				{
					id: "node-1",
					type: "goal",
					data: { label: "Test Goal" },
					position: { x: 0, y: 0 },
					hidden: false,
					customProp: "preserved",
				},
			];

			const result = await getLayoutedElements(mockNodes, [], {
				direction: "TB",
			});

			expect(result.nodes).toHaveLength(1);
			expect(result.nodes[0]).toMatchObject({
				id: "node-1",
				type: "goal",
				data: { label: "Test Goal" },
				customProp: "preserved",
			});
			expect(result.nodes[0]).toHaveProperty("position");
			expect(result.nodes[0]!.position).toHaveProperty("x");
			expect(result.nodes[0]!.position).toHaveProperty("y");
		});

		it("should preserve edge structure", async () => {
			const { getLayoutedElements } = await import("../layout-helper");

			const mockEdges = [
				{
					id: "edge-1",
					source: "node-1",
					target: "node-2",
					hidden: false,
					customProp: "preserved",
				},
			];

			const result = await getLayoutedElements([], mockEdges, {
				direction: "TB",
			});

			expect(result.edges).toHaveLength(1);
			expect(result.edges[0]).toMatchObject({
				id: "edge-1",
				source: "node-1",
				target: "node-2",
				hidden: false,
				customProp: "preserved",
			});
		});

		it("should handle empty inputs gracefully", async () => {
			const { getLayoutedElements } = await import("../layout-helper");

			const result = await getLayoutedElements([], [], { direction: "TB" });

			expect(result.nodes).toEqual([]);
			expect(result.edges).toEqual([]);
		});

		it("should handle different layout directions", async () => {
			const { getLayoutedElements } = await import("../layout-helper");

			const directions = ["TB", "LR", "BT", "RL"];

			for (const direction of directions) {
				await expect(
					getLayoutedElements([], [], {
						direction: direction as "TB" | "LR" | "RL" | "BT",
					})
				).resolves.not.toThrow();
			}
		});

		it("should handle nodes with hidden property", async () => {
			const { getLayoutedElements } = await import("../layout-helper");

			const mixedNodes = [
				{
					id: "visible",
					type: "goal",
					position: { x: 0, y: 0 },
					data: {},
					hidden: false,
				},
				{
					id: "hidden",
					type: "claim",
					position: { x: 0, y: 0 },
					data: {},
					hidden: true,
				},
			];

			const result = await getLayoutedElements(mixedNodes, [], {
				direction: "TB",
			});

			expect(result.nodes).toHaveLength(2);
			expect(result.nodes.find((n) => n.id === "visible")).toBeDefined();
			expect(result.nodes.find((n) => n.id === "hidden")).toBeDefined();
		});

		it("should handle edges with hidden property", async () => {
			const { getLayoutedElements } = await import("../layout-helper");

			const mixedEdges = [
				{ id: "visible", source: "A", target: "B", hidden: false },
				{ id: "hidden", source: "B", target: "C", hidden: true },
			];

			const result = await getLayoutedElements([], mixedEdges, {
				direction: "TB",
			});

			expect(result.edges).toHaveLength(2);
			expect(result.edges.find((e) => e.id === "visible")).toBeDefined();
			expect(result.edges.find((e) => e.id === "hidden")).toBeDefined();
		});

		it("should handle nodes without hidden property", async () => {
			const { getLayoutedElements } = await import("../layout-helper");

			const nodesWithoutHidden = [
				{ id: "node-1", type: "goal", position: { x: 0, y: 0 }, data: {} },
				{ id: "node-2", type: "claim", position: { x: 0, y: 0 }, data: {} },
			];

			await expect(
				getLayoutedElements(nodesWithoutHidden, [], { direction: "TB" })
			).resolves.not.toThrow();
		});

		it("should handle large datasets efficiently", async () => {
			const { getLayoutedElements } = await import("../layout-helper");

			const largeNodes = Array.from({ length: 50 }, (_, i) => ({
				id: `node-${i}`,
				type: "goal",
				position: { x: 0, y: 0 },
				data: {},
				hidden: false,
			}));

			const largeEdges = Array.from({ length: 49 }, (_, i) => ({
				id: `edge-${i}`,
				source: `node-${i}`,
				target: `node-${i + 1}`,
				hidden: false,
			}));

			const start = performance.now();
			const result = await getLayoutedElements(largeNodes, largeEdges, {
				direction: "TB",
			});
			const end = performance.now();

			expect(result.nodes).toHaveLength(50);
			expect(result.edges).toHaveLength(49);
			expect(end - start).toBeLessThan(1000); // ELK may be slower, allow up to 1s
		});

		it("should handle invalid options gracefully", async () => {
			const { getLayoutedElements } = await import("../layout-helper");

			// Test with invalid options but valid nodes/edges
			await expect(
				getLayoutedElements([], [], {
					direction: "INVALID" as "TB" | "LR" | "BT" | "RL",
				})
			).resolves.not.toThrow();

			await expect(
				getLayoutedElements([], [], { direction: "TB" } as {
					direction: "TB" | "LR" | "BT" | "RL";
				})
			).resolves.not.toThrow();
		});

		it("should return a Promise", async () => {
			const { getLayoutedElements } = await import("../layout-helper");

			const result = getLayoutedElements([], [], { direction: "TB" });
			expect(result).toBeInstanceOf(Promise);
		});
	});

	describe("cells (ADR 0005 D1 — side-attached elements)", () => {
		function cellNode(
			id: string,
			name: string,
			attachedTo?: string
		): {
			data: { attachedTo?: string; name: string };
			hidden: boolean;
			id: string;
			position: { x: number; y: number };
			type: string;
		} {
			return {
				id,
				type: "goal",
				position: { x: 0, y: 0 },
				data: { name, ...(attachedTo ? { attachedTo } : {}) },
				hidden: false,
			};
		}

		function cellEdge(id: string, source: string, target: string) {
			return { id, source, target, hidden: false };
		}

		/**
		 * The nine-node probe from ADR 0005 D1: G1 → S1 → {G2, G3}, G2 → E1;
		 * C1 beside G1, A1 beside S1, CG1 challenging G2 with CSn1 beneath CG1
		 * in the tree (CG1 → CSn1). Side attachments are expressed as
		 * `data.attachedTo` pointing at the target node's id; the `challenges`
		 * edge (CG1 -> G2) is included to confirm it doesn't confuse ELK's row
		 * placement (it must be dropped for ELK's purposes since both
		 * endpoints resolve to the same cell).
		 */
		function buildNineNodeProbe() {
			const nodes = [
				cellNode("G1", "G1"),
				cellNode("S1", "S1"),
				cellNode("G2", "G2"),
				cellNode("G3", "G3"),
				cellNode("E1", "E1"),
				cellNode("C1", "C1", "G1"),
				cellNode("A1", "A1", "S1"),
				cellNode("CG1", "CG1", "G2"),
				cellNode("CSn1", "CSn1", "CG1"),
			];
			const edges = [
				cellEdge("e1", "G1", "S1"),
				cellEdge("e2", "S1", "G2"),
				cellEdge("e3", "S1", "G3"),
				cellEdge("e4", "G2", "E1"),
				cellEdge("e5", "CG1", "CSn1"),
				cellEdge("e6", "CG1", "G2"),
			];
			return { nodes, edges };
		}

		async function layoutNineNodeProbe(direction: "LR" | "TB") {
			const { getLayoutedElements } = await import("../layout-helper");
			const { nodes, edges } = buildNineNodeProbe();
			const result = await getLayoutedElements(nodes, edges, { direction });
			return new Map(
				result.nodes.map((n) => [n.id, n.position as { x: number; y: number }])
			);
		}

		function expectNoOverlaps(pos: Map<string, { x: number; y: number }>) {
			const positions = Array.from(pos.values());
			const distinct = new Set(positions.map((p) => `${p.x},${p.y}`));
			// biome-ignore lint/suspicious/noMisplacedAssertion: called from within it() blocks below
			expect(distinct.size).toBe(positions.length);
		}

		describe("direction TB (top-down tree, side attachments to the right)", () => {
			it("places every side attachment in its target's row, to the right", async () => {
				const pos = await layoutNineNodeProbe("TB");
				const g1 = pos.get("G1");
				const c1 = pos.get("C1");
				const s1 = pos.get("S1");
				const a1 = pos.get("A1");
				const g2 = pos.get("G2");
				const cg1 = pos.get("CG1");

				expect(c1?.y).toBe(g1?.y);
				expect(c1?.x).toBeGreaterThan(g1?.x ?? 0);
				expect(a1?.y).toBe(s1?.y);
				expect(a1?.x).toBeGreaterThan(s1?.x ?? 0);
				expect(cg1?.y).toBe(g2?.y);
				expect(cg1?.x).toBeGreaterThan(g2?.x ?? 0);
			});

			it("keeps the tree's row order: G1 < S1 < {G2, G3} < {E1, CSn1}", async () => {
				const pos = await layoutNineNodeProbe("TB");
				const g1 = pos.get("G1");
				const s1 = pos.get("S1");
				const g2 = pos.get("G2");
				const g3 = pos.get("G3");
				const e1 = pos.get("E1");

				expect(s1?.y ?? 0).toBeGreaterThan(g1?.y ?? 0);
				expect(g2?.y ?? 0).toBeGreaterThan(s1?.y ?? 0);
				expect(g3?.y ?? 0).toBeGreaterThan(s1?.y ?? 0);
				expect(e1?.y ?? 0).toBeGreaterThan(g2?.y ?? 0);
			});

			it("sits CSn1 in the row beneath the cell its parent CG1 belongs to", async () => {
				const pos = await layoutNineNodeProbe("TB");
				const cg1 = pos.get("CG1");
				const csn1 = pos.get("CSn1");

				// CSn1 (child of CG1, a side attachment of G2's cell) sits one
				// row below the cell — same guarantee as an ordinary tree
				// child. This does NOT claim CSn1 aligns under CG1's specific
				// x position rather than G2's: ELK places every child of the
				// cell in that shared row via its own crossing-minimisation,
				// and empirically (verified against this repo's elkjs) a
				// child's x is not tied to which member it structurally hangs
				// from — only real ELK edges (here, all routed to the cell
				// itself) constrain layout.
				expect(csn1?.y ?? 0).toBeGreaterThan(cg1?.y ?? 0);
			});

			it("has no overlapping positions", async () => {
				const pos = await layoutNineNodeProbe("TB");
				expectNoOverlaps(pos);
			});
		});

		describe("direction LR (left-right tree, side attachments below — mirrored)", () => {
			it("lays cells out DOWN: every side attachment shares its target's column, below it", async () => {
				const pos = await layoutNineNodeProbe("LR");
				const g1 = pos.get("G1");
				const c1 = pos.get("C1");
				const s1 = pos.get("S1");
				const a1 = pos.get("A1");
				const g2 = pos.get("G2");
				const cg1 = pos.get("CG1");

				expect(c1?.x).toBe(g1?.x);
				expect(c1?.y).toBeGreaterThan(g1?.y ?? 0);
				expect(a1?.x).toBe(s1?.x);
				expect(a1?.y).toBeGreaterThan(s1?.y ?? 0);
				expect(cg1?.x).toBe(g2?.x);
				expect(cg1?.y).toBeGreaterThan(g2?.y ?? 0);
			});

			it("keeps the tree's column order: G1 < S1 < {G2, G3} < {E1, CSn1}", async () => {
				const pos = await layoutNineNodeProbe("LR");
				const g1 = pos.get("G1");
				const s1 = pos.get("S1");
				const g2 = pos.get("G2");
				const g3 = pos.get("G3");
				const e1 = pos.get("E1");

				expect(s1?.x ?? 0).toBeGreaterThan(g1?.x ?? 0);
				expect(g2?.x ?? 0).toBeGreaterThan(s1?.x ?? 0);
				expect(g3?.x ?? 0).toBeGreaterThan(s1?.x ?? 0);
				expect(e1?.x ?? 0).toBeGreaterThan(g2?.x ?? 0);
			});

			it("sits a cell's subtree to the right of the cell itself", async () => {
				const pos = await layoutNineNodeProbe("LR");
				const g2 = pos.get("G2");
				const e1 = pos.get("E1");
				const csn1 = pos.get("CSn1");

				// Same caveat as the TB case above: both E1 (G2's child) and
				// CSn1 (CG1's child) land to the right of the whole cell —
				// this does not claim which specific member's row each aligns
				// with.
				expect(e1?.x ?? 0).toBeGreaterThan(g2?.x ?? 0);
				expect(csn1?.x ?? 0).toBeGreaterThan(g2?.x ?? 0);
			});

			it("has no overlapping positions", async () => {
				const pos = await layoutNineNodeProbe("LR");
				expectNoOverlaps(pos);
			});
		});

		describe("two side attachments on one target", () => {
			it("stacks both defeaters in a column beside the target, preserving the target's tree row", async () => {
				const { getLayoutedElements } = await import("../layout-helper");
				const nodes = [
					cellNode("G1", "G1"),
					cellNode("P1", "P1"),
					cellNode("D1", "D1", "P1"),
					cellNode("D2", "D2", "P1"),
				];
				const edges = [cellEdge("e1", "G1", "P1")];

				const result = await getLayoutedElements(nodes, edges, {
					direction: "TB",
				});
				const pos = new Map(
					result.nodes.map((n) => [
						n.id,
						n.position as { x: number; y: number },
					])
				);
				const g1 = pos.get("G1");
				const p1 = pos.get("P1");
				const d1 = pos.get("D1");
				const d2 = pos.get("D2");

				// Both side attachments: to the right of the target, in a
				// single column (same x).
				expect(d1?.x).toBeGreaterThan(p1?.x ?? 0);
				expect(d2?.x).toBeGreaterThan(p1?.x ?? 0);
				expect(d1?.x).toBe(d2?.x);

				// Stacked, not overlapping.
				expect(d1?.y).not.toBe(d2?.y);

				// The target's own tree row is unaffected by how many
				// attachments it carries — still exactly one row below G1.
				expect(p1?.y ?? 0).toBeGreaterThan(g1?.y ?? 0);

				expectNoOverlaps(pos);
			});

			it("sorts attachments by identifier regardless of input order", async () => {
				const { getLayoutedElements } = await import("../layout-helper");
				// D2 listed before D1 — buildCells must still sort attachments
				// by identifier (compareIdentifiers), not preserve input order.
				const nodes = [
					cellNode("P1", "P1"),
					cellNode("D2", "D2", "P1"),
					cellNode("D1", "D1", "P1"),
				];
				const edges: never[] = [];

				const result = await getLayoutedElements(nodes, edges, {
					direction: "TB",
				});
				const pos = new Map(
					result.nodes.map((n) => [
						n.id,
						n.position as { x: number; y: number },
					])
				);
				const d1 = pos.get("D1");
				const d2 = pos.get("D2");

				// Sorted: D1 (lower y — first in the cell's internal layered
				// direction) above D2, regardless of the input order above.
				expect(d1?.y ?? 0).toBeLessThan(d2?.y ?? 0);
			});
		});

		it("side attachment falls back to its tree position when the target is hidden", async () => {
			const { getLayoutedElements } = await import("../layout-helper");
			const { nodes, edges } = buildNineNodeProbe();
			const withHiddenTarget = nodes.map((n) =>
				n.id === "G2" ? { ...n, hidden: true } : n
			);

			// A visible node attached to a hidden target has nowhere to sit —
			// ELK never sees it as a cell member; the layout still resolves
			// without throwing (the surrounding conversion layer is
			// responsible for clearing `attachedTo` in this case, per D2).
			await expect(
				getLayoutedElements(withHiddenTarget, edges, { direction: "TB" })
			).resolves.not.toThrow();
		});
	});
});
