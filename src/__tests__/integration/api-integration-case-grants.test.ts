import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { canAccessCase } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	createTestCase,
	createTestIntegrationWithSystemUser,
	createTestPermission,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * `POST/GET /api/integrations/[id]/case-grants` +
 * `DELETE /api/integrations/[id]/case-grants/[caseId]` — the API surface
 * that lets a human operator grant/list/revoke an integration's system
 * user's access to a case (TEA — Integration case-access grants need a
 * product surface). Mirrors `api-integrations.test.ts`'s conventions:
 * real Postgres, mocked session auth, byte-identical-404 assertions for
 * the no-enumeration-oracle guarantee.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

beforeEach(async () => {
	await mockNoAuth();
});

afterEach(() => {
	vi.unstubAllEnvs();
});

const NOT_FOUND_ID = "00000000-0000-0000-0000-000000000000";
const INTEGRATION_NOT_FOUND = "Integration not found";
const CASE_NOT_FOUND = "Case not found";

function jsonRequest(url: string, method: string, body?: unknown): Request {
	return new Request(`http://localhost:3000${url}`, {
		method,
		...(body !== undefined && { body: JSON.stringify(body) }),
	});
}

function idParams(id: string) {
	return { params: Promise.resolve({ id }) };
}

function caseGrantParams(id: string, caseId: string) {
	return { params: Promise.resolve({ id, caseId }) };
}

describe("GET /api/integrations/[id]/case-grants", () => {
	it("returns 401 when unauthenticated", async () => {
		const owner = await createTestUser();
		const { integration } = await createTestIntegrationWithSystemUser(owner.id);
		const { GET } = await import(
			"@/app/api/integrations/[id]/case-grants/route"
		);

		const response = await GET(
			jsonRequest(`/api/integrations/${integration.id}/case-grants`, "GET"),
			idParams(integration.id)
		);
		expect(response.status).toBe(401);
	});

	it("lists the integration's current case grants (case id/name + permission)", async () => {
		const owner = await createTestUser();
		const { integration, systemUser } =
			await createTestIntegrationWithSystemUser(owner.id);
		const testCase = await createTestCase(owner.id, { name: "Grant target" });
		await createTestPermission(testCase.id, systemUser.id, owner.id, "EDIT");
		await mockAuth(owner.id, owner.username, owner.email);

		const { GET } = await import(
			"@/app/api/integrations/[id]/case-grants/route"
		);
		const response = await GET(
			jsonRequest(`/api/integrations/${integration.id}/case-grants`, "GET"),
			idParams(integration.id)
		);
		expect(response.status).toBe(200);

		const body = await response.json();
		expect(body.grants).toHaveLength(1);
		expect(body.grants[0]).toMatchObject({
			caseId: testCase.id,
			caseName: "Grant target",
			permission: "EDIT",
		});
	});

	it("returns BYTE-IDENTICAL 404s for a non-owner vs a nonexistent integration id", async () => {
		const owner = await createTestUser();
		const outsider = await createTestUser();
		const { integration } = await createTestIntegrationWithSystemUser(owner.id);
		await mockAuth(outsider.id, outsider.username, outsider.email);

		const { GET } = await import(
			"@/app/api/integrations/[id]/case-grants/route"
		);
		const nonOwnerResponse = await GET(
			jsonRequest(`/api/integrations/${integration.id}/case-grants`, "GET"),
			idParams(integration.id)
		);
		const nonexistentResponse = await GET(
			jsonRequest(`/api/integrations/${NOT_FOUND_ID}/case-grants`, "GET"),
			idParams(NOT_FOUND_ID)
		);

		expect(nonOwnerResponse.status).toBe(404);
		expect(nonOwnerResponse.status).toBe(nonexistentResponse.status);
		const nonOwnerBody = await nonOwnerResponse.json();
		const nonexistentBody = await nonexistentResponse.json();
		expect(nonOwnerBody).toEqual(nonexistentBody);
		expect(nonOwnerBody.error).toBe(INTEGRATION_NOT_FOUND);
	});
});

