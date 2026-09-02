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
 * Route-level regression tests for POST /api/cases/[id]/batch — the JSON
 * editor's batch-update path (TEA — Mutation-schema hardening, Part 2).
 * These exercise the real route handler, not applyBatchUpdate directly
 * (see case-batch-update-service.test.ts for the service-level suite), to
 * prove nullableUrlSchema is actually wired into the schema the route
 * parses against and that the route surfaces its friendly message.
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

async function postBatch(caseId: string, body: unknown) {
	const { POST } = await import("@/app/api/cases/[id]/batch/route");
	const req = new NextRequest(
		`http://localhost:3000/api/cases/${caseId}/batch`,
		{
			method: "POST",
			body: JSON.stringify(body),
			headers: { "Content-Type": "application/json" },
		}
	);
	return await POST(req, { params: Promise.resolve({ id: caseId }) });
}

describe("POST /api/cases/[id]/batch — evidence URL validation (nullableUrlSchema)", () => {
	it("normalises a schemeless URL and stores it with https:// prepended", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const evidence = await createTestElement(testCase.id, owner.id, {
			elementType: "EVIDENCE",
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const response = await postBatch(testCase.id, {
			changes: [
				{
					type: "update",
					elementId: evidence.id,
					data: { url: "example.com/report.pdf" },
				},
			],
		});

		expect(response.status).toBe(200);
		const inDb = await prisma.assuranceElement.findUnique({
			where: { id: evidence.id },
		});
		expect(inDb?.url).toBe("https://example.com/report.pdf");
	});

	it("rejects a mailto: address with the friendly message", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const evidence = await createTestElement(testCase.id, owner.id, {
			elementType: "EVIDENCE",
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const response = await postBatch(testCase.id, {
			changes: [
				{
					type: "update",
					elementId: evidence.id,
					data: { url: "mailto:x@y" },
				},
			],
		});

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toBe(
			"Enter a web address, such as example.com/report.pdf"
		);
	});

	it("clears an existing URL when data.url is null (JSON editor's clear affordance)", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const evidence = await createTestElement(testCase.id, owner.id, {
			elementType: "EVIDENCE",
			url: "https://example.com/existing.pdf",
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const response = await postBatch(testCase.id, {
			changes: [
				{
					type: "update",
					elementId: evidence.id,
					data: { url: null },
				},
			],
		});

		expect(response.status).toBe(200);
		const inDb = await prisma.assuranceElement.findUnique({
			where: { id: evidence.id },
		});
		expect(inDb?.url).toBeNull();
	});
});

describe("POST /api/cases/[id]/batch — strict schema (unrecognised key rejection)", () => {
	it("rejects an update change whose data carries an unrecognised key (URL, uppercase — batchUpdateRequestSchema only declares lowercase url) with 400 naming the key", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const evidence = await createTestElement(testCase.id, owner.id, {
			elementType: "EVIDENCE",
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const response = await postBatch(testCase.id, {
			changes: [
				{
					type: "update",
					elementId: evidence.id,
					data: { URL: "https://x.example" },
				},
			],
		});

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toContain("URL");
	});
});
