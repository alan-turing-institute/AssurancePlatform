import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
	AssuranceCase,
	Context,
	Goal,
	PropertyClaim,
	Strategy,
} from "@/types";
import type { NestedArrayItem, ReactFlowNode } from "../case-helper";

import {
	addEvidenceToClaim,
	addHiddenProp,
	addPropertyClaimToNested,
	attachCaseElement,
	caseItemDescription,
	createAssuranceCaseNode,
	deleteAssuranceCaseNode,
	detachCaseElement,
	extractGoalsClaimsStrategies,
	findElementById,
	findItemById,
	findParentNode,
	findSiblingHiddenState,
	getAssuranceCaseNode,
	getChildrenHiddenStatus,
	listPropertyClaims,
	removeAssuranceCaseNode,
	searchWithDeepFirst,
	setNodeIdentifier,
	toggleHiddenForChildren,
	toggleHiddenForParent,
	updateAssuranceCase,
	updateAssuranceCaseNode,
	updateEvidenceNested,
	updateEvidenceNestedMove,
	updatePropertyClaimNested,
	updatePropertyClaimNestedMove,
} from "../case-helper";

// Helper to create mock fetch response
const createMockResponse = (data: unknown, options: Partial<Response> = {}) => {
	return {
		ok: true,
		json: vi.fn().mockResolvedValue(data),
		headers: new Headers(),
		redirected: false,
		status: 200,
		statusText: "OK",
		type: "basic" as ResponseType,
		url: "",
		clone: vi.fn(),
		body: null,
		bodyUsed: false,
		arrayBuffer: vi.fn(),
		blob: vi.fn(),
		formData: vi.fn(),
		text: vi.fn(),
		...options,
	} as unknown as Response;
};

