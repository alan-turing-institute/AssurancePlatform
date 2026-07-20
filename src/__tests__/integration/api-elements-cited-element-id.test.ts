import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	createTestCase,
	createTestElement,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * ADR 0004 D5: citedElementId lets an AWAY_GOAL name the specific element it
 * cites within the case named by moduleReferenceId. Following the D3
 * (assertionStatus) review lesson: `buildCreateInput`/`buildUpdateInput`
 * (app/api/cases/[id]/elements/route.ts, app/api/elements/[id]/route.ts) are
 * hand-maintained allowlists that silently drop unforwarded fields, so these
 * tests exercise the ACTUAL route handlers, not just the service layer.
 *
 * Creating an AWAY_GOAL via the single-element POST route used to be
 * untestable here: `moduleReferenceId` (required by AwayGoalSchema) wasn't
 * wired into `createElementSchema`/`buildCreateInput`, so AWAY_GOAL elements
 * could only be created via the batch path (case-batch-update-service.ts).
 * That gap is closed (moduleReferenceId route wiring dispatch) — the first
 * test below now creates a real AWAY_GOAL end to end through this route,
 * with both moduleReferenceId and citedElementId set in the same request.
 * moduleReferenceId's own dedicated coverage (required-field rejection,
 * applicability, existence) lives in
 * api-elements-module-reference-id.test.ts; the rest of this file still
 * seeds AWAY_GOAL fixtures directly via the test factory where the point of
 * the test is citedElementId behaviour specifically.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/services/sse-connection-manager", () => ({
	emitSSEEvent: vi.fn(),
	sseConnectionManager: { broadcast: vi.fn() },
}));

const NOT_APPLICABLE_PATTERN = /only applicable to AWAY_GOAL/;
const NOT_FOUND_PATTERN = /must reference an existing element/;
const SELF_CITATION_PATTERN = /cannot reference the element itself/;

beforeEach(async () => {
	await mockNoAuth();
});

