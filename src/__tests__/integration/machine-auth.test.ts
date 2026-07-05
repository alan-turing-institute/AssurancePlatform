import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { GET as whoamiGET } from "@/app/api/machine/whoami/route";
import {
	generateApiTokenSecret,
	hashApiTokenSecret,
	TOKEN_PREFIX,
	tokenDisplayPrefix,
} from "@/lib/auth/api-token-service";
import prisma from "@/lib/prisma";
import {
	deleteIntegrationRegistration,
	getIntegrationsOwnedBy,
	issueToken,
	reactivateIntegration,
	reassignIntegrationOwner,
	registerIntegration,
	revokeIntegration,
	revokeToken,
	rotateToken,
	suspendIntegration,
	TOKEN_ROTATION_OVERLAP_MS,
	updateIntegration,
	updateIntegrationScopes,
	validateApiToken,
} from "@/lib/services/integration-registry-service";
import { RATE_LIMIT_CONFIGS } from "@/lib/services/rate-limit-service";
import {
	expectError,
	expectSameError,
	expectSuccess,
} from "../utils/assertion-helpers";
import { createTestUser } from "../utils/prisma-factories";

const AUTH_FAILURE_MESSAGE = "Invalid or expired token";
const UNKNOWN_SCOPE_PATTERN = /Unknown scope/;
const ALREADY_EXISTS_PATTERN = /already exists/;
const NON_ACTIVE_PATTERN = /non-active/;
const ALREADY_REVOKED_PATTERN = /revoked/;
const NOT_FOUND_PATTERN = /not found/i;
const NOT_FOUND_ID = "00000000-0000-0000-0000-000000000000";
const INTEGRATION_NOT_FOUND = "Integration not found";
const TOKEN_NOT_FOUND = "Token not found";
const CANNOT_REVOKED_PATTERN = /revoked/i;
const ALREADY_ACTIVE_PATTERN = /already active/i;

/**
 * Ownership enforcement (vincent security review 2026-07-03, finding 3 —
 * the management API hard precondition): every mutating function below
 * verifies the ACTOR owns the integration (or the integration behind a
 * token) before acting. A non-owner gets the EXACT SAME "Integration not
 * found" / "Token not found" error as acting on a nonexistent id — never a
 * distinct "Permission denied" — so a caller can't use the response to
 * learn whether an id exists at all. `expectSameError` asserts the two
 * failure modes are byte-identical, not just "both errors".
 */
describe("service-boundary authorisation — non-owner gets the SAME error as nonexistent (no oracle)", () => {
	it("updateIntegrationScopes: non-owner vs nonexistent id", async () => {
		const { integration } = await registerTestIntegration();
		const outsider = await createTestUser();

		const nonOwner = await updateIntegrationScopes(
			integration.id,
			["case:read"],
			outsider.id
		);
		const nonexistent = await updateIntegrationScopes(
			NOT_FOUND_ID,
			["case:read"],
			outsider.id
		);

		expectError(nonOwner, INTEGRATION_NOT_FOUND);
		expectSameError(nonOwner, nonexistent);
	});

	it("suspendIntegration: non-owner vs nonexistent id", async () => {
		const { integration } = await registerTestIntegration();
		const outsider = await createTestUser();

		const nonOwner = await suspendIntegration(integration.id, outsider.id);
		const nonexistent = await suspendIntegration(NOT_FOUND_ID, outsider.id);

		expectError(nonOwner, INTEGRATION_NOT_FOUND);
		expectSameError(nonOwner, nonexistent);
	});

	it("reactivateIntegration: non-owner vs nonexistent id", async () => {
		const { integration, owner } = await registerTestIntegration();
		await suspendIntegration(integration.id, owner.id);
		const outsider = await createTestUser();

		const nonOwner = await reactivateIntegration(integration.id, outsider.id);
		const nonexistent = await reactivateIntegration(NOT_FOUND_ID, outsider.id);

		expectError(nonOwner, INTEGRATION_NOT_FOUND);
		expectSameError(nonOwner, nonexistent);
	});

	it("revokeIntegration: non-owner vs nonexistent id", async () => {
		const { integration } = await registerTestIntegration();
		const outsider = await createTestUser();

		const nonOwner = await revokeIntegration(integration.id, outsider.id);
		const nonexistent = await revokeIntegration(NOT_FOUND_ID, outsider.id);

		expectError(nonOwner, INTEGRATION_NOT_FOUND);
		expectSameError(nonOwner, nonexistent);
	});

	it("reassignIntegrationOwner: non-owner vs nonexistent id", async () => {
		const { integration } = await registerTestIntegration();
		const outsider = await createTestUser();
		const newOwner = await createTestUser();

		const nonOwner = await reassignIntegrationOwner(
			integration.id,
			newOwner.id,
			outsider.id
		);
		const nonexistent = await reassignIntegrationOwner(
			NOT_FOUND_ID,
			newOwner.id,
			outsider.id
		);

		expectError(nonOwner, INTEGRATION_NOT_FOUND);
		expectSameError(nonOwner, nonexistent);
	});

	it("deleteIntegrationRegistration: non-owner vs nonexistent id", async () => {
		const { integration } = await registerTestIntegration();
		const outsider = await createTestUser();

		const nonOwner = await deleteIntegrationRegistration(
			integration.id,
			outsider.id
		);
		const nonexistent = await deleteIntegrationRegistration(
			NOT_FOUND_ID,
			outsider.id
		);

		expectError(nonOwner, INTEGRATION_NOT_FOUND);
		expectSameError(nonOwner, nonexistent);

		// Must NOT have been deleted — the outsider's call had no effect.
		const stillThere = await prisma.integration.findUnique({
			where: { id: integration.id },
		});
		expect(stillThere).not.toBeNull();
	});

	it("issueToken: non-owner vs nonexistent integration id", async () => {
		const { integration } = await registerTestIntegration();
		const outsider = await createTestUser();

		const nonOwner = await issueToken(integration.id, outsider.id);
		const nonexistent = await issueToken(NOT_FOUND_ID, outsider.id);

		expectError(nonOwner, INTEGRATION_NOT_FOUND);
		expectSameError(nonOwner, nonexistent);

		// No token was actually issued for the non-owned integration.
		const tokens = await prisma.apiToken.findMany({
			where: { integrationId: integration.id },
		});
		expect(tokens).toHaveLength(0);
	});

	it("rotateToken: non-owner vs nonexistent token id", async () => {
		const { integration, owner } = await registerTestIntegration();
		const { apiToken } = expectSuccess(
			await issueToken(integration.id, owner.id)
		);
		const outsider = await createTestUser();

		const nonOwner = await rotateToken(apiToken.id, outsider.id);
		const nonexistent = await rotateToken(NOT_FOUND_ID, outsider.id);

		expectError(nonOwner, TOKEN_NOT_FOUND);
		expectSameError(nonOwner, nonexistent);

		// The token was not rotated — still exactly one token on the integration.
		const tokens = await prisma.apiToken.findMany({
			where: { integrationId: integration.id },
		});
		expect(tokens).toHaveLength(1);
	});

	it("revokeToken: non-owner vs nonexistent token id", async () => {
		const { integration, owner } = await registerTestIntegration();
		const { apiToken } = expectSuccess(
			await issueToken(integration.id, owner.id)
		);
		const outsider = await createTestUser();

		const nonOwner = await revokeToken(apiToken.id, outsider.id);
		const nonexistent = await revokeToken(NOT_FOUND_ID, outsider.id);

		expectError(nonOwner, TOKEN_NOT_FOUND);
		expectSameError(nonOwner, nonexistent);

		// The token was not revoked by the outsider's call.
		const stillActive = await prisma.apiToken.findUniqueOrThrow({
			where: { id: apiToken.id },
		});
		expect(stillActive.revokedAt).toBeNull();
	});

	it("registerIntegration binds ownership to the session actor regardless of body content — there is no ownerId field to spoof", async () => {
		const actor = await createTestUser();
		const result = expectSuccess(
			await registerIntegration(
				{ name: `no-spoof-${actor.id}`, scopes: ["case:read"] },
				actor.id
			)
		);
		expect(result.integration.ownerId).toBe(actor.id);
	});
});

