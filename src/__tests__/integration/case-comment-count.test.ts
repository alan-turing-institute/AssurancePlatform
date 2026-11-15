import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	createTestCase,
	createTestComment,
	createTestElement,
	createTestPermission,
	createTestUser,
} from "../utils/prisma-factories";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

beforeEach(async () => {
	await mockNoAuth();
});

interface CountedElement {
	commentCount?: number;
	evidence?: CountedElement[];
	id: string;
	propertyClaims?: CountedElement[];
	strategies?: CountedElement[];
}

async function getCase(caseId: string): Promise<{ goals: CountedElement[] }> {
	const { GET } = await import("@/app/api/cases/[id]/route");
	const response = await GET(
		new NextRequest(`http://localhost:3000/api/cases/${caseId}`),
		{ params: Promise.resolve({ id: caseId }) }
	);
	if (response.status !== 200) {
		throw new Error(`GET answered ${response.status}`);
	}
	return response.json();
}

/** A goal with a strategy and a claim, plus evidence linked to the claim. */
async function buildCase() {
	const owner = await createTestUser();
	const testCase = await createTestCase(owner.id);
	const goal = await createTestElement(testCase.id, owner.id, {
		elementType: "GOAL",
	});
	const strategy = await createTestElement(testCase.id, owner.id, {
		elementType: "STRATEGY",
		parentId: goal.id,
	});
	const claim = await createTestElement(testCase.id, owner.id, {
		elementType: "PROPERTY_CLAIM",
		parentId: goal.id,
	});
	const evidence = await createTestElement(testCase.id, owner.id, {
		elementType: "EVIDENCE",
	});
	await prisma.evidenceLink.create({
		data: { evidenceId: evidence.id, claimId: claim.id },
	});
	return { owner, testCase, goal, strategy, claim, evidence };
}

describe("GET /api/cases/[id] — comments on each element", () => {
	it("reports every comment and reply on an element, and zero where there are none", async () => {
		const { owner, testCase, goal, strategy, claim, evidence } =
			await buildCase();
		const first = await createTestComment(owner.id, { elementId: goal.id });
		await createTestComment(owner.id, { elementId: goal.id });
		await createTestComment(owner.id, {
			elementId: goal.id,
			parentCommentId: first.id,
		});
		await createTestComment(owner.id, { elementId: evidence.id });
		await mockAuth(owner.id, owner.username, owner.email);

		const body = await getCase(testCase.id);

		const goalOut = body.goals[0];
		expect(goalOut?.commentCount).toBe(3);
		expect(
			goalOut?.strategies?.find((s) => s.id === strategy.id)
		).toMatchObject({ commentCount: 0 });
		const claimOut = goalOut?.propertyClaims?.find((c) => c.id === claim.id);
		expect(claimOut?.commentCount).toBe(0);
		expect(claimOut?.evidence?.[0]?.commentCount).toBe(1);
	});

	it("does not count a comment once it has been deleted", async () => {
		const { owner, testCase, goal } = await buildCase();
		await createTestComment(owner.id, { elementId: goal.id });
		const doomed = await createTestComment(owner.id, { elementId: goal.id });
		await mockAuth(owner.id, owner.username, owner.email);
		expect((await getCase(testCase.id)).goals[0]?.commentCount).toBe(2);

		await prisma.comment.delete({ where: { id: doomed.id } });

		expect((await getCase(testCase.id)).goals[0]?.commentCount).toBe(1);
	});

	it("gives a commenter the same counts as the owner", async () => {
		const { owner, testCase, goal } = await buildCase();
		const commenter = await createTestUser();
		await createTestPermission(testCase.id, commenter.id, owner.id, "COMMENT");
		await createTestComment(owner.id, { elementId: goal.id });
		await mockAuth(commenter.id, commenter.username, commenter.email);

		expect((await getCase(testCase.id)).goals[0]?.commentCount).toBe(1);
	});

	it("gives a viewer the same counts as the owner", async () => {
		const { owner, testCase, goal } = await buildCase();
		const viewer = await createTestUser();
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");
		await createTestComment(owner.id, { elementId: goal.id });
		await mockAuth(viewer.id, viewer.username, viewer.email);

		expect((await getCase(testCase.id)).goals[0]?.commentCount).toBe(1);
	});
});
