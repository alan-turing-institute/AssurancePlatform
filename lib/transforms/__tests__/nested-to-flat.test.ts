import { describe, expect, it } from "vitest";
import type { CaseExportNested, TreeNode } from "@/lib/schemas/case-export";
import { flattenNestedToFlat } from "@/lib/transforms/nested-to-flat";

/**
 * TEA — Case import drops defeaters (isDefeater and defeatsElementId) in
 * both formats. nodeToElement (the function under test here, indirectly via
 * flattenNestedToFlat's public entry point) previously copied every other
 * type-specific and dialogical-reasoning field from a TreeNode onto the flat
 * ElementV2 row except isDefeater/defeatsElementId, so a nested export with
 * a defeater silently lost both fields on the nested->flat step alone,
 * before case-import-service.ts ever ran.
 */
describe("nested-to-flat: nodeToElement carries dialogical reasoning fields", () => {
	function buildNestedCase(tree: TreeNode): CaseExportNested {
		return {
			version: "1.0",
			exportedAt: new Date().toISOString(),
			case: { name: "Defeater Case", description: "Has a defeater" },
			tree,
		};
	}

	it("copies isDefeater and defeatsElementId onto the flat element", () => {
		const targetId = "10000000-0000-4000-8000-000000000001";
		const defeaterId = "10000000-0000-4000-8000-000000000002";

		const tree: TreeNode = {
			id: targetId,
			type: "GOAL",
			name: "Root Goal",
			description: "Top-level goal",
			inSandbox: false,
			role: "TOP_LEVEL",
			children: [
				{
					id: defeaterId,
					type: "PROPERTY_CLAIM",
					name: "Defeater Claim",
					description: "Challenges the root goal",
					inSandbox: false,
					isDefeater: true,
					defeatsElementId: targetId,
					children: [],
				},
			],
		};

		const flat = flattenNestedToFlat(buildNestedCase(tree));
		const defeaterElement = flat.elements.find((el) => el.id === defeaterId);

		expect(defeaterElement?.isDefeater).toBe(true);
		expect(defeaterElement?.defeatsElementId).toBe(targetId);
	});

	it("leaves isDefeater/defeatsElementId undefined when the node carries neither", () => {
		const tree: TreeNode = {
			id: "10000000-0000-4000-8000-000000000003",
			type: "GOAL",
			name: "Root Goal",
			description: "Top-level goal",
			inSandbox: false,
			role: "TOP_LEVEL",
			children: [],
		};

		const flat = flattenNestedToFlat(buildNestedCase(tree));
		const [rootElement] = flat.elements;

		expect(rootElement?.isDefeater).toBeUndefined();
		expect(rootElement?.defeatsElementId).toBeUndefined();
	});
});

describe("nested-to-flat: context entries", () => {
	it("keeps plain text and named entries in order, and adds legacy context children after them", () => {
		const named = {
			id: "k3f9x2m7qa",
			name: "window",
			text: "the interval",
			value: "5 minutes",
		};
		const tree = {
			id: "10000000-0000-4000-8000-000000000004",
			type: "GOAL",
			name: "Root Goal",
			description: "Top-level goal",
			inSandbox: false,
			role: "TOP_LEVEL",
			context: ["plain", named],
			children: [
				{
					id: "10000000-0000-4000-8000-000000000005",
					type: "CONTEXT",
					name: "C1",
					description: "A legacy context element",
					inSandbox: false,
					children: [],
				},
			],
		} as TreeNode;

		const flat = flattenNestedToFlat({
			version: "1.1",
			exportedAt: new Date().toISOString(),
			case: { name: "Case", description: "" },
			tree,
		});

		expect(flat.elements[0]?.context).toEqual([
			"plain",
			named,
			"A legacy context element",
		]);
	});
});