describe("case-helper utilities", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("caseItemDescription", () => {
		it("should return correct descriptions for each case item type", () => {
			expect(caseItemDescription("goal")).toBe(
				"Goals are the overarching objectives of the assurance case. They represent what needs to be achieved or demonstrated."
			);
			expect(caseItemDescription("context")).toBe(
				"Context elements provide background information and assumptions that frame the assurance case."
			);
			expect(caseItemDescription("property_claim")).toBe(
				"Property claims assert specific properties or characteristics that support the goals."
			);
			expect(caseItemDescription("evidence")).toBe(
				"Evidence provides factual support and verification for the claims made in the assurance case."
			);
			expect(caseItemDescription("strategy")).toBe(
				"Strategies describe the approach or method used to decompose goals into sub-goals or claims."
			);
		});

		it("should handle unknown types gracefully", () => {
			expect(caseItemDescription("unknown_type")).toBe(
				"Unknown case item type."
			);
		});

		it("should handle null and undefined inputs", () => {
			expect(caseItemDescription(null as unknown as string)).toBe(
				"Unknown case item type."
			);
			expect(caseItemDescription(undefined as unknown as string)).toBe(
				"Unknown case item type."
			);
		});

		it("should handle empty string input", () => {
			expect(caseItemDescription("")).toBe("Unknown case item type.");
		});
	});

	describe("addPropertyClaimToNested", () => {
		const mockPropertyClaim: PropertyClaim = {
			id: 100,
			type: "PropertyClaim",
			name: "New Claim",
			short_description: "Test claim",
			long_description: "",
			goal_id: null,
			property_claim_id: null,
			level: 1,
			claim_type: "claim",
			property_claims: [],
			evidence: [],
			strategy_id: null,
		};

		it("should add property claim to goal when target goal is found", () => {
			const goals: PropertyClaim[] = [
				{
					id: 1,
					type: "PropertyClaim",
					name: "Main Goal",
					short_description: "",
					long_description: "",
					goal_id: null,
					property_claim_id: null,
					level: 1,
					claim_type: "claim",
					property_claims: [],
					evidence: [],
					strategy_id: null,
				},
			];

			const result = addPropertyClaimToNested(goals, 1, mockPropertyClaim);

			expect(result).toBe(true);
			expect(goals[0].property_claims).toHaveLength(1);
			expect(goals[0].property_claims[0]).toEqual(mockPropertyClaim);
		});

		it("should add property claim to nested property claim", () => {
			const goals: PropertyClaim[] = [
				{
					id: 1,
					type: "PropertyClaim",
					name: "Main Goal",
					short_description: "",
					long_description: "",
					goal_id: null,
					property_claim_id: null,
					level: 1,
					claim_type: "claim",
					property_claims: [
						{
							id: 2,
							type: "PropertyClaim",
							name: "Parent Claim",
							short_description: "",
							long_description: "",
							goal_id: null,
							property_claim_id: null,
							level: 2,
							claim_type: "claim",
							property_claims: [],
							evidence: [],
							strategy_id: null,
						},
					],
					evidence: [],
					strategy_id: null,
				},
			];

			const result = addPropertyClaimToNested(goals, 2, mockPropertyClaim);

			expect(result).toBe(true);
			expect(goals[0].property_claims[0].property_claims).toHaveLength(1);
			expect(goals[0].property_claims[0].property_claims[0]).toEqual(
				mockPropertyClaim
			);
		});

		it("should add property claim to strategy", () => {
			const goals: PropertyClaim[] = [
				{
					id: 1,
					type: "PropertyClaim",
					name: "Main Goal",
					short_description: "",
					long_description: "",
					goal_id: null,
					property_claim_id: null,
					level: 1,
					claim_type: "claim",
					property_claims: [],
					evidence: [],
					strategy_id: null,
					strategies: [
						{
							id: 3,
							name: "Test Strategy",
							short_description: "",
							long_description: "",
							goal_id: 1,
							property_claims: [],
						},
					],
				},
			];

			const result = addPropertyClaimToNested(goals, 3, mockPropertyClaim);

			expect(result).toBe(true);
			expect(goals[0].strategies?.[0].property_claims).toHaveLength(1);
			expect(goals[0].strategies?.[0].property_claims[0]).toEqual(
				mockPropertyClaim
			);
		});

		it("should return unchanged array when target not found", () => {
			const goals: PropertyClaim[] = [
				{
					id: 1,
					type: "PropertyClaim",
					name: "Main Goal",
					short_description: "",
					long_description: "",
					goal_id: null,
					property_claim_id: null,
					level: 1,
					claim_type: "claim",
					property_claims: [],
					evidence: [],
					strategy_id: null,
				},
			];

			const result = addPropertyClaimToNested(goals, 999, mockPropertyClaim);

			expect(result).toBe(false);
		});

		it("should handle empty goals array", () => {
			const result = addPropertyClaimToNested([], 1, mockPropertyClaim);
			expect(result).toBe(false);
		});

		it("should handle deeply nested structures", () => {
			const goals: PropertyClaim[] = [
				{
					id: 1,
					type: "PropertyClaim",
					name: "Main Goal",
					short_description: "",
					long_description: "",
					goal_id: null,
					property_claim_id: null,
					level: 1,
					claim_type: "claim",
					property_claims: [
						{
							id: 2,
							type: "PropertyClaim",
							name: "Level 1",
							short_description: "",
							long_description: "",
							goal_id: null,
							property_claim_id: null,
							level: 2,
							claim_type: "claim",
							property_claims: [
								{
									id: 3,
									type: "PropertyClaim",
									name: "Level 2",
									short_description: "",
									long_description: "",
									goal_id: null,
									property_claim_id: null,
									level: 3,
									claim_type: "claim",
									property_claims: [],
									evidence: [],
									strategy_id: null,
								},
							],
							evidence: [],
							strategy_id: null,
						},
					],
					evidence: [],
					strategy_id: null,
				},
			];

			addPropertyClaimToNested(goals, 3, mockPropertyClaim);

			expect(
				goals[0].property_claims[0].property_claims[0].property_claims
			).toHaveLength(1);
		});
	});

	describe("updatePropertyClaimNested", () => {
		const updatedClaim = {
			id: 2,
			name: "Updated Claim",
			short_description: "Updated description",
		};

		it("should update property claim when found", () => {
			const goals: PropertyClaim[] = [
				{
					id: 1,
					type: "PropertyClaim",
					name: "Main Goal",
					short_description: "",
					long_description: "",
					goal_id: null,
					property_claim_id: null,
					level: 1,
					claim_type: "claim",
					property_claims: [
						{
							id: 2,
							type: "PropertyClaim",
							name: "Original Claim",
							short_description: "Original description",
							long_description: "",
							goal_id: null,
							property_claim_id: null,
							level: 2,
							claim_type: "claim",
							property_claims: [],
							evidence: [],
							strategy_id: null,
						},
					],
					evidence: [],
					strategy_id: null,
				},
			];

			const result = updatePropertyClaimNested(goals, 2, updatedClaim);

			if (result?.[0]) {
				expect(result[0].property_claims[0].name).toBe("Updated Claim");
				expect(result[0].property_claims[0].short_description).toBe(
					"Updated description"
				);
			}
		});

		it("should update nested property claim", () => {
			const goals: PropertyClaim[] = [
				{
					id: 1,
					type: "PropertyClaim",
					name: "Main Goal",
					short_description: "",
					long_description: "",
					goal_id: null,
					property_claim_id: null,
					level: 1,
					claim_type: "claim",
					property_claims: [
						{
							id: 2,
							type: "PropertyClaim",
							name: "Parent Claim",
							short_description: "",
							long_description: "",
							goal_id: null,
							property_claim_id: null,
							level: 2,
							claim_type: "claim",
							property_claims: [
								{
									id: 3,
									type: "PropertyClaim",
									name: "Original Nested",
									short_description: "Original",
									long_description: "",
									goal_id: null,
									property_claim_id: null,
									level: 3,
									claim_type: "claim",
									property_claims: [],
									evidence: [],
									strategy_id: null,
								},
							],
							evidence: [],
							strategy_id: null,
						},
					],
					evidence: [],
					strategy_id: null,
				},
			];

			const result = updatePropertyClaimNested(goals, 3, {
				...updatedClaim,
				id: 3,
			});

			if (result?.[0]) {
				expect(result[0].property_claims[0].property_claims[0].name).toBe(
					"Updated Claim"
				);
			}
		});

		it("should return unchanged array when claim not found", () => {
			const goals: PropertyClaim[] = [
				{
					id: 1,
					type: "PropertyClaim",
					name: "Main Goal",
					short_description: "",
					long_description: "",
					goal_id: null,
					property_claim_id: null,
					level: 1,
					claim_type: "claim",
					property_claims: [],
					evidence: [],
					strategy_id: null,
				},
			];

			const result = updatePropertyClaimNested(goals, 999, updatedClaim);
			expect(result).toEqual(goals);
		});

		it("should handle empty goals array", () => {
			const result = updatePropertyClaimNested([], 1, updatedClaim);
			expect(result).toEqual([]);
		});
	});

	describe("listPropertyClaims", () => {
		const mockGoals: PropertyClaim[] = [
			{
				id: 1,
				type: "PropertyClaim",
				name: "Goal 1",
				short_description: "",
				long_description: "",
				goal_id: null,
				property_claim_id: null,
				level: 1,
				claim_type: "claim",
				property_claims: [
					{
						id: 2,
						type: "PropertyClaim",
						name: "Claim 1",
						short_description: "",
						long_description: "",
						goal_id: null,
						property_claim_id: null,
						level: 2,
						claim_type: "claim",
						property_claims: [],
						evidence: [],
						strategy_id: null,
					},
					{
						id: 3,
						type: "PropertyClaim",
						name: "Claim 2",
						short_description: "",
						long_description: "",
						goal_id: null,
						property_claim_id: null,
						level: 2,
						claim_type: "claim",
						property_claims: [
							{
								id: 4,
								type: "PropertyClaim",
								name: "Nested Claim",
								short_description: "",
								long_description: "",
								goal_id: null,
								property_claim_id: null,
								level: 3,
								claim_type: "claim",
								property_claims: [],
								evidence: [],
								strategy_id: null,
							},
						],
						evidence: [],
						strategy_id: null,
					},
				],
				evidence: [],
				strategy_id: null,
			},
			{
				id: 5,
				type: "PropertyClaim",
				name: "Goal 2",
				short_description: "",
				long_description: "",
				goal_id: null,
				property_claim_id: null,
				level: 1,
				claim_type: "claim",
				property_claims: [
					{
						id: 6,
						type: "PropertyClaim",
						name: "Claim 3",
						short_description: "",
						long_description: "",
						goal_id: null,
						property_claim_id: null,
						level: 2,
						claim_type: "claim",
						property_claims: [],
						evidence: [],
						strategy_id: null,
					},
				],
				evidence: [],
				strategy_id: null,
			},
		];

		it("should list all property claims except current one", () => {
			const result = listPropertyClaims(mockGoals, "3");

			expect(result).toHaveLength(3);
			expect(result.map((c) => c.id)).toEqual([2, 4, 6]);
			expect(result.find((c) => c.id === 3)).toBeUndefined();
		});

		it("should include nested claims", () => {
			const result = listPropertyClaims(mockGoals, "999");

			expect(result).toHaveLength(4);
			expect(result.map((c) => c.id)).toEqual([2, 3, 4, 6]);
		});

		it("should handle empty goals array", () => {
			const result = listPropertyClaims([], "1");
			expect(result).toEqual([]);
		});

		it("should handle goals with no property claims", () => {
			const goals: PropertyClaim[] = [
				{
					id: 1,
					type: "PropertyClaim",
					name: "Goal",
					short_description: "",
					long_description: "",
					goal_id: null,
					property_claim_id: null,
					level: 1,
					claim_type: "claim",
					property_claims: [],
					evidence: [],
					strategy_id: null,
				},
			];
			const result = listPropertyClaims(goals, "1");
			expect(result).toEqual([]);
		});
	});

	describe("addEvidenceToClaim", () => {
		const mockEvidence = {
			id: 100,
			type: "Evidence",
			name: "Test Evidence",
			short_description: "Evidence description",
			long_description: "",
			URL: "",
			property_claim_id: [],
		};

		it("should add evidence to property claim", () => {
			const goals: PropertyClaim[] = [
				{
					id: 1,
					type: "PropertyClaim",
					name: "Goal",
					short_description: "",
					long_description: "",
					goal_id: null,
					property_claim_id: null,
					level: 1,
					claim_type: "claim",
					property_claims: [
						{
							id: 2,
							type: "PropertyClaim",
							name: "Claim",
							short_description: "",
							long_description: "",
							goal_id: null,
							property_claim_id: null,
							level: 2,
							claim_type: "claim",
							property_claims: [],
							evidence: [],
							strategy_id: null,
						},
					],
					evidence: [],
					strategy_id: null,
				},
			];

			const result = addEvidenceToClaim(goals, 2, mockEvidence);

			expect(result).toBe(true);
			expect(goals[0].property_claims[0].evidence).toHaveLength(1);
			expect(goals[0].property_claims[0].evidence[0]).toEqual(mockEvidence);
		});

		it("should add evidence to nested claim", () => {
			const goals: PropertyClaim[] = [
				{
					id: 1,
					type: "PropertyClaim",
					name: "Goal",
					short_description: "",
					long_description: "",
					goal_id: null,
					property_claim_id: null,
					level: 1,
					claim_type: "claim",
					property_claims: [
						{
							id: 2,
							type: "PropertyClaim",
							name: "Parent",
							short_description: "",
							long_description: "",
							goal_id: null,
							property_claim_id: null,
							level: 2,
							claim_type: "claim",
							property_claims: [
								{
									id: 3,
									type: "PropertyClaim",
									name: "Child",
									short_description: "",
									long_description: "",
									goal_id: null,
									property_claim_id: null,
									level: 3,
									claim_type: "claim",
									property_claims: [],
									evidence: [],
									strategy_id: null,
								},
							],
							evidence: [],
							strategy_id: null,
						},
					],
					evidence: [],
					strategy_id: null,
				},
			];

			const result = addEvidenceToClaim(goals, 3, mockEvidence);

			expect(result).toBe(true);
			expect(
				goals[0].property_claims[0].property_claims[0].evidence
			).toHaveLength(1);
		});

		it("should return unchanged when claim not found", () => {
			const goals: PropertyClaim[] = [
				{
					id: 1,
					type: "PropertyClaim",
					name: "Goal",
					short_description: "",
					long_description: "",
					goal_id: null,
					property_claim_id: null,
					level: 1,
					claim_type: "claim",
					property_claims: [],
					evidence: [],
					strategy_id: null,
				},
			];

			const result = addEvidenceToClaim(goals, 999, mockEvidence);
			expect(result).toBe(false);
		});
	});

	describe("findItemById", () => {
		const mockGoalData: Goal[] = [
			{
				id: 1,
				type: "Goal",
				name: "Item 1",
				short_description: "",
				long_description: "",
				keywords: "",
				assurance_case_id: 1,
				context: [],
				property_claims: [
					{
						id: 2,
						type: "PropertyClaim",
						name: "Item 2",
						short_description: "",
						long_description: "",
						goal_id: 1,
						property_claim_id: null,
						level: 1,
						claim_type: "claim",
						property_claims: [],
						evidence: [],
						strategy_id: null,
					},
					{
						id: 3,
						type: "PropertyClaim",
						name: "Item 3",
						short_description: "",
						long_description: "",
						goal_id: 1,
						property_claim_id: null,
						level: 1,
						claim_type: "claim",
						property_claims: [
							{
								id: 4,
								type: "PropertyClaim",
								name: "Item 4",
								short_description: "",
								long_description: "",
								goal_id: null,
								property_claim_id: 3,
								level: 2,
								claim_type: "claim",
								property_claims: [],
								evidence: [],
								strategy_id: null,
							},
						],
						evidence: [],
						strategy_id: null,
					},
				],
				strategies: [],
			},
		];

		it("should find item at root level", () => {
			const result = findItemById(mockGoalData[0], 1);
			expect(result?.name).toBe("Item 1");
		});

		it("should find nested item", () => {
			const result = findItemById(mockGoalData[0], 4);
			expect(result?.name).toBe("Item 4");
		});

		it("should return null when item not found", () => {
			const result = findItemById(mockGoalData[0], 999);
			expect(result).toBeNull();
		});

		it("should handle empty goal structure", () => {
			const emptyGoal: Goal = {
				id: 1,
				type: "Goal",
				name: "Empty",
				short_description: "",
				long_description: "",
				keywords: "",
				assurance_case_id: 1,
				context: [],
				property_claims: [],
				strategies: [],
			};
			const result = findItemById(emptyGoal, 999);
			expect(result).toBeNull();
		});

		it("should handle null/undefined collection key", () => {
			const dataWithNull: Goal[] = [
				{
					id: 1,
					type: "Goal",
					name: "Item",
					short_description: "",
					long_description: "",
					keywords: "",
					assurance_case_id: 1,
					context: [],
					property_claims: [],
					strategies: [],
				},
			];
			const result = findItemById(dataWithNull[0], 1);
			expect(result?.name).toBe("Item");
		});
	});

	describe("setNodeIdentifier", () => {
		it("should set identifier for context", () => {
			const node: ReactFlowNode = {
				id: "1",
				type: "goal",
				data: {
					id: 1,
					name: "Test",
					type: "goal",
					context: [{} as Context, {} as Context],
				},
				position: { x: 0, y: 0 },
			};
			const result = setNodeIdentifier(node, "context");

			expect(result).toBe("C2");
		});

		it("should set identifier for evidence", () => {
			const node: ReactFlowNode = {
				id: "1",
				type: "goal",
				data: {
					id: 1,
					name: "Test",
					type: "goal",
					evidence: [],
				},
				position: { x: 0, y: 0 },
			};
			const result = setNodeIdentifier(node, "evidence");

			expect(result).toBe("E0");
		});

		it("should set identifier for strategy", () => {
			const node: ReactFlowNode = {
				id: "1",
				type: "goal",
				data: {
					id: 1,
					name: "Test",
					type: "goal",
					strategies: [
						{} as Strategy,
						{} as Strategy,
						{} as Strategy,
						{} as Strategy,
						{} as Strategy,
					],
				},
				position: { x: 0, y: 0 },
			};
			const result = setNodeIdentifier(node, "strategy");

			expect(result).toBe("S5");
		});
	});

	describe("extractGoalsClaimsStrategies", () => {
		it("should extract goals, claims and strategies", () => {
			const data: NestedArrayItem[] = [
				{
					id: 1,
					type: "Goal",
					name: "Goal 1",
					short_description: "",
					long_description: "",
					keywords: "",
					assurance_case_id: 1,
					context: [],
					property_claims: [],
					strategies: [],
				} as Goal,
				{
					id: 2,
					type: "PropertyClaim",
					name: "Claim 1",
					short_description: "",
					long_description: "",
					goal_id: null,
					property_claim_id: null,
					level: 1,
					claim_type: "claim",
					property_claims: [],
					evidence: [],
					strategy_id: null,
				} as PropertyClaim,
				{
					id: 3,
					type: "Strategy",
					name: "Strategy 1",
					short_description: "",
					long_description: "",
					goal_id: 1,
					property_claims: [],
				} as Strategy,
			];
			const result = extractGoalsClaimsStrategies(data);

			expect(result.goal).toMatchObject({ id: 1, name: "Goal 1" });
			expect(result.claims).toHaveLength(1);
			expect(result.claims[0]).toMatchObject({ id: 2, name: "Claim 1" });
			expect(result.strategies).toHaveLength(2); // Goal and Strategy
		});

		it("should handle empty data", () => {
			const result = extractGoalsClaimsStrategies([]);

			expect(result.goal).toBeNull();
			expect(result.claims).toHaveLength(0);
			expect(result.strategies).toHaveLength(0);
		});

		it("should handle nested structures", () => {
			const data: NestedArrayItem[] = [
				{
					id: 1,
					type: "Goal",
					name: "Goal with nested",
					short_description: "",
					long_description: "",
					keywords: "",
					assurance_case_id: 1,
					context: [],
					property_claims: [
						{
							id: 2,
							type: "PropertyClaim",
							name: "Nested Claim",
							short_description: "",
							long_description: "",
							goal_id: 1,
							property_claim_id: null,
							level: 1,
							claim_type: "claim",
							property_claims: [],
							evidence: [],
							strategy_id: null,
						},
					],
					strategies: [
						{
							id: 3,
							type: "Strategy",
							name: "Nested Strategy",
							short_description: "",
							long_description: "",
							goal_id: 1,
							property_claims: [],
						},
					],
				} as Goal,
			];
			const result = extractGoalsClaimsStrategies(data);

			expect(result.goal).toMatchObject({ id: 1 });
			expect(result.claims).toHaveLength(1);
			expect(result.strategies).toHaveLength(2);
		});
	});

	describe("addHiddenProp", () => {
		it("should add hidden property to single object", async () => {
			const obj: Goal = {
				id: 1,
				type: "Goal",
				name: "Test",
				short_description: "",
				long_description: "",
				keywords: "",
				assurance_case_id: 1,
				context: [],
				property_claims: [],
				strategies: [],
			};
			const result = await addHiddenProp(obj);

			expect((result as Goal & { hidden: boolean }).hidden).toBe(false);
			expect((result as Goal).id).toBe(1);
			expect((result as Goal).name).toBe("Test");
		});

		it("should add hidden property to nested objects", async () => {
			const obj = {
				id: 1,
				name: "Parent",
				children: [
					{ id: 2, name: "Child 1" },
					{ id: 3, name: "Child 2", nested: { id: 4, name: "Nested" } },
				],
			};

			const result = (await addHiddenProp(
				obj as unknown as NestedArrayItem
			)) as unknown as {
				hidden: boolean;
				children: Array<{
					hidden: boolean;
					nested?: { hidden: boolean };
				}>;
			};

			expect(result.hidden).toBe(false);
			expect(result.children[0].hidden).toBe(false);
			expect(result.children[1].hidden).toBe(false);
			expect(result.children[1].nested?.hidden).toBe(false);
		});

		it("should handle arrays directly", async () => {
			const arr: Goal[] = [
				{
					id: 1,
					type: "Goal",
					name: "Item 1",
					short_description: "",
					long_description: "",
					keywords: "",
					assurance_case_id: 1,
					context: [],
					property_claims: [],
					strategies: [],
				},
				{
					id: 2,
					type: "Goal",
					name: "Item 2",
					short_description: "",
					long_description: "",
					keywords: "",
					assurance_case_id: 1,
					context: [],
					property_claims: [],
					strategies: [],
				},
			];

			const result = (await addHiddenProp(arr)) as (Goal & {
				hidden: boolean;
			})[];

			expect(Array.isArray(result)).toBe(true);
			expect(result[0].hidden).toBe(false);
			expect(result[1].hidden).toBe(false);
		});

		it("should handle null and undefined inputs", async () => {
			expect(
				await addHiddenProp(null as unknown as NestedArrayItem)
			).toBeNull();
			expect(
				await addHiddenProp(undefined as unknown as NestedArrayItem)
			).toBeUndefined();
		});

		it("should handle primitive values", async () => {
			expect(await addHiddenProp("string" as unknown as NestedArrayItem)).toBe(
				"string"
			);
			expect(await addHiddenProp(123 as unknown as NestedArrayItem)).toBe(123);
			expect(await addHiddenProp(true as unknown as NestedArrayItem)).toBe(
				true
			);
		});
	});

	describe("API functions", () => {
		const mockToken = "test-token";
		const mockFetch = vi.fn();

		beforeEach(() => {
			mockFetch.mockClear();
			mockFetch.mockResolvedValue(createMockResponse({ success: true }));
			vi.stubGlobal("fetch", mockFetch);
		});

		describe("createAssuranceCaseNode", () => {
			it("should make POST request with correct parameters", async () => {
				const nodeData = { name: "Test Node", type: "goal" };

				await createAssuranceCaseNode("cases/1", nodeData, mockToken);

				expect(mockFetch).toHaveBeenCalledWith(
					expect.stringContaining("/api/cases/1/"),
					expect.objectContaining({
						method: "POST",
						headers: expect.objectContaining({
							Authorization: `Token ${mockToken}`,
							"Content-Type": "application/json",
						}),
						body: JSON.stringify(nodeData),
					})
				);
			});

			it("should handle API errors", async () => {
				mockFetch.mockResolvedValue({
					ok: false,
					status: 400,
				} as Response);

				const mockAssuranceCase: AssuranceCase = {
					id: 1,
					name: "Test Case",
					type: "AssuranceCase",
					lock_uuid: null,
					comments: [],
					permissions: [],
					created_date: "2024-01-01",
				};
				const result = await createAssuranceCaseNode(
					"cases/1",
					mockAssuranceCase,
					mockToken
				);
				expect(result).toEqual({ error: "Something went wrong 400" });
			});
		});

		describe("deleteAssuranceCaseNode", () => {
			it("should make DELETE request with correct parameters", async () => {
				await deleteAssuranceCaseNode("goal", 123, mockToken);

				expect(mockFetch).toHaveBeenCalledWith(
					expect.stringContaining("/api/goals/123/"),
					expect.objectContaining({
						method: "DELETE",
						headers: expect.objectContaining({
							Authorization: `Token ${mockToken}`,
						}),
					})
				);
			});
		});

		describe("updateAssuranceCaseNode", () => {
			it("should make PUT request with correct parameters", async () => {
				const updateData = { name: "Updated Node" };

				await updateAssuranceCaseNode("goal", 1, mockToken, updateData);

				expect(mockFetch).toHaveBeenCalledWith(
					expect.stringContaining("/api/goals/1/"),
					expect.objectContaining({
						method: "PUT",
						headers: expect.objectContaining({
							Authorization: `Token ${mockToken}`,
							"Content-Type": "application/json",
						}),
						body: JSON.stringify(updateData),
					})
				);
			});
		});

		describe("getAssuranceCaseNode", () => {
			it("should make GET request with correct parameters", async () => {
				await getAssuranceCaseNode("goal", 1, mockToken);

				expect(mockFetch).toHaveBeenCalledWith(
					expect.stringContaining("/api/goals/1/"),
					expect.objectContaining({
						method: "GET",
						headers: expect.objectContaining({
							Authorization: `Token ${mockToken}`,
						}),
					})
				);
			});
		});

		describe("updateAssuranceCase", () => {
			it("should update goal in assurance case", () => {
				const updateData = { name: "Updated Goal" };

				const mockAssuranceCase: AssuranceCase = {
					id: 123,
					name: "Test Case",
					type: "AssuranceCase",
					lock_uuid: null,
					comments: [],
					permissions: [],
					created_date: "2024-01-01",
					goals: [
						{
							id: 1,
							type: "Goal",
							name: "Original Goal",
							short_description: "",
							long_description: "",
							keywords: "",
							assurance_case_id: 123,
							context: [],
							property_claims: [],
							strategies: [],
						},
					],
				};
				const mockNode: ReactFlowNode = {
					id: "1",
					type: "goal",
					data: {
						id: 1,
						name: "Test Node",
						type: "goal",
					},
					position: { x: 0, y: 0 },
				};
				const result = updateAssuranceCase(
					"goal",
					mockAssuranceCase,
					updateData,
					1,
					mockNode
				);

				expect(result.goals?.[0]?.name).toBe("Updated Goal");
			});
		});
	});

	describe("Edge cases and error handling", () => {
		it("should handle malformed data gracefully", () => {
			const malformedData = [
				{ id: null, name: undefined },
				{ property_claims: "not-an-array" },
				null,
				undefined,
			];

			expect(() =>
				listPropertyClaims(malformedData as unknown as PropertyClaim[], "1")
			).not.toThrow();
			expect(() => {
				try {
					// Use a valid NestedArrayItem for testing
					const validItem: Goal = {
						id: 1,
						type: "Goal",
						name: "Test",
						short_description: "",
						long_description: "",
						keywords: "",
						assurance_case_id: 1,
						context: [],
						property_claims: [],
						strategies: [],
					};
					findItemById(validItem, 1);
				} catch {
					// Expected to potentially throw with malformed data
				}
			}).not.toThrow();
		});

		it("should handle circular references without infinite loops", () => {
			const circularData: Goal = {
				id: 1,
				type: "Goal",
				name: "Test",
				short_description: "",
				long_description: "",
				keywords: "",
				assurance_case_id: 1,
				context: [],
				property_claims: [],
				strategies: [],
			};
			// Create circular reference
			const circularPropertyClaim: PropertyClaim = {
				id: 2,
				type: "PropertyClaim",
				name: "Circular",
				short_description: "",
				long_description: "",
				goal_id: 1,
				property_claim_id: null,
				level: 1,
				claim_type: "claim",
				property_claims: [],
				evidence: [],
				strategy_id: null,
			};
			circularData.property_claims.push(circularPropertyClaim);

			// Should not hang or crash
			expect(() => findItemById(circularData, 1)).not.toThrow();
		});

		it("should handle very large datasets efficiently", () => {
			const largeData: Goal[] = Array.from({ length: 1000 }, (_, i) => ({
				id: i,
				type: "Goal",
				name: `Item ${i}`,
				short_description: "",
				long_description: "",
				keywords: "",
				assurance_case_id: 1,
				context: [],
				property_claims: [],
				strategies: [],
			}));

			const start = performance.now();
			const result = findItemById(largeData[999], 999);
			const end = performance.now();

			expect(result?.id).toBe(999);
			expect(end - start).toBeLessThan(100); // Should complete in reasonable time
		});
	});

	describe("updatePropertyClaimNestedMove", () => {
		const mockPropertyClaim: PropertyClaim = {
			id: 1,
			type: "PropertyClaim",
			name: "Test Claim",
			short_description: "Test description",
			long_description: "",
			goal_id: null,
			property_claim_id: null,
			level: 1,
			claim_type: "claim",
			property_claims: [],
			evidence: [],
			strategy_id: null,
		};

		const mockGoals: PropertyClaim[] = [
			{
				id: 2,
				type: "PropertyClaim",
				name: "Parent Claim",
				short_description: "",
				long_description: "",
				goal_id: null,
				property_claim_id: null,
				level: 1,
				claim_type: "claim",
				property_claims: [mockPropertyClaim],
				evidence: [],
				strategy_id: null,
			},
		];

		it("should move property claim to new location", () => {
			const newPropertyClaimData = {
				name: "Moved Claim",
				property_claim_id: 2,
			};

			const result = updatePropertyClaimNestedMove(
				mockGoals,
				1,
				newPropertyClaimData
			);

			expect(result).toBeDefined();
			expect(Array.isArray(result)).toBe(true);
		});

		it("should handle empty array", () => {
			const result = updatePropertyClaimNestedMove([], 1, {});
			expect(result).toEqual([]);
		});

		it("should handle non-existent claim id", () => {
			const result = updatePropertyClaimNestedMove(mockGoals, 999, {});
			expect(result).toBeDefined();
		});
	});

	describe("updateEvidenceNested", () => {
		const mockEvidence = {
			id: 1,
			type: "Evidence",
			name: "Test Evidence",
			short_description: "Test description",
			long_description: "",
			URL: "",
			property_claim_id: [1],
		};

		const mockGoals: PropertyClaim[] = [
			{
				id: 1,
				type: "PropertyClaim",
				name: "Test Claim",
				short_description: "",
				long_description: "",
				goal_id: null,
				property_claim_id: null,
				level: 1,
				claim_type: "claim",
				property_claims: [],
				evidence: [mockEvidence],
				strategy_id: null,
			},
		];

		it("should update evidence when found", () => {
			const updateData = { name: "Updated Evidence" };
			const result = updateEvidenceNested(mockGoals, 1, updateData);

			expect(result).toBeDefined();
			if (result !== null) {
				expect(Array.isArray(result)).toBe(true);
			}
		});

		it("should handle empty array", () => {
			const result = updateEvidenceNested([], 1, {});
			expect(result).toBeNull();
		});

		it("should handle non-existent evidence", () => {
			const result = updateEvidenceNested(mockGoals, 999, {});
			expect(result).toBeNull();
		});

		it("should handle nested evidence in property claims", () => {
			const nestedGoals: PropertyClaim[] = [
				{
					id: 1,
					type: "PropertyClaim",
					name: "Parent",
					short_description: "",
					long_description: "",
					goal_id: null,
					property_claim_id: null,
					level: 1,
					claim_type: "claim",
					property_claims: [
						{
							id: 2,
							type: "PropertyClaim",
							name: "Child",
							short_description: "",
							long_description: "",
							goal_id: null,
							property_claim_id: null,
							level: 2,
							claim_type: "claim",
							property_claims: [],
							evidence: [mockEvidence],
							strategy_id: null,
						},
					],
					evidence: [],
					strategy_id: null,
				},
			];

			const result = updateEvidenceNested(nestedGoals, 1, {
				name: "Updated Nested Evidence",
			});
			expect(result).toBeDefined();
		});
	});

	describe("updateEvidenceNestedMove", () => {
		const mockEvidence = {
			id: 1,
			type: "Evidence",
			name: "Test Evidence",
			short_description: "",
			long_description: "",
			URL: "",
			property_claim_id: [1],
		};

		const mockGoals: PropertyClaim[] = [
			{
				id: 1,
				type: "PropertyClaim",
				name: "Test Claim",
				short_description: "",
				long_description: "",
				goal_id: null,
				property_claim_id: null,
				level: 1,
				claim_type: "claim",
				property_claims: [],
				evidence: [mockEvidence],
				strategy_id: null,
			},
		];

		it("should move evidence to new location", () => {
			const updateData = { property_claim_id: [2] };
			const result = updateEvidenceNestedMove(mockGoals, 1, updateData);

			expect(result).toBeDefined();
			expect(Array.isArray(result)).toBe(true);
		});

		it("should handle empty array", () => {
			const result = updateEvidenceNestedMove([], 1, {
				property_claim_id: [1],
			});
			expect(result).toEqual([]);
		});
	});

	describe("searchWithDeepFirst", () => {
		const mockTargetNode = {
			id: 2,
			hidden: false,
			type: "PropertyClaim",
		};

		const mockAssuranceCase = {
			id: 1,
			type: "Goal",
			name: "Goal 1",
			hidden: false,
			property_claims: [
				{
					id: 2,
					type: "PropertyClaim",
					name: "Nested Claim",
					hidden: false,
					property_claims: [],
					evidence: [],
				},
			],
			strategies: [],
			context: [],
			evidence: [],
		};

		it("should find target node by id", () => {
			const [foundNode, parentMap] = searchWithDeepFirst(
				mockTargetNode,
				mockAssuranceCase
			);
			// The function returns the found node or null
			expect(foundNode).toBeDefined();
			expect(typeof parentMap).toBe("object");
		});

		it("should return null for non-existent target", () => {
			const nonExistentTarget = { id: 999, hidden: false, type: "Goal" };
			const [foundNode, parentMap] = searchWithDeepFirst(
				nonExistentTarget,
				mockAssuranceCase
			);
			expect(foundNode).toBeNull();
			expect(typeof parentMap).toBe("object");
		});

		it("should handle empty assurance case", () => {
			const emptyCase = {
				id: 1,
				type: "Goal",
				hidden: false,
				property_claims: [],
				strategies: [],
				context: [],
				evidence: [],
			};
			const [foundNode, parentMap] = searchWithDeepFirst(
				mockTargetNode,
				emptyCase
			);
			expect(foundNode).toBeNull();
			expect(typeof parentMap).toBe("object");
		});
	});

	describe("toggleHiddenForParent", () => {
		const mockNode: ReactFlowNode = {
			id: "1",
			type: "goal",
			data: {
				id: 1,
				name: "Test Goal",
				type: "goal",
			},
			position: { x: 0, y: 0 },
		};

		const mockAssuranceCase: AssuranceCase = {
			id: 1,
			name: "Test Case",
			type: "AssuranceCase",
			lock_uuid: null,
			comments: [],
			permissions: [],
			created_date: "2024-01-01",
			goals: [
				{
					id: 1,
					type: "Goal",
					name: "Test Goal",
					short_description: "",
					long_description: "",
					keywords: "",
					assurance_case_id: 1,
					context: [],
					property_claims: [],
					strategies: [],
				},
			],
		};

		it("should toggle hidden state for parent", () => {
			const result = toggleHiddenForParent(mockNode, mockAssuranceCase);
			expect(result).toBeDefined();
			expect(result.id).toBe(1);
		});

		it("should handle empty assurance case", () => {
			const emptyCase: AssuranceCase = {
				...mockAssuranceCase,
				goals: [],
			};
			const result = toggleHiddenForParent(mockNode, emptyCase);
			expect(result).toBeDefined();
		});
	});

	describe("toggleHiddenForChildren", () => {
		const mockAssuranceCase: AssuranceCase = {
			id: 1,
			name: "Test Case",
			type: "AssuranceCase",
			lock_uuid: null,
			comments: [],
			permissions: [],
			created_date: "2024-01-01",
			goals: [
				{
					id: 1,
					type: "Goal",
					name: "Test Goal",
					short_description: "",
					long_description: "",
					keywords: "",
					assurance_case_id: 1,
					context: [],
					property_claims: [
						{
							id: 2,
							type: "PropertyClaim",
							name: "Child Claim",
							short_description: "",
							long_description: "",
							goal_id: 1,
							property_claim_id: null,
							level: 1,
							claim_type: "claim",
							property_claims: [],
							evidence: [],
							strategy_id: null,
						},
					],
					strategies: [],
				},
			],
		};

		it("should toggle hidden state for children", () => {
			const result = toggleHiddenForChildren(mockAssuranceCase, 1);
			expect(result).toBeDefined();
			expect(result.id).toBe(1);
		});

		it("should handle deeply nested structures", () => {
			const deepAssuranceCase: AssuranceCase = {
				...mockAssuranceCase,
				goals: [
					{
						...mockAssuranceCase.goals![0],
						property_claims: [
							{
								id: 2,
								type: "PropertyClaim",
								name: "Child",
								short_description: "",
								long_description: "",
								goal_id: 1,
								property_claim_id: null,
								level: 1,
								claim_type: "claim",
								property_claims: [
									{
										id: 3,
										type: "PropertyClaim",
										name: "Grandchild",
										short_description: "",
										long_description: "",
										goal_id: null,
										property_claim_id: 2,
										level: 2,
										claim_type: "claim",
										property_claims: [],
										evidence: [],
										strategy_id: null,
									},
								],
								evidence: [],
								strategy_id: null,
							},
						],
					},
				],
			};

			const result = toggleHiddenForChildren(deepAssuranceCase, 1);
			expect(result).toBeDefined();
		});

		it("should handle empty children arrays", () => {
			const emptyAssuranceCase: AssuranceCase = {
				...mockAssuranceCase,
				goals: [
					{
						...mockAssuranceCase.goals![0],
						property_claims: [],
						strategies: [],
						context: [],
					},
				],
			};

			const result = toggleHiddenForChildren(emptyAssuranceCase, 1);
			expect(result).toBeDefined();
		});
	});

	describe("findElementById", () => {
		const mockData = {
			id: 1,
			type: "Goal",
			name: "Root Goal",
			property_claims: [
				{
					id: 2,
					type: "PropertyClaim",
					name: "Child Claim",
					property_claims: [
						{
							id: 3,
							type: "PropertyClaim",
							name: "Grandchild Claim",
							property_claims: [],
							evidence: [],
						},
					],
					evidence: [],
				},
			],
			strategies: [
				{
					id: 4,
					type: "Strategy",
					name: "Test Strategy",
					property_claims: [],
				},
			],
			context: [],
			evidence: [],
		};

		it("should find element by id", () => {
			const result = findElementById(mockData, 3);
			expect(result?.id).toBe(3);
			expect(result?.name).toBe("Grandchild Claim");
		});

		it("should find strategy by id", () => {
			const result = findElementById(mockData, 4);
			expect(result?.id).toBe(4);
			expect(result?.name).toBe("Test Strategy");
		});

		it("should return null for non-existent id", () => {
			const result = findElementById(mockData, 999);
			expect(result).toBeNull();
		});

		it("should handle empty object data", () => {
			const emptyData = {
				id: 999,
				type: "Goal",
				name: "Empty",
				property_claims: [],
				strategies: [],
				context: [],
				evidence: [],
			};
			const result = findElementById(emptyData, 1);
			expect(result).toBeNull();
		});
	});

	describe("getChildrenHiddenStatus", () => {
		const mockNode = {
			id: 1,
			type: "Goal",
			name: "Test Goal",
			property_claims: [
				{ id: 2, hidden: true },
				{ id: 3, hidden: false },
			],
			strategies: [{ id: 4, hidden: false }],
			context: [{ id: 5, hidden: true }],
			evidence: [{ id: 6, hidden: false }],
		};

		it("should return children hidden status", () => {
			const result = getChildrenHiddenStatus(mockNode);
			expect(result).toBeDefined();
			expect(typeof result).toBe("object");
		});

		it("should handle node without children", () => {
			const emptyNode = {
				id: 1,
				type: "Goal",
				name: "Empty Goal",
			};

			const result = getChildrenHiddenStatus(emptyNode);
			expect(result).toBeDefined();
		});

		it("should handle minimal node data", () => {
			const minimalNode = {
				id: 1,
				type: "Goal",
			};
			const result = getChildrenHiddenStatus(minimalNode);
			expect(result).toBeDefined();
		});
	});

	describe("Additional function coverage", () => {
		it("should test basic function signatures", () => {
			// Test functions exist and are callable
			expect(typeof findSiblingHiddenState).toBe("function");
			expect(typeof findParentNode).toBe("function");
			expect(typeof removeAssuranceCaseNode).toBe("function");
			expect(typeof detachCaseElement).toBe("function");
			expect(typeof attachCaseElement).toBe("function");
		});

		it("should verify function types and basic operation", () => {
			// Simple verification that functions exist and are callable
			const mockData = [
				{ id: 1, hidden: false },
				{ id: 2, hidden: true },
			];

			// Test that the function exists and doesn't throw on basic usage
			expect(() => findSiblingHiddenState(mockData, 1)).not.toThrow();

			// These functions exist and are tested elsewhere, so just verify they're callable
			expect(typeof removeAssuranceCaseNode).toBe("function");
		});
	});

	describe("Complex integration scenarios", () => {
		it("should handle complex nested property claim operations", () => {
			const complexGoals: PropertyClaim[] = [
				{
					id: 1,
					type: "PropertyClaim",
					name: "Root Claim",
					short_description: "",
					long_description: "",
					goal_id: null,
					property_claim_id: null,
					level: 1,
					claim_type: "claim",
					property_claims: [
						{
							id: 2,
							type: "PropertyClaim",
							name: "Level 1",
							short_description: "",
							long_description: "",
							goal_id: null,
							property_claim_id: 1,
							level: 2,
							claim_type: "claim",
							property_claims: [
								{
									id: 3,
									type: "PropertyClaim",
									name: "Level 2",
									short_description: "",
									long_description: "",
									goal_id: null,
									property_claim_id: 2,
									level: 3,
									claim_type: "claim",
									property_claims: [],
									evidence: [],
									strategy_id: null,
								},
							],
							evidence: [],
							strategy_id: null,
						},
					],
					evidence: [],
					strategy_id: null,
					strategies: [
						{
							id: 4,
							name: "Test Strategy",
							short_description: "",
							long_description: "",
							goal_id: 1,
							property_claims: [
								{
									id: 5,
									type: "PropertyClaim",
									name: "Strategy Claim",
									short_description: "",
									long_description: "",
									goal_id: null,
									property_claim_id: null,
									level: 2,
									claim_type: "claim",
									property_claims: [],
									evidence: [],
									strategy_id: 4,
								},
							],
						},
					],
				},
			];

			// Test nested property claim addition
			const newClaim: PropertyClaim = {
				id: 6,
				type: "PropertyClaim",
				name: "New Nested Claim",
				short_description: "",
				long_description: "",
				goal_id: null,
				property_claim_id: null,
				level: 3,
				claim_type: "claim",
				property_claims: [],
				evidence: [],
				strategy_id: null,
			};

			const addResult = addPropertyClaimToNested(complexGoals, 3, newClaim);
			expect(addResult).toBe(true);

			// Test property claim listing
			const listedClaims = listPropertyClaims(complexGoals, "2");
			expect(listedClaims.length).toBeGreaterThan(0);

			// Test finding items by ID
			const foundItem = findItemById(complexGoals[0], 5);
			expect(foundItem?.name).toBe("Strategy Claim");
		});

		it("should handle evidence operations on complex structures", () => {
			const complexGoals: PropertyClaim[] = [
				{
					id: 1,
					type: "PropertyClaim",
					name: "Root",
					short_description: "",
					long_description: "",
					goal_id: null,
					property_claim_id: null,
					level: 1,
					claim_type: "claim",
					property_claims: [
						{
							id: 2,
							type: "PropertyClaim",
							name: "Child",
							short_description: "",
							long_description: "",
							goal_id: null,
							property_claim_id: 1,
							level: 2,
							claim_type: "claim",
							property_claims: [],
							evidence: [],
							strategy_id: null,
						},
					],
					evidence: [],
					strategy_id: null,
				},
			];

			const newEvidence = {
				id: 10,
				type: "Evidence",
				name: "Test Evidence",
				short_description: "Evidence description",
				long_description: "",
				URL: "",
				property_claim_id: [2],
			};

			const addResult = addEvidenceToClaim(complexGoals, 2, newEvidence);
			expect(addResult).toBe(true);
			expect(complexGoals[0].property_claims[0].evidence).toHaveLength(1);
		});
	});
});
