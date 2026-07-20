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
 * moduleReferenceId route wiring — "AWAY_GOAL cannot be created via the
 * single-element route" (moduleReferenceId gap). Before this fix,
 * `moduleReferenceId` was not part of `createElementSchema`/
 * `buildCreateInput`/`updateElementSchema` at all: the batch path
 * (case-batch-update-service.ts, via AwayGoalSchema/ModuleSchema in
 * lib/schemas/element-validation.ts) already required and persisted it, but
 * the single-element POST/PUT routes had no way to carry it through, so an
 * AWAY_GOAL created via POST would hit the Prisma element-validation
 * extension's "Element validation failed" and surface as an opaque 500 —
 * this is the exact gap api-elements-cited-element-id.test.ts's docstring
 * flagged as making a route-level AWAY_GOAL creation test impossible during
 * ADR 0004 D5 (its deviation 1). These tests exercise the real route
 * handlers end to end, following that file's convention.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/services/sse-connection-manager", () => ({
	emitSSEEvent: vi.fn(),
	sseConnectionManager: { broadcast: vi.fn() },
}));

const NOT_APPLICABLE_PATTERN = /only applicable to MODULE and AWAY_GOAL/;
const REQUIRED_PATTERN = /moduleReferenceId is required/;
const NOT_FOUND_PATTERN = /must reference an existing case/;

beforeEach(async () => {
	await mockNoAuth();
});

describe("POST /api/cases/[id]/elements — moduleReferenceId", () => {
	it("creates an AWAY_GOAL with moduleReferenceId, persisted per a separate refetch", async () => {
		const owner = await createTestUser();
		const homeCase = await createTestCase(owner.id);
		const awayCase = await createTestCase(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { POST } = await import("@/app/api/cases/[id]/elements/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${homeCase.id}/elements`,
			{
				method: "POST",
				body: JSON.stringify({
					type: "away_goal",
					name: "Reference",
					description: "Cites another case",
					moduleReferenceId: awayCase.id,
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

		// Separate refetch — proves DB persistence, not just an echoed response.
		const inDb = await prisma.assuranceElement.findFirst({
			where: { caseId: homeCase.id, elementType: "AWAY_GOAL" },
		});
		expect(inDb?.moduleReferenceId).toBe(awayCase.id);
	});

	it("rejects creating an AWAY_GOAL without moduleReferenceId (400, not a 500)", async () => {
		const owner = await createTestUser();
		const homeCase = await createTestCase(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { POST } = await import("@/app/api/cases/[id]/elements/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${homeCase.id}/elements`,
			{
				method: "POST",
				body: JSON.stringify({
					type: "away_goal",
					name: "Reference",
					description: "Missing its case reference",
				}),
				headers: { "Content-Type": "application/json" },
			}
		);
		const response = await POST(req, {
			params: Promise.resolve({ id: homeCase.id }),
		});

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toMatch(REQUIRED_PATTERN);

		const elements = await prisma.assuranceElement.findMany({
			where: { caseId: homeCase.id, elementType: "AWAY_GOAL" },
		});
		expect(elements).toHaveLength(0);
	});

	it("rejects moduleReferenceId on a type it doesn't apply to", async () => {
		const owner = await createTestUser();
		const homeCase = await createTestCase(owner.id);
		const awayCase = await createTestCase(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { POST } = await import("@/app/api/cases/[id]/elements/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${homeCase.id}/elements`,
			{
				method: "POST",
				body: JSON.stringify({
					type: "strategy",
					name: "A Strategy",
					description: "Not a MODULE or AWAY_GOAL",
					moduleReferenceId: awayCase.id,
				}),
				headers: { "Content-Type": "application/json" },
			}
		);
		const response = await POST(req, {
			params: Promise.resolve({ id: homeCase.id }),
		});

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toMatch(NOT_APPLICABLE_PATTERN);

		const elements = await prisma.assuranceElement.findMany({
			where: { caseId: homeCase.id, elementType: "STRATEGY" },
		});
		expect(elements).toHaveLength(0);
	});

	it("rejects a nonexistent moduleReferenceId target case", async () => {
		const owner = await createTestUser();
		const homeCase = await createTestCase(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { POST } = await import("@/app/api/cases/[id]/elements/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${homeCase.id}/elements`,
			{
				method: "POST",
				body: JSON.stringify({
					type: "away_goal",
					name: "Reference",
					description: "Cites a case that doesn't exist",
					moduleReferenceId: "00000000-0000-0000-0000-000000000000",
				}),
				headers: { "Content-Type": "application/json" },
			}
		);
		const response = await POST(req, {
			params: Promise.resolve({ id: homeCase.id }),
		});

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toMatch(NOT_FOUND_PATTERN);

		const elements = await prisma.assuranceElement.findMany({
			where: { caseId: homeCase.id, elementType: "AWAY_GOAL" },
		});
		expect(elements).toHaveLength(0);
	});
});

describe("PUT /api/elements/[id] — moduleReferenceId", () => {
	it("lets an author change moduleReferenceId on an AWAY_GOAL, persisted per a separate refetch", async () => {
		const owner = await createTestUser();
		const homeCase = await createTestCase(owner.id);
		const awayCaseA = await createTestCase(owner.id);
		const awayCaseB = await createTestCase(owner.id);
		const awayGoal = await createTestElement(homeCase.id, owner.id, {
			elementType: "AWAY_GOAL",
			name: "Reference",
			moduleReferenceId: awayCaseA.id,
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const { PUT } = await import("@/app/api/elements/[id]/route");
		const req = new NextRequest(
			`http://localhost:3000/api/elements/${awayGoal.id}`,
			{
				method: "PUT",
				body: JSON.stringify({ moduleReferenceId: awayCaseB.id }),
				headers: { "Content-Type": "application/json" },
			}
		);
		const response = await PUT(req, {
			params: Promise.resolve({ id: awayGoal.id }),
		});

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.moduleReferenceId).toBe(awayCaseB.id);

		const inDb = await prisma.assuranceElement.findUnique({
			where: { id: awayGoal.id },
		});
		expect(inDb?.moduleReferenceId).toBe(awayCaseB.id);
	});

	it("rejects moduleReferenceId on a non-MODULE/AWAY_GOAL type through the route handler", async () => {
		const owner = await createTestUser();
		const homeCase = await createTestCase(owner.id);
		const awayCase = await createTestCase(owner.id);
		const goal = await createTestElement(homeCase.id, owner.id, {
			elementType: "GOAL",
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const { PUT } = await import("@/app/api/elements/[id]/route");
		const req = new NextRequest(
			`http://localhost:3000/api/elements/${goal.id}`,
			{
				method: "PUT",
				body: JSON.stringify({ moduleReferenceId: awayCase.id }),
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
		expect(inDb?.moduleReferenceId).toBeNull();
	});
});
