import { beforeEach, describe, expect, it, vi } from "vitest";
import { convertAssuranceCase } from "@/lib/case/convert-case";
import { exportCase } from "@/lib/services/case-export-service";
import { fetchCaseFromPrisma } from "@/lib/services/case-fetch-service";
import { mockNoAuth } from "../utils/auth-helpers";
import {
	addCounterGoal,
	buildArgument,
	type ExportedNode,
	exportIdCounts,
	fetchIdCounts,
	fetchNodes,
	viewed,
} from "../utils/counter-goal-kit";
import { createTestElement, createTestUser } from "../utils/prisma-factories";

/**
 * A counter-goal can challenge an away goal or a module, and an ordinary goal
 * that has a parent (stored by an older version) stays out of the case as it
 * always has.
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

async function fetchGoals(ownerId: string, caseId: string) {
	const result = viewed(await fetchCaseFromPrisma(caseId, ownerId));
	if (result.error || !result.data) {
		throw new Error(result.error ?? "no data");
	}
	return result.data;
}

describe("counter-goals against cited elements", () => {
	async function setUp(kind: "AWAY_GOAL" | "MODULE") {
		const owner = await createTestUser();
		const fx = await buildArgument(owner.id);
		const other = await buildArgument(owner.id);
		const cited = await createTestElement(fx.caseId, owner.id, {
			elementType: kind,
			name: kind === "AWAY_GOAL" ? "AG1" : "M1",
			description: `cited ${kind}`,
			parentId: fx.goal.id,
			moduleReferenceId: other.caseId,
			...(kind === "MODULE" ? { moduleEmbedType: "REFERENCE" as const } : {}),
		});
		const counterGoal = await addCounterGoal(fx, {
			name: "CG1",
			description: `counter-goal against the ${kind}`,
			parentId: cited.id,
		});
		return { owner, fx, cited, counterGoal };
	}

	it.each([
		["an away goal", "AWAY_GOAL"],
		["a module", "MODULE"],
	] as const)("a counter-goal against %s is returned beneath it and drawn at its side", async (_label, kind) => {
		const { owner, fx, cited, counterGoal } = await setUp(kind);

		const data = await fetchGoals(owner.id, fx.caseId);

		const owners = fetchNodes(data.goals).filter((node) =>
			Array.isArray(node.goals)
				? (node.goals as { id: string }[]).some(
						(goal) => goal.id === counterGoal.id
					)
				: false
		);
		expect(owners.map((node) => node.id)).toEqual([cited.id]);
		const canvas = convertAssuranceCase(
			data as unknown as Parameters<typeof convertAssuranceCase>[0]
		);
		const citedNode = canvas.caseNodes.find(
			(node) => node.data.id === cited.id
		);
		const counterNode = canvas.caseNodes.find(
			(node) => node.data.id === counterGoal.id
		);
		expect(citedNode).toBeDefined();
		expect(counterNode?.data.attachedTo).toBe(citedNode?.id);
		expect(counterNode?.data.attachSide).toBe("right");
	});

	it.each([
		["an away goal", "AWAY_GOAL"],
		["a module", "MODULE"],
	] as const)("a counter-goal against %s is exported once", async (_label, kind) => {
		const { owner, fx, counterGoal } = await setUp(kind);

		const exported = viewed(
			await exportCase(owner.id, fx.caseId, {
				includeComments: false,
			})
		);

		const tree = exported.data?.tree as unknown as ExportedNode;
		expect(exportIdCounts(tree).get(counterGoal.id)).toBe(1);
	});
});

describe("an ordinary goal that has a parent", () => {
	it("stays out of the case fetch, as before, while a counter-goal in the same place is drawn", async () => {
		const owner = await createTestUser();
		const fx = await buildArgument(owner.id);
		const ordinary = await createTestElement(fx.caseId, owner.id, {
			elementType: "GOAL",
			name: "G7",
			description: "ordinary goal hung from the claim",
			parentId: fx.claim.id,
		});
		const counterGoal = await addCounterGoal(fx, {
			name: "CG1",
			description: "counter-goal hung from the claim",
			parentId: fx.claim.id,
		});

		const data = await fetchGoals(owner.id, fx.caseId);

		const counts = fetchIdCounts(data.goals);
		expect(counts.has(ordinary.id)).toBe(false);
		expect(counts.get(counterGoal.id)).toBe(1);
	});
});
