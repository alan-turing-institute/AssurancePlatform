import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	createTestIntegrationWithSystemUser,
	createTestUser,
} from "../utils/prisma-factories";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

beforeEach(async () => {
	await mockNoAuth();
});

afterEach(() => {
	vi.unstubAllEnvs();
});

function deleteAccountRequest(body?: unknown): NextRequest {
	return new NextRequest("http://localhost:3000/api/users/me", {
		method: "DELETE",
		...(body !== undefined && { body: JSON.stringify(body) }),
	});
}

// ============================================
// DELETE /api/users/me
//
// (nanaki minor, work item 9 — this route had no test file at all. Kept
// minimal: just enough to prove work items 5+7 end to end, since
// `user-management-service.test.ts` already covers `deleteAccount` itself
// at the service level.)
// ============================================

describe("DELETE /api/users/me", () => {
	it("returns 401 when unauthenticated", async () => {
		const { DELETE } = await import("@/app/api/users/me/route");
		const response = await DELETE(deleteAccountRequest());
		expect(response.status).toBe(401);
	});

	/**
	 * End-to-end proof for work items 5+7: `deleteAccount`'s owned-
	 * integrations pre-check (now a `count`, not a full `findMany` — item 7)
	 * surfaces through `serviceErrorToAppError`'s re-anchored ERROR_MAPPINGS
	 * pattern (item 5) as a 409 with the reworded, removal-only message,
	 * reaching HTTP correctly — not just the service layer.
	 */
	it("returns 409 with the removal-only message when the user owns an integration", async () => {
		const owner = await createTestUser({ authProvider: "GITHUB" });
		await createTestIntegrationWithSystemUser(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { DELETE } = await import("@/app/api/users/me/route");
		const response = await DELETE(deleteAccountRequest());

		expect(response.status).toBe(409);
		const body = await response.json();
		expect(body.error).toBe(
			"Remove your 1 integration before deleting your account"
		);
	});

	it("accepts a real { password } body — exercises the schema's non-empty branch", async () => {
		// GITHUB (OAuth): deleteAccount never verifies the password for a
		// non-LOCAL user, so this proves the route/schema accept and pass a
		// real password string through, without needing one that matches a
		// stored hash.
		const owner = await createTestUser({ authProvider: "GITHUB" });
		await mockAuth(owner.id, owner.username, owner.email);

		const { DELETE } = await import("@/app/api/users/me/route");
		const response = await DELETE(
			deleteAccountRequest({ password: "some-password-123" })
		);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.success).toBe(true);
	});

	it("returns 400 for an unknown key in the body", async () => {
		const owner = await createTestUser({ authProvider: "GITHUB" });
		await mockAuth(owner.id, owner.username, owner.email);

		const { DELETE } = await import("@/app/api/users/me/route");
		const response = await DELETE(
			deleteAccountRequest({ password: "x", extra: "not allowed" })
		);

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toBe('Unrecognized key: "extra"');
	});
});