describe("reactivateIntegration — lifecycle (barret deviation 6, 2026-07-03: suspend was a one-way door)", () => {
	it("reactivates a SUSPENDED integration back to ACTIVE", async () => {
		const { integration, owner } = await registerTestIntegration();
		expectSuccess(await suspendIntegration(integration.id, owner.id));

		const reactivated = expectSuccess(
			await reactivateIntegration(integration.id, owner.id)
		);
		expect(reactivated.status).toBe("ACTIVE");
	});

	it("suspend → reactivate → suspend cycles cleanly", async () => {
		const { integration, owner } = await registerTestIntegration();

		expectSuccess(await suspendIntegration(integration.id, owner.id));
		expectSuccess(await reactivateIntegration(integration.id, owner.id));
		const suspendedAgain = expectSuccess(
			await suspendIntegration(integration.id, owner.id)
		);

		expect(suspendedAgain.status).toBe("SUSPENDED");
	});

	it("refuses to reactivate a REVOKED integration — terminal, not a resurrection", async () => {
		const { integration, owner } = await registerTestIntegration();
		expectSuccess(await revokeIntegration(integration.id, owner.id));

		const result = await reactivateIntegration(integration.id, owner.id);
		expectError(result, CANNOT_REVOKED_PATTERN);

		const unchanged = await prisma.integration.findUniqueOrThrow({
			where: { id: integration.id },
		});
		expect(unchanged.status).toBe("REVOKED");
	});

	it("refuses to reactivate an already-ACTIVE integration", async () => {
		const { integration, owner } = await registerTestIntegration();

		const result = await reactivateIntegration(integration.id, owner.id);
		expectError(result, ALREADY_ACTIVE_PATTERN);
	});

	it("refuses to SUSPEND a REVOKED integration — suspend must not un-revoke it", async () => {
		const { integration, owner } = await registerTestIntegration();
		expectSuccess(await revokeIntegration(integration.id, owner.id));

		const result = await suspendIntegration(integration.id, owner.id);
		expectError(result, CANNOT_REVOKED_PATTERN);

		const unchanged = await prisma.integration.findUniqueOrThrow({
			where: { id: integration.id },
		});
		expect(unchanged.status).toBe("REVOKED");
	});

	it("writes a SecurityAuditLog row for reactivation", async () => {
		const { integration, owner } = await registerTestIntegration();
		await suspendIntegration(integration.id, owner.id);
		await reactivateIntegration(integration.id, owner.id);

		const event = await prisma.securityAuditLog.findFirst({
			where: { userId: owner.id, eventType: "integration_reactivated" },
		});
		expect(event).not.toBeNull();
	});
});

