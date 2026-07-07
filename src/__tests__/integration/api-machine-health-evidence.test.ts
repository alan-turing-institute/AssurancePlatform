import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
	issueToken,
	registerIntegration,
	revokeToken,
} from "@/lib/services/integration-registry-service";
import { emitSSEEvent } from "@/lib/services/sse-connection-manager";
import { expectSuccess } from "../utils/assertion-helpers";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	createTestCase,
	createTestElement,
	createTestPermission,
	createTestUser,
} from "../utils/prisma-factories";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/services/sse-connection-manager", async (importOriginal) => {
	const actual =
		await importOriginal<
			typeof import("@/lib/services/sse-connection-manager")
		>();
	return {
		...actual,
		emitSSEEvent: vi.fn(),
	};
});

// Wrapped (not stubbed): defaults to the REAL implementation for every test
// except the one that deliberately overrides it with `mockResolvedValueOnce`
// (see "POST — evidence persists even when scoring fails" below).
vi.mock("@/lib/services/health-scoring-service", async (importOriginal) => {
	const actual =
		await importOriginal<
			typeof import("@/lib/services/health-scoring-service")
		>();
	return {
		...actual,
		recomputeHealthScore: vi.fn(actual.recomputeHealthScore),
	};
});

const EVIDENCE_PATH = (claimId: string) =>
	`http://localhost:3000/api/machine/health/elements/${claimId}/evidence`;
const AUTH_FAILURE_MESSAGE = "Invalid or expired token";
const NOT_FOUND_PATTERN = /Claim not found/;
const NOT_ENABLED_PATTERN = /is not enabled/;

beforeEach(async () => {
	await mockNoAuth();
	vi.mocked(emitSSEEvent).mockClear();
});

afterEach(() => {
	vi.unstubAllEnvs();
});

async function setup() {
	const owner = await createTestUser();
	const testCase = await createTestCase(owner.id);
	const claim = await createTestElement(testCase.id, owner.id, {
		elementType: "PROPERTY_CLAIM",
	});
	return { owner, testCase, claim };
}

/** Registers an integration owned by `ownerId`, issues a token, and grants its system user `permission` on `caseId`. */
async function setupIntegration(
	ownerId: string,
	caseId: string,
	scopes: string[],
	permission: "VIEW" | "EDIT" | null = "EDIT"
) {
	const { integration, systemUserId } = expectSuccess(
		await registerIntegration(
			{
				name: `test-health-integration-${ownerId}-${Date.now()}`,
				scopes,
			},
			ownerId
		)
	);
	const { secret, apiToken } = expectSuccess(
		await issueToken(integration.id, ownerId)
	);
	if (permission) {
		await createTestPermission(caseId, systemUserId, ownerId, permission);
	}
	return { integration, systemUserId, secret, apiToken };
}

function evidenceBody(
	claimId: string,
	overrides: Record<string, unknown> = {}
): Record<string, unknown> {
	return {
		formatVersion: "0.1",
		claimId,
		metricName: "in-distribution-rate",
		value: 0.982,
		threshold: 0.95,
		verdict: "PASS",
		oddDimensions: ["traffic-density"],
		sourceSystem: "darter-pipeline",
		provenance: { check: "ood-monitor/kl-divergence", runId: "gh-run-1" },
		evaluatedAt: new Date().toISOString(),
		...overrides,
	};
}

function postRequest(
	claimId: string,
	body: unknown,
	token?: string
): NextRequest {
	return new NextRequest(EVIDENCE_PATH(claimId), {
		method: "POST",
		headers: {
			"content-type": "application/json",
			...(token ? { authorization: `Bearer ${token}` } : {}),
		},
		body: JSON.stringify(body),
	});
}

function getRequest(claimId: string, token?: string): NextRequest {
	return new NextRequest(EVIDENCE_PATH(claimId), {
		headers: token ? { authorization: `Bearer ${token}` } : {},
	});
}

function importRoute() {
	return import("@/app/api/machine/health/elements/[id]/evidence/route");
}

