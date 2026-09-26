import { describe, expect, it } from "vitest";
import type { CaseExportNested } from "@/lib/schemas/case-export";
import { caseExportToAssuranceCase } from "../case-export-to-assurance-case";

const NOT_A_GOAL_PATTERN = /Expected a GOAL/;
const UNSUPPORTED_CHILD_PATTERN = /Unsupported child type/;

function nestedCase(tree: CaseExportNested["tree"]): CaseExportNested {
	return {
		version: "1.0",
		exportedAt: "2025-12-17T10:00:00.000Z",
		case: { name: "Fair Recruitment AI System", description: "A case" },
		tree,
	};
}

describe("caseExportToAssuranceCase", () => {
	it("converts a goal-only tree and sets view-only permissions", () => {
		const result = caseExportToAssuranceCase(
			nestedCase({
				id: "g1",
				type: "GOAL",
				name: "G1",
				description: "The goal",
				inSandbox: false,
				context: ["Some scope"],
				children: [],
			})
		);

		expect(result.permissions).toBe("view");
		expect(result.goals).toHaveLength(1);
		expect(result.goals?.[0]).toMatchObject({
			id: "g1",
			name: "G1",
			description: "The goal",
			context: ["Some scope"],
			strategies: [],
			propertyClaims: [],
		});
	});

	it("nests strategies, property claims (including nested claims) and evidence", () => {
		const result = caseExportToAssuranceCase(
			nestedCase({
				id: "g1",
				type: "GOAL",
				name: "G1",
				description: "The goal",
				inSandbox: false,
				children: [
					{
						id: "s1",
						type: "STRATEGY",
						name: "S1",
						description: "The strategy",
						inSandbox: false,
						children: [
							{
								id: "p1",
								type: "PROPERTY_CLAIM",
								name: "P1",
								description: "The claim",
								inSandbox: false,
								level: 1,
								children: [
									{
										id: "p1a",
										type: "PROPERTY_CLAIM",
										name: "P1a",
										description: "A nested claim",
										inSandbox: false,
										level: 2,
										children: [],
									},
									{
										id: "e1",
										type: "EVIDENCE",
										name: "E1",
										description: "The evidence",
										inSandbox: false,
										url: "https://example.com/e1",
										children: [],
									},
								],
							},
						],
					},
				],
			})
		);

		const goal = result.goals?.[0];
		expect(goal?.strategies).toHaveLength(1);
		const strategy = goal?.strategies[0];
		expect(strategy?.propertyClaims).toHaveLength(1);
		const claim = strategy?.propertyClaims[0];
		expect(claim?.propertyClaims).toHaveLength(1);
		expect(claim?.propertyClaims[0]).toMatchObject({ id: "p1a", name: "P1a" });
		expect(claim?.evidence).toHaveLength(1);
		expect(claim?.evidence[0]).toMatchObject({
			id: "e1",
			URL: "https://example.com/e1",
		});
	});

	it("throws when the root of the tree is not a goal", () => {
		expect(() =>
			caseExportToAssuranceCase(
				nestedCase({
					id: "s1",
					type: "STRATEGY",
					name: "S1",
					description: "Not a goal",
					inSandbox: false,
					children: [],
				})
			)
		).toThrow(NOT_A_GOAL_PATTERN);
	});

	it("throws on a child type it cannot place under a goal", () => {
		expect(() =>
			caseExportToAssuranceCase(
				nestedCase({
					id: "g1",
					type: "GOAL",
					name: "G1",
					description: "The goal",
					inSandbox: false,
					children: [
						{
							id: "e1",
							type: "EVIDENCE",
							name: "E1",
							description: "Evidence directly under a goal",
							inSandbox: false,
							children: [],
						},
					],
				})
			)
		).toThrow(UNSUPPORTED_CHILD_PATTERN);
	});

	it("throws on a child type it cannot place under a strategy", () => {
		expect(() =>
			caseExportToAssuranceCase(
				nestedCase({
					id: "g1",
					type: "GOAL",
					name: "G1",
					description: "The goal",
					inSandbox: false,
					children: [
						{
							id: "s1",
							type: "STRATEGY",
							name: "S1",
							description: "The strategy",
							inSandbox: false,
							children: [
								{
									id: "g2",
									type: "GOAL",
									name: "G2",
									description: "A goal nested under a strategy",
									inSandbox: false,
									children: [],
								},
							],
						},
					],
				})
			)
		).toThrow(UNSUPPORTED_CHILD_PATTERN);
	});

	it("throws on a child type it cannot place under a property claim", () => {
		expect(() =>
			caseExportToAssuranceCase(
				nestedCase({
					id: "g1",
					type: "GOAL",
					name: "G1",
					description: "The goal",
					inSandbox: false,
					children: [
						{
							id: "p1",
							type: "PROPERTY_CLAIM",
							name: "P1",
							description: "The claim",
							inSandbox: false,
							level: 1,
							children: [
								{
									id: "s1",
									type: "STRATEGY",
									name: "S1",
									description: "A strategy nested under a claim",
									inSandbox: false,
									children: [],
								},
							],
						},
					],
				})
			)
		).toThrow(UNSUPPORTED_CHILD_PATTERN);
	});
});