describe("updateIntegration — description and scopes, partial updates", () => {
	it("updates description only, leaving scopes untouched", async () => {
		const { integration, owner } = await registerTestIntegration(["case:read"]);

		const result = expectSuccess(
			await updateIntegration(
				integration.id,
				{ description: "a new description" },
				owner.id
			)
		);

		expect(result.description).toBe("a new description");
		expect(result.scopes).toEqual(["case:read"]);
	});

	it("updates scopes only, leaving description untouched", async () => {
		const { integration, owner } = await registerTestIntegration(["case:read"]);

		const result = expectSuccess(
			await updateIntegration(
				integration.id,
				{ scopes: ["case:read", "health:evidence:read"] },
				owner.id
			)
		);

		expect(result.scopes).toEqual(["case:read", "health:evidence:read"]);
	});

	it("rejects an unknown scope without persisting anything", async () => {
		const { integration, owner } = await registerTestIntegration();

		const result = await updateIntegration(
			integration.id,
			{ scopes: ["case:read", "not-a-real-scope"] },
			owner.id
		);
		expectError(result, UNKNOWN_SCOPE_PATTERN);
	});

	it("writes a SecurityAuditLog row for an update", async () => {
		const { integration, owner } = await registerTestIntegration();
		await updateIntegration(
			integration.id,
			{ description: "updated" },
			owner.id
		);

		const event = await prisma.securityAuditLog.findFirst({
			where: { userId: owner.id, eventType: "integration_updated" },
		});
		expect(event).not.toBeNull();
	});
});

/** Creates a raw ApiToken row with a known plaintext secret (for edge cases the service's own issueToken doesn't cover, e.g. a past expiresAt). */
async function createRawToken(
	integrationId: string,
	overrides: Partial<{ expiresAt: Date; revokedAt: Date }> = {}
) {
	const secret = generateApiTokenSecret();
	const apiToken = await prisma.apiToken.create({
		data: {
			integrationId,
			tokenHash: hashApiTokenSecret(secret),
			tokenPrefix: tokenDisplayPrefix(secret),
			...overrides,
		},
	});
	return { secret, apiToken };
}

async function registerTestIntegration(
	scopes: string[] = ["case:read", "health:evidence:write"]
) {
	const owner = await createTestUser();
	const result = expectSuccess(
		await registerIntegration(
			{ name: `test-integration-${owner.id}`, scopes },
			owner.id
		)
	);
	return { owner, ...result };
}

/** Builds a `whoami` request with the given headers (omit `authorization` to simulate a missing token). */
function whoamiRequest(headers: Record<string, string> = {}): NextRequest {
	return new NextRequest("http://localhost:3000/api/machine/whoami", {
		headers,
	});
}

describe("integration-registry-service — registration & lifecycle", () => {
	it("registers an integration with its own system user", async () => {
		const { integration, systemUserId } = await registerTestIntegration();

		expect(integration.status).toBe("ACTIVE");
		const systemUser = await prisma.user.findUniqueOrThrow({
			where: { id: systemUserId },
		});
		expect(systemUser.isSystemUser).toBe(true);
	});

	it("rejects registration with an unknown scope (loud failure, nothing persisted)", async () => {
		const owner = await createTestUser();
		const result = await registerIntegration(
			{
				name: "bad-scope-integration",
				scopes: ["case:read", "not-a-real-scope"],
			},
			owner.id
		);
		expectError(result, UNKNOWN_SCOPE_PATTERN);

		const persisted = await prisma.integration.findUnique({
			where: { name: "bad-scope-integration" },
		});
		expect(persisted).toBeNull();
	});

	it("rejects updateIntegrationScopes with an unknown scope", async () => {
		const { integration, owner } = await registerTestIntegration();
		const result = await updateIntegrationScopes(
			integration.id,
			["case:read", "evil:scope"],
			owner.id
		);
		expectError(result, UNKNOWN_SCOPE_PATTERN);

		const unchanged = await prisma.integration.findUniqueOrThrow({
			where: { id: integration.id },
		});
		expect(unchanged.scopes).toEqual(integration.scopes);
	});

	it("rejects a duplicate integration name", async () => {
		const owner = await createTestUser();
		expectSuccess(
			await registerIntegration(
				{ name: "dup-name", scopes: ["case:read"] },
				owner.id
			)
		);
		const second = await registerIntegration(
			{ name: "dup-name", scopes: ["case:read"] },
			owner.id
		);
		expectError(second, ALREADY_EXISTS_PATTERN);
	});

	it("suspends an integration", async () => {
		const { integration, owner } = await registerTestIntegration();
		const suspended = expectSuccess(
			await suspendIntegration(integration.id, owner.id)
		);
		expect(suspended.status).toBe("SUSPENDED");
	});

	it("revokes an integration and revokes all its unrevoked tokens", async () => {
		const { integration, owner } = await registerTestIntegration();
		const { apiToken } = expectSuccess(
			await issueToken(integration.id, owner.id)
		);

		const revoked = expectSuccess(
			await revokeIntegration(integration.id, owner.id)
		);
		expect(revoked.status).toBe("REVOKED");

		const token = await prisma.apiToken.findUniqueOrThrow({
			where: { id: apiToken.id },
		});
		expect(token.revokedAt).not.toBeNull();
	});

	/**
	 * `revokeIntegration` has no guard against being called twice — unlike
	 * `suspendIntegration`/`reactivateIntegration`, which both explicitly
	 * reject a REVOKED-state transition, re-revoking an already-REVOKED
	 * integration is a harmless no-op success today. Pinning this is
	 * deliberate, not an oversight rediscovery (nanaki info finding, work
	 * item 12): a caller retrying a revoke after a dropped response
	 * (network blip, client retry) gets a clean success, not a spurious
	 * error. If this idempotence is ever tightened into a conflict, this
	 * test should be updated alongside that decision, not silently broken.
	 */
	it("is idempotent: revoking an already-REVOKED integration succeeds harmlessly (deliberate)", async () => {
		const { integration, owner } = await registerTestIntegration();

		expectSuccess(await revokeIntegration(integration.id, owner.id));
		const secondCall = expectSuccess(
			await revokeIntegration(integration.id, owner.id)
		);
		expect(secondCall.status).toBe("REVOKED");
	});

	it("writes an audit log entry for registration, suspension, and revocation", async () => {
		const { integration, owner } = await registerTestIntegration();
		await suspendIntegration(integration.id, owner.id);
		await revokeIntegration(integration.id, owner.id);

		const events = await prisma.securityAuditLog.findMany({
			where: { userId: owner.id },
			orderBy: { createdAt: "asc" },
		});
		const eventTypes = events.map((e) => e.eventType);
		expect(eventTypes).toEqual(
			expect.arrayContaining([
				"integration_registered",
				"integration_suspended",
				"integration_revoked",
			])
		);
	});
});

