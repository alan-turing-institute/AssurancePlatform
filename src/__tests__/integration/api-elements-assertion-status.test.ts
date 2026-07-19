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

/**
 * Review follow-up (round 2, vincent, BLOCKER): both mutation routes
 * validated `assertionStatus` via Zod, then dropped it in their hand-
 * maintained input builders (`buildCreateInput` / `buildUpdateInput`) — the
 * guarded service (element-service.ts) never received it, so no author
 * could actually set the field through the API. The permission-matrix
 * tests in element-assertion-status-permissions.test.ts call
 * `createElement`/`updateElement` directly, which is why they never caught
 * this — these tests exercise the ACTUAL route handlers
 * (app/api/cases/[id]/elements/route.ts, app/api/elements/[id]/route.ts)
 * to prove the field is reachable end-to-end, not just correct at the
 * service layer.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/services/sse-connection-manager", () => ({
	emitSSEEvent: vi.fn(),
	sseConnectionManager: { broadcast: vi.fn() },
}));

const PERMISSION_DENIED_PATTERN = /Permission denied/;

beforeEach(async () => {
	await mockNoAuth();
});

describe("POST /api/cases/[id]/elements — assertionStatus (ADR 0004 D3)", () => {
	it("lets an author set assertionStatus through the route handler, persisted per a separate refetch", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { POST } = await import("@/app/api/cases/[id]/elements/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/elements`,
			{
				method: "POST",
				body: JSON.stringify({
					type: "goal",
					name: "Root Goal",
					description: "Top-level goal",
					assertionStatus: "NEEDS_SUPPORT",
				}),
				headers: { "Content-Type": "application/json" },
			}
		);
		const response = await POST(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(201);
		const body = await response.json();
		expect(body.assertionStatus).toBe("NEEDS_SUPPORT");

		// Separate refetch — proves DB persistence, not just an echoed response.
		const inDb = await prisma.assuranceElement.findUnique({
			where: { id: body.id },
		});
		expect(inDb?.assertionStatus).toBe("NEEDS_SUPPORT");
	});

	it("rejects a system/integration user through the route (proves the guard is reachable via the real HTTP path)", async () => {
		const owner = await createTestUser();
		const { systemUser } = await createTestIntegrationWithSystemUser(owner.id);
		const testCase = await createTestCase(owner.id);
		// A genuine EDIT grant, as a real integration would hold
		// (grantIntegrationCaseAccess) — not a test-only shortcut.
		await createTestPermission(testCase.id, systemUser.id, owner.id, "EDIT");
		await mockAuth(systemUser.id, systemUser.username, systemUser.email);

		const { POST } = await import("@/app/api/cases/[id]/elements/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/elements`,
			{
				method: "POST",
				body: JSON.stringify({
					type: "goal",
					name: "Root Goal",
					description: "Top-level goal",
					assertionStatus: "ASSUMED",
				}),
				headers: { "Content-Type": "application/json" },
			}
		);
		const response = await POST(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(403);
		const body = await response.json();
		expect(body.error).toMatch(PERMISSION_DENIED_PATTERN);

		const elements = await prisma.assuranceElement.findMany({
			where: { caseId: testCase.id },
		});
		expect(elements).toHaveLength(0);
	});
});

describe("PUT /api/elements/[id] — assertionStatus (ADR 0004 D3)", () => {
	it("lets an author set assertionStatus through the route handler, persisted per a separate refetch", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const element = await createTestElement(testCase.id, owner.id, {
			elementType: "GOAL",
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const { PUT } = await import("@/app/api/elements/[id]/route");
		const req = new NextRequest(
			`http://localhost:3000/api/elements/${element.id}`,
			{
				method: "PUT",
				body: JSON.stringify({ assertionStatus: "DEFEATED" }),
				headers: { "Content-Type": "application/json" },
			}
		);
		const response = await PUT(req, {
			params: Promise.resolve({ id: element.id }),
		});

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.assertionStatus).toBe("DEFEATED");

		// Separate refetch — proves DB persistence, not just an echoed response.
		const inDb = await prisma.assuranceElement.findUnique({
			where: { id: element.id },
		});
		expect(inDb?.assertionStatus).toBe("DEFEATED");
	});

	it("rejects a system/integration user through the route (proves the guard is reachable via the real HTTP path)", async () => {
		const owner = await createTestUser();
		const { systemUser } = await createTestIntegrationWithSystemUser(owner.id);
		const testCase = await createTestCase(owner.id);
		await createTestPermission(testCase.id, systemUser.id, owner.id, "EDIT");
		const element = await createTestElement(testCase.id, owner.id, {
			elementType: "GOAL",
		});
		await mockAuth(systemUser.id, systemUser.username, systemUser.email);

		const { PUT } = await import("@/app/api/elements/[id]/route");
		const req = new NextRequest(
			`http://localhost:3000/api/elements/${element.id}`,
			{
				method: "PUT",
				body: JSON.stringify({ assertionStatus: "DEFEATED" }),
				headers: { "Content-Type": "application/json" },
			}
		);
		const response = await PUT(req, {
			params: Promise.resolve({ id: element.id }),
		});

		expect(response.status).toBe(403);
		const body = await response.json();
		expect(body.error).toMatch(PERMISSION_DENIED_PATTERN);

		const inDb = await prisma.assuranceElement.findUnique({
			where: { id: element.id },
		});
		expect(inDb?.assertionStatus).toBeNull();
	});
});
