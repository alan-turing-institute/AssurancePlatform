import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	createTestApiToken,
	createTestCase,
	createTestIntegrationWithSystemUser,
	createTestPermission,
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

const NOT_FOUND_ID = "00000000-0000-0000-0000-000000000000";
const INTEGRATION_NOT_FOUND = "Integration not found";
const TOKEN_NOT_FOUND = "Token not found";

function jsonRequest(url: string, method: string, body?: unknown): NextRequest {
	return new NextRequest(`http://localhost:3000${url}`, {
		method,
		...(body !== undefined && { body: JSON.stringify(body) }),
	});
}

function idParams(id: string) {
	return { params: Promise.resolve({ id }) };
}

function tokenParams(id: string, tokenId: string) {
	return { params: Promise.resolve({ id, tokenId }) };
}

// ============================================
// GET / POST /api/integrations
// ============================================

describe("GET /api/integrations", () => {
	it("returns 401 when unauthenticated", async () => {
		const { GET } = await import("@/app/api/integrations/route");
		const response = await GET();
		expect(response.status).toBe(401);
	});

	it("lists only the caller's own integrations, never another user's", async () => {
		const owner = await createTestUser();
		const other = await createTestUser();
		await createTestIntegrationWithSystemUser(owner.id, {
			name: "mine",
		});
		await createTestIntegrationWithSystemUser(other.id, {
			name: "not-mine",
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const { GET } = await import("@/app/api/integrations/route");
		const response = await GET();
		expect(response.status).toBe(200);

		const body = await response.json();
		expect(body.integrations).toHaveLength(1);
		expect(body.integrations[0].name).toBe("mine");
	});

	it("includes a token summary (prefix, timestamps) but NEVER a hash or secret", async () => {
		const owner = await createTestUser();
		const { integration } = await createTestIntegrationWithSystemUser(owner.id);
		const apiToken = await createTestApiToken(integration.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { GET } = await import("@/app/api/integrations/route");
		const response = await GET();
		const body = await response.json();

		expect(body.integrations[0].tokens).toHaveLength(1);
		const token = body.integrations[0].tokens[0];
		expect(token.id).toBe(apiToken.id);
		expect(token.tokenPrefix).toBe(apiToken.tokenPrefix);
		expect(token).not.toHaveProperty("tokenHash");
		expect(token).not.toHaveProperty("secret");
		expect(JSON.stringify(body)).not.toContain(apiToken.tokenHash);
	});

	/**
	 * Pins that `revokedAt`/`expiresAt` survive `listIntegrationsForOwner`'s
	 * `select` for BOTH lifecycle states, not just the "everything null"
	 * happy path the previous test exercised (nanaki info, work item 10).
	 */
	it("surfaces revokedAt for a REVOKED token and expiresAt for an EXPIRED token", async () => {
		const owner = await createTestUser();
		const { integration } = await createTestIntegrationWithSystemUser(owner.id);
		const revokedToken = await createTestApiToken(integration.id, {
			revokedAt: new Date(),
		});
		const expiredToken = await createTestApiToken(integration.id, {
			expiresAt: new Date(Date.now() - 60_000),
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const { GET } = await import("@/app/api/integrations/route");
		const response = await GET();
		const body = await response.json();

		const tokens = body.integrations[0].tokens as Array<{
			expiresAt: string | null;
			id: string;
			revokedAt: string | null;
		}>;
		const revoked = tokens.find((token) => token.id === revokedToken.id);
		const expired = tokens.find((token) => token.id === expiredToken.id);
		expect(revoked?.revokedAt).not.toBeNull();
		expect(expired?.expiresAt).not.toBeNull();
	});
});

describe("POST /api/integrations", () => {
	it("returns 401 when unauthenticated", async () => {
		const { POST } = await import("@/app/api/integrations/route");
		const response = await POST(
			jsonRequest("/api/integrations", "POST", {
				name: "my-integration",
				scopes: ["case:read"],
			})
		);
		expect(response.status).toBe(401);
	});

	it("registers an integration owned by the session user, returning no token", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);

		const { POST } = await import("@/app/api/integrations/route");
		const response = await POST(
			jsonRequest("/api/integrations", "POST", {
				name: `route-registered-${user.id}`,
				description: "a test integration",
				scopes: ["case:read"],
			})
		);

		expect(response.status).toBe(201);
		const body = await response.json();
		expect(body.integration.ownerId).toBe(user.id);
		expect(body.integration).not.toHaveProperty("secret");
		expect(body.integration).not.toHaveProperty("token");
	});

	it("binds ownership to the session user even if the body names a different owner", async () => {
		const user = await createTestUser();
		const other = await createTestUser();
		await mockAuth(user.id, user.username, user.email);

		const { POST } = await import("@/app/api/integrations/route");
		const response = await POST(
			jsonRequest("/api/integrations", "POST", {
				name: `spoof-attempt-${user.id}`,
				scopes: ["case:read"],
				ownerId: other.id,
			})
		);

		expect(response.status).toBe(201);
		const body = await response.json();
		expect(body.integration.ownerId).toBe(user.id);
		expect(body.integration.ownerId).not.toBe(other.id);
	});

	it("rejects an unknown scope with 400", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);

		const { POST } = await import("@/app/api/integrations/route");
		const response = await POST(
			jsonRequest("/api/integrations", "POST", {
				name: `bad-scope-${user.id}`,
				scopes: ["not-a-real-scope"],
			})
		);

		expect(response.status).toBe(400);
	});

	it("rejects an empty scopes array with 400", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);

		const { POST } = await import("@/app/api/integrations/route");
		const response = await POST(
			jsonRequest("/api/integrations", "POST", {
				name: `no-scopes-${user.id}`,
				scopes: [],
			})
		);

		expect(response.status).toBe(400);
	});

	it("rejects a missing name with 400", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);

		const { POST } = await import("@/app/api/integrations/route");
		const response = await POST(
			jsonRequest("/api/integrations", "POST", { scopes: ["case:read"] })
		);

		expect(response.status).toBe(400);
	});

	it("writes a SecurityAuditLog row for registration", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);

		const { POST } = await import("@/app/api/integrations/route");
		await POST(
			jsonRequest("/api/integrations", "POST", {
				name: `audited-${user.id}`,
				scopes: ["case:read"],
			})
		);

		const event = await prisma.securityAuditLog.findFirst({
			where: { userId: user.id, eventType: "integration_registered" },
		});
		expect(event).not.toBeNull();
	});
});

