import type { PlainCase, PlainTreeNode } from "@/lib/case/defined-terms";

/**
 * Builders for small cases handed to the export templates. A node has an empty
 * description and no children unless the test says otherwise.
 */

export function exportNode(
	fields: Partial<PlainTreeNode> & Pick<PlainTreeNode, "id" | "type">
): PlainTreeNode {
	return {
		name: null,
		description: "",
		inSandbox: false,
		children: [],
		...fields,
	};
}

export function exportCase(
	tree: PlainTreeNode,
	caseFields: Partial<PlainCase["case"]> = {}
): PlainCase {
	return {
		version: "1.0",
		exportedAt: "2024-01-15T10:00:00Z",
		case: {
			name: "Sample case",
			description: "Sample description",
			...caseFields,
		},
		tree,
	};
}