describe("POST /api/machine/health/elements/[id]/evidence — happy path", () => {
	it("appends evidence, recomputes score, and returns 201 with both", async () => {
		const { owner, testCase, claim } = await setup();
		const { secret } = await setupIntegration(owner.id, testCase.id, [
			"health:evidence:write",
		]);
		const { POST } = await importRoute();

		const response = await POST(
			postRequest(claim.id, evidenceBody(claim.id), secret),
			{
				params: Promise.resolve({ id: claim.id }),
			}
		);

		expect(response.status).toBe(201);
		const body = await response.json();
		expect(body.evidence.claimId).toBe(claim.id);
		expect(body.evidence.previousRecordHash).toBeNull();
		expect(body.health.score).toBe(1);
	});

	it("emits tea.health/state-changed to the claim's case AFTER the write commits", async () => {
		const { owner, testCase, claim } = await setup();
		const { secret } = await setupIntegration(owner.id, testCase.id, [
			"health:evidence:write",
		]);
		const { POST } = await importRoute();

		const response = await POST(
			postRequest(claim.id, evidenceBody(claim.id), secret),
			{
				params: Promise.resolve({ id: claim.id }),
			}
		);
		expect(response.status).toBe(201);

		expect(emitSSEEvent).toHaveBeenCalledTimes(1);
		expect(emitSSEEvent).toHaveBeenCalledWith(
			"tea.health/state-changed",
			testCase.id,
			expect.objectContaining({ claimId: claim.id })
		);

		// Evidence must actually be committed by the time the event fires.
		const persisted = await prisma.pluginHealthEvidence.findMany({
			where: { claimId: claim.id },
		});
		expect(persisted).toHaveLength(1);
	});

	it("chains a second POST's previousRecordHash to the first's recordHash", async () => {
		const { owner, testCase, claim } = await setup();
		const { secret } = await setupIntegration(owner.id, testCase.id, [
			"health:evidence:write",
		]);
		const { POST } = await importRoute();

		const first = await POST(
			postRequest(claim.id, evidenceBody(claim.id), secret),
			{ params: Promise.resolve({ id: claim.id }) }
		);
		const firstBody = await first.json();

		const second = await POST(
			postRequest(
				claim.id,
				evidenceBody(claim.id, { verdict: "FAIL" }),
				secret
			),
			{ params: Promise.resolve({ id: claim.id }) }
		);
		const secondBody = await second.json();

		expect(secondBody.evidence.previousRecordHash).toBe(
			firstBody.evidence.recordHash
		);
		expect(secondBody.health.score).toBe(0);
	});

	it("uses default scoring settings when no PluginState row exists for the integration's system user", async () => {
		const { DEFAULT_VALIDITY_WINDOW_SECONDS } = await import(
			"@/lib/services/health-scoring-service"
		);
		const { owner, testCase, claim } = await setup();
		const { secret, systemUserId } = await setupIntegration(
			owner.id,
			testCase.id,
			["health:evidence:write"]
		);

		const settingsRow = await prisma.pluginState.findUnique({
			where: {
				pluginId_scopeType_scopeId: {
					pluginId: "tea.health",
					scopeType: "USER",
					scopeId: systemUserId,
				},
			},
		});
		expect(settingsRow).toBeNull();

		const { POST } = await importRoute();
		const response = await POST(
			postRequest(claim.id, evidenceBody(claim.id), secret),
			{ params: Promise.resolve({ id: claim.id }) }
		);

		expect(response.status).toBe(201);
		const body = await response.json();
		expect(body.health.validityWindowSeconds).toBe(
			DEFAULT_VALIDITY_WINDOW_SECONDS
		);
		expect(body.health.score).toBe(1);
	});
});

describe("POST — evidence persists even when scoring fails", () => {
	it("keeps the appended evidence, does not emit SSE, and surfaces the scoring error", async () => {
		const { recomputeHealthScore } = await import(
			"@/lib/services/health-scoring-service"
		);
		const { owner, testCase, claim } = await setup();
		const { secret } = await setupIntegration(owner.id, testCase.id, [
			"health:evidence:write",
		]);
		vi.mocked(recomputeHealthScore).mockResolvedValueOnce({
			error: "Failed to compute health score",
		});
		const { POST } = await importRoute();

		const response = await POST(
			postRequest(claim.id, evidenceBody(claim.id), secret),
			{ params: Promise.resolve({ id: claim.id }) }
		);

		expect(response.status).toBe(500);
		const body = await response.json();
		expect(body.error).toBe("Failed to compute health score");

		// The evidence write already committed inside appendHealthEvidence,
		// BEFORE recomputeHealthScore was ever called — append-only durability
		// does not depend on the scoring step succeeding.
		const persisted = await prisma.pluginHealthEvidence.findMany({
			where: { claimId: claim.id },
		});
		expect(persisted).toHaveLength(1);

		expect(emitSSEEvent).not.toHaveBeenCalled();
	});
});

