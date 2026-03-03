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
});