describe("POST /api/cases/[id]/elements — citedElementId (ADR 0004 D5)", () => {
	it("creates an AWAY_GOAL end to end with moduleReferenceId and citedElementId, persisted per a separate refetch", async () => {
		const owner = await createTestUser();
		const homeCase = await createTestCase(owner.id);
		const awayCase = await createTestCase(owner.id);
		const citedGoal = await createTestElement(awayCase.id, owner.id, {
			elementType: "GOAL",
			name: "Away Goal",
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const { POST } = await import("@/app/api/cases/[id]/elements/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${homeCase.id}/elements`,
			{
				method: "POST",
				body: JSON.stringify({
					type: "away_goal",
					name: "Reference",
					description: "Cites a specific element in another case",
					moduleReferenceId: awayCase.id,
					citedElementId: citedGoal.id,
				}),
				headers: { "Content-Type": "application/json" },
			}
		);
		const response = await POST(req, {
			params: Promise.resolve({ id: homeCase.id }),
		});

		expect(response.status).toBe(201);
		const body = await response.json();
		expect(body.moduleReferenceId).toBe(awayCase.id);
		expect(body.citedElementId).toBe(citedGoal.id);

		// Separate refetch — proves DB persistence, not just an echoed response.
		const inDb = await prisma.assuranceElement.findFirst({
			where: { caseId: homeCase.id, elementType: "AWAY_GOAL" },
		});
		expect(inDb?.moduleReferenceId).toBe(awayCase.id);
		expect(inDb?.citedElementId).toBe(citedGoal.id);
	});

	it("rejects citedElementId on a non-AWAY_GOAL type through the route handler", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const target = await createTestElement(testCase.id, owner.id, {
			elementType: "GOAL",
			name: "Existing Goal",
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const { POST } = await import("@/app/api/cases/[id]/elements/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/elements`,
			{
				method: "POST",
				body: JSON.stringify({
					type: "strategy",
					name: "A Strategy",
					description: "Not an AWAY_GOAL",
					citedElementId: target.id,
				}),
				headers: { "Content-Type": "application/json" },
			}
		);
		const response = await POST(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toMatch(NOT_APPLICABLE_PATTERN);

		const elements = await prisma.assuranceElement.findMany({
			where: { caseId: testCase.id, elementType: "STRATEGY" },
		});
		expect(elements).toHaveLength(0);
	});
});

describe("PUT /api/elements/[id] — citedElementId (ADR 0004 D5)", () => {
	it("lets an author set citedElementId on an AWAY_GOAL through the route handler, persisted per a separate refetch", async () => {
		const owner = await createTestUser();
		const homeCase = await createTestCase(owner.id);
		const awayCase = await createTestCase(owner.id);
		const citedGoal = await createTestElement(awayCase.id, owner.id, {
			elementType: "GOAL",
			name: "Away Goal",
		});
		const awayGoal = await createTestElement(homeCase.id, owner.id, {
			elementType: "AWAY_GOAL",
			name: "Reference",
			moduleReferenceId: awayCase.id,
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const { PUT } = await import("@/app/api/elements/[id]/route");
		const req = new NextRequest(
			`http://localhost:3000/api/elements/${awayGoal.id}`,
			{
				method: "PUT",
				body: JSON.stringify({ citedElementId: citedGoal.id }),
				headers: { "Content-Type": "application/json" },
			}
		);
		const response = await PUT(req, {
			params: Promise.resolve({ id: awayGoal.id }),
		});

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.citedElementId).toBe(citedGoal.id);

		// Separate refetch — proves DB persistence, not just an echoed response.
		const inDb = await prisma.assuranceElement.findUnique({
			where: { id: awayGoal.id },
		});
		expect(inDb?.citedElementId).toBe(citedGoal.id);
	});

	it("rejects citedElementId on a non-AWAY_GOAL type through the route handler", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const goal = await createTestElement(testCase.id, owner.id, {
			elementType: "GOAL",
		});
		const otherGoal = await createTestElement(testCase.id, owner.id, {
			elementType: "PROPERTY_CLAIM",
			parentId: goal.id,
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const { PUT } = await import("@/app/api/elements/[id]/route");
		const req = new NextRequest(
			`http://localhost:3000/api/elements/${goal.id}`,
			{
				method: "PUT",
				body: JSON.stringify({ citedElementId: otherGoal.id }),
				headers: { "Content-Type": "application/json" },
			}
		);
		const response = await PUT(req, {
			params: Promise.resolve({ id: goal.id }),
		});

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toMatch(NOT_APPLICABLE_PATTERN);

		const inDb = await prisma.assuranceElement.findUnique({
			where: { id: goal.id },
		});
		expect(inDb?.citedElementId).toBeNull();
	});

	it("rejects a nonexistent citedElementId target through the route handler", async () => {
		const owner = await createTestUser();
		const homeCase = await createTestCase(owner.id);
		const awayCase = await createTestCase(owner.id);
		const awayGoal = await createTestElement(homeCase.id, owner.id, {
			elementType: "AWAY_GOAL",
			moduleReferenceId: awayCase.id,
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const { PUT } = await import("@/app/api/elements/[id]/route");
		const req = new NextRequest(
			`http://localhost:3000/api/elements/${awayGoal.id}`,
			{
				method: "PUT",
				body: JSON.stringify({
					citedElementId: "00000000-0000-0000-0000-000000000000",
				}),
				headers: { "Content-Type": "application/json" },
			}
		);
		const response = await PUT(req, {
			params: Promise.resolve({ id: awayGoal.id }),
		});

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toMatch(NOT_FOUND_PATTERN);

		const inDb = await prisma.assuranceElement.findUnique({
			where: { id: awayGoal.id },
		});
		expect(inDb?.citedElementId).toBeNull();
	});

	it("rejects self-citation through the route handler", async () => {
		const owner = await createTestUser();
		const homeCase = await createTestCase(owner.id);
		const awayCase = await createTestCase(owner.id);
		const awayGoal = await createTestElement(homeCase.id, owner.id, {
			elementType: "AWAY_GOAL",
			moduleReferenceId: awayCase.id,
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const { PUT } = await import("@/app/api/elements/[id]/route");
		const req = new NextRequest(
			`http://localhost:3000/api/elements/${awayGoal.id}`,
			{
				method: "PUT",
				body: JSON.stringify({ citedElementId: awayGoal.id }),
				headers: { "Content-Type": "application/json" },
			}
		);
		const response = await PUT(req, {
			params: Promise.resolve({ id: awayGoal.id }),
		});

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toMatch(SELF_CITATION_PATTERN);

		const inDb = await prisma.assuranceElement.findUnique({
			where: { id: awayGoal.id },
		});
		expect(inDb?.citedElementId).toBeNull();
	});

	it("clears citationDangling when the author sets a fresh citedElementId", async () => {
		const owner = await createTestUser();
		const homeCase = await createTestCase(owner.id);
		const awayCase = await createTestCase(owner.id);
		const citedGoal = await createTestElement(awayCase.id, owner.id, {
			elementType: "GOAL",
		});
		const awayGoal = await createTestElement(homeCase.id, owner.id, {
			elementType: "AWAY_GOAL",
			moduleReferenceId: awayCase.id,
			citationDangling: true,
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const { PUT } = await import("@/app/api/elements/[id]/route");
		const req = new NextRequest(
			`http://localhost:3000/api/elements/${awayGoal.id}`,
			{
				method: "PUT",
				body: JSON.stringify({ citedElementId: citedGoal.id }),
				headers: { "Content-Type": "application/json" },
			}
		);
		const response = await PUT(req, {
			params: Promise.resolve({ id: awayGoal.id }),
		});

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.citationDangling).toBeUndefined();

		const inDb = await prisma.assuranceElement.findUnique({
			where: { id: awayGoal.id },
		});
		expect(inDb?.citationDangling).toBe(false);
	});
});