describe("integration-registry-service — owner-deletion flow", () => {
	it("lists integrations owned by a user", async () => {
		const { integration, owner } = await registerTestIntegration();
		const owned = expectSuccess(await getIntegrationsOwnedBy(owner.id));
		expect(owned.map((i) => i.id)).toContain(integration.id);
	});

	it("reassigns an integration's owner", async () => {
		const { integration, owner } = await registerTestIntegration();
		const newOwner = await createTestUser();

		const updated = expectSuccess(
			await reassignIntegrationOwner(integration.id, newOwner.id, owner.id)
		);
		expect(updated.ownerId).toBe(newOwner.id);
	});

	it("hard-deletes an integration registration, cascading its tokens", async () => {
		const { integration, owner } = await registerTestIntegration();
		const { apiToken } = expectSuccess(
			await issueToken(integration.id, owner.id)
		);

		expectSuccess(
			await deleteIntegrationRegistration(integration.id, owner.id)
		);

		const gone = await prisma.integration.findUnique({
			where: { id: integration.id },
		});
		expect(gone).toBeNull();
		const tokenGone = await prisma.apiToken.findUnique({
			where: { id: apiToken.id },
		});
		expect(tokenGone).toBeNull();
	});

	it("clears the way for owner deletion once integrations are reassigned or deleted (DB RESTRICT no longer blocks)", async () => {
		const { integration, owner } = await registerTestIntegration();
		const newOwner = await createTestUser();

		expectSuccess(
			await reassignIntegrationOwner(integration.id, newOwner.id, owner.id)
		);

		// The original owner no longer owns any integration, so the DB's
		// unconditional ON DELETE RESTRICT on Integration.ownerId no longer applies.
		await expect(
			prisma.user.delete({ where: { id: owner.id } })
		).resolves.toBeDefined();
	});
});