describe("POST — evidence-format-v0.1 body validation", () => {
	it("rejects a body whose claimId does not match the path id (400, not a silent re-target)", async () => {
		const { owner, testCase, claim } = await setup();
		const otherClaim = await createTestElement(testCase.id, owner.id, {
			elementType: "PROPERTY_CLAIM",
			name: "Other claim",
		});
		const { secret } = await setupIntegration(owner.id, testCase.id, [
			"health:evidence:write",
		]);
		const { POST } = await importRoute();

		const response = await POST(
			postRequest(claim.id, evidenceBody(otherClaim.id), secret),
			{ params: Promise.resolve({ id: claim.id }) }
		);

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.code).toBe("VALIDATION");

		const persisted = await prisma.pluginHealthEvidence.findMany({
			where: { claimId: claim.id },
		});
		expect(persisted).toHaveLength(0);
	});

	it("rejects an unknown top-level field (fail-loud, not silent drift)", async () => {
		const { owner, testCase, claim } = await setup();
		const { secret } = await setupIntegration(owner.id, testCase.id, [
			"health:evidence:write",
		]);
		const { POST } = await importRoute();

		const response = await POST(
			postRequest(
				claim.id,
				evidenceBody(claim.id, { unexpectedField: "sneaky" }),
				secret
			),
			{ params: Promise.resolve({ id: claim.id }) }
		);

		expect(response.status).toBe(400);
	});

	it("rejects provenance missing the required check/runId keys", async () => {
		const { owner, testCase, claim } = await setup();
		const { secret } = await setupIntegration(owner.id, testCase.id, [
			"health:evidence:write",
		]);
		const { POST } = await importRoute();

		const response = await POST(
			postRequest(
				claim.id,
				evidenceBody(claim.id, { provenance: { twinVersion: "2.1.0" } }),
				secret
			),
			{ params: Promise.resolve({ id: claim.id }) }
		);

		expect(response.status).toBe(400);
	});

	it("rejects a formatVersion other than 0.1", async () => {
		const { owner, testCase, claim } = await setup();
		const { secret } = await setupIntegration(owner.id, testCase.id, [
			"health:evidence:write",
		]);
		const { POST } = await importRoute();

		const response = await POST(
			postRequest(
				claim.id,
				evidenceBody(claim.id, { formatVersion: "0.2" }),
				secret
			),
			{ params: Promise.resolve({ id: claim.id }) }
		);

		expect(response.status).toBe(400);
	});

	it("preserves provenance keys beyond check/runId verbatim", async () => {
		const { owner, testCase, claim } = await setup();
		const { secret } = await setupIntegration(owner.id, testCase.id, [
			"health:evidence:write",
		]);
		const { POST } = await importRoute();

		const response = await POST(
			postRequest(
				claim.id,
				evidenceBody(claim.id, {
					provenance: {
						check: "ood-monitor/kl-divergence",
						runId: "gh-run-1",
						checkVersion: "1.4.2",
						scenarioId: "replay-2026-06-30-heathrow-07",
					},
				}),
				secret
			),
			{ params: Promise.resolve({ id: claim.id }) }
		);

		expect(response.status).toBe(201);
		const body = await response.json();
		expect(body.evidence.provenance).toEqual({
			check: "ood-monitor/kl-divergence",
			runId: "gh-run-1",
			checkVersion: "1.4.2",
			scenarioId: "replay-2026-06-30-heathrow-07",
		});
	});
});

