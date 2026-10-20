import { tool } from "ai";
import { z } from "zod";
import { type PlainCase, toPlainCase } from "@/lib/case/defined-terms";
import { logger } from "@/lib/logger";
import { createClaimHealthTool } from "@/lib/plugins/assistant/claim-health-tool";
import type { TechniquesModelAccess } from "@/lib/plugins/assistant/techniques-models";
import {
	createTechniquesTool,
	type SelectedElement,
	techniquesConfigured,
} from "@/lib/plugins/assistant/techniques-tool";
import { exportCase } from "@/lib/services/case-export-service";
import { lintCase } from "./linter/lint-case";
import { createToolCallLimit } from "./tool-call-limit";

interface TreeNode {
	children?: TreeNode[];
	description?: string;
	id: string;
	name?: string | null;
	type?: string;
	[key: string]: unknown;
}

const log = logger.child({ component: "assistant-tools" });

const NOT_FOUND = { found: false, message: "Not found in this case." } as const;

/** What a case-reading tool returns when its work throws, in place of the error's own text. */
const UNREADABLE = {
	found: false,
	message: "The case could not be read.",
} as const;

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

/** Every element whose label is `label`, ignoring case and surrounding space. */
function findByLabel(node: TreeNode, label: string): TreeNode[] {
	const wanted = label.trim().toLowerCase();
	const hits = node.name?.trim().toLowerCase() === wanted ? [node] : [];
	return hits.concat(
		(node.children ?? []).flatMap((child) => findByLabel(child, label))
	);
}

/**
 * The element with this id; failing that, the one element with this label,
 * since a model often passes the name it sees ("P1") rather than the id. A
 * label shared by more than one element names none of them.
 */
function findElement(tree: TreeNode, idOrLabel: string): TreeNode | null {
	const byId = findNode(tree, idOrLabel);
	if (byId) {
		return byId;
	}
	const [only, ...others] = findByLabel(tree, idOrLabel);
	return only && others.length === 0 ? only : null;
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
): Promise<PlainCase | null> {
	const result = await exportCase(userId, caseId, { includeComments: false });
	return "data" in result ? toPlainCase(result.data) : null;
}

/**
 * Runs a tool's work and returns its result. A throw gives `UNREADABLE`, so
 * the model is never handed the error's message, which can name hosts or
 * queries; only the error's class is logged.
 */
async function unlessItThrows<T>(
	toolName: string,
	work: () => Promise<T>
): Promise<T | typeof UNREADABLE> {
	try {
		return await work();
	} catch (error) {
		log.warn("An assistant tool failed; answering with a fixed result", {
			tool: toolName,
			errorName: error instanceof Error ? error.name : "unknown",
		});
		return UNREADABLE;
	}
}

/**
 * Reads the case on the first call and gives every later call the same
 * export, so however many tools run in a reply the case is exported once. A
 * read that throws is not kept, and the next call reads again.
 */
function sharedCaseExport(
	userId: string,
	caseId: string
): () => Promise<PlainCase | null> {
	let pending: Promise<PlainCase | null> | null = null;
	return () => {
		pending ??= loadExport(userId, caseId).catch((error: unknown) => {
			pending = null;
			throw error;
		});
		return pending;
	};
}

/**
 * The assistant's read-only tools. They close over the route's `userId` and
 * `caseId`; the model never supplies either, and an element id is only ever
 * looked up inside that case's own export, so an id from another case is
 * simply not found. Comments are never exported.
 *
 * The tools are made for one reply. They share a cap on tool calls
 * (`MAX_TOOL_CALLS_PER_REPLY`): a call past it returns a fixed error and does
 * no work. `read_case`, `read_element` and `lint_case` share one export of the
 * case, so a reply reads it once however many of them are called. None of the
 * tools throws to the SDK: a failure gives a fixed result, and only the error's
 * class is logged.
 *
 * `replyDeadline` is the epoch time in milliseconds at which the whole reply is
 * cut off; the techniques tool keeps its wait inside it. `models` gives that
 * tool the user's search and ranking jobs; without it the tool searches by
 * keyword only.
 *
 * `claimHealth` adds `read_claim_health`, which the caller sets only when the
 * health plugin is on for the user and the case has claims with automated
 * checks. It takes the claims' order and labels from the shared export and
 * reads their statuses again on every call.
 */
export function createCaseTools(
	userId: string,
	caseId: string,
	selection: SelectedElement | null = null,
	replyDeadline?: number,
	models?: TechniquesModelAccess,
	claimHealth = false
) {
	const limited = createToolCallLimit();
	const caseExport = sharedCaseExport(userId, caseId);
	return {
		read_case: tool({
			description:
				"Read the whole open assurance case: its name, description and the full element tree (goals, strategies, property claims, evidence, contexts, assumptions, justifications).",
			inputSchema: z.object({}),
			execute: () =>
				limited(() =>
					unlessItThrows("read_case", async () => {
						const data = await caseExport();
						return data
							? { found: true, case: data.case, tree: data.tree }
							: NOT_FOUND;
					})
				),
		}),
		read_element: tool({
			description:
				"Read one element of the open case by its id, with its direct children. Use an id taken from read_case or from the selected element. An element's label, such as P1, is accepted when no id matches and only one element has that label.",
			inputSchema: z.object({
				elementId: z
					.string()
					.describe(
						"The element id, as shown by read_case; failing that, its label."
					),
			}),
			execute: ({ elementId }) =>
				limited(() =>
					unlessItThrows("read_element", async () => {
						const data = await caseExport();
						const node = data
							? findElement(data.tree as TreeNode, elementId)
							: null;
						return node
							? { found: true, element: withShallowChildren(node) }
							: NOT_FOUND;
					})
				),
		}),
		lint_case: tool({
			description:
				"Lint the open assurance case against the rule catalogue. Returns structural findings (rule id, element label, severity, reason, fix), gaps the author has acknowledged, questions for the author, the number of findings left out when there are more than 100 (truncated), and judgementRules: further rules for you to apply to the case yourself. When the case has prechecks (mechanical facts for the judgement rules) it also returns them as prechecks, with prechecksTruncated giving the number left out; when it has none, neither field is present. Prechecks, acknowledged gaps and questions are limited to 100 each, with acknowledgedGapsTruncated and questionsTruncated giving the number of gaps and questions left out.",
			inputSchema: z.object({}),
			execute: () =>
				limited(() =>
					unlessItThrows("lint_case", async () => {
						const data = await caseExport();
						return data ? { found: true, ...lintCase(data) } : NOT_FOUND;
					})
				),
		}),
		...(techniquesConfigured()
			? {
					suggest_techniques: createTechniquesTool(
						selection,
						replyDeadline,
						models,
						limited
					),
				}
			: {}),
		...(claimHealth
			? {
					read_claim_health: createClaimHealthTool(
						userId,
						caseId,
						caseExport,
						limited
					),
				}
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
