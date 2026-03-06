import type { Node } from "reactflow";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
	EvidenceResponse,
	GoalResponse,
	PropertyClaimResponse,
	StrategyResponse,
} from "@/lib/services/case-response-types";
import type { AssuranceCaseWithGoals, ConvertibleItem } from "../convert-case";
import {
	convertAssuranceCase,
	createEdgesFromNodes,
	createNodesRecursively,
} from "../convert-case";

describe("convert-case utilities", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("convertAssuranceCase", () => {
		const mockAssuranceCase: AssuranceCaseWithGoals = {
			id: "1",
			name: "Test Case",
			goals: [
				{
					id: "1",
					type: "goal",
					name: "Main Goal",
					description: "Primary objective",

					keywords: "test, goal",
					assuranceCaseId: "1",
					context: [],
					propertyClaims: [
						{
							id: "2",
							type: "property_claim",
							name: "Property Claim",
							description: "Supporting claim",

							goalId: "1",
							propertyClaimId: null,
							level: 1,
							claimType: "claim",
							propertyClaims: [],
							evidence: [
								{
									id: "3",
									type: "evidence",
									name: "Evidence Item",
									description: "Supporting evidence",

									URL: "https://example.com/evidence",
									propertyClaimId: ["2"],
								} as EvidenceResponse,
							],
							strategyId: null,
						} as PropertyClaimResponse,
					],
					strategies: [
						{
							id: "4",
							type: "strategy",
							name: "Strategy",
							description: "Approach",

							goalId: "1",
							propertyClaims: [],
						} as StrategyResponse,
					],
				} as unknown as GoalResponse,
			],
		};

		it("should convert assurance case to ReactFlow format", async () => {
			const result = await convertAssuranceCase(mockAssuranceCase);

			expect(result).toHaveProperty("caseNodes");
			expect(result).toHaveProperty("caseEdges");
			expect(Array.isArray(result.caseNodes)).toBe(true);
			expect(Array.isArray(result.caseEdges)).toBe(true);
		});

		it("should create nodes for all elements", async () => {
			const result = await convertAssuranceCase(mockAssuranceCase);

			// Should have nodes for goal, property claim, evidence, strategy, context
			expect(result.caseNodes.length).toBeGreaterThan(0);

			// Check that different node types are created
			const nodeTypes = result.caseNodes.map((node) => node.type);
			expect(nodeTypes).toContain("goal");
		});

		it("should create edges between connected nodes", async () => {
			const result = await convertAssuranceCase(mockAssuranceCase);

			expect(result.caseEdges.length).toBeGreaterThan(0);

			// Edges should have proper structure
			for (const edge of result.caseEdges) {
				expect(edge).toHaveProperty("id");
				expect(edge).toHaveProperty("source");
				expect(edge).toHaveProperty("target");
			}
		});

		it("should handle empty assurance case", async () => {
			const emptyCase: AssuranceCaseWithGoals = {
				id: "1",
				name: "Empty Case",
				goals: [],
			};

			const result = await convertAssuranceCase(emptyCase);

			expect(result.caseNodes).toEqual([]);
			expect(result.caseEdges).toEqual([]);
		});

		it("should handle assurance case with no goals", async () => {
			const caseWithoutGoals: AssuranceCaseWithGoals = {
				id: "1",
				name: "No Goals Case",
				goals: [],
			};

			const result = await convertAssuranceCase(caseWithoutGoals);

			expect(result.caseNodes).toEqual([]);
			expect(result.caseEdges).toEqual([]);
		});

		it("should handle null assurance case", async () => {
			const nullCase: AssuranceCaseWithGoals = { goals: [] };
			const result = await convertAssuranceCase(nullCase);

			expect(result.caseNodes).toEqual([]);
			expect(result.caseEdges).toEqual([]);
		});

		it("should handle undefined assurance case", async () => {
			const undefinedCase: AssuranceCaseWithGoals = { goals: [] };
			const result = await convertAssuranceCase(undefinedCase);

			expect(result.caseNodes).toEqual([]);
			expect(result.caseEdges).toEqual([]);
		});
	});

	describe("createNodesRecursively", () => {
		const mockGoal: ConvertibleItem = {
			id: "1",
			type: "goal",
			name: "Test Goal",
			description: "Test description",
			context: [
				{
					id: "5",
					type: "context",
					name: "Context",
					description: "Context description",
				},
			],
			propertyClaims: [
				{
					id: "2",
					type: "property_claim",
					name: "Child Claim",
					description: "Child description",

					goalId: "1",
					propertyClaimId: null,
					level: 1,
					claimType: "claim",
					propertyClaims: [],
					evidence: [
						{
							id: "3",
							type: "evidence",
							name: "Evidence",
							description: "Evidence description",

							URL: "https://example.com",
							propertyClaimId: ["2"],
						} as EvidenceResponse,
					],
					strategyId: null,
				} as PropertyClaimResponse,
			],
			strategies: [
				{
					id: "4",
					type: "strategy",
					name: "Strategy",
					description: "Strategy description",

					goalId: "1",
					propertyClaims: [],
				} as StrategyResponse,
			],
		};

		it("should create nodes recursively for nested structures", () => {
			const nodes = createNodesRecursively([mockGoal], "goal");

			expect(nodes.length).toBeGreaterThan(1);

			// Should include the main goal
			const goalNode = nodes.find((n) => n.id === "goal-1");
			expect(goalNode).toBeDefined();
			if (goalNode) {
				expect(goalNode.type).toBe("goal");
			}
		});

		it("should prevent duplicate nodes", () => {
			const processedItems = new Set<ConvertibleItem>();

			// Add the same goal twice
			const nodes1 = createNodesRecursively(
				[mockGoal],
				"goal",
				null,
				processedItems
			);
			const nodes2 = createNodesRecursively(
				[mockGoal],
				"goal",
				null,
				processedItems
			);

			// The second call should return empty array since items are already processed
			expect(nodes2).toEqual([]);
			expect(nodes1.length).toBeGreaterThan(0);
		});

		it("should respect depth limits", () => {
			const deeplyNested = {
				id: "1",
				type: "ConvertibleItem",
				name: "Level 0",
				propertyClaims: [
					{
						id: "2",
						type: "property_claim",
						name: "Level 1",
						propertyClaims: [
							{
								id: "3",
								type: "property_claim",
								name: "Level 2",
								propertyClaims: [
									{
										id: "4",
										type: "property_claim",
										name: "Level 3",
										propertyClaims: [],
									},
								],
							},
						],
					},
				],
			};

			const nodes: Node[] = [];
			const maxDepth = 2;

			createNodesRecursively(
				[deeplyNested as unknown as ConvertibleItem],
				"goal",
				null,
				new Set<ConvertibleItem>(),
				maxDepth
			);

			// Should not include nodes beyond max depth
			const level3Node = nodes.find((n) => n.data.label === "Level 3");
			expect(level3Node).toBeUndefined();
		});

		it("should create nodes with correct positioning data", () => {
			const nodes = createNodesRecursively(
				[mockGoal],
				"goal",
				null,
				new Set<ConvertibleItem>(),
				0
			);

			const goalNode = nodes.find((n) => n.data.elementId === "1");
			expect(goalNode).toBeDefined();
			if (goalNode) {
				expect(goalNode.position).toBeDefined();
				expect(typeof goalNode.position.x).toBe("number");
				expect(typeof goalNode.position.y).toBe("number");
			}
		});

		it("should handle empty arrays", () => {
			const nodes = createNodesRecursively(
				[],
				"goal",
				null,
				new Set<ConvertibleItem>(),
				0
			);

			expect(nodes).toHaveLength(0);
		});

		it("should handle null/undefined arrays", () => {
			const nodes1 = createNodesRecursively(
				null as unknown as ConvertibleItem[],
				"goal",
				null,
				new Set<ConvertibleItem>(),
				0
			);
			expect(nodes1).toHaveLength(0);

			const nodes2 = createNodesRecursively(
				undefined as unknown as ConvertibleItem[],
				"goal",
				null,
				new Set<ConvertibleItem>(),
				0
			);
			expect(nodes2).toHaveLength(0);
		});

		it("should create correct node types for different elements", () => {
			const nodes = createNodesRecursively(
				[mockGoal],
				"goal",
				null,
				new Set<ConvertibleItem>(),
				0
			);

			const goalNode = nodes.find((n) => n.type === "goal");
			const claimNode = nodes.find((n) => n.type === "property");
			const evidenceNode = nodes.find((n) => n.type === "evidence");
			const strategyNode = nodes.find((n) => n.type === "strategy");
			// Note: context nodes are deprecated and no longer created

			expect(goalNode).toBeDefined();
			expect(claimNode).toBeDefined();
			expect(evidenceNode).toBeDefined();
			expect(strategyNode).toBeDefined();
		});

		it("should handle items with missing properties", () => {
			const incompleteGoal = {
				id: "1",
				type: "goal",
				name: "Incomplete Goal",
				// Missing short_description and nested arrays
			};

			const nodes = createNodesRecursively(
				[incompleteGoal],
				"goal",
				null,
				new Set<ConvertibleItem>(),
				0
			);

			expect(nodes).toHaveLength(1);
			expect(nodes[0]!.data.name).toBe("Incomplete Goal");
		});
	});

	describe("createEdgesFromNodes", () => {
		const mockNodes: Node[] = [
			{
				id: "goal-1",
				type: "goal",
				position: { x: 0, y: 0 },
				data: { parentId: null, elementId: "1", elementType: "goal" },
			},
			{
				id: "claim-2",
				type: "claim",
				position: { x: 0, y: 0 },
				data: {
					parentId: "goal-1",
					elementId: "2",
					elementType: "property_claim",
				},
			},
			{
				id: "evidence-3",
				type: "evidence",
				position: { x: 0, y: 0 },
				data: { parentId: "claim-2", elementId: "3", elementType: "evidence" },
			},
			{
				id: "strategy-4",
				type: "strategy",
				position: { x: 0, y: 0 },
				data: { parentId: "goal-1", elementId: "4", elementType: "strategy" },
			},
			{
				id: "context-5",
				type: "context",
				position: { x: 0, y: 0 },
				data: { parentId: "goal-1", elementId: "5", elementType: "context" },
			},
		];

		it("should create edges between parent and child nodes", () => {
			const edges = createEdgesFromNodes(mockNodes);

			expect(edges.length).toBeGreaterThan(0);

			// Should create edge from goal to claim
			const goalToClaimEdge = edges.find(
				(e) => e.source === "goal-1" && e.target === "claim-2"
			);
			expect(goalToClaimEdge).toBeDefined();

			// Should create edge from claim to evidence
			const claimToEvidenceEdge = edges.find(
				(e) => e.source === "claim-2" && e.target === "evidence-3"
			);
			expect(claimToEvidenceEdge).toBeDefined();
		});

		it("should create unique edge IDs", () => {
			const edges = createEdgesFromNodes(mockNodes);

			const edgeIds = edges.map((edge) => edge.id);
			const uniqueIds = new Set(edgeIds);

			expect(uniqueIds.size).toBe(edgeIds.length);
		});

		it("should not create edges for root nodes", () => {
			const edges = createEdgesFromNodes(mockNodes);

			// Goal node has no parent, so it shouldn't be a target
			const edgesToGoal = edges.filter((e) => e.target === "goal-1");
			expect(edgesToGoal).toHaveLength(0);
		});

		it("should handle nodes with no parents", () => {
			const orphanNodes: Node[] = [
				{
					id: "goal-1",
					type: "goal",
					position: { x: 0, y: 0 },
					data: { parentId: null, elementId: "1", elementType: "goal" },
				},
				{
					id: "goal-2",
					type: "goal",
					position: { x: 0, y: 0 },
					data: { parentId: null, elementId: "2", elementType: "goal" },
				},
			];

			const edges = createEdgesFromNodes(orphanNodes);
			expect(edges).toHaveLength(0);
		});

		it("should handle empty node array", () => {
			const edges = createEdgesFromNodes([]);
			expect(edges).toEqual([]);
		});

		it("should handle nodes with missing parent references", () => {
			const nodesWithMissingParents: Node[] = [
				{
					id: "goal-1",
					type: "goal",
					position: { x: 0, y: 0 },
					data: { parentId: null, elementId: "1", elementType: "goal" },
				},
				{
					id: "claim-2",
					type: "claim",
					position: { x: 0, y: 0 },
					data: {
						parentId: "999",
						elementId: "2",
						elementType: "property_claim",
					}, // Parent doesn't exist
				},
			];

			const edges = createEdgesFromNodes(nodesWithMissingParents);

			// Should not create edge to non-existent parent
			expect(edges).toHaveLength(0);
		});

		it("should create correct edge properties", () => {
			const edges = createEdgesFromNodes(mockNodes);

			for (const edge of edges) {
				expect(edge).toHaveProperty("id");
				expect(edge).toHaveProperty("source");
				expect(edge).toHaveProperty("target");
				expect(edge).toHaveProperty("type");
				expect(edge.type).toBe("smoothstep");
			}
		});
	});

	describe("Integration tests", () => {
		it("should handle complete conversion workflow", async () => {
			const complexCase: AssuranceCaseWithGoals = {
				id: "1",
				name: "Complex Case",
				goals: [
					{
						id: "1",
						type: "goal",
						name: "Main Goal",
						description: "Main goal description",

						keywords: "main, goal",
						assuranceCaseId: "1",
						context: [],
						propertyClaims: [
							{
								id: "2",
								type: "property_claim",
								name: "Claim 1",
								description: "Claim description",

								goalId: "1",
								propertyClaimId: null,
								level: 1,
								claimType: "claim",
								strategyId: null,
								propertyClaims: [
									{
										id: "3",
										type: "property_claim",
										name: "Sub-claim",
										description: "Sub-claim description",

										goalId: "1",
										propertyClaimId: "2",
										level: 2,
										claimType: "claim",
										strategyId: null,
										propertyClaims: [],
										evidence: [
											{
												id: "4",
												type: "evidence",
												name: "Evidence 1",
												description: "Evidence description",

												URL: "https://example.com",
												propertyClaimId: ["3"],
											},
										],
									},
								],
								evidence: [],
							},
						],
						strategies: [
							{
								id: "5",
								type: "strategy",
								name: "Strategy 1",
								description: "Strategy description",

								goalId: "1",
								propertyClaims: [],
							},
						],
					},
					{
						id: "6",
						type: "goal",
						name: "Secondary Goal",
						description: "Secondary goal description",

						keywords: "secondary, goal",
						assuranceCaseId: "1",
						context: [],
						propertyClaims: [],
						strategies: [],
					},
				],
			};

			const result = await convertAssuranceCase(complexCase);

			expect(result.caseNodes.length).toBeGreaterThan(5);
			expect(result.caseEdges.length).toBeGreaterThan(3);

			// Verify node-edge consistency
			const nodeIds = new Set(result.caseNodes.map((n) => n.id));
			for (const edge of result.caseEdges) {
				expect(nodeIds.has(edge.source)).toBe(true);
				expect(nodeIds.has(edge.target)).toBe(true);
			}
		});

		it("should handle very large assurance cases efficiently", async () => {
			const largeCase: AssuranceCaseWithGoals = {
				id: "1",
				name: "Large Case",
				goals: Array.from({ length: 10 }, (_, i) => ({
					id: String(i + 1),
					type: "goal",
					name: `Goal ${i + 1}`,
					description: `Goal ${i + 1} description`,
					keywords: `goal, ${i}`,
					assuranceCaseId: "1",
					context: [],
					strategies: [],
					propertyClaims: Array.from({ length: 5 }, (_j, j) => ({
						id: String(i * 5 + j + 100),
						type: "property_claim",
						name: `Claim ${i}-${j}`,
						description: `Claim ${i}-${j} description`,
						goalId: String(i + 1),
						propertyClaimId: null,
						level: 1,
						claimType: "claim",
						strategyId: null,
						propertyClaims: [],
						evidence: Array.from({ length: 2 }, (_k, k) => ({
							id: String(i * 10 + j * 2 + k + 1000),
							type: "evidence",
							name: `Evidence ${i}-${j}-${k}`,
							description: `Evidence ${i}-${j}-${k} description`,
							URL: `https://example.com/evidence-${i}-${j}-${k}`,
							propertyClaimId: [String(i * 5 + j + 100)],
						})),
					})),
				})),
			};

			const start = performance.now();
			const result = await convertAssuranceCase(largeCase);
			const end = performance.now();

			expect(result.caseNodes.length).toBeGreaterThan(50);
			expect(end - start).toBeLessThan(1000); // Should complete in reasonable time
		});

		it("should maintain data integrity during conversion", async () => {
			const caseData: AssuranceCaseWithGoals = {
				id: "1",
				name: "Integrity Test",
				goals: [
					{
						id: "10",
						type: "goal",
						name: "Test Goal",
						description: "Goal description",

						keywords: "test, goal",
						assuranceCaseId: "1",
						context: [],
						strategies: [],
						propertyClaims: [
							{
								id: "20",
								type: "property_claim",
								name: "Test Claim",
								description: "Claim description",

								goalId: "10",
								propertyClaimId: null,
								level: 1,
								claimType: "claim",
								strategyId: null,
								propertyClaims: [],
								evidence: [],
							},
						],
					},
				],
			};

			const result = await convertAssuranceCase(caseData);

			const goalNode = result.caseNodes.find((n) => n.data.id === "10");
			const claimNode = result.caseNodes.find((n) => n.data.id === "20");

			expect(goalNode?.data.name).toBe("Test Goal");
			expect(goalNode?.data.description).toBe("Goal description");
			expect(claimNode?.data.name).toBe("Test Claim");
			expect(claimNode?.data.description).toBe("Claim description");
		});
	});

	describe("Error handling and edge cases", () => {
		it("should handle circular references in data", async () => {
			const circularCase: AssuranceCaseWithGoals = {
				id: "1",
				name: "Circular Case",
				goals: [
					{
						id: "1",
						type: "goal",
						name: "Circular Goal",
						description: "Circular goal description",

						keywords: "circular, goal",
						assuranceCaseId: "1",
						context: [],
						strategies: [],
						propertyClaims: [],
					},
				],
			};

			// Create circular reference
			circularCase.goals[0]!.propertyClaims.push(
				circularCase.goals[0]! as unknown as PropertyClaimResponse
			);

			// Should not hang or crash
			const result = await convertAssuranceCase(circularCase);
			expect(result).toBeDefined();
			expect(result.caseNodes.length).toBeGreaterThan(0);
		});

		it("should handle malformed data gracefully", () => {
			const malformedCase = {
				id: "not-a-number",
				name: null,
				goals: [
					{
						id: undefined,
						name: "",
						propertyClaims: "not-an-array",
					},
				],
			};

			expect(() => {
				convertAssuranceCase(
					malformedCase as unknown as AssuranceCaseWithGoals
				);
			}).not.toThrow();
		});

		it("should handle extremely deep nesting", async () => {
			const deepCase: AssuranceCaseWithGoals = {
				id: "1",
				name: "Deep Case",
				goals: [
					{
						id: "1",
						type: "goal",
						name: "Root Goal",
						description: "Root goal description",

						keywords: "root, goal",
						assuranceCaseId: "1",
						context: [],
						strategies: [],
						propertyClaims: [] as PropertyClaimResponse[],
					},
				],
			};

			// Create 20 levels of nesting
			let current: GoalResponse | PropertyClaimResponse = deepCase.goals[0]!;
			for (let i = 0; i < 20; i++) {
				const claim: PropertyClaimResponse = {
					id: String(i + 2),
					type: "property_claim",
					name: `Claim Level ${i}`,
					description: `Claim level ${i} description`,
					goalId: "1",
					propertyClaimId: i > 0 ? String(i + 1) : null,
					level: i + 1,
					claimType: "claim",
					strategyId: null,
					evidence: [],
					propertyClaims: [],
				};
				current.propertyClaims.push(claim);
				current = claim;
			}

			const result = await convertAssuranceCase(deepCase);

			// Should handle deep nesting without stack overflow
			expect(result.caseNodes.length).toBeGreaterThan(1);
			expect(result.caseEdges.length).toBeGreaterThan(0);
		});
	});
});