describe("integration-registry-service — token lifecycle", () => {
	it("issues a token whose plaintext authenticates and whose secret is never persisted", async () => {
		const { integration, owner } = await registerTestIntegration();
		const { secret, apiToken } = expectSuccess(
			await issueToken(integration.id, owner.id)
		);

		expect(secret.startsWith(TOKEN_PREFIX)).toBe(true);
		expect(apiToken.tokenHash).not.toBe(secret);

		const result = await validateApiToken({
			token: secret,
			ipAddress: "203.0.113.10",
		});
		expectSuccess(result);
	});

	it("refuses to issue a token for a non-ACTIVE integration", async () => {
		const { integration, owner } = await registerTestIntegration();
		await suspendIntegration(integration.id, owner.id);

		const result = await issueToken(integration.id, owner.id);
		expectError(result, NON_ACTIVE_PATTERN);
	});

	it("rotates a token: both old and new authenticate during the overlap window", async () => {
		const { integration, owner } = await registerTestIntegration();
		const { secret: oldSecret, apiToken: oldApiToken } = expectSuccess(
			await issueToken(integration.id, owner.id)
		);

		const rotated = expectSuccess(await rotateToken(oldApiToken.id, owner.id));
		expect(rotated.newToken.secret.startsWith(TOKEN_PREFIX)).toBe(true);

		const oldResult = await validateApiToken({
			token: oldSecret,
			ipAddress: "203.0.113.11",
		});
		expectSuccess(oldResult);

		const newResult = await validateApiToken({
			token: rotated.newToken.secret,
			ipAddress: "203.0.113.11",
		});
		expectSuccess(newResult);

		const oldRow = await prisma.apiToken.findUniqueOrThrow({
			where: { id: oldApiToken.id },
		});
		expect(oldRow.revokedAt).toBeNull(); // rotation schedules expiry, doesn't hard-revoke
		expect(oldRow.expiresAt).not.toBeNull();
		const untilMs = oldRow.expiresAt!.getTime() - Date.now();
		expect(untilMs).toBeGreaterThan(0);
		expect(untilMs).toBeLessThanOrEqual(TOKEN_ROTATION_OVERLAP_MS + 1000);
	});

	it("stops the old token working once the rotation overlap has elapsed", async () => {
		const { integration, owner } = await registerTestIntegration();
		const { secret: oldSecret, apiToken: oldApiToken } = expectSuccess(
			await issueToken(integration.id, owner.id)
		);
		await rotateToken(oldApiToken.id, owner.id);

		// Simulate the overlap window having elapsed.
		await prisma.apiToken.update({
			where: { id: oldApiToken.id },
			data: { expiresAt: new Date(Date.now() - 1000) },
		});

		const result = await validateApiToken({
			token: oldSecret,
			ipAddress: "203.0.113.12",
		});
		expectError(result, AUTH_FAILURE_MESSAGE);
	});

	it("refuses to rotate an already-revoked token", async () => {
		const { integration, owner } = await registerTestIntegration();
		const { apiToken } = expectSuccess(
			await issueToken(integration.id, owner.id)
		);
		expectSuccess(await revokeToken(apiToken.id, owner.id));

		const result = await rotateToken(apiToken.id, owner.id);
		expectError(result, ALREADY_REVOKED_PATTERN);
	});

	it("revokes a token immediately — no grace period", async () => {
		const { integration, owner } = await registerTestIntegration();
		const { secret, apiToken } = expectSuccess(
			await issueToken(integration.id, owner.id)
		);

		expectSuccess(await revokeToken(apiToken.id, owner.id));

		const result = await validateApiToken({
			token: secret,
			ipAddress: "203.0.113.13",
		});
		expectError(result, AUTH_FAILURE_MESSAGE);
	});

	it("rejects an expired token with the same generic message", async () => {
		const { integration } = await registerTestIntegration();
		const { secret } = await createRawToken(integration.id, {
			expiresAt: new Date(Date.now() - 1000),
		});

		const result = await validateApiToken({
			token: secret,
			ipAddress: "203.0.113.14",
		});
		expectError(result, AUTH_FAILURE_MESSAGE);
	});
});

describe("integration-registry-service — scope enforcement", () => {
	it("authenticates when the required scope is present", async () => {
		const { integration, owner } = await registerTestIntegration(["case:read"]);
		const { secret } = expectSuccess(
			await issueToken(integration.id, owner.id)
		);

		const result = await validateApiToken({
			token: secret,
			scope: "case:read",
			ipAddress: "203.0.113.20",
		});
		expectSuccess(result);
	});

	it("rejects when the required scope is absent — same generic message as any other failure", async () => {
		const { integration, owner } = await registerTestIntegration(["case:read"]);
		const { secret } = expectSuccess(
			await issueToken(integration.id, owner.id)
		);

		const result = await validateApiToken({
			token: secret,
			scope: "health:evidence:write",
			ipAddress: "203.0.113.21",
		});
		expectError(result, AUTH_FAILURE_MESSAGE);
	});

	it("authenticates regardless of scopes when no scope is required (whoami's use case)", async () => {
		const { integration, owner } = await registerTestIntegration(["case:read"]);
		const { secret } = expectSuccess(
			await issueToken(integration.id, owner.id)
		);

		const result = await validateApiToken({
			token: secret,
			ipAddress: "203.0.113.22",
		});
		expectSuccess(result);
	});
});

describe("integration-registry-service — revoked/suspended integration paths", () => {
	it("rejects a token belonging to a SUSPENDED integration", async () => {
		const { integration, owner } = await registerTestIntegration();
		const { secret } = expectSuccess(
			await issueToken(integration.id, owner.id)
		);
		expectSuccess(await suspendIntegration(integration.id, owner.id));

		const result = await validateApiToken({
			token: secret,
			ipAddress: "203.0.113.30",
		});
		expectError(result, AUTH_FAILURE_MESSAGE);
	});

	it("rejects a token belonging to a REVOKED integration", async () => {
		const { integration, owner } = await registerTestIntegration();
		const { secret } = expectSuccess(
			await issueToken(integration.id, owner.id)
		);
		expectSuccess(await revokeIntegration(integration.id, owner.id));

		const result = await validateApiToken({
			token: secret,
			ipAddress: "203.0.113.31",
		});
		expectError(result, AUTH_FAILURE_MESSAGE);
	});
});

describe("integration-registry-service — same error for every failure mode (no oracle)", () => {
	it("returns an identical message for missing, malformed, unknown, revoked, expired, and wrong-scope tokens", async () => {
		const { integration, owner } = await registerTestIntegration(["case:read"]);
		const { secret: revokedSecret, apiToken: revokedApiToken } = expectSuccess(
			await issueToken(integration.id, owner.id)
		);
		expectSuccess(await revokeToken(revokedApiToken.id, owner.id));
		const { secret: expiredSecret } = await createRawToken(integration.id, {
			expiresAt: new Date(Date.now() - 1000),
		});
		const { secret: scopedSecret } = expectSuccess(
			await issueToken(integration.id, owner.id)
		);

		const cases: Parameters<typeof validateApiToken>[0][] = [
			{ token: null, ipAddress: "203.0.113.40" },
			{ token: "not-even-shaped-right", ipAddress: "203.0.113.41" },
			{ token: "teap_totally-unknown-hash", ipAddress: "203.0.113.42" },
			{ token: revokedSecret, ipAddress: "203.0.113.43" },
			{ token: expiredSecret, ipAddress: "203.0.113.44" },
			{
				token: scopedSecret,
				scope: "health:evidence:write",
				ipAddress: "203.0.113.45",
			},
		];

		for (const params of cases) {
			const result = await validateApiToken(params);
			expectError(result, AUTH_FAILURE_MESSAGE);
		}
	});
});

