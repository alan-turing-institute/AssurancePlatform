import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	createTestCase,
	createTestElement,
	createTestIntegrationWithSystemUser,
	createTestPermission,
	createTestUser,
} from "../utils/prisma-factories";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

const KNOWN_PLUGIN_ID = "tea.health";
const UNKNOWN_PLUGIN_ID = "tea.does-not-exist";
const WRITE_SCOPE = "health:evidence:write";

function requestFor(pluginId: string): NextRequest {
	return new NextRequest(
		`http://localhost:3000/api/user/plugins/${pluginId}/consequences`
	);
}

function importRoute() {
	return import("@/app/api/user/plugins/[pluginId]/consequences/route");
}

/** Inserts one evidence row directly — this suite reads counts, not the hash chain. */
async function insertEvidence(claimId: string, createdById: string) {
	const n = Math.random().toString(36).slice(2);
	return await prisma.pluginHealthEvidence.create({
		data: {
			claimId,
			metricName: "in-distribution-rate",
			verdict: "PASS",
			sourceSystem: "test",
			provenance: { check: "test" },
			evaluatedAt: new Date(),
			formatVersion: "0.1",
			recordHash: `hash-${n}`,
			createdById,
		},
	});
}

beforeEach(async () => {
	await mockNoAuth();
});

describe("GET /api/user/plugins/[pluginId]/consequences", () => {
	it("returns 401 when the request is not authenticated", async () => {
		const { GET } = await importRoute();
		const response = await GET(requestFor(KNOWN_PLUGIN_ID), {
			params: Promise.resolve({ pluginId: KNOWN_PLUGIN_ID }),
		});
		expect(response.status).toBe(401);
	});

	it("returns 404 for a plugin id absent from the manifest", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);

		const { GET } = await importRoute();
		const response = await GET(requestFor(UNKNOWN_PLUGIN_ID), {
			params: Promise.resolve({ pluginId: UNKNOWN_PLUGIN_ID }),
		});
		expect(response.status).toBe(404);
	});

	it("counts evidence, cases, and active scoped integrations on a case the user can access", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const claim = await createTestElement(testCase.id, owner.id, {
			elementType: "PROPERTY_CLAIM",
		});
		await insertEvidence(claim.id, owner.id);
		await insertEvidence(claim.id, owner.id);

		const { integration, systemUser } =
			await createTestIntegrationWithSystemUser(owner.id, {
				scopes: [WRITE_SCOPE],
				status: "ACTIVE",
			});
		await createTestPermission(testCase.id, systemUser.id, owner.id, "EDIT");

		await mockAuth(owner.id, owner.username, owner.email);
		const { GET } = await importRoute();
		const response = await GET(requestFor(KNOWN_PLUGIN_ID), {
			params: Promise.resolve({ pluginId: KNOWN_PLUGIN_ID }),
		});

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.evidenceRecordCount).toBe(2);
		expect(body.caseCount).toBe(1);
		expect(body.activeIntegrations).toEqual([
			{ id: integration.id, name: integration.name },
		]);
	});

	it("omits an integration that lacks the health:evidence:write scope", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const claim = await createTestElement(testCase.id, owner.id, {
			elementType: "PROPERTY_CLAIM",
		});
		await insertEvidence(claim.id, owner.id);

		const { systemUser } = await createTestIntegrationWithSystemUser(owner.id, {
			scopes: ["health:evidence:read"],
			status: "ACTIVE",
		});
		await createTestPermission(testCase.id, systemUser.id, owner.id, "EDIT");

		await mockAuth(owner.id, owner.username, owner.email);
		const { GET } = await importRoute();
		const response = await GET(requestFor(KNOWN_PLUGIN_ID), {
			params: Promise.resolve({ pluginId: KNOWN_PLUGIN_ID }),
		});

		const body = await response.json();
		expect(body.evidenceRecordCount).toBe(1);
		expect(body.activeIntegrations).toEqual([]);
	});

	it("omits a REVOKED integration even with the write scope and case access", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);

		const { systemUser } = await createTestIntegrationWithSystemUser(owner.id, {
			scopes: [WRITE_SCOPE],
			status: "REVOKED",
		});
		await createTestPermission(testCase.id, systemUser.id, owner.id, "EDIT");

		await mockAuth(owner.id, owner.username, owner.email);
		const { GET } = await importRoute();
		const response = await GET(requestFor(KNOWN_PLUGIN_ID), {
			params: Promise.resolve({ pluginId: KNOWN_PLUGIN_ID }),
		});

		const body = await response.json();
		expect(body.activeIntegrations).toEqual([]);
	});

	it("returns zeros/empty for a user with no access to the case at all", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const claim = await createTestElement(testCase.id, owner.id, {
			elementType: "PROPERTY_CLAIM",
		});
		await insertEvidence(claim.id, owner.id);
		const { systemUser } = await createTestIntegrationWithSystemUser(owner.id, {
			scopes: [WRITE_SCOPE],
			status: "ACTIVE",
		});
		await createTestPermission(testCase.id, systemUser.id, owner.id, "EDIT");

		const outsider = await createTestUser();
		await mockAuth(outsider.id, outsider.username, outsider.email);

		const { GET } = await importRoute();
		const response = await GET(requestFor(KNOWN_PLUGIN_ID), {
			params: Promise.resolve({ pluginId: KNOWN_PLUGIN_ID }),
		});

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body).toEqual({
			evidenceRecordCount: 0,
			caseCount: 0,
			activeIntegrations: [],
		});
	});
});