// ============================================
// PATCH /api/integrations/[id]
// ============================================

describe("PATCH /api/integrations/[id] — permission matrix", () => {
	it("returns 401 when unauthenticated", async () => {
		const owner = await createTestUser();
		const { integration } = await createTestIntegrationWithSystemUser(owner.id);
		const { PATCH } = await import("@/app/api/integrations/[id]/route");

		const response = await PATCH(
			jsonRequest(`/api/integrations/${integration.id}`, "PATCH", {
				description: "x",
			}),
			idParams(integration.id)
		);
		expect(response.status).toBe(401);
	});

	it("the owner can update description and scopes", async () => {
		const owner = await createTestUser();
		const { integration } = await createTestIntegrationWithSystemUser(
			owner.id,
			{ scopes: ["case:read"] }
		);
		await mockAuth(owner.id, owner.username, owner.email);

		const { PATCH } = await import("@/app/api/integrations/[id]/route");
		const response = await PATCH(
			jsonRequest(`/api/integrations/${integration.id}`, "PATCH", {
				description: "updated description",
				scopes: ["case:read", "health:evidence:read"],
			}),
			idParams(integration.id)
		);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.integration.description).toBe("updated description");
		expect(body.integration.scopes).toEqual([
			"case:read",
			"health:evidence:read",
		]);
	});

	it("returns 404 'Integration not found' for a nonexistent id", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);

		const { PATCH } = await import("@/app/api/integrations/[id]/route");
		const response = await PATCH(
			jsonRequest(`/api/integrations/${NOT_FOUND_ID}`, "PATCH", {
				description: "x",
			}),
			idParams(NOT_FOUND_ID)
		);

		expect(response.status).toBe(404);
		const body = await response.json();
		expect(body.error).toBe(INTEGRATION_NOT_FOUND);
	});

	it("returns 404 'Integration not found' for a non-owner", async () => {
		const owner = await createTestUser();
		const outsider = await createTestUser();
		const { integration } = await createTestIntegrationWithSystemUser(owner.id);
		await mockAuth(outsider.id, outsider.username, outsider.email);

		const { PATCH } = await import("@/app/api/integrations/[id]/route");
		const response = await PATCH(
			jsonRequest(`/api/integrations/${integration.id}`, "PATCH", {
				description: "x",
			}),
			idParams(integration.id)
		);

		expect(response.status).toBe(404);
		const body = await response.json();
		expect(body.error).toBe(INTEGRATION_NOT_FOUND);
	});

	it("returns BYTE-IDENTICAL 404s for a non-owner vs a nonexistent id (no enumeration oracle)", async () => {
		const owner = await createTestUser();
		const outsider = await createTestUser();
		const { integration } = await createTestIntegrationWithSystemUser(owner.id);
		await mockAuth(outsider.id, outsider.username, outsider.email);

		const { PATCH } = await import("@/app/api/integrations/[id]/route");
		const nonOwnerResponse = await PATCH(
			jsonRequest(`/api/integrations/${integration.id}`, "PATCH", {
				description: "x",
			}),
			idParams(integration.id)
		);
		const nonexistentResponse = await PATCH(
			jsonRequest(`/api/integrations/${NOT_FOUND_ID}`, "PATCH", {
				description: "x",
			}),
			idParams(NOT_FOUND_ID)
		);

		expect(nonOwnerResponse.status).toBe(nonexistentResponse.status);
		const nonOwnerBody = await nonOwnerResponse.json();
		const nonexistentBody = await nonexistentResponse.json();
		expect(nonOwnerBody).toEqual(nonexistentBody);
	});

	it("rejects an unknown scope with 400", async () => {
		const owner = await createTestUser();
		const { integration } = await createTestIntegrationWithSystemUser(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { PATCH } = await import("@/app/api/integrations/[id]/route");
		const response = await PATCH(
			jsonRequest(`/api/integrations/${integration.id}`, "PATCH", {
				scopes: ["not-a-real-scope"],
			}),
			idParams(integration.id)
		);

		expect(response.status).toBe(400);
	});

	it("rejects an empty body (neither description nor scopes) with 400", async () => {
		const owner = await createTestUser();
		const { integration } = await createTestIntegrationWithSystemUser(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { PATCH } = await import("@/app/api/integrations/[id]/route");
		const response = await PATCH(
			jsonRequest(`/api/integrations/${integration.id}`, "PATCH", {}),
			idParams(integration.id)
		);

		expect(response.status).toBe(400);
	});

	it("rejects a non-UUID path id with 400", async () => {
		const owner = await createTestUser();
		await mockAuth(owner.id, owner.username, owner.email);

		const { PATCH } = await import("@/app/api/integrations/[id]/route");
		const response = await PATCH(
			jsonRequest("/api/integrations/not-a-uuid", "PATCH", {
				description: "x",
			}),
			idParams("not-a-uuid")
		);

		expect(response.status).toBe(400);
	});
});

// ============================================
// Lifecycle: suspend / reactivate / revoke
// ============================================

type MutationRouteHandler = (
	req: Request,
	ctx: { params: Promise<{ id: string }> }
) => Promise<Response>;