describe("POST — permission matrix (machine token paths)", () => {
	it("rejects a token missing the health:evidence:write scope — generic message, no oracle", async () => {
		const { owner, testCase, claim } = await setup();
		const { secret } = await setupIntegration(owner.id, testCase.id, [
			"health:evidence:read",
		]);
		const { POST } = await importRoute();

		const response = await POST(
			postRequest(claim.id, evidenceBody(claim.id), secret),
			{
				params: Promise.resolve({ id: claim.id }),
			}
		);

		expect(response.status).toBe(401);
		const body = await response.json();
		expect(body.error).toBe(AUTH_FAILURE_MESSAGE);
		expect(emitSSEEvent).not.toHaveBeenCalled();
	});

	it("rejects a revoked token", async () => {
		const { owner, testCase, claim } = await setup();
		const { secret, apiToken } = await setupIntegration(owner.id, testCase.id, [
			"health:evidence:write",
		]);
		await revokeToken(apiToken.id, owner.id);
		const { POST } = await importRoute();

		const response = await POST(
			postRequest(claim.id, evidenceBody(claim.id), secret),
			{
				params: Promise.resolve({ id: claim.id }),
			}
		);

		expect(response.status).toBe(401);
	});

	it("rejects a token belonging to a SUSPENDED integration", async () => {
		const { suspendIntegration } = await import(
			"@/lib/services/integration-registry-service"
		);
		const { owner, testCase, claim } = await setup();
		const { secret, integration } = await setupIntegration(
			owner.id,
			testCase.id,
			["health:evidence:write"]
		);
		expectSuccess(await suspendIntegration(integration.id, owner.id));
		const { POST } = await importRoute();

		const response = await POST(
			postRequest(claim.id, evidenceBody(claim.id), secret),
			{
				params: Promise.resolve({ id: claim.id }),
			}
		);

		expect(response.status).toBe(401);
	});

	it("rejects a missing token entirely", async () => {
		const { claim } = await setup();
		const { POST } = await importRoute();

		const response = await POST(postRequest(claim.id, evidenceBody(claim.id)), {
			params: Promise.resolve({ id: claim.id }),
		});

		expect(response.status).toBe(401);
	});

	it("refuses (generic not-found, not a 500) when the integration's system user has no case access", async () => {
		const { owner, testCase, claim } = await setup();
		const { secret } = await setupIntegration(
			owner.id,
			testCase.id,
			["health:evidence:write"],
			null // no permission grant
		);
		const { POST } = await importRoute();

		const response = await POST(
			postRequest(claim.id, evidenceBody(claim.id), secret),
			{
				params: Promise.resolve({ id: claim.id }),
			}
		);

		expect(response.status).toBe(404);
		const body = await response.json();
		expect(body.error).toMatch(NOT_FOUND_PATTERN);
		expect(emitSSEEvent).not.toHaveBeenCalled();
	});

	it("returns byte-identical 404 responses for a no-access token, whether the claim exists or not (no enumeration oracle)", async () => {
		const { owner, testCase, claim } = await setup();
		const { secret } = await setupIntegration(
			owner.id,
			testCase.id,
			["health:evidence:write"],
			null // no permission grant
		);
		const { POST } = await importRoute();
		const nonexistentId = "00000000-0000-0000-0000-000000000000";

		const existingResponse = await POST(
			postRequest(claim.id, evidenceBody(claim.id), secret),
			{ params: Promise.resolve({ id: claim.id }) }
		);
		const nonexistentResponse = await POST(
			postRequest(nonexistentId, evidenceBody(nonexistentId), secret),
			{ params: Promise.resolve({ id: nonexistentId }) }
		);

		expect(existingResponse.status).toBe(nonexistentResponse.status);
		const existingBody = await existingResponse.json();
		const nonexistentBody = await nonexistentResponse.json();
		expect(existingBody).toEqual(nonexistentBody);
	});

	it("refuses when the system user has only VIEW access (write needs EDIT)", async () => {
		const { owner, testCase, claim } = await setup();
		const { secret } = await setupIntegration(
			owner.id,
			testCase.id,
			["health:evidence:write"],
			"VIEW"
		);
		const { POST } = await importRoute();

		const response = await POST(
			postRequest(claim.id, evidenceBody(claim.id), secret),
			{
				params: Promise.resolve({ id: claim.id }),
			}
		);

		expect(response.status).toBe(404);
	});
});

