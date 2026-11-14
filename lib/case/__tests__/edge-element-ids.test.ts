import { describe, expect, it } from "vitest";
import { convertAssuranceCase } from "../convert-case";
import { getHighlightedEdges } from "../edge-highlight";
import { getLayoutedElements } from "../layout-helper";

/** G1 supports S1 and P1; P1 holds sub-claim P2 and evidence E1 and E2. Node ids differ from element ids. */
const CASE = {
	id: "case-1",
	goals: [
		{
			id: "goal-uuid",
			name: "G1",
			type: "TopLevelNormativeGoal",
			strategies: [
				{
					id: "strategy-uuid",
					name: "S1",
					type: "Strategy",
					propertyClaims: [],
				},
			],
			propertyClaims: [
				{
					id: "claim-uuid",
					name: "P1",
					type: "PropertyClaim",
					propertyClaims: [
						{
							id: "subclaim-uuid",
							name: "P2",
							type: "PropertyClaim",
							evidence: [],
							propertyClaims: [],
						},
					],
					evidence: [
						{ id: "evidence-uuid-1", name: "E1", type: "Evidence" },
						{ id: "evidence-uuid-2", name: "E2", type: "Evidence" },
					],
				},
			],
		},
	],
} as never;

const EXPECTED = [
	["goal-uuid", "strategy-uuid"],
	["goal-uuid", "claim-uuid"],
	["claim-uuid", "subclaim-uuid"],
	["claim-uuid", "evidence-uuid-1"],
	["claim-uuid", "evidence-uuid-2"],
];

function pairsOf(
	edges: { data?: { sourceElementId?: string; targetElementId?: string } }[]
) {
	return edges
		.map((edge) => [edge.data?.sourceElementId, edge.data?.targetElementId])
		.sort((a, b) => String(a).localeCompare(String(b)));
}

describe("support edges carry the ids of the two elements they join", () => {
	it("names the parent and the child element, not their canvas node ids", () => {
		const { caseNodes, caseEdges } = convertAssuranceCase(CASE);

		expect(caseNodes.map((node) => node.id)).not.toContain("claim-uuid");
		expect(caseEdges).toHaveLength(EXPECTED.length);
		expect(pairsOf(caseEdges)).toEqual(
			[...EXPECTED].sort((a, b) => String(a).localeCompare(String(b)))
		);
		for (const edge of caseEdges) {
			expect(edge.type).toBe("support");
		}
	});

	it("keeps the ids once the edges have been laid out", async () => {
		const { caseNodes, caseEdges } = convertAssuranceCase(CASE);

		const laidOut = await getLayoutedElements(caseNodes, caseEdges, {
			direction: "TB",
		});

		expect(pairsOf(laidOut.edges)).toEqual(
			[...EXPECTED].sort((a, b) => String(a).localeCompare(String(b)))
		);
	});

	it("keeps the ids on an edge that is highlighted because its node is selected", () => {
		const { caseNodes, caseEdges } = convertAssuranceCase(CASE);
		const selected = caseNodes.map((node) => ({
			...node,
			selected: node.data.id === "claim-uuid",
		}));

		const edges = getHighlightedEdges(caseEdges, selected);

		expect(edges.some((edge) => edge.data?.highlighted)).toBe(true);
		expect(pairsOf(edges)).toEqual(
			[...EXPECTED].sort((a, b) => String(a).localeCompare(String(b)))
		);
	});

	it("has no ids on the edges of a case with no elements", () => {
		const { caseEdges } = convertAssuranceCase({
			id: "empty",
			goals: [],
		} as never);

		expect(caseEdges).toEqual([]);
	});
});
