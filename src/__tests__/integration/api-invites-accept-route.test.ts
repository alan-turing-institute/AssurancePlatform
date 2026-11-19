import { describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
	createCaseInvite,
	generateInviteToken,
	hashInviteToken,
} from "@/lib/services/case-invite-service";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import { createTestCase, createTestUser } from "../utils/prisma-factories";

/**
 * POST /api/invites/[token]/accept against a real database: the invitee
 * accepts once, everyone else is refused with a 4xx, and the database shows
 * that only the invitee gained access. `next/headers`'s `headers()` throws
 * outside a real request, so it is mocked.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));
vi.mock("next/headers", () => ({
	headers: vi.fn().mockResolvedValue(new Headers()),
}));

async function accept(token: string): Promise<Response> {
	const route = await import("@/app/api/invites/[token]/accept/route");
	return route.POST(
		new Request(`http://localhost:3000/api/invites/${token}/accept`, {
			method: "POST",
		}),
		{ params: Promise.resolve({ token }) }
	);
}

async function scene() {
	const owner = await createTestUser();
	const invitee = await createTestUser();
	const testCase = await createTestCase(owner.id);
	const created = await createCaseInvite({
		caseId: testCase.id,
		email: invitee.email,
		permission: "EDIT",
		invitedById: owner.id,
	});
	if ("error" in created) {
		throw new Error(created.error);
	}
	return {
		owner,
		invitee,
		caseId: testCase.id,
		token: created.data.invite_token,
	};
}

const signInAs = (user: { id: string; username: string; email: string }) =>
	mockAuth(user.id, user.username, user.email);

const permissionUserIds = async (caseId: string) =>
	(await prisma.casePermission.findMany({ where: { caseId } })).map(
		(row) => row.userId
	);

const storedInvite = (token: string) =>
	prisma.caseInvite.findUniqueOrThrow({
		where: { inviteTokenHash: hashInviteToken(token) },
	});

describe("POST /api/invites/[token]/accept", () => {
	it("lets the invitee accept once, then answers 409", async () => {
		const s = await scene();
		await signInAs(s.invitee);

		const first = await accept(s.token);
		expect(first.status).toBe(200);
		expect(await first.json()).toMatchObject({
			success: true,
			case_id: s.caseId,
		});
		expect(await permissionUserIds(s.caseId)).toEqual([s.invitee.id]);
		const acceptedAt = (await storedInvite(s.token)).acceptedAt;
		expect(acceptedAt).not.toBeNull();

		const second = await accept(s.token);
		expect(second.status).toBe(409);
		expect(await permissionUserIds(s.caseId)).toEqual([s.invitee.id]);
		expect((await storedInvite(s.token)).acceptedAt).toEqual(acceptedAt);
	});

	it.each([
		["the case owner", "owner"],
		["another signed-in account", "other"],
	] as const)("refuses %s with 403", async (_label, who) => {
		const s = await scene();
		const other = await createTestUser();
		await signInAs(who === "owner" ? s.owner : other);

		const response = await accept(s.token);

		expect(response.status).toBe(403);
		expect(await response.json()).toMatchObject({
			error: "Invite was sent to a different email address",
		});
		expect(await permissionUserIds(s.caseId)).toEqual([]);
		expect((await storedInvite(s.token)).acceptedAt).toBeNull();
	});

	it("answers 401 when signed out", async () => {
		const s = await scene();
		await mockNoAuth();

		expect((await accept(s.token)).status).toBe(401);
		expect(await permissionUserIds(s.caseId)).toEqual([]);
		expect((await storedInvite(s.token)).acceptedAt).toBeNull();
	});

	it("answers 400 for a well-formed code that matches no invitation", async () => {
		const user = await createTestUser();
		await signInAs(user);

		const response = await accept(generateInviteToken());

		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({ error: "Invalid invite" });
		expect(await prisma.casePermission.count()).toBe(0);
	});

	it("answers 400 for an expired invitation", async () => {
		const s = await scene();
		await prisma.caseInvite.update({
			where: { inviteTokenHash: hashInviteToken(s.token) },
			data: { inviteExpiresAt: new Date(Date.now() - 60_000) },
		});
		await signInAs(s.invitee);

		const response = await accept(s.token);

		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({
			error: "Invite has expired",
		});
		expect(await permissionUserIds(s.caseId)).toEqual([]);
		expect((await storedInvite(s.token)).acceptedAt).toBeNull();
	});
});
