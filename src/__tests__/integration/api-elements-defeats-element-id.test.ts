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
 * defeatsElementId (dialogical reasoning / defeaters) — route-level coverage,
 * following the same lesson as api-elements-cited-element-id.test.ts:
 * buildCreateInput/buildUpdateInput are hand-maintained allowlists that can
 * silently drop a field never wired through, so this exercises the ACTUAL
 * route handlers (app/api/cases/[id]/elements/route.ts,
 * app/api/elements/[id]/route.ts), not just the service layer. Service-layer
 * coverage of the scoping rule itself (cross-case, nonexistent, soft-deleted,
 * self-reference, null-clears) lives in element-defeats-scoping.test.ts.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/services/sse-connection-manager", () => ({
	emitSSEEvent: vi.fn(),
	sseConnectionManager: { broadcast: vi.fn() },
}));

const CROSS_CASE_PATTERN =
	/defeatsElementId must reference an existing element in this case/;

beforeEach(async () => {
	await mockNoAuth();
});

describe("POST /api/cases/[id]/elements — defeatsElementId", () => {
	it("creates an element with defeatsElementId end to end, persisted per a separate refetch", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const target = await createTestElement(testCase.id, owner.id, {
			elementType: "PROPERTY_CLAIM",
			name: "Original claim",
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const { POST } = await import("@/app/api/cases/[id]/elements/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/elements`,
			{
				method: "POST",
				body: JSON.stringify({
					type: "property_claim",
					name: "Rebuttal",
					description: "Defeats the original claim",
					isDefeater: true,
					defeatsElementId: target.id,
				}),
				headers: { "Content-Type": "application/json" },
			}
		);
		const response = await POST(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(201);
		const body = await response.json();
		expect(body.defeatsElementId).toBe(target.id);
		expect(body.isDefeater).toBe(true);

		// Separate refetch — proves DB persistence, not just an echoed response.
		const inDb = await prisma.assuranceElement.findFirst({
			where: { caseId: testCase.id, name: "Rebuttal" },
		});
		expect(inDb?.defeatsElementId).toBe(target.id);
		expect(inDb?.isDefeater).toBe(true);
	});

	it("rejects a cross-case defeatsElementId through the route handler", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const otherCase = await createTestCase(owner.id);
		const foreignTarget = await createTestElement(otherCase.id, owner.id, {
			elementType: "PROPERTY_CLAIM",
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const { POST } = await import("@/app/api/cases/[id]/elements/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/elements`,
			{
				method: "POST",
				body: JSON.stringify({
					type: "property_claim",
					name: "Rebuttal",
					description: "Points at a foreign case",
					defeatsElementId: foreignTarget.id,
				}),
				headers: { "Content-Type": "application/json" },
			}
		);
		const response = await POST(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toMatch(CROSS_CASE_PATTERN);

		const elements = await prisma.assuranceElement.findMany({
			where: { caseId: testCase.id },
		});
		expect(elements).toHaveLength(0);
	});
});

describe("PUT /api/elements/[id] — defeatsElementId", () => {
	it("round-trips defeatsElementId through the route handler, persisted per a separate refetch", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const target = await createTestElement(testCase.id, owner.id, {
			elementType: "PROPERTY_CLAIM",
		});
		const element = await createTestElement(testCase.id, owner.id, {
			elementType: "PROPERTY_CLAIM",
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const { PUT } = await import("@/app/api/elements/[id]/route");
		const req = new NextRequest(
			`http://localhost:3000/api/elements/${element.id}`,
			{
				method: "PUT",
				body: JSON.stringify({
					isDefeater: true,
					defeatsElementId: target.id,
				}),
				headers: { "Content-Type": "application/json" },
			}
		);
		const response = await PUT(req, {
			params: Promise.resolve({ id: element.id }),
		});

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.defeatsElementId).toBe(target.id);
		expect(body.isDefeater).toBe(true);

		// Separate refetch — proves DB persistence, not just an echoed response.
		const inDb = await prisma.assuranceElement.findUnique({
			where: { id: element.id },
		});
		expect(inDb?.defeatsElementId).toBe(target.id);
		expect(inDb?.isDefeater).toBe(true);
	});

	it("rejects a cross-case defeatsElementId through the route handler", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const otherCase = await createTestCase(owner.id);
		const foreignTarget = await createTestElement(otherCase.id, owner.id, {
			elementType: "PROPERTY_CLAIM",
		});
		const element = await createTestElement(testCase.id, owner.id, {
			elementType: "PROPERTY_CLAIM",
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const { PUT } = await import("@/app/api/elements/[id]/route");
		const req = new NextRequest(
			`http://localhost:3000/api/elements/${element.id}`,
			{
				method: "PUT",
				body: JSON.stringify({ defeatsElementId: foreignTarget.id }),
				headers: { "Content-Type": "application/json" },
			}
		);
		const response = await PUT(req, {
			params: Promise.resolve({ id: element.id }),
		});

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toMatch(CROSS_CASE_PATTERN);

		const inDb = await prisma.assuranceElement.findUnique({
			where: { id: element.id },
		});
		expect(inDb?.defeatsElementId).toBeNull();
	});
});