/** Looks up the named HTTP-verb export on an imported route module, failing loudly (not `undefined`) if the route doesn't actually export it. */
function requireHandler(
	mod: Record<string, MutationRouteHandler>,
	method: "DELETE" | "POST"
): MutationRouteHandler {
	const handler = mod[method];
	if (!handler) {
		throw new Error(`Route module has no ${method} export`);
	}
	return handler;
}

/**
 * One loop generates the 401 + byte-identical-404 tests for every
 * single-`[id]`-keyed mutation route "for free" — `reactivate` (nanaki
 * MAJOR, work item 3) and `DELETE /api/integrations/[id]` (cid decision,
 * work item 6) are both added here rather than as one-off describe blocks,
 * so any FUTURE route of this same shape gets the same coverage by adding
 * one array entry. `path: ""` + `method: "DELETE"` models the base route
 * (no action suffix, different verb) alongside the POST action routes.
 */
describe("Integration mutation routes — permission matrix (suspend/reactivate/revoke/delete)", () => {
	const cases: Array<{
		importRoute: () => Promise<Record<string, MutationRouteHandler>>;
		method: "DELETE" | "POST";
		path: string;
	}> = [
		{
			method: "POST",
			path: "suspend",
			importRoute: () => import("@/app/api/integrations/[id]/suspend/route"),
		},
		{
			method: "POST",
			path: "reactivate",
			importRoute: () => import("@/app/api/integrations/[id]/reactivate/route"),
		},
		{
			method: "POST",
			path: "revoke",
			importRoute: () => import("@/app/api/integrations/[id]/revoke/route"),
		},
		{
			method: "DELETE",
			path: "",
			importRoute: () => import("@/app/api/integrations/[id]/route"),
		},
	];

	for (const { method, path, importRoute } of cases) {
		const label = path || "delete";
		const url = (id: string) =>
			path ? `/api/integrations/${id}/${path}` : `/api/integrations/${id}`;

		it(`${label}: returns 401 when unauthenticated`, async () => {
			const owner = await createTestUser();
			const { integration } = await createTestIntegrationWithSystemUser(
				owner.id
			);
			const mod = await importRoute();
			const handler = requireHandler(mod, method);

			const response = await handler(
				jsonRequest(url(integration.id), method),
				idParams(integration.id)
			);
			expect(response.status).toBe(401);
		});

		it(`${label}: returns BYTE-IDENTICAL 404s for a non-owner vs a nonexistent id`, async () => {
			const owner = await createTestUser();
			const outsider = await createTestUser();
			const { integration } = await createTestIntegrationWithSystemUser(
				owner.id
			);
			await mockAuth(outsider.id, outsider.username, outsider.email);

			const mod = await importRoute();
			const handler = requireHandler(mod, method);
			const nonOwnerResponse = await handler(
				jsonRequest(url(integration.id), method),
				idParams(integration.id)
			);
			const nonexistentResponse = await handler(
				jsonRequest(url(NOT_FOUND_ID), method),
				idParams(NOT_FOUND_ID)
			);

			expect(nonOwnerResponse.status).toBe(404);
			expect(nonOwnerResponse.status).toBe(nonexistentResponse.status);
			const nonOwnerBody = await nonOwnerResponse.json();
			const nonexistentBody = await nonexistentResponse.json();
			expect(nonOwnerBody).toEqual(nonexistentBody);
			expect(nonOwnerBody.error).toBe(INTEGRATION_NOT_FOUND);
		});
	}
});

// ============================================
// DELETE /api/integrations/[id] — happy path (permission matrix above)
// ============================================

describe("DELETE /api/integrations/[id]", () => {
	it("deletes the integration — it no longer appears in GET /api/integrations", async () => {
		const owner = await createTestUser();
		const { integration: toDelete } = await createTestIntegrationWithSystemUser(
			owner.id,
			{ name: "delete-me" }
		);
		const { integration: toKeep } = await createTestIntegrationWithSystemUser(
			owner.id,
			{ name: "keep-me" }
		);
		await mockAuth(owner.id, owner.username, owner.email);

		const { DELETE } = await import("@/app/api/integrations/[id]/route");
		const response = await DELETE(
			jsonRequest(`/api/integrations/${toDelete.id}`, "DELETE"),
			idParams(toDelete.id)
		);
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.success).toBe(true);

		const { GET } = await import("@/app/api/integrations/route");
		const listResponse = await GET();
		const listBody = await listResponse.json();
		const ids = listBody.integrations.map(
			(integration: { id: string }) => integration.id
		);
		expect(ids).not.toContain(toDelete.id);
		expect(ids).toContain(toKeep.id);
	});
});

// ============================================
// DELETE /api/integrations/[id] — system user orphan cleanup
// (TEA — Integration delete leaves the machine user behind, blocks
// same-name re-registration; found + fixed 2026-07-14, staging repro)
// ============================================

