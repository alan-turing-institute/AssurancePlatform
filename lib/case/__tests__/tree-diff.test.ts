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
