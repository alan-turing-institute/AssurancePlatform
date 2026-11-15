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
 * Route-level regression tests for POST /api/elements/[id]/attach (TEA —
 * Mutation-schema hardening, commit 00a77f7e). The route used to read
 * legacy snake_case keys (goal_id, parent_id, strategy_id,
 * property_claim_id) from the raw body via resolveParentId() before
 * parsing; that resolver is gone and the body is parsed directly with
 * attachElementSchema (z.strictObject({ parentId })). These exercise the
 * real POST handler against real Postgres, mirroring
 * api-cases-batch-route.test.ts's pattern.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/services/sse-connection-manager", () => ({
	emitSSEEvent: vi.fn(),
	sseConnectionManager: { broadcast: vi.fn() },
}));

beforeEach(async () => {
	await mockNoAuth();
});

async function postAttach(elementId: string, body: unknown) {
	const { POST } = await import("@/app/api/elements/[id]/attach/route");
	const req = new NextRequest(
		`http://localhost:3000/api/elements/${elementId}/attach`,
		{
			method: "POST",
			body: JSON.stringify(body),
			headers: { "Content-Type": "application/json" },
		}
	);
	return await POST(req, { params: Promise.resolve({ id: elementId }) });
}

describe("POST /api/elements/[id]/attach", () => {
	it("attaches the element to the named parent when the body is a bare { parentId }", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const goal = await createTestElement(testCase.id, owner.id, {
			elementType: "GOAL",
		});
		const orphan = await createTestElement(testCase.id, owner.id, {
			elementType: "STRATEGY",
			inSandbox: true,
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const response = await postAttach(orphan.id, { parentId: goal.id });

		expect(response.status).toBe(200);
		const inDb = await prisma.assuranceElement.findUnique({
			where: { id: orphan.id },
		});
		expect(inDb?.parentId).toBe(goal.id);
	});

	it.each([
		"CONTEXT",
		"JUSTIFICATION",
		"ASSUMPTION",
		"CONTRACT",
	] as const)("attaches a %s element from the side area under a claim", async (elementType) => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const claim = await createTestElement(testCase.id, owner.id, {
			elementType: "PROPERTY_CLAIM",
		});
		const stored = await createTestElement(testCase.id, owner.id, {
			elementType: "STRATEGY",
			inSandbox: true,
		});
		// Written straight to the table: the factory only builds current types.
		const oldElement = await prisma.assuranceElement.update({
			where: { id: stored.id },
			data: { elementType },
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const response = await postAttach(oldElement.id, { parentId: claim.id });

		expect(response.status).toBe(200);
		const inDb = await prisma.assuranceElement.findUnique({
			where: { id: oldElement.id },
		});
		expect(inDb?.parentId).toBe(claim.id);
		expect(inDb?.inSandbox).toBe(false);
	});

	it.each([
		"CONTEXT",
		"JUSTIFICATION",
		"ASSUMPTION",
		"CONTRACT",
	] as const)("refuses to attach a %s element beneath a piece of evidence", async (elementType) => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const evidence = await createTestElement(testCase.id, owner.id, {
			elementType: "EVIDENCE",
		});
		const stored = await createTestElement(testCase.id, owner.id, {
			elementType: "STRATEGY",
			inSandbox: true,
		});
		const oldElement = await prisma.assuranceElement.update({
			where: { id: stored.id },
			data: { elementType },
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const response = await postAttach(oldElement.id, {
			parentId: evidence.id,
		});

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toBe(
			"parentId cannot be a piece of evidence unless the element is a counter-goal"
		);
		const inDb = await prisma.assuranceElement.findUnique({
			where: { id: oldElement.id },
		});
		expect(inDb?.parentId).toBeNull();
		expect(inDb?.inSandbox).toBe(true);
	});

	it.each([
		["CONTEXT", "AWAY_GOAL"],
		["CONTEXT", "MODULE"],
		["JUSTIFICATION", "AWAY_GOAL"],
		["ASSUMPTION", "MODULE"],
	] as const)("refuses to attach a %s element beneath a parent of type %s", async (elementType, parentType) => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const referenced = await createTestCase(owner.id);
		const parent = await createTestElement(testCase.id, owner.id, {
			elementType: parentType,
			moduleReferenceId: referenced.id,
			moduleEmbedType: "REFERENCE",
		});
		const stored = await createTestElement(testCase.id, owner.id, {
			elementType: "STRATEGY",
			inSandbox: true,
		});
		const oldElement = await prisma.assuranceElement.update({
			where: { id: stored.id },
			data: { elementType },
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const response = await postAttach(oldElement.id, {
			parentId: parent.id,
		});

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toBe("parentId cannot be an away goal or a module");
		const inDb = await prisma.assuranceElement.findUnique({
			where: { id: oldElement.id },
		});
		expect(inDb?.parentId).toBeNull();
		expect(inDb?.inSandbox).toBe(true);
	});

	it("rejects a legacy snake_case body (goal_id) with 400 and does not attach", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const goal = await createTestElement(testCase.id, owner.id, {
			elementType: "GOAL",
		});
		const orphan = await createTestElement(testCase.id, owner.id, {
			elementType: "STRATEGY",
			inSandbox: true,
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const response = await postAttach(orphan.id, { goal_id: goal.id });

		expect(response.status).toBe(400);
		const inDb = await prisma.assuranceElement.findUnique({
			where: { id: orphan.id },
		});
		expect(inDb?.parentId).toBeNull();
	});

	it("rejects a non-UUID parentId with 400 and the friendly message", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const orphan = await createTestElement(testCase.id, owner.id, {
			elementType: "STRATEGY",
			inSandbox: true,
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const response = await postAttach(orphan.id, {
			parentId: "not-a-uuid",
		});

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toBe("Invalid parent ID format");
	});

	it("answers 400 when a detached claim is attached beneath its own child", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const claim = await createTestElement(testCase.id, owner.id, {
			elementType: "PROPERTY_CLAIM",
			inSandbox: true,
		});
		const child = await createTestElement(testCase.id, owner.id, {
			elementType: "PROPERTY_CLAIM",
			parentId: claim.id,
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const response = await postAttach(claim.id, { parentId: child.id });

		expect(response.status).toBe(400);
		expect((await response.json()).error).toBe(
			"Cannot move element to one of its descendants"
		);
		const inDb = await prisma.assuranceElement.findUnique({
			where: { id: claim.id },
		});
		expect(inDb?.parentId).toBeNull();
		expect(inDb?.inSandbox).toBe(true);
	});
});