describe("integration-registry-service — throttle behaviour", () => {
	it("throttles failed attempts by IP and stops before the DB lookup once over the limit", async () => {
		const ipAddress = "203.0.113.99";
		const maxAttempts = RATE_LIMIT_CONFIGS.machineAuth.limits[0].maxAttempts;

		for (let i = 0; i < maxAttempts; i++) {
			const result = await validateApiToken({ token: null, ipAddress });
			expect("error" in result).toBe(true);
			expect((result as { rateLimited?: true }).rateLimited).toBeUndefined();
		}

		const blocked = await validateApiToken({ token: null, ipAddress });
		expect("error" in blocked).toBe(true);
		expect((blocked as { rateLimited?: true }).rateLimited).toBe(true);

		const attempts = await prisma.rateLimitAttempt.count({
			where: { endpoint: "machine_auth", identifier: ipAddress },
		});
		expect(attempts).toBe(maxAttempts + 1);
	});

	it("does not consume the throttle budget on successful authentication", async () => {
		const { integration, owner } = await registerTestIntegration();
		const { secret } = expectSuccess(
			await issueToken(integration.id, owner.id)
		);
		const ipAddress = "203.0.113.98";

		for (let i = 0; i < 5; i++) {
			expectSuccess(await validateApiToken({ token: secret, ipAddress }));
		}

		const attempts = await prisma.rateLimitAttempt.count({
			where: { endpoint: "machine_auth", identifier: ipAddress },
		});
		expect(attempts).toBe(0);
	});

	it("writes a SecurityAuditLog row for a failed attempt", async () => {
		const ipAddress = "203.0.113.97";
		await validateApiToken({ token: "teap_nope", ipAddress });

		const events = await prisma.securityAuditLog.findMany({
			where: { eventType: "machine_auth_failed", ipAddress },
		});
		expect(events.length).toBeGreaterThan(0);
	});
});

describe("/api/machine/whoami — reachability", () => {
	it("reaches the handler and returns the integration's identity for a valid token", async () => {
		const { integration, owner } = await registerTestIntegration(["case:read"]);
		const { secret } = expectSuccess(
			await issueToken(integration.id, owner.id)
		);

		const req = new NextRequest("http://localhost:3000/api/machine/whoami", {
			headers: { authorization: `Bearer ${secret}` },
		});
		const response = await whoamiGET(req);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.name).toBe(integration.name);
		expect(body.scopes).toEqual(["case:read"]);
		expect(typeof body.tokenPrefix).toBe("string");
	});

	it("returns the API error envelope — not a redirect — for a missing token", async () => {
		const req = new NextRequest("http://localhost:3000/api/machine/whoami");
		const response = await whoamiGET(req);

		expect(response.status).toBe(401);
		expect(response.headers.get("location")).toBeNull();
		const body = await response.json();
		expect(body.code).toBe("UNAUTHORISED");
	});

	it("returns the API error envelope — not a redirect — for an invalid token", async () => {
		const req = new NextRequest("http://localhost:3000/api/machine/whoami", {
			headers: { authorization: "Bearer teap_garbage-not-a-real-token" },
		});
		const response = await whoamiGET(req);

		expect(response.status).toBe(401);
		expect(response.headers.get("location")).toBeNull();
		const body = await response.json();
		expect(body.code).toBe("UNAUTHORISED");
	});

	it("stamps lastUsedAt / lastSeenAt on a successful request", async () => {
		const { integration, owner } = await registerTestIntegration();
		const { secret, apiToken } = expectSuccess(
			await issueToken(integration.id, owner.id)
		);

		const req = new NextRequest("http://localhost:3000/api/machine/whoami", {
			headers: { authorization: `Bearer ${secret}` },
		});
		await whoamiGET(req);

		const [updatedToken, updatedIntegration] = await Promise.all([
			prisma.apiToken.findUniqueOrThrow({ where: { id: apiToken.id } }),
			prisma.integration.findUniqueOrThrow({ where: { id: integration.id } }),
		]);
		expect(updatedToken.lastUsedAt).not.toBeNull();
		expect(updatedIntegration.lastSeenAt).not.toBeNull();
	});
});

describe("requireApiToken — header shapes", () => {
	it("rejects a non-Bearer scheme (Basic) the same as a missing token", async () => {
		const response = await whoamiGET(
			whoamiRequest({ authorization: "Basic dXNlcjpwYXNz" })
		);

		expect(response.status).toBe(401);
		const body = await response.json();
		expect(body.error).toBe(AUTH_FAILURE_MESSAGE);
	});

	it("rejects a bare 'Bearer' scheme with no token", async () => {
		const response = await whoamiGET(
			whoamiRequest({ authorization: "Bearer" })
		);

		expect(response.status).toBe(401);
		const body = await response.json();
		expect(body.error).toBe(AUTH_FAILURE_MESSAGE);
	});

	it("rejects 'Bearer ' followed only by whitespace where the token should be", async () => {
		const response = await whoamiGET(
			whoamiRequest({ authorization: "Bearer    " })
		);

		expect(response.status).toBe(401);
		const body = await response.json();
		expect(body.error).toBe(AUTH_FAILURE_MESSAGE);
	});

	it("rejects a lower-cased 'bearer' scheme even with an otherwise-valid token (case-sensitive parsing)", async () => {
		const { integration, owner } = await registerTestIntegration();
		const { secret } = expectSuccess(
			await issueToken(integration.id, owner.id)
		);

		const response = await whoamiGET(
			whoamiRequest({ authorization: `bearer ${secret}` })
		);

		expect(response.status).toBe(401);
		const body = await response.json();
		expect(body.error).toBe(AUTH_FAILURE_MESSAGE);
	});
});

