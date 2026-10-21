import { beforeEach, describe, expect, it, vi } from "vitest";
import { computeTreeDiff } from "@/lib/case/tree-diff";
import prisma from "@/lib/prisma";
import type { CaseExportNested, TreeNode } from "@/lib/schemas/case-export";
import { applyBatchUpdate } from "@/lib/services/case-batch-update-service";
import { exportCase } from "@/lib/services/case-export-service";
import { fetchCaseFromPrisma } from "@/lib/services/case-fetch-service";
import { mockNoAuth } from "../utils/auth-helpers";
import {
	addChild,
	addCounterGoal,
	buildArgument,
	fetchIdCounts,
	viewed,
} from "../utils/counter-goal-kit";
import { createTestUser } from "../utils/prisma-factories";

/**
 * The JSON editor sends the difference between the case as exported and the
 * edited text. The export shows what hangs from shared evidence (its
 * counter-goals) under one claim only, so deleting that claim must not read as
 * deleting the counter-goals: batch deletes are permanent.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/services/sse-connection-manager", () => ({
	emitSSEEvent: vi.fn(),
	sseConnectionManager: { broadcast: vi.fn() },
}));

beforeEach(async () => {
	await mockNoAuth();
});

/** The tree without the node of the given id and what hangs from it. */
function without(node: TreeNode, id: string): TreeNode {
	return {
		...node,
		children: node.children
			.filter((child) => child.id !== id)
			.map((child) => without(child, id)),
	};
}

/** The claim whose copy of the evidence is the one that shows what hangs from it. */
function claimShowing(
	node: TreeNode,
	evidenceId: string
): TreeNode | undefined {
	const shows = node.children.some(
		(child) => child.id === evidenceId && child.children.length > 0
	);
	if (shows) {
		return node;
	}
	for (const child of node.children) {
		const found = claimShowing(child, evidenceId);
		if (found) {
			return found;
		}
	}
}

describe("deleting, in the JSON editor, the claim that shows a counter-goal on shared evidence", () => {
	it("keeps the counter-goal and its support, drawn under the other claim", async () => {
		const owner = await createTestUser();
		const fx = await buildArgument(owner.id);
		const counterGoal = await addCounterGoal(fx, {
			name: "CG1",
			description: "against the shared evidence",
			parentId: fx.evidenceShared.id,
		});
		const support = await addChild(fx, {
			elementType: "PROPERTY_CLAIM",
			name: "P3",
			description: "claim supporting the counter-goal",
			parentId: counterGoal.id,
		});
		const exported = viewed(
			await exportCase(owner.id, fx.caseId, { includeComments: false })
		);
		const current = JSON.parse(
			JSON.stringify(exported.data)
		) as CaseExportNested;
		const shower = claimShowing(current.tree, fx.evidenceShared.id);
		expect(shower).toBeDefined();
		const edited = {
			...current,
			tree: without(current.tree, shower?.id ?? ""),
		};

		const { changes } = computeTreeDiff(current, edited);
		const result = await applyBatchUpdate(owner.id, fx.caseId, changes);

		expect("error" in result).toBe(false);
		const stored = await prisma.assuranceElement.findMany({
			where: { id: { in: [counterGoal.id, support.id] } },
		});
		expect(stored).toHaveLength(2);
		const fetched = viewed(await fetchCaseFromPrisma(fx.caseId, owner.id));
		const counts = fetchIdCounts(fetched.data?.goals);
		expect(counts.get(counterGoal.id)).toBe(1);
		expect(counts.get(support.id)).toBe(1);
	});
});