describe("POST /api/integrations/[id]/case-grants", () => {
	it("returns 401 when unauthenticated", async () => {
		const owner = await createTestUser();
		const { integration } = await createTestIntegrationWithSystemUser(owner.id);
		const testCase = await createTestCase(owner.id);
		const { POST } = await import(
			"@/app/api/integrations/[id]/case-grants/route"
		);

		const response = await POST(
			jsonRequest(`/api/integrations/${integration.id}/case-grants`, "POST", {
				caseId: testCase.id,
				permission: "VIEW",
			}),
			idParams(integration.id)
		);
		expect(response.status).toBe(401);
	});

	it("owner+admin: grants access, creating a CasePermission for the integration's system user", async () => {
		const owner = await createTestUser();
		const { integration, systemUser } =
			await createTestIntegrationWithSystemUser(owner.id);
		const testCase = await createTestCase(owner.id, { name: "Owned case" });
		await mockAuth(owner.id, owner.username, owner.email);

		const { POST } = await import(
			"@/app/api/integrations/[id]/case-grants/route"
		);
		const response = await POST(
			jsonRequest(`/api/integrations/${integration.id}/case-grants`, "POST", {
				caseId: testCase.id,
				permission: "EDIT",
			}),
			idParams(integration.id)
		);

		expect(response.status).toBe(201);
		const body = await response.json();
		expect(body.grant).toMatchObject({
			caseId: testCase.id,
			caseName: "Owned case",
			permission: "EDIT",
			alreadyGranted: false,
		});

		const permission = await prisma.casePermission.findUnique({
			where: { caseId_userId: { caseId: testCase.id, userId: systemUser.id } },
		});
		expect(permission?.permission).toBe("EDIT");

		// The system user can now access the case at the granted level —
		// this is the exact check a machine-facing case route would run via
		// `requireApiToken`'s `systemUserId` (no machine case-read route
		// exists yet to drive this end-to-end through a bearer token, so
		// this pins the same access-control primitive that route would use).
		expect(
			await canAccessCase(
				{ userId: systemUser.id, caseId: testCase.id },
				"EDIT"
			)
		).toBe(true);
	});

	it("owner+admin-via-direct-share (not the case creator): grants access", async () => {
		const creator = await createTestUser();
		const admin = await createTestUser();
		const { integration, systemUser } =
			await createTestIntegrationWithSystemUser(admin.id);
		const testCase = await createTestCase(creator.id);
		await createTestPermission(testCase.id, admin.id, creator.id, "ADMIN");
		await mockAuth(admin.id, admin.username, admin.email);

		const { POST } = await import(
			"@/app/api/integrations/[id]/case-grants/route"
		);
		const response = await POST(
			jsonRequest(`/api/integrations/${integration.id}/case-grants`, "POST", {
				caseId: testCase.id,
				permission: "VIEW",
			}),
			idParams(integration.id)
		);

		expect(response.status).toBe(201);
		expect(
			await canAccessCase(
				{ userId: systemUser.id, caseId: testCase.id },
				"VIEW"
			)
		).toBe(true);
	});

	it("duplicate grant is idempotent success (200, alreadyGranted: true), not an error", async () => {
		const owner = await createTestUser();
		const { integration } = await createTestIntegrationWithSystemUser(owner.id);
		const testCase = await createTestCase(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { POST } = await import(
			"@/app/api/integrations/[id]/case-grants/route"
		);
		const first = await POST(
			jsonRequest(`/api/integrations/${integration.id}/case-grants`, "POST", {
				caseId: testCase.id,
				permission: "VIEW",
			}),
			idParams(integration.id)
		);
		expect(first.status).toBe(201);

		const second = await POST(
			jsonRequest(`/api/integrations/${integration.id}/case-grants`, "POST", {
				caseId: testCase.id,
				permission: "VIEW",
			}),
			idParams(integration.id)
		);
		expect(second.status).toBe(200);
		const body = await second.json();
		expect(body.grant.alreadyGranted).toBe(true);

		// Still exactly one CasePermission row — the unique (caseId, userId)
		// constraint is honoured via upsert, never a second row or an error.
		const permissions = await prisma.casePermission.findMany({
			where: { caseId: testCase.id },
		});
		expect(permissions).toHaveLength(1);
	});

	it("re-granting with a DIFFERENT permission level updates it (upsert) — a real change, so 201/alreadyGranted:false, never an error", async () => {
		const owner = await createTestUser();
		const { integration, systemUser } =
			await createTestIntegrationWithSystemUser(owner.id);
		const testCase = await createTestCase(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { POST } = await import(
			"@/app/api/integrations/[id]/case-grants/route"
		);
		await POST(
			jsonRequest(`/api/integrations/${integration.id}/case-grants`, "POST", {
				caseId: testCase.id,
				permission: "VIEW",
			}),
			idParams(integration.id)
		);
		const response = await POST(
			jsonRequest(`/api/integrations/${integration.id}/case-grants`, "POST", {
				caseId: testCase.id,
				permission: "ADMIN",
			}),
			idParams(integration.id)
		);

		expect(response.status).toBe(201);
		const body = await response.json();
		expect(body.grant.alreadyGranted).toBe(false);
		const permission = await prisma.casePermission.findUnique({
			where: { caseId_userId: { caseId: testCase.id, userId: systemUser.id } },
		});
		expect(permission?.permission).toBe("ADMIN");

		// Still exactly one row — upsert on the (caseId, userId) unique
		// constraint, never a second row for the same grant.
		const permissions = await prisma.casePermission.findMany({
			where: { caseId: testCase.id },
		});
		expect(permissions).toHaveLength(1);
	});

	it("returns BYTE-IDENTICAL 404s for a non-owner vs a nonexistent integration id", async () => {
		const owner = await createTestUser();
		const outsider = await createTestUser();
		const { integration } = await createTestIntegrationWithSystemUser(owner.id);
		const testCase = await createTestCase(owner.id);
		await mockAuth(outsider.id, outsider.username, outsider.email);

		const { POST } = await import(
			"@/app/api/integrations/[id]/case-grants/route"
		);
		const nonOwnerResponse = await POST(
			jsonRequest(`/api/integrations/${integration.id}/case-grants`, "POST", {
				caseId: testCase.id,
				permission: "VIEW",
			}),
			idParams(integration.id)
		);
		const nonexistentResponse = await POST(
			jsonRequest(`/api/integrations/${NOT_FOUND_ID}/case-grants`, "POST", {
				caseId: testCase.id,
				permission: "VIEW",
			}),
			idParams(NOT_FOUND_ID)
		);

		expect(nonOwnerResponse.status).toBe(404);
		expect(nonOwnerResponse.status).toBe(nonexistentResponse.status);
		const nonOwnerBody = await nonOwnerResponse.json();
		const nonexistentBody = await nonexistentResponse.json();
		expect(nonOwnerBody).toEqual(nonexistentBody);
		expect(nonOwnerBody.error).toBe(INTEGRATION_NOT_FOUND);
	});

	/**
	 * The dispatch's core requirement: an actor who OWNS the integration but
	 * has no ADMIN permission on the target case must fail exactly like a
	 * nonexistent case — same status, same message — never a distinct 403
	 * that would leak "the case exists, you're just not its admin".
	 */
	it("owner-but-not-case-admin fails as not-found, BYTE-IDENTICAL to a nonexistent case", async () => {
		const owner = await createTestUser();
		const caseCreator = await createTestUser();
		const { integration } = await createTestIntegrationWithSystemUser(owner.id);
		const testCase = await createTestCase(caseCreator.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { POST } = await import(
			"@/app/api/integrations/[id]/case-grants/route"
		);
		const notAdminResponse = await POST(
			jsonRequest(`/api/integrations/${integration.id}/case-grants`, "POST", {
				caseId: testCase.id,
				permission: "VIEW",
			}),
			idParams(integration.id)
		);
		const nonexistentCaseResponse = await POST(
			jsonRequest(`/api/integrations/${integration.id}/case-grants`, "POST", {
				caseId: NOT_FOUND_ID,
				permission: "VIEW",
			}),
			idParams(integration.id)
		);

		expect(notAdminResponse.status).toBe(404);
		expect(notAdminResponse.status).toBe(nonexistentCaseResponse.status);
		const notAdminBody = await notAdminResponse.json();
		const nonexistentCaseBody = await nonexistentCaseResponse.json();
		expect(notAdminBody).toEqual(nonexistentCaseBody);
		expect(notAdminBody.error).toBe(CASE_NOT_FOUND);
	});

	it("case admin via VIEW/COMMENT/EDIT (below ADMIN) also fails as not-found", async () => {
		const owner = await createTestUser();
		const caseCreator = await createTestUser();
		const { integration } = await createTestIntegrationWithSystemUser(owner.id);
		const testCase = await createTestCase(caseCreator.id);
		await createTestPermission(testCase.id, owner.id, caseCreator.id, "EDIT");
		await mockAuth(owner.id, owner.username, owner.email);

		const { POST } = await import(
			"@/app/api/integrations/[id]/case-grants/route"
		);
		const response = await POST(
			jsonRequest(`/api/integrations/${integration.id}/case-grants`, "POST", {
				caseId: testCase.id,
				permission: "VIEW",
			}),
			idParams(integration.id)
		);

		expect(response.status).toBe(404);
		expect((await response.json()).error).toBe(CASE_NOT_FOUND);
	});

	it("rejects an invalid permission value with 400", async () => {
		const owner = await createTestUser();
		const { integration } = await createTestIntegrationWithSystemUser(owner.id);
		const testCase = await createTestCase(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { POST } = await import(
			"@/app/api/integrations/[id]/case-grants/route"
		);
		const response = await POST(
			jsonRequest(`/api/integrations/${integration.id}/case-grants`, "POST", {
				caseId: testCase.id,
				permission: "SUPER_ADMIN",
			}),
			idParams(integration.id)
		);
		expect(response.status).toBe(400);
	});

	it("rejects a non-UUID caseId with 400", async () => {
		const owner = await createTestUser();
		const { integration } = await createTestIntegrationWithSystemUser(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { POST } = await import(
			"@/app/api/integrations/[id]/case-grants/route"
		);
		const response = await POST(
			jsonRequest(`/api/integrations/${integration.id}/case-grants`, "POST", {
				caseId: "not-a-uuid",
				permission: "VIEW",
			}),
			idParams(integration.id)
		);
		expect(response.status).toBe(400);
	});

	it("cannot grant access to an arbitrary userId — the body has no such field", async () => {
		const owner = await createTestUser();
		const other = await createTestUser();
		const { integration, systemUser } =
			await createTestIntegrationWithSystemUser(owner.id);
		const testCase = await createTestCase(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { POST } = await import(
			"@/app/api/integrations/[id]/case-grants/route"
		);
		await POST(
			jsonRequest(`/api/integrations/${integration.id}/case-grants`, "POST", {
				caseId: testCase.id,
				permission: "VIEW",
				userId: other.id,
			}),
			idParams(integration.id)
		);

		// Only the integration's OWN system user ever gets a grant.
		const grantedForOther = await prisma.casePermission.findUnique({
			where: { caseId_userId: { caseId: testCase.id, userId: other.id } },
		});
		expect(grantedForOther).toBeNull();
		const grantedForSystemUser = await prisma.casePermission.findUnique({
			where: {
				caseId_userId: { caseId: testCase.id, userId: systemUser.id },
			},
		});
		expect(grantedForSystemUser).not.toBeNull();
	});

	it("writes a SecurityAuditLog row for a grant", async () => {
		const owner = await createTestUser();
		const { integration } = await createTestIntegrationWithSystemUser(owner.id);
		const testCase = await createTestCase(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { POST } = await import(
			"@/app/api/integrations/[id]/case-grants/route"
		);
		await POST(
			jsonRequest(`/api/integrations/${integration.id}/case-grants`, "POST", {
				caseId: testCase.id,
				permission: "VIEW",
			}),
			idParams(integration.id)
		);

		const event = await prisma.securityAuditLog.findFirst({
			where: { userId: owner.id, eventType: "integration_case_access_granted" },
		});
		expect(event).not.toBeNull();
	});
});

describe("DELETE /api/integrations/[id]/case-grants/[caseId]", () => {
	it("returns 401 when unauthenticated", async () => {
		const owner = await createTestUser();
		const { integration } = await createTestIntegrationWithSystemUser(owner.id);
		const testCase = await createTestCase(owner.id);
		const { DELETE } = await import(
			"@/app/api/integrations/[id]/case-grants/[caseId]/route"
		);

		const response = await DELETE(
			jsonRequest(
				`/api/integrations/${integration.id}/case-grants/${testCase.id}`,
				"DELETE"
			),
			caseGrantParams(integration.id, testCase.id)
		);
		expect(response.status).toBe(401);
	});

	it("revokes access — a system user that could VIEW the case loses access after revoke", async () => {
		const owner = await createTestUser();
		const { integration, systemUser } =
			await createTestIntegrationWithSystemUser(owner.id);
		const testCase = await createTestCase(owner.id);
		await createTestPermission(testCase.id, systemUser.id, owner.id, "VIEW");
		await mockAuth(owner.id, owner.username, owner.email);

		expect(
			await canAccessCase(
				{ userId: systemUser.id, caseId: testCase.id },
				"VIEW"
			)
		).toBe(true);

		const { DELETE } = await import(
			"@/app/api/integrations/[id]/case-grants/[caseId]/route"
		);
		const response = await DELETE(
			jsonRequest(
				`/api/integrations/${integration.id}/case-grants/${testCase.id}`,
				"DELETE"
			),
			caseGrantParams(integration.id, testCase.id)
		);
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.success).toBe(true);

		expect(
			await canAccessCase(
				{ userId: systemUser.id, caseId: testCase.id },
				"VIEW"
			)
		).toBe(false);
		const permission = await prisma.casePermission.findUnique({
			where: {
				caseId_userId: { caseId: testCase.id, userId: systemUser.id },
			},
		});
		expect(permission).toBeNull();
	});

	it("revoking a grant that never existed is idempotent success, not an error", async () => {
		const owner = await createTestUser();
		const { integration } = await createTestIntegrationWithSystemUser(owner.id);
		const testCase = await createTestCase(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { DELETE } = await import(
			"@/app/api/integrations/[id]/case-grants/[caseId]/route"
		);
		const response = await DELETE(
			jsonRequest(
				`/api/integrations/${integration.id}/case-grants/${testCase.id}`,
				"DELETE"
			),
			caseGrantParams(integration.id, testCase.id)
		);
		expect(response.status).toBe(200);
	});

	it("returns BYTE-IDENTICAL 404s for a non-owner vs a nonexistent integration id", async () => {
		const owner = await createTestUser();
		const outsider = await createTestUser();
		const { integration } = await createTestIntegrationWithSystemUser(owner.id);
		const testCase = await createTestCase(owner.id);
		await mockAuth(outsider.id, outsider.username, outsider.email);

		const { DELETE } = await import(
			"@/app/api/integrations/[id]/case-grants/[caseId]/route"
		);
		const nonOwnerResponse = await DELETE(
			jsonRequest(
				`/api/integrations/${integration.id}/case-grants/${testCase.id}`,
				"DELETE"
			),
			caseGrantParams(integration.id, testCase.id)
		);
		const nonexistentResponse = await DELETE(
			jsonRequest(
				`/api/integrations/${NOT_FOUND_ID}/case-grants/${testCase.id}`,
				"DELETE"
			),
			caseGrantParams(NOT_FOUND_ID, testCase.id)
		);

		expect(nonOwnerResponse.status).toBe(404);
		expect(nonOwnerResponse.status).toBe(nonexistentResponse.status);
		const nonOwnerBody = await nonOwnerResponse.json();
		const nonexistentBody = await nonexistentResponse.json();
		expect(nonOwnerBody).toEqual(nonexistentBody);
		expect(nonOwnerBody.error).toBe(INTEGRATION_NOT_FOUND);
	});

	it("owner-but-not-case-admin fails as not-found, BYTE-IDENTICAL to a nonexistent case", async () => {
		const owner = await createTestUser();
		const caseCreator = await createTestUser();
		const { integration } = await createTestIntegrationWithSystemUser(owner.id);
		const testCase = await createTestCase(caseCreator.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { DELETE } = await import(
			"@/app/api/integrations/[id]/case-grants/[caseId]/route"
		);
		const notAdminResponse = await DELETE(
			jsonRequest(
				`/api/integrations/${integration.id}/case-grants/${testCase.id}`,
				"DELETE"
			),
			caseGrantParams(integration.id, testCase.id)
		);
		const nonexistentCaseResponse = await DELETE(
			jsonRequest(
				`/api/integrations/${integration.id}/case-grants/${NOT_FOUND_ID}`,
				"DELETE"
			),
			caseGrantParams(integration.id, NOT_FOUND_ID)
		);

		expect(notAdminResponse.status).toBe(404);
		expect(notAdminResponse.status).toBe(nonexistentCaseResponse.status);
		const notAdminBody = await notAdminResponse.json();
		const nonexistentCaseBody = await nonexistentCaseResponse.json();
		expect(notAdminBody).toEqual(nonexistentCaseBody);
		expect(notAdminBody.error).toBe(CASE_NOT_FOUND);
	});

	it("rejects a non-UUID path id with 400", async () => {
		const owner = await createTestUser();
		await mockAuth(owner.id, owner.username, owner.email);

		const { DELETE } = await import(
			"@/app/api/integrations/[id]/case-grants/[caseId]/route"
		);
		const response = await DELETE(
			jsonRequest(
				"/api/integrations/not-a-uuid/case-grants/also-not-a-uuid",
				"DELETE"
			),
			caseGrantParams("not-a-uuid", "also-not-a-uuid")
		);
		expect(response.status).toBe(400);
	});

	it("writes a SecurityAuditLog row for a revoke", async () => {
		const owner = await createTestUser();
		const { integration, systemUser } =
			await createTestIntegrationWithSystemUser(owner.id);
		const testCase = await createTestCase(owner.id);
		await createTestPermission(testCase.id, systemUser.id, owner.id, "VIEW");
		await mockAuth(owner.id, owner.username, owner.email);

		const { DELETE } = await import(
			"@/app/api/integrations/[id]/case-grants/[caseId]/route"
		);
		await DELETE(
			jsonRequest(
				`/api/integrations/${integration.id}/case-grants/${testCase.id}`,
				"DELETE"
			),
			caseGrantParams(integration.id, testCase.id)
		);

		const event = await prisma.securityAuditLog.findFirst({
			where: {
				userId: owner.id,
				eventType: "integration_case_access_revoked",
			},
		});
		expect(event).not.toBeNull();
	});
});
