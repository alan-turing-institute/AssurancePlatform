import { tool } from "ai";
import { z } from "zod";
import {
	createTechniquesTool,
	type SelectedElement,
	techniquesConfigured,
} from "@/lib/plugins/assistant/techniques-tool";
import type { CaseExportNested } from "@/lib/schemas/case-export";
import { exportCase } from "@/lib/services/case-export-service";
import { lintCase } from "./linter/lint-case";

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
 *
 * `replyDeadline` is the epoch time in milliseconds at which the whole reply is
 * cut off; the techniques tool keeps its wait inside it.
 */
export function createCaseTools(
	userId: string,
	caseId: string,
	selection: SelectedElement | null = null,
	replyDeadline?: number
) {
	return {
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
		lint_case: tool({
			description:
				"Lint the open assurance case against the rule catalogue. Returns structural findings (rule id, element label, severity, reason, fix), gaps the author has acknowledged, questions for the author, the number of findings left out when there are more than 100 (truncated), and judgementRules: further rules for you to apply to the case yourself. When the case has prechecks (mechanical facts for the judgement rules) it also returns them as prechecks, with prechecksTruncated giving the number left out; when it has none, neither field is present. Prechecks, acknowledged gaps and questions are limited to 100 each, with acknowledgedGapsTruncated and questionsTruncated giving the number of gaps and questions left out.",
			inputSchema: z.object({}),
			execute: async () => {
				const data = await loadExport(userId, caseId);
				return data ? { found: true, ...lintCase(data) } : NOT_FOUND;
			},
		}),
		...(techniquesConfigured()
			? { suggest_techniques: createTechniquesTool(selection, replyDeadline) }
			: {}),
	};
}

/**
 * The system prompt. The sentence naming the tools is built from the names of
 * the tools actually registered, in registration order.
 */
export function buildSystemPrompt(toolNames: readonly string[]): string {
	return `You are the Case Assistant inside TEA (Trustworthy and Ethical Assurance), a platform for building assurance cases: structured arguments that a goal is met, made of goals, strategies, property claims and the evidence that supports them.

You have these read-only tools: ${toolNames.join(", ")}. read_case returns the whole open case as a tree. read_element returns one element and its direct children by id. You cannot change the case.

Answer from the case. Read it with a tool before you answer a question about it, and refer to elements by their names (such as G1 or P2). If the answer is not in the case, say so plainly instead of guessing. Be concise.

When the user asks you to lint, check or review the case, call lint_case first and call it once. Your reply must then list the findings it returned, one per line, as "RULEID on ELEMENT: reason", copying the values as returned; if truncated is more than 0, say that many further findings were left out. Then, if the result contains a prechecks field, list its entries under a heading "Prechecks", one per line, in the same form with detail in place of reason, and mention prechecksTruncated when it is more than 0, saying that many further prechecks were left out; if the result has no prechecks field, write no "Prechecks" heading and do not mention prechecks. Prechecks are facts for you to weigh against the judgement rules, not findings. Relay the tool's questions to the user, at most six. Next, read the case with read_case if you have not, apply the judgementRules text to it yourself, and list any further findings in the same "RULEID on ELEMENT: reason" form under a heading "Judgement findings". If you find none, say so. Never say whether the case is adequate or good enough.`;
}
