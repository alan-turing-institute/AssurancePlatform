import { describe, expect, it } from "vitest";
import type { CaseExportNested, TreeNode } from "@/lib/schemas/case-export";
import { computeTreeDiff } from "../tree-diff";

const GOAL_ID = "00000000-0000-4000-8000-000000000001";
const CLAIM_ID = "00000000-0000-4000-8000-000000000002";
const HINT = "Say what the claim asserts";

function claim(fields: Partial<TreeNode> = {}): TreeNode {
	return {
		id: CLAIM_ID,
		type: "PROPERTY_CLAIM",
		name: "P1",
		description: "",
		inSandbox: false,
		level: 1,
		children: [],
		...fields,
	};
}

function exportWith(...children: TreeNode[]): CaseExportNested {
	return {
		version: "1.1",
		exportedAt: "2026-11-02T00:00:00.000Z",
		case: { name: "Case", description: "" },
		tree: {
			id: GOAL_ID,
			type: "GOAL",
			name: "G1",
			description: "The goal",
			inSandbox: false,
			children,
		},
	};
}

describe("computeTreeDiff and placeholders", () => {
	it("sends no update when the marker and hint are unchanged", () => {
		const marked = claim({ isPlaceholder: true, placeholderHint: HINT });

		const { changes } = computeTreeDiff(exportWith(marked), exportWith(marked));

		expect(changes).toEqual([]);
	});

	it("sends the marker off, and the hint cleared, when both are taken out of the document", () => {
		const { changes } = computeTreeDiff(
			exportWith(claim({ isPlaceholder: true, placeholderHint: HINT })),
			exportWith(claim())
		);

		expect(changes).toEqual([
			{
				type: "update",
				elementId: CLAIM_ID,
				data: { isPlaceholder: false, placeholderHint: null },
			},
		]);
	});

	it("sends only the marker when it alone is taken out of the document", () => {
		const { changes } = computeTreeDiff(
			exportWith(claim({ isPlaceholder: true, placeholderHint: HINT })),
			exportWith(claim({ placeholderHint: HINT }))
		);

		expect(changes).toEqual([
			{
				type: "update",
				elementId: CLAIM_ID,
				data: { isPlaceholder: false },
			},
		]);
	});

	it("sends the marker on with its hint when they are added to an element", () => {
		const { changes } = computeTreeDiff(
			exportWith(claim({ description: "Written" })),
			exportWith(
				claim({
					description: "Written",
					isPlaceholder: true,
					placeholderHint: HINT,
				})
			)
		);

		expect(changes).toEqual([
			{
				type: "update",
				elementId: CLAIM_ID,
				data: { isPlaceholder: true, placeholderHint: HINT },
			},
		]);
	});

	it("sends only the hint when the hint of a placeholder is reworded", () => {
		const { changes } = computeTreeDiff(
			exportWith(claim({ isPlaceholder: true, placeholderHint: HINT })),
			exportWith(claim({ isPlaceholder: true, placeholderHint: "Reworded" }))
		);

		expect(changes).toEqual([
			{
				type: "update",
				elementId: CLAIM_ID,
				data: { placeholderHint: "Reworded" },
			},
		]);
	});

	it("sends only the text when text is written to a placeholder and the marker is left in the document", () => {
		const { changes } = computeTreeDiff(
			exportWith(claim({ isPlaceholder: true, placeholderHint: HINT })),
			exportWith(
				claim({
					description: "Written",
					isPlaceholder: true,
					placeholderHint: HINT,
				})
			)
		);

		expect(changes).toEqual([
			{
				type: "update",
				elementId: CLAIM_ID,
				data: { description: "Written" },
			},
		]);
	});

	it("creates a new element with its marker and hint", () => {
		const { changes } = computeTreeDiff(
			exportWith(),
			exportWith(claim({ isPlaceholder: true, placeholderHint: HINT }))
		);

		expect(changes).toHaveLength(1);
		expect(changes[0]).toMatchObject({
			type: "create",
			elementId: CLAIM_ID,
			data: { isPlaceholder: true, placeholderHint: HINT },
		});
	});

	it("creates a new element without a marker as an ordinary one", () => {
		const { changes } = computeTreeDiff(exportWith(), exportWith(claim()));

		expect(changes[0]).toMatchObject({ type: "create" });
		expect(changes[0]).not.toHaveProperty("data.isPlaceholder", true);
	});

	it("never sends the markers a pattern leaves on a case, whatever the document says", () => {
		const { changes } = computeTreeDiff(
			exportWith(claim({ fromPattern: true })),
			exportWith(claim({ fromPattern: false, modifiedFromPattern: true }))
		);

		expect(changes).toEqual([]);
	});

	it("does not put the markers a pattern leaves on a case into a new element", () => {
		const { changes } = computeTreeDiff(
			exportWith(),
			exportWith(claim({ fromPattern: true, modifiedFromPattern: true }))
		);

		const sent = JSON.stringify(changes);
		expect(sent).not.toContain("fromPattern");
		expect(sent).not.toContain("modifiedFromPattern");
	});
});
