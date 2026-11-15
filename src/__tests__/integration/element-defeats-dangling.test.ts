import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
	deleteElement,
	detachElement,
	restoreElement,
} from "@/lib/services/element-service";
import { expectSuccess } from "../utils/assertion-helpers";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	createTestCase,
	createTestElement,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * A challenge whose target is deleted or detached is left unlinked and
 * flagged `defeatsDangling`, unless the challenge goes with its target.
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

async function challengeWorld() {
	const owner = await createTestUser();
	const testCase = await createTestCase(owner.id);
	const goal = await createTestElement(testCase.id, owner.id, {
		elementType: "GOAL",
		name: "G1",
	});
	const target = await createTestElement(testCase.id, owner.id, {
		elementType: "PROPERTY_CLAIM",
		name: "P1",
		parentId: goal.id,
	});
	const sibling = await createTestElement(testCase.id, owner.id, {
		elementType: "PROPERTY_CLAIM",
		name: "P2",
		parentId: goal.id,
	});
	// Hangs from the target and challenges it: goes with it.
	const childDefeater = await createTestElement(testCase.id, owner.id, {
		elementType: "PROPERTY_CLAIM",
		name: "P1.1",
		parentId: target.id,
		isDefeater: true,
		defeatsElementId: target.id,
	});
	// Hangs from elsewhere but challenges the target: stays behind.
	const outsideDefeater = await createTestElement(testCase.id, owner.id, {
		elementType: "PROPERTY_CLAIM",
		name: "P2.1",
		parentId: sibling.id,
		isDefeater: true,
		defeatsElementId: target.id,
	});
	return {
		owner,
		testCase,
		goal,
		target,
		sibling,
		childDefeater,
		outsideDefeater,
	};
}

const row = (id: string) =>
	prisma.assuranceElement.findUniqueOrThrow({ where: { id } });

describe("a challenge whose target is deleted", () => {
	it("is unlinked and flagged when it hangs from elsewhere", async () => {
		const { owner, target, outsideDefeater } = await challengeWorld();

		expectSuccess(await deleteElement(owner.id, target.id));

		const after = await row(outsideDefeater.id);
		expect(after.defeatsElementId).toBeNull();
		expect(after.defeatsDangling).toBe(true);
		expect(after.deletedAt).toBeNull();
	});

	it("is left intact when it hangs from the target, including after a restore", async () => {
		const { owner, target, childDefeater } = await challengeWorld();

		expectSuccess(await deleteElement(owner.id, target.id));
		expectSuccess(await restoreElement(owner.id, target.id));

		const after = await row(childDefeater.id);
		expect(after.defeatsElementId).toBe(target.id);
		expect(after.defeatsDangling).toBe(false);
		expect(after.deletedAt).toBeNull();
	});

	it("is left alone by the deletion of an unrelated element", async () => {
		const { owner, testCase, target, outsideDefeater } = await challengeWorld();
		const unrelated = await createTestElement(testCase.id, owner.id, {
			elementType: "STRATEGY",
			name: "S1",
		});

		expectSuccess(await deleteElement(owner.id, unrelated.id));

		const after = await row(outsideDefeater.id);
		expect(after.defeatsElementId).toBe(target.id);
		expect(after.defeatsDangling).toBe(false);
	});

	it("is returned with defeatsDangling true by GET /api/elements/[id]", async () => {
		const { owner, target, outsideDefeater } = await challengeWorld();
		expectSuccess(await deleteElement(owner.id, target.id));
		await mockAuth(owner.id, owner.username, owner.email);

		const { GET } = await import("@/app/api/elements/[id]/route");
		const response = await GET(
			new NextRequest(
				`http://localhost:3000/api/elements/${outsideDefeater.id}`
			),
			{ params: Promise.resolve({ id: outsideDefeater.id }) }
		);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.defeatsDangling).toBe(true);
		expect(body.defeatsElementId ?? null).toBeNull();
	});
});

describe("a challenge whose target is detached", () => {
	it("is unlinked and flagged when it hangs from elsewhere", async () => {
		const { owner, target, outsideDefeater } = await challengeWorld();

		expectSuccess(await detachElement(owner.id, target.id));

		const after = await row(outsideDefeater.id);
		expect(after.defeatsElementId).toBeNull();
		expect(after.defeatsDangling).toBe(true);
	});

	it("is left intact when it hangs from the target", async () => {
		const { owner, target, childDefeater } = await challengeWorld();

		expectSuccess(await detachElement(owner.id, target.id));

		const after = await row(childDefeater.id);
		expect(after.defeatsElementId).toBe(target.id);
		expect(after.defeatsDangling).toBe(false);
	});
});

describe("POST /api/cases/[id]/batch — a delete of a challenge's target", () => {
	async function postBatch(caseId: string, body: unknown) {
		const { POST } = await import("@/app/api/cases/[id]/batch/route");
		return await POST(
			new NextRequest(`http://localhost:3000/api/cases/${caseId}/batch`, {
				method: "POST",
				body: JSON.stringify(body),
				headers: { "Content-Type": "application/json" },
			}),
			{ params: Promise.resolve({ id: caseId }) }
		);
	}

	it("flags a surviving challenge", async () => {
		const { owner, testCase, target, outsideDefeater } = await challengeWorld();
		await mockAuth(owner.id, owner.username, owner.email);

		const response = await postBatch(testCase.id, {
			changes: [{ type: "delete", elementId: target.id }],
		});

		expect(response.status).toBe(200);
		const after = await row(outsideDefeater.id);
		expect(after.defeatsElementId).toBeNull();
		expect(after.defeatsDangling).toBe(true);
	});

	it("does not flag a challenge the same edit points at another target", async () => {
		const { owner, testCase, target, sibling, outsideDefeater } =
			await challengeWorld();
		await mockAuth(owner.id, owner.username, owner.email);

		const response = await postBatch(testCase.id, {
			changes: [
				{ type: "delete", elementId: target.id },
				{
					type: "update",
					elementId: outsideDefeater.id,
					data: { defeatsElementId: sibling.id },
				},
			],
		});

		expect(response.status).toBe(200);
		const after = await row(outsideDefeater.id);
		expect(after.defeatsElementId).toBe(sibling.id);
		expect(after.defeatsDangling).toBe(false);
	});
});
