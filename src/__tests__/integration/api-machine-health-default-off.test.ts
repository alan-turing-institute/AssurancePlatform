import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
	issueToken,
	registerIntegration,
	revokeIntegration,
	suspendIntegration,
} from "@/lib/services/integration-registry-service";
import { buildHealthCheckList } from "../fixtures/health-checks";
import { buildHealthRecords } from "../fixtures/health-records";
import { expectSuccess } from "../utils/assertion-helpers";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	createTestCase,
	createTestElement,
	createTestPermission,
	createTestPluginState,
	createTestUser,
} from "../utils/prisma-factories";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

const BASE = "http://localhost:3000/api";
const AUTH_FAILURE_MESSAGE = "Invalid or expired token";
const NOT_ENABLED_PATTERN = /is not enabled/;
const SCOPES = [
	"health:checks:write",
	"health:criteria:read",
	"health:evidence:read",
	"health:evidence:write",
];

beforeEach(async () => {
	await mockNoAuth();
});

afterEach(() => {
	vi.unstubAllEnvs();
});

/**
 * A person who has made no choice about Health, owning a case with one claim,
 * and a pipeline integration of theirs holding EDIT on that case.
 */
async function setupPipeline() {
	const owner = await createTestUser();
	const testCase = await createTestCase(owner.id);
	const claim = await createTestElement(testCase.id, owner.id, {
		elementType: "PROPERTY_CLAIM",
	});
	const { integration, systemUserId } = expectSuccess(
		await registerIntegration(
			{ name: `pipeline-${owner.id}`, scopes: SCOPES },
			owner.id
		)
	);
	const { secret } = expectSuccess(await issueToken(integration.id, owner.id));
	await createTestPermission(testCase.id, systemUserId, owner.id, "EDIT");
	return { owner, testCase, claim, integration, systemUserId, secret };
}

function machineRequest(
	path: string,
	secret: string,
	options: { method?: string; body?: unknown } = {}
) {
	return new NextRequest(`${BASE}${path}`, {
		method: options.method ?? "GET",
		headers: {
			authorization: `Bearer ${secret}`,
			...(options.body === undefined
				? {}
				: { "content-type": "application/json" }),
		},
		...(options.body === undefined
			? {}
			: { body: JSON.stringify(options.body) }),
	});
}

async function whoami(secret: string) {
	const { GET } = await import("@/app/api/machine/whoami/route");
	return await GET(machineRequest("/machine/whoami", secret));
}

async function readCaseCriteria(caseId: string, secret: string) {
	const { GET } = await import(
		"@/app/api/machine/health/cases/[id]/criteria/route"
	);
	return await GET(
		machineRequest(`/machine/health/cases/${caseId}/criteria`, secret),
		{ params: Promise.resolve({ id: caseId }) }
	);
}

async function postEvidence(claimId: string, secret: string) {
	const { POST } = await import(
		"@/app/api/machine/health/elements/[id]/evidence/route"
	);
	return await POST(
		machineRequest(`/machine/health/elements/${claimId}/evidence`, secret, {
			method: "POST",
			body: buildHealthRecords(claimId).populationPass,
		}),
		{ params: Promise.resolve({ id: claimId }) }
	);
}

async function publishChecks(secret: string) {
	const { PUT } = await import("@/app/api/machine/health/checks/route");
	return await PUT(
		machineRequest("/machine/health/checks", secret, {
			method: "PUT",
			body: buildHealthCheckList(),
		})
	);
}

async function evidenceCount(claimId: string) {
	return await prisma.pluginHealthEvidence.count({ where: { claimId } });
}

describe("machine health routes — an integration whose owner never turned Health on", () => {
	it("answers the identity check", async () => {
		const { secret } = await setupPipeline();

		const response = await whoami(secret);

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({ scopes: SCOPES });
	});

	it("reads a case's accepted settings", async () => {
		const { testCase, secret } = await setupPipeline();

		const response = await readCaseCriteria(testCase.id, secret);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			case_id: testCase.id,
			criteria: [],
		});
	});

	it("stores an evidence record", async () => {
		const { claim, secret } = await setupPipeline();

		const response = await postEvidence(claim.id, secret);

		expect(response.status).toBe(201);
		expect(await evidenceCount(claim.id)).toBe(1);
	});

	it("publishes its check list", async () => {
		const { secret } = await setupPipeline();

		const response = await publishChecks(secret);

		expect(response.status).toBe(200);
	});

	it("keeps sending while the owner's own row turns Health off", async () => {
		const { owner, claim, testCase, secret } = await setupPipeline();
		await createTestPluginState(owner.id, {
			pluginId: "tea.health",
			scopeType: "USER",
			enabled: false,
		});

		expect((await readCaseCriteria(testCase.id, secret)).status).toBe(200);
		expect((await postEvidence(claim.id, secret)).status).toBe(201);
		expect(await evidenceCount(claim.id)).toBe(1);
	});
});

