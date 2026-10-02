import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
	issueToken,
	registerIntegration,
	revokeToken,
} from "@/lib/services/integration-registry-service";
import { emitSSEEvent } from "@/lib/services/sse-connection-manager";
import {
	buildHealthRecords,
	type HealthRecordFixture,
	type HealthRecordName,
	SUMMARY_CHECK_NAME,
	withOverrides,
} from "../fixtures/health-records";
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

/** A fresh fixture record (default: a passing population summary) for `claimId`. */
function evidenceBody(
	claimId: string,
	name: HealthRecordName = "populationPass",
	overrides: Record<string, unknown> = {}
): HealthRecordFixture {
	return withOverrides(buildHealthRecords(claimId)[name], overrides);
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

function getRequest(claimId: string, token?: string, query = ""): NextRequest {
	return new NextRequest(`${EVIDENCE_PATH(claimId)}${query}`, {
		headers: token ? { authorization: `Bearer ${token}` } : {},
	});
}

function importRoute() {
	return import("@/app/api/machine/health/elements/[id]/evidence/route");
}

/** Sets up a case with a claim and a writer integration, and returns a `post` helper bound to them. */
async function setupWriter() {
	const context = await setup();
	const { secret } = await setupIntegration(
		context.owner.id,
		context.testCase.id,
		["health:evidence:write"]
	);
	const { POST } = await importRoute();
	const post = (body: unknown, claimId = context.claim.id) =>
		POST(postRequest(claimId, body, secret), {
			params: Promise.resolve({ id: claimId }),
		});
	return { ...context, secret, post };
}

describe("POST /api/machine/health/elements/[id]/evidence — happy path", () => {
	it("accepts a population summary with 201 { record, status }, storing the record as sent", async () => {
		const { claim, post } = await setupWriter();
		const sent = evidenceBody(claim.id);

		const response = await post(sent);

		expect(response.status).toBe(201);
		const body = await response.json();
		expect(body.record).toEqual(sent);
		expect(body.status).toMatchObject({
			verdict: "pass",
			stale: false,
			stale_reason: null,
			record_id: sent.record_id,
			bound_check: SUMMARY_CHECK_NAME,
			rejected_since_last_accept: 0,
		});
		const row = await prisma.pluginHealthEvidence.findFirstOrThrow({
			where: { claimId: claim.id },
		});
		expect(row.record).toEqual(sent);
	});

	it("accepts a whole-system record", async () => {
		const { claim, post } = await setupWriter();

		const response = await post(evidenceBody(claim.id, "wholeSystem"));

		expect(response.status).toBe(201);
		expect((await response.json()).status.bound_check).toBe(
			"Forecast Availability Checker"
		);
	});

	it("stores a null value as absent", async () => {
		const { claim, post } = await setupWriter();

		const response = await post(
			evidenceBody(claim.id, "indeterminate", { value: null })
		);

		expect(response.status).toBe(201);
		expect("value" in (await response.json()).record).toBe(false);
	});

	it("accepts a value whose unit is left out", async () => {
		const { claim, post } = await setupWriter();

		const response = await post(
			evidenceBody(claim.id, "populationPass", { value: { number: 0.97 } })
		);

		expect(response.status).toBe(201);
		expect((await response.json()).record.value).toEqual({ number: 0.97 });
	});

	it("accepts a summary listing 2,000 members", async () => {
		const { claim, post } = await setupWriter();
		const fixture = evidenceBody(claim.id);

		const response = await post(
			withOverrides(fixture, {
				provenance: {
					...(fixture.provenance as object),
					members: Array.from({ length: 2000 }, () => crypto.randomUUID()),
				},
			})
		);

		expect(response.status).toBe(201);
	});

	it("emits tea.health/state-changed to the claim's case once the write has committed", async () => {
		const { testCase, claim, post } = await setupWriter();

		const response = await post(evidenceBody(claim.id));
		expect(response.status).toBe(201);

		expect(emitSSEEvent).toHaveBeenCalledTimes(1);
		expect(emitSSEEvent).toHaveBeenCalledWith(
			"tea.health/state-changed",
			testCase.id,
			expect.objectContaining({
				claimId: claim.id,
				status: expect.objectContaining({ verdict: "pass" }),
			})
		);
		// The evidence is committed by the time the event fires.
		expect(
			await prisma.pluginHealthEvidence.count({ where: { claimId: claim.id } })
		).toBe(1);
	});

	it("chains a second POST's previous record hash to the first's record hash", async () => {
		const { claim, post } = await setupWriter();
		expect((await post(evidenceBody(claim.id))).status).toBe(201);
		expect((await post(evidenceBody(claim.id, "marginalSummary"))).status).toBe(
			201
		);

		const rows = await prisma.pluginHealthEvidence.findMany({
			where: { claimId: claim.id },
			orderBy: { chainSequence: "asc" },
		});
		expect(rows[0]?.previousRecordHash).toBeNull();
		expect(rows[1]?.previousRecordHash).toBe(rows[0]?.recordHash);
	});

	it("preserves provenance keys beyond the recognised ones verbatim", async () => {
		const { claim, post } = await setupWriter();
		const fixture = evidenceBody(claim.id);
		const provenance = {
			...(fixture.provenance as object),
			scenario_notes: { nested: ["a", "b"], flag: true },
		};

		const response = await post(withOverrides(fixture, { provenance }));

		expect(response.status).toBe(201);
		const row = await prisma.pluginHealthEvidence.findFirstOrThrow({
			where: { claimId: claim.id },
		});
		expect(row.record).toHaveProperty("provenance", provenance);
	});
});

describe("POST — evidence format 1.1 body validation", () => {
	it.each([
		[
			"a claim_ref that does not match the path id",
			{ claim_ref: crypto.randomUUID() },
			"claim_ref",
		],
		["an unknown top-level field", { record_hash: "abc" }, "record_hash"],
		[
			"a format_version other than 1.1",
			{ format_version: "0.1" },
			"format_version",
		],
		["no valid_for", { valid_for: undefined }, "valid_for"],
		["a window in months", { window: "P1M" }, "window"],
		[
			"a timestamp more than five minutes ahead",
			{ timestamp: new Date(Date.now() + 10 * 60_000).toISOString() },
			"timestamp",
		],
	])("refuses %s with 400 naming the field, storing nothing", async (_label, overrides, field) => {
		const { claim, post } = await setupWriter();

		const response = await post(
			evidenceBody(claim.id, "populationPass", overrides)
		);

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toContain(field);
		expect(
			await prisma.pluginHealthEvidence.count({ where: { claimId: claim.id } })
		).toBe(0);
		expect(emitSSEEvent).not.toHaveBeenCalled();
	});

	it("refuses a body that is not valid JSON", async () => {
		const { claim, secret } = await setupWriter();
		const { POST } = await importRoute();

		const response = await POST(
			new NextRequest(EVIDENCE_PATH(claim.id), {
				method: "POST",
				headers: {
					"content-type": "application/json",
					authorization: `Bearer ${secret}`,
				},
				body: "{not json",
			}),
			{ params: Promise.resolve({ id: claim.id }) }
		);

		expect(response.status).toBe(400);
	});
});

describe("POST — repeated record_id and the bound check", () => {
	it("refuses a repeated record_id with 409 and stores nothing more", async () => {
		const { claim, post } = await setupWriter();
		const sent = evidenceBody(claim.id);
		expect((await post(sent)).status).toBe(201);

		const response = await post(sent);

		expect(response.status).toBe(409);
		expect(
			await prisma.pluginHealthEvidence.count({ where: { claimId: claim.id } })
		).toBe(1);
	});

	it("refuses a record from a second check with 422 and the contract's message, then returns the count to zero on the next accepted record", async () => {
		const { claim, post } = await setupWriter();
		expect((await post(evidenceBody(claim.id))).status).toBe(201);

		const refused = await post(evidenceBody(claim.id, "wholeSystem"));
		expect(refused.status).toBe(422);
		expect((await refused.json()).error).toBe(
			`This claim is bound to check ${SUMMARY_CHECK_NAME}. Evidence from another check needs its own evidence claim in the case.`
		);
		expect(
			await prisma.pluginHealthEvidence.count({ where: { claimId: claim.id } })
		).toBe(1);
		const state = await prisma.pluginHealthClaimState.findUniqueOrThrow({
			where: { claimId: claim.id },
		});
		expect(state.rejectedSinceLastAccept).toBe(1);

		const accepted = await post(evidenceBody(claim.id, "marginalSummary"));
		expect(accepted.status).toBe(201);
		expect((await accepted.json()).status.rejected_since_last_accept).toBe(0);
	});

	it("does not count a 400 towards rejected_since_last_accept", async () => {
		const { claim, post } = await setupWriter();
		expect((await post(evidenceBody(claim.id))).status).toBe(201);

		const refused = await post(
			evidenceBody(claim.id, "wholeSystem", { format_version: "0.1" })
		);
		expect(refused.status).toBe(400);

		const state = await prisma.pluginHealthClaimState.findUniqueOrThrow({
			where: { claimId: claim.id },
		});
		expect(state.rejectedSinceLastAccept).toBe(0);
	});
});

describe("GET /api/machine/health/elements/[id]/evidence — paged list", () => {
	it("returns newest first with next_before, snake_case items and the open revocation", async () => {
		const { owner, claim, post } = await setupWriter();
		const sent = [
			evidenceBody(claim.id, "populationPass"),
			evidenceBody(claim.id, "marginalSummary"),
			evidenceBody(claim.id, "failingSummary"),
		];
		for (const record of sent) {
			expect((await post(record)).status).toBe(201);
		}
		const { revokeHealthEvidence } = await import(
			"@/lib/services/health-evidence-service"
		);
		expectSuccess(
			await revokeHealthEvidence(
				owner.id,
				claim.id,
				sent[2]?.record_id as string,
				{
					cause: "evidence-defect",
					reason: "Bad run",
				}
			)
		);
		await mockAuth(owner.id, owner.username, owner.email);
		const { GET } = await importRoute();

		const page = await GET(getRequest(claim.id, undefined, "?limit=2"), {
			params: Promise.resolve({ id: claim.id }),
		});

		expect(page.status).toBe(200);
		const body = await page.json();
		expect(body.evidence).toHaveLength(2);
		expect(body.evidence[0]).toMatchObject({
			record: { record_id: sent[2]?.record_id },
			revocation: {
				cause: "evidence-defect",
				reason: "Bad run",
				revoked_by_name: owner.username,
			},
		});
		expect(body.evidence[0].revocation.revoked_at).toEqual(expect.any(String));
		expect(body.evidence[1].revocation).toBeNull();
		expect(body.evidence[0]).toEqual(
			expect.objectContaining({
				id: expect.any(String),
				chain_sequence: expect.any(Number),
				record_hash: expect.any(String),
				previous_record_hash: expect.any(String),
				created_by_id: expect.any(String),
				created_at: expect.any(String),
				expires_at: expect.any(String),
			})
		);
		expect(body.next_before).toBe(body.evidence[1].chain_sequence);

		const older = await GET(
			getRequest(claim.id, undefined, `?limit=2&before=${body.next_before}`),
			{ params: Promise.resolve({ id: claim.id }) }
		);
		const olderBody = await older.json();
		expect(olderBody.evidence).toHaveLength(1);
		expect(olderBody.evidence[0].record.record_id).toBe(sent[0]?.record_id);
		expect(olderBody.next_before).toBeNull();
	});

	it("refuses an invalid limit or before with 400", async () => {
		const { owner, claim } = await setup();
		await mockAuth(owner.id, owner.username, owner.email);
		const { GET } = await importRoute();

		for (const query of ["?limit=0", "?limit=500", "?before=abc", "?x=1"]) {
			const response = await GET(getRequest(claim.id, undefined, query), {
				params: Promise.resolve({ id: claim.id }),
			});
			expect(response.status).toBe(400);
		}
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