describe("POST/GET — disabled-plugin refusal (clean error, not a 500)", () => {
	it("POST refuses cleanly when tea.health is disabled at the deployment level", async () => {
		const { owner, testCase, claim } = await setup();
		const { secret } = await setupIntegration(owner.id, testCase.id, [
			"health:evidence:write",
		]);
		vi.stubEnv("TEA_PLUGINS_DISABLED", "tea.health");
		const { POST } = await importRoute();

		const response = await POST(
			postRequest(claim.id, evidenceBody(claim.id), secret),
			{
				params: Promise.resolve({ id: claim.id }),
			}
		);

		expect(response.status).toBe(403);
		const body = await response.json();
		expect(body.error).toMatch(NOT_ENABLED_PATTERN);
		expect(emitSSEEvent).not.toHaveBeenCalled();
	});

	it("GET refuses cleanly when tea.health is disabled at the deployment level", async () => {
		const { owner, testCase, claim } = await setup();
		const { secret } = await setupIntegration(
			owner.id,
			testCase.id,
			["health:evidence:read"],
			"VIEW"
		);
		vi.stubEnv("TEA_PLUGINS_DISABLED", "tea.health");
		const { GET } = await importRoute();

		const response = await GET(getRequest(claim.id, secret), {
			params: Promise.resolve({ id: claim.id }),
		});

		expect(response.status).toBe(403);
	});
});

describe("GET /api/machine/health/elements/[id]/evidence — dual auth", () => {
	it("reads the log via a bearer token scoped health:evidence:read", async () => {
		const { owner, testCase, claim } = await setup();
		const { secret: writeSecret } = await setupIntegration(
			owner.id,
			testCase.id,
			["health:evidence:write"]
		);
		const { POST, GET } = await importRoute();
		await POST(postRequest(claim.id, evidenceBody(claim.id), writeSecret), {
			params: Promise.resolve({ id: claim.id }),
		});

		const { secret: readSecret } = await setupIntegration(
			owner.id,
			testCase.id,
			["health:evidence:read"],
			"VIEW"
		);
		const response = await GET(getRequest(claim.id, readSecret), {
			params: Promise.resolve({ id: claim.id }),
		});

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.evidence).toHaveLength(1);
	});

	it("rejects a bearer token missing the read scope", async () => {
		const { owner, testCase, claim } = await setup();
		const { secret } = await setupIntegration(
			owner.id,
			testCase.id,
			["health:evidence:write"],
			"VIEW"
		);
		const { GET } = await importRoute();

		const response = await GET(getRequest(claim.id, secret), {
			params: Promise.resolve({ id: claim.id }),
		});

		expect(response.status).toBe(401);
	});

	it("refuses (generic not-found, not a 500) when the read token's system user has no case access", async () => {
		const { owner, testCase, claim } = await setup();
		const { secret } = await setupIntegration(
			owner.id,
			testCase.id,
			["health:evidence:read"],
			null // no permission grant
		);
		const { GET } = await importRoute();

		const response = await GET(getRequest(claim.id, secret), {
			params: Promise.resolve({ id: claim.id }),
		});

		expect(response.status).toBe(404);
		const body = await response.json();
		expect(body.error).toMatch(NOT_FOUND_PATTERN);
	});

	it("reads the log via a human session with case VIEW access", async () => {
		const { owner, testCase, claim } = await setup();
		const viewer = await createTestUser();
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");
		await mockAuth(viewer.id, viewer.username, viewer.email);

		const { GET } = await importRoute();
		const response = await GET(getRequest(claim.id), {
			params: Promise.resolve({ id: claim.id }),
		});

		expect(response.status).toBe(200);
	});

	it("returns 404 (not a redirect) for a human session with no case access and no token", async () => {
		const { claim } = await setup();
		const outsider = await createTestUser();
		await mockAuth(outsider.id, outsider.username, outsider.email);

		const { GET } = await importRoute();
		const response = await GET(getRequest(claim.id), {
			params: Promise.resolve({ id: claim.id }),
		});

		expect(response.status).toBe(404);
		expect(response.headers.get("location")).toBeNull();
	});

	it("returns 401 with no bearer token and no session", async () => {
		const { claim } = await setup();
		const { GET } = await importRoute();

		const response = await GET(getRequest(claim.id), {
			params: Promise.resolve({ id: claim.id }),
		});

		expect(response.status).toBe(401);
	});
});
