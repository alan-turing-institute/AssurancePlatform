import { tool } from "ai";
import { z } from "zod";
import {
	createTechniquesTool,
	type SelectedElement,
	techniquesConfigured,
} from "@/lib/plugins/assistant/techniques-tool";
import type { CaseExportNested } from "@/lib/schemas/case-export";
import { exportCase } from "@/lib/services/case-export-service";

interface TreeNode {
	children?: TreeNode[];
	description?: string;
	id: string;
	name?: string | null;
	type?: string;
	[key: string]: unknown;
}

const NOT_FOUND = { found: false, message: "Not found in this case." } as const;

function findNode(node: TreeNode, id: string): TreeNode | null {
	if (node.id === id) {
		return node;
	}
	for (const child of node.children ?? []) {
		const hit = findNode(child, id);
		if (hit) {
			return hit;
		}
	}
	return null;
}

/** One level of children only, so a single element's answer stays small. */
function withShallowChildren(node: TreeNode) {
	const { children = [], ...rest } = node;
	return {
		...rest,
		children: children.map((child) => ({
			id: child.id,
			type: child.type,
			name: child.name,
			description: child.description,
			childCount: child.children?.length ?? 0,
		})),
	};
}

async function loadExport(
	userId: string,
	caseId: string
): Promise<CaseExportNested | null> {
	const result = await exportCase(userId, caseId, { includeComments: false });
	return "data" in result ? result.data : null;
}

/**
 * The assistant's read-only tools. Both close over the route's `userId` and
 * `caseId`; the model never supplies either, and an element id is only ever
 * looked up inside that case's own export, so an id from another case is
 * simply not found. Comments are never exported.
 */
export function createCaseTools(
	userId: string,
	caseId: string,
	selection: SelectedElement | null = null
) {
	return {
		...(techniquesConfigured()
			? { suggest_techniques: createTechniquesTool(selection) }
			: {}),
		read_case: tool({
			description:
				"Read the whole open assurance case: its name, description and the full element tree (goals, strategies, property claims, evidence, contexts, assumptions, justifications).",
			inputSchema: z.object({}),
			execute: async () => {
				const data = await loadExport(userId, caseId);
				return data
					? { found: true, case: data.case, tree: data.tree }
					: NOT_FOUND;
			},
		}),
		read_element: tool({
			description:
				"Read one element of the open case by its id, with its direct children. Use an id taken from read_case.",
			inputSchema: z.object({
				elementId: z
					.string()
					.describe("The element id, as shown by read_case."),
			}),
			execute: async ({ elementId }) => {
				const data = await loadExport(userId, caseId);
				const node = data ? findNode(data.tree as TreeNode, elementId) : null;
				return node
					? { found: true, element: withShallowChildren(node) }
					: NOT_FOUND;
			},
		}),
	};
}

export const ASSISTANT_SYSTEM_PROMPT = `You are the Case Assistant inside TEA (Trustworthy and Ethical Assurance), a platform for building assurance cases: structured arguments that a goal is met, made of goals, strategies, property claims and the evidence that supports them.

You have two read-only tools. read_case returns the whole open case as a tree. read_element returns one element and its direct children by id. You cannot change the case.

Answer from the case. Read it with a tool before you answer a question about it, and refer to elements by their names (such as G1 or P2). If the answer is not in the case, say so plainly instead of guessing. Be concise.`;