describe("machine health routes — what still switches an integration off", () => {
	it("refuses with 403 and stores nothing once a row turns Health off for the integration's account", async () => {
		const { systemUserId, claim, testCase, secret } = await setupPipeline();
		await createTestPluginState(systemUserId, {
			pluginId: "tea.health",
			scopeType: "USER",
			enabled: false,
		});

		const read = await readCaseCriteria(testCase.id, secret);
		const post = await postEvidence(claim.id, secret);
		const publish = await publishChecks(secret);

		expect(read.status).toBe(403);
		expect(post.status).toBe(403);
		expect(publish.status).toBe(403);
		expect((await post.json()).error).toMatch(NOT_ENABLED_PATTERN);
		expect(await evidenceCount(claim.id)).toBe(0);
	});

	it("refuses with 403 and stores nothing when the deployment withholds Health, while the identity check still answers", async () => {
		const { claim, testCase, secret } = await setupPipeline();
		vi.stubEnv("TEA_PLUGINS_DISABLED", "tea.health");

		expect((await readCaseCriteria(testCase.id, secret)).status).toBe(403);
		const post = await postEvidence(claim.id, secret);
		expect(post.status).toBe(403);
		expect((await post.json()).error).toMatch(NOT_ENABLED_PATTERN);
		expect((await publishChecks(secret)).status).toBe(403);
		expect(await evidenceCount(claim.id)).toBe(0);
		expect((await whoami(secret)).status).toBe(200);
	});

	it.each([
		["suspended", suspendIntegration],
		["revoked", revokeIntegration],
	])("refuses a %s integration with 401 before any plugin check", async (_status, retire) => {
		const { owner, integration, claim, testCase, secret } =
			await setupPipeline();
		expectSuccess(await retire(integration.id, owner.id));

		for (const response of [
			await whoami(secret),
			await readCaseCriteria(testCase.id, secret),
			await postEvidence(claim.id, secret),
		]) {
			expect(response.status).toBe(401);
			expect((await response.json()).error).toBe(AUTH_FAILURE_MESSAGE);
		}
		expect(await evidenceCount(claim.id)).toBe(0);
	});
});

describe("Health for a person — off until they turn it on in settings", () => {
	it("refuses the owner's own session while their integration keeps sending, and admits it once they turn Health on", async () => {
		const { owner, claim, secret } = await setupPipeline();
		await mockAuth(owner.id, owner.username, owner.email);
		const { GET: readStatus } = await import(
			"@/app/api/elements/[id]/health/route"
		);
		const statusRequest = () =>
			readStatus(new NextRequest(`${BASE}/elements/${claim.id}/health`), {
				params: Promise.resolve({ id: claim.id }),
			});

		expect((await statusRequest()).status).toBe(403);
		expect((await postEvidence(claim.id, secret)).status).toBe(201);

		const { PATCH } = await import("@/app/api/user/plugins/route");
		const toggled = await PATCH(
			new NextRequest(`${BASE}/user/plugins`, {
				method: "PATCH",
				body: JSON.stringify({ pluginId: "tea.health", enabled: true }),
			})
		);
		expect(toggled.status).toBe(200);

		const admitted = await statusRequest();
		expect(admitted.status).toBe(200);
		expect((await admitted.json()).status).not.toBeNull();
	});

	it("is listed as off, with the Case Assistant, for a person who never chose", async () => {
		const person = await createTestUser();
		await mockAuth(person.id, person.username, person.email);

		const { GET } = await import("@/app/api/user/plugins/route");
		const body = await (await GET()).json();

		const byId = new Map(
			body.plugins.map((plugin: { pluginId: string; enabled: boolean }) => [
				plugin.pluginId,
				plugin.enabled,
			])
		);
		expect(byId.get("tea.health")).toBe(false);
		expect(byId.get("tea.assistant")).toBe(false);
	});
});
