import type { SelectedElement } from "@/lib/plugins/assistant/techniques-tool";
import { exportCase } from "@/lib/services/case-export-service";

interface Node {
	children?: Node[];
	description?: string;
	id: string;
	name?: string | null;
	type?: string;
}

function find(node: Node, id: string): Node | null {
	if (node.id === id) {
		return node;
	}
	for (const child of node.children ?? []) {
		const hit = find(child, id);
		if (hit) {
			return hit;
		}
	}
	return null;
}

/** Looks the element up in the permission-checked export of this case; an id not in the case gives null. */
export async function resolveSelectedElement(
	userId: string,
	caseId: string,
	elementId: string | undefined
): Promise<SelectedElement | null> {
	if (!elementId) {
		return null;
	}
	const result = await exportCase(userId, caseId, { includeComments: false });
	if (!("data" in result)) {
		return null;
	}
	const node = find(result.data.tree as Node, elementId);
	return node
		? {
				label: node.name || "an element",
				type: node.type ?? "element",
				text: node.description ?? "",
			}
		: null;
}

export function selectionPrompt(selection: SelectedElement | null): string {
	return selection
		? `\n\nThe user has selected ${selection.label} (${selection.type}): ${selection.text}. "This claim", "this element" and "the selected element" mean it.`
		: "";
}