describe("requireApiToken — extractIpAddress, via whoami's failed-attempt audit trail", () => {
	/** A failed whoami call always audit-logs the IP `extractIpAddress` resolved — the cheapest observable proxy for a private helper. */
	async function failedWhoamiIpAddress(
		headers: Record<string, string>
	): Promise<void> {
		const response = await whoamiGET(
			whoamiRequest({
				authorization: `Bearer ${TOKEN_PREFIX}does-not-exist`,
				...headers,
			})
		);
		// biome-ignore lint/suspicious/noMisplacedAssertion: Called from within test blocks
		expect(response.status).toBe(401);
	}

	it("uses a single x-forwarded-for value as the client IP", async () => {
		await failedWhoamiIpAddress({ "x-forwarded-for": "203.0.113.60" });

		const event = await prisma.securityAuditLog.findFirst({
			where: { eventType: "machine_auth_failed", ipAddress: "203.0.113.60" },
		});
		expect(event).not.toBeNull();
	});

	it("takes the first entry of a comma-separated x-forwarded-for chain", async () => {
		await failedWhoamiIpAddress({
			"x-forwarded-for": "203.0.113.61, 70.41.3.18, 150.172.238.178",
		});

		const event = await prisma.securityAuditLog.findFirst({
			where: { eventType: "machine_auth_failed", ipAddress: "203.0.113.61" },
		});
		expect(event).not.toBeNull();
	});

	it("falls back to x-real-ip when x-forwarded-for is absent", async () => {
		await failedWhoamiIpAddress({ "x-real-ip": "203.0.113.62" });

		const event = await prisma.securityAuditLog.findFirst({
			where: { eventType: "machine_auth_failed", ipAddress: "203.0.113.62" },
		});
		expect(event).not.toBeNull();
	});

	it("records 'unknown' when neither IP header is present", async () => {
		await failedWhoamiIpAddress({});

		const event = await prisma.securityAuditLog.findFirst({
			where: { eventType: "machine_auth_failed", ipAddress: "unknown" },
		});
		expect(event).not.toBeNull();
	});
});

describe("HTTP 429 through whoami/requireApiToken", () => {
	it("returns 429 + a RATE_LIMITED envelope once the machineAuth throttle is exhausted via whoami — not validateApiToken directly", async () => {
		const ipAddress = "203.0.113.70";
		const maxAttempts = RATE_LIMIT_CONFIGS.machineAuth.limits[0].maxAttempts;

		for (let i = 0; i < maxAttempts; i++) {
			const response = await whoamiGET(
				whoamiRequest({ "x-forwarded-for": ipAddress })
			);
			expect(response.status).toBe(401);
		}

		const blocked = await whoamiGET(
			whoamiRequest({ "x-forwarded-for": ipAddress })
		);

		expect(blocked.status).toBe(429);
		const body = await blocked.json();
		expect(body.code).toBe("RATE_LIMITED");
		expect(typeof body.error).toBe("string");
	});
});

describe("issueToken({ expiresAt }) — both directions through the normal issue path", () => {
	it("authenticates when expiresAt is in the future", async () => {
		const { integration, owner } = await registerTestIntegration();
		const future = new Date(Date.now() + 60_000);

		const { secret } = expectSuccess(
			await issueToken(integration.id, owner.id, { expiresAt: future })
		);

		const result = await validateApiToken({
			token: secret,
			ipAddress: "203.0.113.71",
		});
		expectSuccess(result);
	});

	it("fails closed when expiresAt has already elapsed", async () => {
		const { integration, owner } = await registerTestIntegration();
		const elapsed = new Date(Date.now() - 60_000);

		const { secret } = expectSuccess(
			await issueToken(integration.id, owner.id, { expiresAt: elapsed })
		);

		const result = await validateApiToken({
			token: secret,
			ipAddress: "203.0.113.72",
		});
		expectError(result, AUTH_FAILURE_MESSAGE);
	});
});

describe("envelope no-oracle — whoami's body.error is textually identical across failure modes", () => {
	it("returns the exact same body.error for missing, malformed, unknown, revoked, expired, and suspended-integration tokens", async () => {
		const { integration, owner } = await registerTestIntegration();
		const { secret: revokedSecret, apiToken: revokedApiToken } = expectSuccess(
			await issueToken(integration.id, owner.id)
		);
		expectSuccess(await revokeToken(revokedApiToken.id, owner.id));

		const { secret: expiredSecret } = await createRawToken(integration.id, {
			expiresAt: new Date(Date.now() - 1000),
		});

		const { integration: suspended, owner: suspendedOwner } =
			await registerTestIntegration();
		const { secret: suspendedSecret } = expectSuccess(
			await issueToken(suspended.id, suspendedOwner.id)
		);
		expectSuccess(await suspendIntegration(suspended.id, suspendedOwner.id));

		const headerSets: Record<string, string>[] = [
			{},
			{ authorization: "Bearer not-even-shaped-right" },
			{ authorization: `Bearer ${TOKEN_PREFIX}totally-unknown-hash` },
			{ authorization: `Bearer ${revokedSecret}` },
			{ authorization: `Bearer ${expiredSecret}` },
			{ authorization: `Bearer ${suspendedSecret}` },
		];

		for (const headers of headerSets) {
			const response = await whoamiGET(whoamiRequest(headers));
			expect(response.status).toBe(401);
			const body = await response.json();
			expect(body.error).toBe(AUTH_FAILURE_MESSAGE);
		}
	});
});

