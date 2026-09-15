import { afterEach, describe, expect, it, vi } from "vitest";
import { type LogEntry, resetLogSink, setLogSink } from "@/lib/logger";

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
				// CSn1 is an ORDINARY child of CG1 (the e5 edge below), not a
				// further side attachment — matching production shape (evidence
				// under a defeater has no attachedTo of its own, only a support
				// edge from the defeater) and the story text: "CSn1 beneath CG1
				// in the tree".
				cellNode("CSn1", "CSn1"),
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

	describe("cross-kind ordering and centreY (ADR 0005 D1/D8, walkthrough findings 4/5/9)", () => {
		function typedNode(
			id: string,
			type: string,
			name: string,
			attachedTo?: string
		) {
			return {
				id,
				type,
				position: { x: 0, y: 0 },
				data: { name, ...(attachedTo ? { attachedTo } : {}) },
				hidden: false,
			};
		}
		function plainEdge(id: string, source: string, target: string) {
			return { id, source, target, hidden: false };
		}

		it("orders a cell's own children before each side element's, in cell order — a defeater's evidence sits right of the target's children", async () => {
			const { getLayoutedElements } = await import("../layout-helper");
			// G1 -> S1, S2 (ordinary strategies); two defeaters P1, P2 attached
			// to G1; P2 -> E4 (evidence under the second defeater) — the exact
			// shape of walkthrough findings 4 and 5.
			const nodes = [
				typedNode("G1", "goal", "G1"),
				typedNode("S1", "strategy", "S1"),
				typedNode("S2", "strategy", "S2"),
				typedNode("P1", "property", "P1", "G1"),
				typedNode("P2", "property", "P2", "G1"),
				typedNode("E4", "evidence", "E4"),
			];
			const edges = [
				plainEdge("e1", "G1", "S1"),
				plainEdge("e2", "G1", "S2"),
				plainEdge("e3", "P2", "E4"),
			];

			const result = await getLayoutedElements(nodes, edges, {
				direction: "TB",
			});
			const pos = new Map(result.nodes.map((n) => [n.id, n.position]));

			// The target's (G1's) own children, S1 and S2, sit left of E4 —
			// the second defeater's evidence — not scattered by identifier
			// string comparison ("E4" < "S1").
			expect(pos.get("S1")?.x ?? 0).toBeLessThan(pos.get("E4")?.x ?? 0);
			expect(pos.get("S2")?.x ?? 0).toBeLessThan(pos.get("E4")?.x ?? 0);
			// Identifier order preserved within the target's own children.
			expect(pos.get("S1")?.x ?? 0).toBeLessThan(pos.get("S2")?.x ?? 0);
		});

		it("orders a cell's own children by kind before identifier: strategies/claims, then evidence, then away goals and modules", async () => {
			const { getLayoutedElements } = await import("../layout-helper");
			// G1 -> S1 (strategy), E1 (evidence), AG1 (away goal), M1 (module) —
			// identifier order alone would read AG1 < E1 < M1 < S1, scattering
			// the row (walkthrough finding 9); kind must win first.
			const nodes = [
				typedNode("G1", "goal", "G1"),
				typedNode("S1", "strategy", "S1"),
				typedNode("E1", "evidence", "E1"),
				typedNode("AG1", "awayGoal", "AG1"),
				typedNode("M1", "module", "M1"),
			];
			const edges = [
				plainEdge("e1", "G1", "S1"),
				plainEdge("e2", "G1", "E1"),
				plainEdge("e3", "G1", "AG1"),
				plainEdge("e4", "G1", "M1"),
			];

			const result = await getLayoutedElements(nodes, edges, {
				direction: "TB",
			});
			const pos = new Map(result.nodes.map((n) => [n.id, n.position]));

			const s1 = pos.get("S1")?.x ?? 0;
			const e1 = pos.get("E1")?.x ?? 0;
			const ag1 = pos.get("AG1")?.x ?? 0;
			const m1 = pos.get("M1")?.x ?? 0;

			// Strategy before evidence, evidence before both away goal and
			// module — kind rank, not string comparison.
			expect(s1).toBeLessThan(e1);
			expect(e1).toBeLessThan(ag1);
			expect(e1).toBeLessThan(m1);
		});

		it("combines cell order and kind order: a mixed-kind row with a defeater's evidence sorts target-kinds, then side-element-kinds", async () => {
			const { getLayoutedElements } = await import("../layout-helper");
			// G1 -> S1, S2 (strategies), AG1 (away goal), M1 (module); two
			// defeaters P1, P2 attached to G1; P2 -> E4 (evidence). Expected
			// row order: S1, S2 (target, kind 0), AG1, M1 (target, kind 2),
			// then E4 (side element P2's own child) — reproduces walkthrough
			// finding 9 (AG1, E4, S1, S2, M1 on staging) fixed.
			const nodes = [
				typedNode("G1", "goal", "G1"),
				typedNode("S1", "strategy", "S1"),
				typedNode("S2", "strategy", "S2"),
				typedNode("AG1", "awayGoal", "AG1"),
				typedNode("M1", "module", "M1"),
				typedNode("P1", "property", "P1", "G1"),
				typedNode("P2", "property", "P2", "G1"),
				typedNode("E4", "evidence", "E4"),
			];
			const edges = [
				plainEdge("e1", "G1", "S1"),
				plainEdge("e2", "G1", "S2"),
				plainEdge("e3", "G1", "AG1"),
				plainEdge("e4", "G1", "M1"),
				plainEdge("e5", "P2", "E4"),
			];

			const result = await getLayoutedElements(nodes, edges, {
				direction: "TB",
			});
			const pos = new Map(result.nodes.map((n) => [n.id, n.position]));
			const xOf = (id: string) => pos.get(id)?.x ?? 0;

			expect(xOf("S1")).toBeLessThan(xOf("S2"));
			expect(xOf("S2")).toBeLessThan(xOf("AG1"));
			expect(xOf("AG1")).toBeLessThan(xOf("M1"));
			expect(xOf("M1")).toBeLessThan(xOf("E4"));
		});

		it("sets a below-the-whole-cell centreY (not the target's own midpoint) on a support edge leaving a cell", async () => {
			const { getLayoutedElements } = await import("../layout-helper");
			// G1 (goal, height 120) with two defeaters P1, P2 (property,
			// height 100) attached — the two-stacked-defeaters shape where the
			// old midpoint-below-G1 bend passed through P2's card (walkthrough
			// finding 4). S1 is G1's ordinary child.
			const nodes = [
				typedNode("G1", "goal", "G1"),
				typedNode("P1", "property", "P1", "G1"),
				typedNode("P2", "property", "P2", "G1"),
				typedNode("S1", "strategy", "S1"),
			];
			const edges = [plainEdge("e1", "G1", "S1")];

			const result = await getLayoutedElements(nodes, edges, {
				direction: "TB",
			});
			const pos = new Map(result.nodes.map((n) => [n.id, n.position]));
			const HEIGHTS: Record<string, number> = {
				goal: 120,
				property: 100,
			};
			const bottomOf = (id: string, type: string) =>
				(pos.get(id)?.y ?? 0) + (HEIGHTS[type] ?? 0);
			const cellBottom = Math.max(
				bottomOf("G1", "goal"),
				bottomOf("P1", "property"),
				bottomOf("P2", "property")
			);

			const supportEdge = result.edges.find(
				(e) => e.source === "G1" && e.target === "S1"
			);
			expect(supportEdge?.data?.centerY).toBeDefined();
			// Below the WHOLE cell (both defeater cards), not just G1's own
			// midpoint — the whole point of D8's fix.
			expect(supportEdge?.data?.centerY as number).toBeGreaterThan(cellBottom);
		});

		it("leaves centerY undefined on edges outside any cell", async () => {
			const { getLayoutedElements } = await import("../layout-helper");
			const nodes = [
				typedNode("G1", "goal", "G1"),
				typedNode("S1", "strategy", "S1"),
			];
			const edges = [plainEdge("e1", "G1", "S1")];

			const result = await getLayoutedElements(nodes, edges, {
				direction: "TB",
			});

			const supportEdge = result.edges.find(
				(e) => e.source === "G1" && e.target === "S1"
			);
			expect(supportEdge?.data?.centerY).toBeUndefined();
		});
	});

	describe("nested defeaters — flattened into the root cell (ADR 0005 D8, vincent round 2 blocker 1)", () => {
		function typedNode(
			id: string,
			type: string,
			name: string,
			attachedTo?: string
		) {
			return {
				id,
				type,
				position: { x: 0, y: 0 },
				data: { name, ...(attachedTo ? { attachedTo } : {}) },
				hidden: false,
			};
		}
		function plainEdge(id: string, source: string, target: string) {
			return { id, source, target, hidden: false };
		}

		it("lays a defeater-on-a-defeater chain out as one cell, three members in a row, CSn1 right of CG1", async () => {
			const { getLayoutedElements } = await import("../layout-helper");
			// G2 is challenged by CG1 (a counter-goal), which is itself
			// challenged by CSn1 (a counter-counter-argument, GSN §1:6) — the
			// exact shape that used to crash ELK with "Referenced shape does
			// not exist: cell-CG1" once the outer membership guard stopped
			// cell-CG1 being emitted but buildElkEdges still targeted it.
			// Uniform node kind (like the nine-node probe above) so ELK's own
			// vertical centring for differing heights can't be mistaken for a
			// row mismatch — this test is about cell membership and column
			// order, not node kind.
			const nodes = [
				typedNode("G2", "goal", "G2"),
				typedNode("CG1", "goal", "CG1", "G2"),
				typedNode("CSn1", "goal", "CSn1", "CG1"),
			];
			// The challenges edges (CG1 -> G2, CSn1 -> CG1) — same-cell once
			// flattened, so dropped for ELK's purposes; included to prove
			// that doesn't break anything either.
			const edges = [
				plainEdge("e1", "CG1", "G2"),
				plainEdge("e2", "CSn1", "CG1"),
			];

			await expect(
				getLayoutedElements(nodes, edges, { direction: "TB" })
			).resolves.not.toThrow();

			const result = await getLayoutedElements(nodes, edges, {
				direction: "TB",
			});
			const pos = new Map(result.nodes.map((n) => [n.id, n.position]));

			// All three in the same row (cell) — one cell, not two.
			const g2 = pos.get("G2");
			const cg1 = pos.get("CG1");
			const csn1 = pos.get("CSn1");
			expect(cg1?.y).toBe(g2?.y);
			expect(csn1?.y).toBe(g2?.y);

			// Further right, in chain order — the counter-counter-argument
			// sits beyond its own parent, not stacked beside it.
			expect(cg1?.x ?? 0).toBeGreaterThan(g2?.x ?? 0);
			expect(csn1?.x ?? 0).toBeGreaterThan(cg1?.x ?? 0);
		});

		it("degrades without throwing when a cell reference's target does not exist", async () => {
			const { getLayoutedElements } = await import("../layout-helper");
			const nodes = [
				typedNode("G1", "goal", "G1"),
				typedNode("P1", "property", "P1", "does-not-exist"),
			];

			await expect(
				getLayoutedElements(nodes, [], { direction: "TB" })
			).resolves.not.toThrow();

			const result = await getLayoutedElements(nodes, [], {
				direction: "TB",
			});
			// P1 still gets laid out — as an ordinary tree node (D2's
			// fallback), not dropped.
			expect(result.nodes.find((n) => n.id === "P1")?.position).toBeDefined();
		});

		it("degrades without throwing when an attachment chain cycles back on itself", async () => {
			const { getLayoutedElements } = await import("../layout-helper");
			const nodes = [
				typedNode("A", "property", "A", "B"),
				typedNode("B", "property", "B", "A"),
			];

			await expect(
				getLayoutedElements(nodes, [], { direction: "TB" })
			).resolves.not.toThrow();
		});
	});

	describe("ELK failure fallback (vincent round 2 blocker 1)", () => {
		afterEach(() => {
			vi.restoreAllMocks();
			vi.unstubAllEnvs();
			resetLogSink();
		});

		it("logs and falls back to the pre-layout positions when ELK itself throws", async () => {
			// Logging is silent under NODE_ENV=test unless LOG_LEVEL is set
			// (lib/logger.ts's own test seam) — without this, the entry never
			// reaches setLogSink's callback at all, regardless of the sink.
			vi.stubEnv("LOG_LEVEL", "debug");

			const { getLayoutedElements } = await import("../layout-helper");
			// `elk-api`'s `layout` is a real prototype method (verified against
			// the installed elkjs bundle), so spying on it intercepts the
			// module-level `elk` singleton `layout-helper.ts` already holds —
			// no module reset (and the fresh-singleton logger mismatch that
			// comes with one) required.
			const ELK = (await import("elkjs/lib/elk.bundled.js")).default;
			vi.spyOn(ELK.prototype, "layout").mockRejectedValueOnce(
				new Error("Referenced shape does not exist")
			);

			const entries: LogEntry[] = [];
			setLogSink((entry) => {
				entries.push(entry);
			});

			const nodes = [
				{
					id: "G1",
					type: "goal",
					position: { x: 5, y: 7 },
					data: { name: "G1" },
					hidden: false,
				},
				{
					id: "S1",
					type: "strategy",
					position: { x: 9, y: 11 },
					data: { name: "S1" },
					hidden: false,
				},
			];
			const edges = [{ id: "e1", source: "G1", target: "S1", hidden: false }];

			const result = await getLayoutedElements(nodes, edges, {
				direction: "TB",
			});

			// The canvas falls back to the pre-layout positions instead of
			// freezing — nodes/edges are returned exactly as given.
			expect(result.nodes).toEqual(nodes);
			expect(result.edges).toEqual(edges);
			expect(
				entries.some(
					(e) =>
						e.level === "error" &&
						e.msg === "Case layout failed; falling back to pre-layout positions"
				)
			).toBe(true);
		});
	});

	describe("left-right tree — centreX bend (ADR 0005 D8, vincent round 2 blocker 3)", () => {
		function typedNode(
			id: string,
			type: string,
			name: string,
			attachedTo?: string
		) {
			return {
				id,
				type,
				position: { x: 0, y: 0 },
				data: { name, ...(attachedTo ? { attachedTo } : {}) },
				hidden: false,
			};
		}
		function plainEdge(id: string, source: string, target: string) {
			return { id, source, target, hidden: false };
		}

		it("bends a cell's outgoing support edge at centerX, beyond the cell's right edge — not centerY", async () => {
			const { getLayoutedElements } = await import("../layout-helper");
			const nodes = [
				typedNode("G1", "goal", "G1"),
				typedNode("P1", "property", "P1", "G1"),
				typedNode("P2", "property", "P2", "G1"),
				typedNode("S1", "strategy", "S1"),
			];
			const edges = [plainEdge("e1", "G1", "S1")];

			const result = await getLayoutedElements(nodes, edges, {
				direction: "LR",
			});
			const pos = new Map(result.nodes.map((n) => [n.id, n.position]));
			const HEIGHTS: Record<string, number> = { goal: 120, property: 100 };
			const WIDTH = 320;
			const rightEdgeOf = (id: string) => (pos.get(id)?.x ?? 0) + WIDTH;
			const cellRightEdge = Math.max(
				rightEdgeOf("G1"),
				rightEdgeOf("P1"),
				rightEdgeOf("P2")
			);

			const supportEdge = result.edges.find(
				(e) => e.source === "G1" && e.target === "S1"
			);
			expect(supportEdge?.data?.centerX).toBeDefined();
			expect(supportEdge?.data?.centerY).toBeUndefined();
			expect(supportEdge?.data?.centerX as number).toBeGreaterThan(
				cellRightEdge
			);
			// Sanity: heights aren't otherwise unused above.
			expect(HEIGHTS.goal).toBeGreaterThan(0);
		});
	});
});
