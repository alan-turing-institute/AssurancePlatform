import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appendHealthEvidence } from "@/lib/services/health-evidence-service";
import { recomputeHealthScore } from "@/lib/services/health-scoring-service";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	createTestCase,
	createTestElement,
	createTestPermission,
	createTestPluginData,
	createTestUser,
} from "../utils/prisma-factories";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

const HEALTH_PATH = (elementId: string) =>
	`http://localhost:3000/api/elements/${elementId}/health`;
const NONEXISTENT_ID = "00000000-0000-0000-0000-000000000000";
const NOT_ENABLED_PATTERN = /is not enabled/;

beforeEach(async () => {
	await mockNoAuth();
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

function getRequest(elementId: string): NextRequest {
	return new NextRequest(HEALTH_PATH(elementId));
}

function importRoute() {
	return import("@/app/api/elements/[id]/health/route");
}

describe("GET /api/elements/[id]/health — happy path", () => {
	it("returns the score written by recomputeHealthScore, end to end", async () => {
		const { owner, testCase, claim } = await setup();
		await mockAuth(owner.id, owner.username, owner.email);
		const appended = await appendHealthEvidence(owner.id, {
			claimId: claim.id,
			metricName: "in-distribution-rate",
			value: 0.98,
			threshold: 0.95,
			verdict: "PASS",
			oddDimensions: [],
			sourceSystem: "darter-pipeline",
			provenance: { check: "ood-monitor/kl-divergence", runId: "run-1" },
			evaluatedAt: new Date().toISOString(),
		});
		expect("data" in appended).toBe(true);
		await recomputeHealthScore(owner.id, claim.id, testCase.id);

		const { GET } = await importRoute();
		const response = await GET(getRequest(claim.id), {
			params: Promise.resolve({ id: claim.id }),
		});

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.health.score).toBe(1);
		expect(body.health.lastEvaluatedAt).not.toBeNull();
	});

	it("returns health: null for a claim that has never been scored", async () => {
		const { owner, claim } = await setup();
		await mockAuth(owner.id, owner.username, owner.email);
		const { GET } = await importRoute();

		const response = await GET(getRequest(claim.id), {
			params: Promise.resolve({ id: claim.id }),
		});

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.health).toBeNull();
	});

	it("reads via a viewer's session with only VIEW access", async () => {
		const { owner, testCase, claim } = await setup();
		const viewer = await createTestUser();
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");
		await createTestPluginData(testCase.id, {
			pluginId: "tea.health",
			elementId: claim.id,
			data: {
				score: 0.5,
				lastEvaluatedAt: null,
				validityWindowSeconds: 86_400,
			},
		});
		await mockAuth(viewer.id, viewer.username, viewer.email);
		const { GET } = await importRoute();

		const response = await GET(getRequest(claim.id), {
			params: Promise.resolve({ id: claim.id }),
		});

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.health.score).toBe(0.5);
	});
});

describe("GET /api/elements/[id]/health — validation and auth", () => {
	it("rejects a non-UUID id with 400", async () => {
		const { owner } = await setup();
		await mockAuth(owner.id, owner.username, owner.email);
		const { GET } = await importRoute();

		const response = await GET(getRequest("not-a-uuid"), {
			params: Promise.resolve({ id: "not-a-uuid" }),
		});

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.code).toBe("VALIDATION");
	});

	it("returns 401 with no session", async () => {
		const { claim } = await setup();
		const { GET } = await importRoute();

		const response = await GET(getRequest(claim.id), {
			params: Promise.resolve({ id: claim.id }),
		});

		expect(response.status).toBe(401);
	});
});

describe("GET /api/elements/[id]/health — permission matrix", () => {
	it("returns 404 'Claim not found' for a non-existent claim id", async () => {
		const { owner } = await setup();
		await mockAuth(owner.id, owner.username, owner.email);
		const { GET } = await importRoute();

		const response = await GET(getRequest(NONEXISTENT_ID), {
			params: Promise.resolve({ id: NONEXISTENT_ID }),
		});

		expect(response.status).toBe(404);
		const body = await response.json();
		expect(body.error).toBe("Claim not found");
	});

	it("returns 404 'Claim not found' for a session with no case access", async () => {
		const { claim } = await setup();
		const outsider = await createTestUser();
		await mockAuth(outsider.id, outsider.username, outsider.email);
		const { GET } = await importRoute();

		const response = await GET(getRequest(claim.id), {
			params: Promise.resolve({ id: claim.id }),
		});

		expect(response.status).toBe(404);
		const body = await response.json();
		expect(body.error).toBe("Claim not found");
	});

	it("returns byte-identical 404s for a non-existent claim vs. one an outsider can't access (no enumeration oracle)", async () => {
		const { claim } = await setup();
		const outsider = await createTestUser();
		await mockAuth(outsider.id, outsider.username, outsider.email);
		const { GET } = await importRoute();

		const noAccessResponse = await GET(getRequest(claim.id), {
			params: Promise.resolve({ id: claim.id }),
		});
		const nonexistentResponse = await GET(getRequest(NONEXISTENT_ID), {
			params: Promise.resolve({ id: NONEXISTENT_ID }),
		});

		expect(noAccessResponse.status).toBe(nonexistentResponse.status);
		const noAccessBody = await noAccessResponse.json();
		const nonexistentBody = await nonexistentResponse.json();
		expect(noAccessBody).toEqual(nonexistentBody);
	});
});

describe("GET /api/elements/[id]/health — disabled-plugin refusal", () => {
	it("refuses cleanly (403, not a 500) when tea.health is disabled at the deployment level", async () => {
		const { owner, claim } = await setup();
		await mockAuth(owner.id, owner.username, owner.email);
		vi.stubEnv("TEA_PLUGINS_DISABLED", "tea.health");
		const { GET } = await importRoute();

		const response = await GET(getRequest(claim.id), {
			params: Promise.resolve({ id: claim.id }),
		});

		expect(response.status).toBe(403);
		const body = await response.json();
		expect(body.error).toMatch(NOT_ENABLED_PATTERN);
	});
});
