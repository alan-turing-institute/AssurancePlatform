import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchCaseFromPrisma } from "@/lib/services/case-fetch-service";
import { mockNoAuth } from "../utils/auth-helpers";
import {
	addChild,
	addCounterGoal,
	buildArgument,
	fetchNodes,
	linkEvidence,
	viewed,
} from "../utils/counter-goal-kit";
import { createTestElement, createTestUser } from "../utils/prisma-factories";

/**
 * Shared evidence is drawn once per claim that links it. When what hangs from
 * that evidence (a counter-goal, its claims, and their own shared evidence) is
 * repeated with every copy, a chain of such steps doubles at every level, so a
 * case of a few dozen elements can produce a fetch of thousands of nodes. The
 * size of the fetch has to stay in proportion to the size of the case. The
 * export builds from the same rule, which its unit tests pin by exact count.
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

const LEVELS = 8;
/** Generous: every element and every evidence link a few times over. */
const NODES_PER_ELEMENT = 10;

/**
 * Each level: two claims under the previous counter-goal (or the top goal),
 * one piece of evidence linked to both, and a counter-goal against that
 * evidence.
 */
async function buildDiamondChain(ownerId: string) {
	const fx = await buildArgument(ownerId);
	let parentId = fx.goal.id;
	let added = 0;
	for (let level = 0; level < LEVELS; level += 1) {
		const left = await addChild(fx, {
			elementType: "PROPERTY_CLAIM",
			name: `A${level}`,
			description: `left claim ${level}`,
			parentId,
		});
		const right = await addChild(fx, {
			elementType: "PROPERTY_CLAIM",
			name: `B${level}`,
			description: `right claim ${level}`,
			parentId,
		});
		const evidence = await createTestElement(fx.caseId, ownerId, {
			elementType: "EVIDENCE",
			name: `EV${level}`,
			description: `shared evidence ${level}`,
			url: `https://example.com/ev${level}`,
		});
		await linkEvidence(evidence.id, left.id);
		await linkEvidence(evidence.id, right.id);
		const counterGoal = await addCounterGoal(fx, {
			name: `CG${level}`,
			description: `counter-goal ${level}`,
			parentId: evidence.id,
		});
		parentId = counterGoal.id;
		added += 4;
	}
	// The base argument has six elements and three links.
	return { fx, elementCount: 6 + added, linkCount: 3 + 2 * LEVELS };
}

describe("size of the fetch for a chain of shared evidence and counter-goals", () => {
	it("keeps the case fetch in proportion to the size of the case", async () => {
		const owner = await createTestUser();
		const { fx, elementCount, linkCount } = await buildDiamondChain(owner.id);

		const result = viewed(await fetchCaseFromPrisma(fx.caseId, owner.id));

		const nodes = fetchNodes(result.data?.goals).length;
		expect(nodes).toBeLessThanOrEqual(
			NODES_PER_ELEMENT * (elementCount + linkCount)
		);
	});
});