describe("DELETE /api/integrations/[id] — system user orphan cleanup", () => {
	it("full journey: register, grant case access, revoke it, delete, then re-register the same name succeeds — the system user and its CasePermission grants are actually gone, not just unreachable through the deleted integration", async () => {
		const owner = await createTestUser();
		await mockAuth(owner.id, owner.username, owner.email);
		const testCase = await createTestCase(owner.id, {
			name: "orphan-journey-case",
		});

		const name = `orphan-journey-${owner.id}`;
		const { POST: registerPost } = await import("@/app/api/integrations/route");
		const registerResponse = await registerPost(
			jsonRequest("/api/integrations", "POST", {
				name,
				scopes: ["case:read"],
			})
		);
		expect(registerResponse.status).toBe(201);
		const { integration } = await registerResponse.json();
		const integrationId: string = integration.id;
		const systemUserId: string = integration.systemUserId;
		expect(systemUserId).toEqual(expect.any(String));

		// The system user exists and carries the exact username/email the
		// unique-constraint collision used to be keyed on.
		const systemUserBeforeDelete = await prisma.user.findUnique({
			where: { id: systemUserId },
		});
		expect(systemUserBeforeDelete).toMatchObject({
			email: `integration+${name}@tea-platform.internal`,
			isSystemUser: true,
			username: `integration-${name}`,
		});

		// Grant the system user access to a case.
		const { POST: grantPost } = await import(
			"@/app/api/integrations/[id]/case-grants/route"
		);
		const grantResponse = await grantPost(
			jsonRequest(`/api/integrations/${integrationId}/case-grants`, "POST", {
				caseId: testCase.id,
				permission: "EDIT",
			}),
			idParams(integrationId)
		);
		expect(grantResponse.status).toBe(201);
		expect(
			await prisma.casePermission.findUnique({
				where: {
					caseId_userId: { caseId: testCase.id, userId: systemUserId },
				},
			})
		).not.toBeNull();

		// Revoke that grant explicitly, then grant it again — proving the
		// orphan assertions below exercise the DELETE-time cascade, not just
		// the outcome of this explicit revoke.
		const { DELETE: revokeCaseAccessDelete } = await import(
			"@/app/api/integrations/[id]/case-grants/[caseId]/route"
		);
		const revokeResponse = await revokeCaseAccessDelete(
			jsonRequest(
				`/api/integrations/${integrationId}/case-grants/${testCase.id}`,
				"DELETE"
			),
			{ params: Promise.resolve({ id: integrationId, caseId: testCase.id }) }
		);
		expect(revokeResponse.status).toBe(200);
		expect(
			await prisma.casePermission.findUnique({
				where: {
					caseId_userId: { caseId: testCase.id, userId: systemUserId },
				},
			})
		).toBeNull();

		const regrantResponse = await grantPost(
			jsonRequest(`/api/integrations/${integrationId}/case-grants`, "POST", {
				caseId: testCase.id,
				permission: "VIEW",
			}),
			idParams(integrationId)
		);
		expect(regrantResponse.status).toBe(201);
		expect(
			await prisma.casePermission.findUnique({
				where: {
					caseId_userId: { caseId: testCase.id, userId: systemUserId },
				},
			})
		).not.toBeNull();

		// Delete the integration's registration.
		const { DELETE: deleteIntegrationDelete } = await import(
			"@/app/api/integrations/[id]/route"
		);
		const deleteResponse = await deleteIntegrationDelete(
			jsonRequest(`/api/integrations/${integrationId}`, "DELETE"),
			idParams(integrationId)
		);
		expect(deleteResponse.status).toBe(200);

		// Orphan assertions: the system user itself is gone...
		const orphanUser = await prisma.user.findUnique({
			where: { id: systemUserId },
		});
		expect(orphanUser).toBeNull();

		// ...its CasePermission grant cascaded away with it (not merely
		// unreachable via the now-deleted integration)...
		const orphanGrant = await prisma.casePermission.findUnique({
			where: {
				caseId_userId: { caseId: testCase.id, userId: systemUserId },
			},
		});
		expect(orphanGrant).toBeNull();

		// ...and neither the username nor the email that used to collide on
		// re-registration exist anywhere any more — the leftover-collision
		// path `registerIntegration`'s catch-all unique-constraint handler
		// used to hit is now unreachable, not merely worked around.
		expect(
			await prisma.user.findUnique({
				where: { username: `integration-${name}` },
			})
		).toBeNull();
		expect(
			await prisma.user.findUnique({
				where: { email: `integration+${name}@tea-platform.internal` },
			})
		).toBeNull();

		// Re-registering the exact same name now succeeds instead of
		// misreporting the orphan's leftover unique-constraint collision as
		// "An integration with this name already exists".
		const reregisterResponse = await registerPost(
			jsonRequest("/api/integrations", "POST", {
				name,
				scopes: ["case:read"],
			})
		);
		expect(reregisterResponse.status).toBe(201);
		const reregisterBody = await reregisterResponse.json();
		expect(reregisterBody.integration.name).toBe(name);
		expect(reregisterBody.integration.id).not.toBe(integrationId);
		expect(reregisterBody.integration.systemUserId).not.toBe(systemUserId);
	});

	it("does not touch a DIFFERENT integration's system user or its case-access grants", async () => {
		const owner = await createTestUser();
		const { integration: toDelete, systemUser: systemUserToDelete } =
			await createTestIntegrationWithSystemUser(owner.id, {
				name: "isolation-delete-me",
			});
		const { integration: toKeep, systemUser: systemUserToKeep } =
			await createTestIntegrationWithSystemUser(owner.id, {
				name: "isolation-keep-me",
			});
		const testCase = await createTestCase(owner.id, {
			name: "isolation-case",
		});
		await createTestPermission(
			testCase.id,
			systemUserToDelete.id,
			owner.id,
			"VIEW"
		);
		await createTestPermission(
			testCase.id,
			systemUserToKeep.id,
			owner.id,
			"VIEW"
		);
		await mockAuth(owner.id, owner.username, owner.email);

		const { DELETE } = await import("@/app/api/integrations/[id]/route");
		const response = await DELETE(
			jsonRequest(`/api/integrations/${toDelete.id}`, "DELETE"),
			idParams(toDelete.id)
		);
		expect(response.status).toBe(200);

		expect(
			await prisma.user.findUnique({ where: { id: systemUserToDelete.id } })
		).toBeNull();
		expect(
			await prisma.user.findUnique({ where: { id: systemUserToKeep.id } })
		).not.toBeNull();
		expect(
			await prisma.integration.findUnique({ where: { id: toKeep.id } })
		).not.toBeNull();
		expect(
			await prisma.casePermission.findUnique({
				where: {
					caseId_userId: { caseId: testCase.id, userId: systemUserToKeep.id },
				},
			})
		).not.toBeNull();
	});

	it("still rejects a genuine live name collision with 'already exists' — distinct from the leftover-orphan collision this fix makes unreachable", async () => {
		// `Integration.name` is its own `@unique` column (independent of the
		// system user's username/email uniqueness this fix addresses), so a
		// second registration under the same name MUST keep failing for as
		// long as the first integration is alive and un-deleted. This is the
		// genuine-collision path — it must remain reachable and correctly
		// reported after this fix, never silently swallowed alongside the
		// leftover-orphan path the journey test above proves is now closed.
		const owner = await createTestUser();
		await mockAuth(owner.id, owner.username, owner.email);
		const name = `live-collision-${owner.id}`;

		const { POST } = await import("@/app/api/integrations/route");
		const firstResponse = await POST(
			jsonRequest("/api/integrations", "POST", {
				name,
				scopes: ["case:read"],
			})
		);
		expect(firstResponse.status).toBe(201);
		const { integration: first } = await firstResponse.json();

		const secondResponse = await POST(
			jsonRequest("/api/integrations", "POST", {
				name,
				scopes: ["case:read"],
			})
		);
		expect(secondResponse.status).toBe(409);
		const secondBody = await secondResponse.json();
		expect(secondBody.error).toBe(
			"An integration with this name already exists"
		);

		// The first integration and its system user are untouched — this
		// path never deletes anything, it just refuses the duplicate.
		expect(
			await prisma.integration.findUnique({ where: { id: first.id } })
		).not.toBeNull();
		expect(
			await prisma.user.findUnique({ where: { id: first.systemUserId } })
		).not.toBeNull();
	});
});