describe("service CRUD guards — not-found / non-active / already-revoked batch", () => {
	it("returns the not-found error from updateIntegrationScopes for an unknown integration id", async () => {
		const owner = await createTestUser();
		expectError(
			await updateIntegrationScopes(NOT_FOUND_ID, ["case:read"], owner.id),
			NOT_FOUND_PATTERN
		);
	});

	it("returns the not-found error from suspendIntegration for an unknown integration id", async () => {
		const owner = await createTestUser();
		expectError(
			await suspendIntegration(NOT_FOUND_ID, owner.id),
			NOT_FOUND_PATTERN
		);
	});

	it("returns the not-found error from revokeIntegration for an unknown integration id", async () => {
		const owner = await createTestUser();
		expectError(
			await revokeIntegration(NOT_FOUND_ID, owner.id),
			NOT_FOUND_PATTERN
		);
	});

	it("returns the not-found error from reassignIntegrationOwner for an unknown integration id", async () => {
		const owner = await createTestUser();
		const newOwner = await createTestUser();
		expectError(
			await reassignIntegrationOwner(NOT_FOUND_ID, newOwner.id, owner.id),
			NOT_FOUND_PATTERN
		);
	});

	it("returns the not-found error from reassignIntegrationOwner for an unknown new-owner id", async () => {
		const { integration, owner } = await registerTestIntegration();
		expectError(
			await reassignIntegrationOwner(integration.id, NOT_FOUND_ID, owner.id),
			NOT_FOUND_PATTERN
		);
	});

	it("returns the not-found error from deleteIntegrationRegistration for an unknown integration id", async () => {
		const owner = await createTestUser();
		expectError(
			await deleteIntegrationRegistration(NOT_FOUND_ID, owner.id),
			NOT_FOUND_PATTERN
		);
	});

	it("returns the not-found error from issueToken for an unknown integration id", async () => {
		const owner = await createTestUser();
		expectError(await issueToken(NOT_FOUND_ID, owner.id), NOT_FOUND_PATTERN);
	});

	it("returns the not-found error from rotateToken for an unknown token id", async () => {
		const owner = await createTestUser();
		expectError(await rotateToken(NOT_FOUND_ID, owner.id), NOT_FOUND_PATTERN);
	});

	it("returns the not-found error from revokeToken for an unknown token id", async () => {
		const owner = await createTestUser();
		expectError(await revokeToken(NOT_FOUND_ID, owner.id), NOT_FOUND_PATTERN);
	});

	it("refuses to rotate a token belonging to a non-ACTIVE (suspended) integration", async () => {
		const { integration, owner } = await registerTestIntegration();
		const { apiToken } = expectSuccess(
			await issueToken(integration.id, owner.id)
		);
		expectSuccess(await suspendIntegration(integration.id, owner.id));

		expectError(await rotateToken(apiToken.id, owner.id), NON_ACTIVE_PATTERN);
	});

	it("refuses a second revocation of an already-revoked token", async () => {
		const { integration, owner } = await registerTestIntegration();
		const { apiToken } = expectSuccess(
			await issueToken(integration.id, owner.id)
		);
		expectSuccess(await revokeToken(apiToken.id, owner.id));

		expectError(
			await revokeToken(apiToken.id, owner.id),
			ALREADY_REVOKED_PATTERN
		);
	});
});

/**
 * Next.js compiles `config.matcher` entries via path-to-regexp, which
 * anchors the pattern to the full pathname (`^...$`) — an unanchored
 * `new RegExp(pattern).test(path)` can find a spurious match starting
 * from a later `/` in the path (e.g. re-trying from "/machine/whoami"
 * once "/api/machine/whoami" fails the lookahead at index 0), which
 * would falsely report the exemption as not working. Anchoring here
 * reproduces the real matching behaviour.
 */
function compileMatcher(pattern: string): RegExp {
	return new RegExp(`^${pattern}$`);
}

describe("middleware — /api/machine exemption (R1)", () => {
	it("excludes every /api/machine/* path from the auth-redirect matcher", async () => {
		const { config } = await import("@/middleware");
		const matcherRegex = compileMatcher(config.matcher[0] as string);

		expect(matcherRegex.test("/api/machine/whoami")).toBe(false);
		expect(matcherRegex.test("/api/machine/health/elements/123/evidence")).toBe(
			false
		);
	});

	it("still matches ordinary protected app/API routes", async () => {
		const { config } = await import("@/middleware");
		const matcherRegex = compileMatcher(config.matcher[0] as string);

		expect(matcherRegex.test("/dashboard")).toBe(true);
		expect(matcherRegex.test("/api/cases/123")).toBe(true);
	});
});
