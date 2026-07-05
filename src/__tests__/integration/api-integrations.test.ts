import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	createTestApiToken,
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

describe("POST /api/integrations/[id]/suspend|reactivate|revoke — permission matrix", () => {
	const cases: Array<{
		importRoute: () => Promise<{
			POST: (
				req: Request,
				ctx: { params: Promise<{ id: string }> }
			) => Promise<Response>;
		}>;
		path: string;
	}> = [
		{
			path: "suspend",
			importRoute: () => import("@/app/api/integrations/[id]/suspend/route"),
		},
		{
			path: "revoke",
			importRoute: () => import("@/app/api/integrations/[id]/revoke/route"),
		},
	];

	for (const { path, importRoute } of cases) {
		it(`${path}: returns 401 when unauthenticated`, async () => {
			const owner = await createTestUser();
			const { integration } = await createTestIntegrationWithSystemUser(
				owner.id
			);
			const { POST } = await importRoute();

			const response = await POST(
				jsonRequest(`/api/integrations/${integration.id}/${path}`, "POST"),
				idParams(integration.id)
			);
			expect(response.status).toBe(401);
		});

		it(`${path}: returns BYTE-IDENTICAL 404s for a non-owner vs a nonexistent id`, async () => {
			const owner = await createTestUser();
			const outsider = await createTestUser();
			const { integration } = await createTestIntegrationWithSystemUser(
				owner.id
			);
			await mockAuth(outsider.id, outsider.username, outsider.email);

			const { POST } = await importRoute();
			const nonOwnerResponse = await POST(
				jsonRequest(`/api/integrations/${integration.id}/${path}`, "POST"),
				idParams(integration.id)
			);
			const nonexistentResponse = await POST(
				jsonRequest(`/api/integrations/${NOT_FOUND_ID}/${path}`, "POST"),
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