// ============================================
// Lifecycle conflict responses (409) — route level
// (nanaki minor, work item 8 — service-level coverage already exists in
// machine-auth.test.ts; these pin the SAME conflicts reach HTTP as 409,
// analogous to the existing route-level 409 tests below/above at the
// reactivate-after-revoke and issue-token-on-suspended cases.)
// ============================================

describe("Lifecycle conflict responses (409) — route level", () => {
	it("suspend: 409 when the integration is already REVOKED", async () => {
		const owner = await createTestUser();
		const { integration } = await createTestIntegrationWithSystemUser(
			owner.id,
			{ status: "REVOKED" }
		);
		await mockAuth(owner.id, owner.username, owner.email);

		const { POST } = await import("@/app/api/integrations/[id]/suspend/route");
		const response = await POST(
			jsonRequest(`/api/integrations/${integration.id}/suspend`, "POST"),
			idParams(integration.id)
		);
		expect(response.status).toBe(409);
	});

	it("reactivate: 409 when the integration is already ACTIVE", async () => {
		const owner = await createTestUser();
		const { integration } = await createTestIntegrationWithSystemUser(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { POST } = await import(
			"@/app/api/integrations/[id]/reactivate/route"
		);
		const response = await POST(
			jsonRequest(`/api/integrations/${integration.id}/reactivate`, "POST"),
			idParams(integration.id)
		);
		expect(response.status).toBe(409);
	});

	it("rotate: 409 when the token's integration is SUSPENDED", async () => {
		const owner = await createTestUser();
		const { integration } = await createTestIntegrationWithSystemUser(
			owner.id,
			{ status: "SUSPENDED" }
		);
		const apiToken = await createTestApiToken(integration.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { POST } = await import(
			"@/app/api/integrations/[id]/tokens/[tokenId]/rotate/route"
		);
		const response = await POST(
			jsonRequest(
				`/api/integrations/${integration.id}/tokens/${apiToken.id}/rotate`,
				"POST"
			),
			tokenParams(integration.id, apiToken.id)
		);
		expect(response.status).toBe(409);
	});

	it("rotate: 409 when the token is already revoked", async () => {
		const owner = await createTestUser();
		const { integration } = await createTestIntegrationWithSystemUser(owner.id);
		const apiToken = await createTestApiToken(integration.id, {
			revokedAt: new Date(),
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const { POST } = await import(
			"@/app/api/integrations/[id]/tokens/[tokenId]/rotate/route"
		);
		const response = await POST(
			jsonRequest(
				`/api/integrations/${integration.id}/tokens/${apiToken.id}/rotate`,
				"POST"
			),
			tokenParams(integration.id, apiToken.id)
		);
		expect(response.status).toBe(409);
	});
});

describe("Lifecycle round-trip via the routes", () => {
	it("suspend → reactivate → suspend, then revoke is terminal (reactivate-after-revoke rejected)", async () => {
		const owner = await createTestUser();
		const { integration } = await createTestIntegrationWithSystemUser(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { POST: suspend } = await import(
			"@/app/api/integrations/[id]/suspend/route"
		);
		const { POST: reactivate } = await import(
			"@/app/api/integrations/[id]/reactivate/route"
		);
		const { POST: revoke } = await import(
			"@/app/api/integrations/[id]/revoke/route"
		);

		const suspended = await suspend(
			jsonRequest(`/api/integrations/${integration.id}/suspend`, "POST"),
			idParams(integration.id)
		);
		expect(suspended.status).toBe(200);
		expect((await suspended.json()).integration.status).toBe("SUSPENDED");

		const reactivated = await reactivate(
			jsonRequest(`/api/integrations/${integration.id}/reactivate`, "POST"),
			idParams(integration.id)
		);
		expect(reactivated.status).toBe(200);
		expect((await reactivated.json()).integration.status).toBe("ACTIVE");

		const suspendedAgain = await suspend(
			jsonRequest(`/api/integrations/${integration.id}/suspend`, "POST"),
			idParams(integration.id)
		);
		expect(suspendedAgain.status).toBe(200);

		const revoked = await revoke(
			jsonRequest(`/api/integrations/${integration.id}/revoke`, "POST"),
			idParams(integration.id)
		);
		expect(revoked.status).toBe(200);
		expect((await revoked.json()).integration.status).toBe("REVOKED");

		const reactivateAfterRevoke = await reactivate(
			jsonRequest(`/api/integrations/${integration.id}/reactivate`, "POST"),
			idParams(integration.id)
		);
		expect(reactivateAfterRevoke.status).toBe(409);
	});

	it("a suspended integration's token fails machine auth (pinned from the route level)", async () => {
		const owner = await createTestUser();
		await mockAuth(owner.id, owner.username, owner.email);

		const { POST: registerRoute } = await import(
			"@/app/api/integrations/route"
		);
		const registered = await registerRoute(
			jsonRequest("/api/integrations", "POST", {
				name: `route-suspend-token-${owner.id}`,
				scopes: ["case:read"],
			})
		);
		const { integration } = (await registered.json()) as {
			integration: { id: string };
		};

		const { POST: issueRoute } = await import(
			"@/app/api/integrations/[id]/tokens/route"
		);
		const issued = await issueRoute(
			jsonRequest(`/api/integrations/${integration.id}/tokens`, "POST", {}),
			idParams(integration.id)
		);
		const { secret } = (await issued.json()) as { secret: string };

		const { POST: suspendRoute } = await import(
			"@/app/api/integrations/[id]/suspend/route"
		);
		await suspendRoute(
			jsonRequest(`/api/integrations/${integration.id}/suspend`, "POST"),
			idParams(integration.id)
		);

		const { GET: whoami } = await import("@/app/api/machine/whoami/route");
		const whoamiResponse = await whoami(
			new NextRequest("http://localhost:3000/api/machine/whoami", {
				headers: { authorization: `Bearer ${secret}` },
			})
		);
		expect(whoamiResponse.status).toBe(401);
	});
});

// ============================================
// POST /api/integrations/[id]/tokens (issue)
// ============================================

describe("POST /api/integrations/[id]/tokens — issuance", () => {
	it("returns 401 when unauthenticated", async () => {
		const owner = await createTestUser();
		const { integration } = await createTestIntegrationWithSystemUser(owner.id);
		const { POST } = await import("@/app/api/integrations/[id]/tokens/route");

		const response = await POST(
			jsonRequest(`/api/integrations/${integration.id}/tokens`, "POST", {}),
			idParams(integration.id)
		);
		expect(response.status).toBe(401);
	});

	it("returns the plaintext secret exactly once, absent from any subsequent GET", async () => {
		const owner = await createTestUser();
		const { integration } = await createTestIntegrationWithSystemUser(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { POST } = await import("@/app/api/integrations/[id]/tokens/route");
		const response = await POST(
			jsonRequest(`/api/integrations/${integration.id}/tokens`, "POST", {}),
			idParams(integration.id)
		);
		expect(response.status).toBe(201);
		const body = await response.json();
		expect(typeof body.secret).toBe("string");
		expect(body.secret.length).toBeGreaterThan(0);
		expect(body.token.tokenPrefix).toBeDefined();

		const { GET } = await import("@/app/api/integrations/route");
		const listResponse = await GET();
		const listBody = await listResponse.json();
		expect(JSON.stringify(listBody)).not.toContain(body.secret);
	});

	it("returns BYTE-IDENTICAL 404s for a non-owner vs a nonexistent integration id", async () => {
		const owner = await createTestUser();
		const outsider = await createTestUser();
		const { integration } = await createTestIntegrationWithSystemUser(owner.id);
		await mockAuth(outsider.id, outsider.username, outsider.email);

		const { POST } = await import("@/app/api/integrations/[id]/tokens/route");
		const nonOwnerResponse = await POST(
			jsonRequest(`/api/integrations/${integration.id}/tokens`, "POST", {}),
			idParams(integration.id)
		);
		const nonexistentResponse = await POST(
			jsonRequest(`/api/integrations/${NOT_FOUND_ID}/tokens`, "POST", {}),
			idParams(NOT_FOUND_ID)
		);

		expect(nonOwnerResponse.status).toBe(404);
		expect(nonOwnerResponse.status).toBe(nonexistentResponse.status);
		const nonOwnerBody = await nonOwnerResponse.json();
		const nonexistentBody = await nonexistentResponse.json();
		expect(nonOwnerBody).toEqual(nonexistentBody);
		expect(nonOwnerBody.error).toBe(INTEGRATION_NOT_FOUND);
	});

	it("refuses to issue a token for a non-active (suspended) integration with 409", async () => {
		const owner = await createTestUser();
		const { integration } = await createTestIntegrationWithSystemUser(
			owner.id,
			{ status: "SUSPENDED" }
		);
		await mockAuth(owner.id, owner.username, owner.email);

		const { POST } = await import("@/app/api/integrations/[id]/tokens/route");
		const response = await POST(
			jsonRequest(`/api/integrations/${integration.id}/tokens`, "POST", {}),
			idParams(integration.id)
		);
		expect(response.status).toBe(409);
	});

	it("rejects a past expiresAt with 400", async () => {
		const owner = await createTestUser();
		const { integration } = await createTestIntegrationWithSystemUser(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { POST } = await import("@/app/api/integrations/[id]/tokens/route");
		const response = await POST(
			jsonRequest(`/api/integrations/${integration.id}/tokens`, "POST", {
				expiresAt: new Date(Date.now() - 60_000).toISOString(),
			}),
			idParams(integration.id)
		);
		expect(response.status).toBe(400);
	});

	it("writes a SecurityAuditLog row for token issuance", async () => {
		const owner = await createTestUser();
		const { integration } = await createTestIntegrationWithSystemUser(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { POST } = await import("@/app/api/integrations/[id]/tokens/route");
		await POST(
			jsonRequest(`/api/integrations/${integration.id}/tokens`, "POST", {}),
			idParams(integration.id)
		);

		const event = await prisma.securityAuditLog.findFirst({
			where: { userId: owner.id, eventType: "token_issued" },
		});
		expect(event).not.toBeNull();
	});
});

// ============================================
// POST /api/integrations/[id]/tokens/[tokenId]/rotate
// ============================================

describe("POST /api/integrations/[id]/tokens/[tokenId]/rotate", () => {
	it("returns 401 when unauthenticated", async () => {
		const owner = await createTestUser();
		const { integration } = await createTestIntegrationWithSystemUser(owner.id);
		const apiToken = await createTestApiToken(integration.id);
		const { POST } = await import(
			"@/app/api/integrations/[id]/tokens/[tokenId]/rotate/route"
		);

		const response = await POST(
			jsonRequest(
				`/api/integrations/${integration.id}/tokens/${apiToken.id}/rotate`,
				"POST"
			),
			tokenParams(integration.id, apiToken.id)
		);
		expect(response.status).toBe(401);
	});

	it("rotates the token, returning a new plaintext secret exactly once", async () => {
		const owner = await createTestUser();
		const { integration } = await createTestIntegrationWithSystemUser(owner.id);
		const apiToken = await createTestApiToken(integration.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { POST } = await import(
			"@/app/api/integrations/[id]/tokens/[tokenId]/rotate/route"
		);
		const response = await POST(
			jsonRequest(
				`/api/integrations/${integration.id}/tokens/${apiToken.id}/rotate`,
				"POST"
			),
			tokenParams(integration.id, apiToken.id)
		);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(typeof body.secret).toBe("string");
		expect(body.oldTokenId).toBe(apiToken.id);
		expect(body.token.id).not.toBe(apiToken.id);
	});

	it("returns BYTE-IDENTICAL 404s for a non-owner vs a nonexistent token id", async () => {
		const owner = await createTestUser();
		const outsider = await createTestUser();
		const { integration } = await createTestIntegrationWithSystemUser(owner.id);
		const apiToken = await createTestApiToken(integration.id);
		await mockAuth(outsider.id, outsider.username, outsider.email);

		const { POST } = await import(
			"@/app/api/integrations/[id]/tokens/[tokenId]/rotate/route"
		);
		const nonOwnerResponse = await POST(
			jsonRequest(
				`/api/integrations/${integration.id}/tokens/${apiToken.id}/rotate`,
				"POST"
			),
			tokenParams(integration.id, apiToken.id)
		);
		const nonexistentResponse = await POST(
			jsonRequest(
				`/api/integrations/${integration.id}/tokens/${NOT_FOUND_ID}/rotate`,
				"POST"
			),
			tokenParams(integration.id, NOT_FOUND_ID)
		);

		expect(nonOwnerResponse.status).toBe(404);
		expect(nonOwnerResponse.status).toBe(nonexistentResponse.status);
		const nonOwnerBody = await nonOwnerResponse.json();
		const nonexistentBody = await nonexistentResponse.json();
		expect(nonOwnerBody).toEqual(nonexistentBody);
		expect(nonOwnerBody.error).toBe(TOKEN_NOT_FOUND);
	});

	/**
	 * Deviation-5 fix (cid SHOULD-FIX, work item 2): a tokenId that exists
	 * and IS owned by the caller, but belongs to a DIFFERENT integration the
	 * SAME owner also owns, must be rejected identically to a nonexistent
	 * tokenId — not silently rotated via the "wrong" path `[id]`. Regression
	 * pair per nanaki's prescription: two integrations under the same
	 * owner, token issued under B, rotate attempted via A's path.
	 */
	it("rejects a tokenId that belongs to a DIFFERENT integration under the SAME owner, identically to a nonexistent tokenId", async () => {
		const owner = await createTestUser();
		const { integration: integrationA } =
			await createTestIntegrationWithSystemUser(owner.id, { name: "int-a" });
		const { integration: integrationB } =
			await createTestIntegrationWithSystemUser(owner.id, { name: "int-b" });
		const tokenB = await createTestApiToken(integrationB.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { POST } = await import(
			"@/app/api/integrations/[id]/tokens/[tokenId]/rotate/route"
		);
		const crossPathResponse = await POST(
			jsonRequest(
				`/api/integrations/${integrationA.id}/tokens/${tokenB.id}/rotate`,
				"POST"
			),
			tokenParams(integrationA.id, tokenB.id)
		);
		const nonexistentResponse = await POST(
			jsonRequest(
				`/api/integrations/${integrationA.id}/tokens/${NOT_FOUND_ID}/rotate`,
				"POST"
			),
			tokenParams(integrationA.id, NOT_FOUND_ID)
		);

		expect(crossPathResponse.status).toBe(404);
		expect(crossPathResponse.status).toBe(nonexistentResponse.status);
		const crossPathBody = await crossPathResponse.json();
		const nonexistentBody = await nonexistentResponse.json();
		expect(crossPathBody).toEqual(nonexistentBody);
		expect(crossPathBody.error).toBe(TOKEN_NOT_FOUND);

		// Must NOT have been rotated — still exactly one token on integration B.
		const tokens = await prisma.apiToken.findMany({
			where: { integrationId: integrationB.id },
		});
		expect(tokens).toHaveLength(1);
	});

	it("writes a SecurityAuditLog row for token rotation", async () => {
		const owner = await createTestUser();
		const { integration } = await createTestIntegrationWithSystemUser(owner.id);
		const apiToken = await createTestApiToken(integration.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { POST } = await import(
			"@/app/api/integrations/[id]/tokens/[tokenId]/rotate/route"
		);
		await POST(
			jsonRequest(
				`/api/integrations/${integration.id}/tokens/${apiToken.id}/rotate`,
				"POST"
			),
			tokenParams(integration.id, apiToken.id)
		);

		const event = await prisma.securityAuditLog.findFirst({
			where: { userId: owner.id, eventType: "token_rotated" },
		});
		expect(event).not.toBeNull();
	});
});

// ============================================
// DELETE /api/integrations/[id]/tokens/[tokenId]
// ============================================

describe("DELETE /api/integrations/[id]/tokens/[tokenId]", () => {
	it("returns 401 when unauthenticated", async () => {
		const owner = await createTestUser();
		const { integration } = await createTestIntegrationWithSystemUser(owner.id);
		const apiToken = await createTestApiToken(integration.id);
		const { DELETE } = await import(
			"@/app/api/integrations/[id]/tokens/[tokenId]/route"
		);

		const response = await DELETE(
			jsonRequest(
				`/api/integrations/${integration.id}/tokens/${apiToken.id}`,
				"DELETE"
			),
			tokenParams(integration.id, apiToken.id)
		);
		expect(response.status).toBe(401);
	});

	it("revokes the token immediately", async () => {
		const owner = await createTestUser();
		const { integration } = await createTestIntegrationWithSystemUser(owner.id);
		const apiToken = await createTestApiToken(integration.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { DELETE } = await import(
			"@/app/api/integrations/[id]/tokens/[tokenId]/route"
		);
		const response = await DELETE(
			jsonRequest(
				`/api/integrations/${integration.id}/tokens/${apiToken.id}`,
				"DELETE"
			),
			tokenParams(integration.id, apiToken.id)
		);

		expect(response.status).toBe(200);
		const revoked = await prisma.apiToken.findUniqueOrThrow({
			where: { id: apiToken.id },
		});
		expect(revoked.revokedAt).not.toBeNull();
	});

	it("returns BYTE-IDENTICAL 404s for a non-owner vs a nonexistent token id", async () => {
		const owner = await createTestUser();
		const outsider = await createTestUser();
		const { integration } = await createTestIntegrationWithSystemUser(owner.id);
		const apiToken = await createTestApiToken(integration.id);
		await mockAuth(outsider.id, outsider.username, outsider.email);

		const { DELETE } = await import(
			"@/app/api/integrations/[id]/tokens/[tokenId]/route"
		);
		const nonOwnerResponse = await DELETE(
			jsonRequest(
				`/api/integrations/${integration.id}/tokens/${apiToken.id}`,
				"DELETE"
			),
			tokenParams(integration.id, apiToken.id)
		);
		const nonexistentResponse = await DELETE(
			jsonRequest(
				`/api/integrations/${integration.id}/tokens/${NOT_FOUND_ID}`,
				"DELETE"
			),
			tokenParams(integration.id, NOT_FOUND_ID)
		);

		expect(nonOwnerResponse.status).toBe(404);
		expect(nonOwnerResponse.status).toBe(nonexistentResponse.status);
		const nonOwnerBody = await nonOwnerResponse.json();
		const nonexistentBody = await nonexistentResponse.json();
		expect(nonOwnerBody).toEqual(nonexistentBody);
		expect(nonOwnerBody.error).toBe(TOKEN_NOT_FOUND);
	});

	/**
	 * Deviation-5 fix, DELETE-revoke equivalent of the rotate-route
	 * regression pair above (work item 2, nanaki's prescription).
	 */
	it("rejects a tokenId that belongs to a DIFFERENT integration under the SAME owner, identically to a nonexistent tokenId", async () => {
		const owner = await createTestUser();
		const { integration: integrationA } =
			await createTestIntegrationWithSystemUser(owner.id, { name: "int-a" });
		const { integration: integrationB } =
			await createTestIntegrationWithSystemUser(owner.id, { name: "int-b" });
		const tokenB = await createTestApiToken(integrationB.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { DELETE } = await import(
			"@/app/api/integrations/[id]/tokens/[tokenId]/route"
		);
		const crossPathResponse = await DELETE(
			jsonRequest(
				`/api/integrations/${integrationA.id}/tokens/${tokenB.id}`,
				"DELETE"
			),
			tokenParams(integrationA.id, tokenB.id)
		);
		const nonexistentResponse = await DELETE(
			jsonRequest(
				`/api/integrations/${integrationA.id}/tokens/${NOT_FOUND_ID}`,
				"DELETE"
			),
			tokenParams(integrationA.id, NOT_FOUND_ID)
		);

		expect(crossPathResponse.status).toBe(404);
		expect(crossPathResponse.status).toBe(nonexistentResponse.status);
		const crossPathBody = await crossPathResponse.json();
		const nonexistentBody = await nonexistentResponse.json();
		expect(crossPathBody).toEqual(nonexistentBody);
		expect(crossPathBody.error).toBe(TOKEN_NOT_FOUND);

		// Must NOT have been revoked by the cross-path call.
		const stillActive = await prisma.apiToken.findUniqueOrThrow({
			where: { id: tokenB.id },
		});
		expect(stillActive.revokedAt).toBeNull();
	});

	it("writes a SecurityAuditLog row for token revocation", async () => {
		const owner = await createTestUser();
		const { integration } = await createTestIntegrationWithSystemUser(owner.id);
		const apiToken = await createTestApiToken(integration.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { DELETE } = await import(
			"@/app/api/integrations/[id]/tokens/[tokenId]/route"
		);
		await DELETE(
			jsonRequest(
				`/api/integrations/${integration.id}/tokens/${apiToken.id}`,
				"DELETE"
			),
			tokenParams(integration.id, apiToken.id)
		);

		const event = await prisma.securityAuditLog.findFirst({
			where: { userId: owner.id, eventType: "token_revoked" },
		});
		expect(event).not.toBeNull();
	});
});
