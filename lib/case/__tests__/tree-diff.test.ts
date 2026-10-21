import { describe, expect, it } from "vitest";
import type { CaseExportNested, TreeNode } from "@/lib/schemas/case-export";
import { computeTreeDiff } from "../tree-diff";

const GOAL_ID = "00000000-0000-4000-8000-000000000001";
const NAMED_ENTRY = {
	id: "k3f9x2m7qa",
	name: "window",
	text: "the interval",
	value: "5 minutes",
};

function exportWith(context: TreeNode["context"]): CaseExportNested {
	return {
		version: "1.1",
		exportedAt: "2026-10-19T00:00:00.000Z",
		case: { name: "Case", description: "" },
		tree: {
			id: GOAL_ID,
			type: "GOAL",
			name: "G1",
			description: "Goal",
			inSandbox: false,
			context,
			children: [],
		},
	};
}

describe("computeTreeDiff and context", () => {
	it("sends no update for named entries that did not change, whatever their key order", () => {
		const current = exportWith(["plain", NAMED_ENTRY]);
		const reordered = exportWith([
			"plain",
			{
				value: "5 minutes",
				text: "the interval",
				name: "window",
				id: "k3f9x2m7qa",
			},
		]);

		const { changes } = computeTreeDiff(current, reordered);

		expect(changes).toEqual([]);
	});

	it("sends the whole context list when a named entry's text changes", () => {
		const edited = exportWith([
			"plain",
			{ ...NAMED_ENTRY, text: "a new meaning" },
		]);

		const { changes } = computeTreeDiff(
			exportWith(["plain", NAMED_ENTRY]),
			edited
		);

		expect(changes).toEqual([
			{
				type: "update",
				elementId: GOAL_ID,
				data: { context: ["plain", { ...NAMED_ENTRY, text: "a new meaning" }] },
			},
		]);
	});

	it("sends an update when a plain entry becomes a named one", () => {
		const { changes } = computeTreeDiff(
			exportWith(["window"]),
			exportWith([NAMED_ENTRY])
		);

		expect(changes).toHaveLength(1);
	});
});

/**
 * The export shows what hangs from shared evidence E (a counter-goal CG, its
 * claim CGP, and the evidence E3 under that claim) under the first claim A that
 * links it; under claim B the evidence is a leaf.
 */
describe("computeTreeDiff and what hangs from shared evidence", () => {
	const node = (
		id: string,
		type: TreeNode["type"],
		children: TreeNode[] = [],
		extra: Partial<TreeNode> = {}
	): TreeNode => ({
		id,
		type,
		name: id,
		description: id,
		inSandbox: false,
		children,
		...extra,
	});
	const counterGoal = () =>
		node(
			"CG",
			"GOAL",
			[node("CGP", "PROPERTY_CLAIM", [node("E3", "EVIDENCE")])],
			{ isDefeater: true }
		);
	const claim = (id: string, evidence: TreeNode[]) =>
		node(id, "PROPERTY_CLAIM", evidence);
	const caseOf = (claims: TreeNode[]): CaseExportNested => ({
		version: "1.1",
		exportedAt: "2026-10-21T00:00:00.000Z",
		case: { name: "Case", description: "" },
		tree: node("G1", "GOAL", claims),
	});
	const current = caseOf([
		claim("A", [node("E", "EVIDENCE", [counterGoal()])]),
		claim("B", [node("E", "EVIDENCE")]),
	]);
	const deletedBy = (edited: CaseExportNested) =>
		computeTreeDiff(current, edited)
			.changes.filter((change) => change.type === "delete")
			.map((change) => change.elementId)
			.sort();

	it.each([
		{
			label: "the claim that shows it is deleted",
			edited: caseOf([claim("B", [node("E", "EVIDENCE")])]),
			deleted: ["A"],
		},
		{
			label: "the evidence is removed from the claim that shows it",
			edited: caseOf([claim("A", []), claim("B", [node("E", "EVIDENCE")])]),
			deleted: [],
		},
	])("keeps the counter-goal, its claim and their evidence when $label", ({
		edited,
		deleted,
	}) => {
		const { changes } = computeTreeDiff(current, edited);

		expect(deletedBy(edited)).toEqual(deleted);
		expect(changes).toContainEqual({
			type: "unlink_evidence",
			evidenceId: "E",
			claimId: "A",
		});
		expect(
			changes.filter(
				(change) =>
					change.type === "unlink_evidence" && change.evidenceId === "E3"
			)
		).toEqual([]);
	});

	it.each([
		{
			label: "the counter-goal is removed from the copy that shows it",
			edited: caseOf([
				claim("A", [node("E", "EVIDENCE")]),
				claim("B", [node("E", "EVIDENCE")]),
			]),
			deleted: ["CG", "CGP", "E3"],
		},
		{
			label: "the evidence is removed from every claim",
			edited: caseOf([claim("A", []), claim("B", [])]),
			deleted: ["CG", "CGP", "E", "E3"],
		},
	])("still deletes what hangs from the evidence when $label", ({
		edited,
		deleted,
	}) => {
		expect(deletedBy(edited)).toEqual(deleted);
	});
});
