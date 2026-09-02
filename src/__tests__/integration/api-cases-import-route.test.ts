import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	createNestedCaseJSON,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * Route-level coverage for POST/PUT /api/cases/import — previously only the
 * service layer (`case-import-service.test.ts`) and the gdrive/github
 * import variants had tests; the route handlers themselves (the one
 * sanctioned schema-less body read, Design §4 of the body-size-guard
 * issue) were never invoked by any test.
 */

const ONE_MIB = 1024 * 1024;

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

beforeEach(async () => {
	await mockNoAuth();
});

function importRequest(
	method: "POST" | "PUT",
	body: string,
	init?: { headers?: Record<string, string> }
): NextRequest {
	return new NextRequest("http://localhost:3000/api/cases/import", {
		method,
		body,
		headers: init?.headers,
	});
}

describe("POST /api/cases/import", () => {
	it("imports a small valid case document", async () => {
		const owner = await createTestUser();
		await mockAuth(owner.id, owner.username, owner.email);

		const { POST } = await import("@/app/api/cases/import/route");
		const req = importRequest("POST", JSON.stringify(createNestedCaseJSON()));

		const response = await POST(req);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(typeof body.id).toBe("string");

		const inDb = await prisma.assuranceCase.findUnique({
			where: { id: body.id },
		});
		expect(inDb).not.toBeNull();
		expect(inDb?.name).toBe("Test Import Case");
	});

	it("rejects a valid-JSON body that is not a valid case document with 400, not 413, even padded past 1 MiB", async () => {
		const owner = await createTestUser();
		await mockAuth(owner.id, owner.username, owner.email);

		const payload = JSON.stringify({ junk: "x".repeat(1.5 * ONE_MIB) });
		expect(payload.length).toBeGreaterThan(ONE_MIB);

		const { POST } = await import("@/app/api/cases/import/route");
		const req = importRequest("POST", payload);

		const response = await POST(req);

		expect(response.status).toBe(400);
	});

	it("rejects a body over the 10 MiB caseImport cap, declared via Content-Length, with 413", async () => {
		const owner = await createTestUser();
		await mockAuth(owner.id, owner.username, owner.email);

		const oversized = JSON.stringify({
			junk: "x".repeat(10 * ONE_MIB + 1024),
		});

		const { POST } = await import("@/app/api/cases/import/route");
		const req = importRequest("POST", oversized, {
			headers: { "content-length": String(oversized.length) },
		});

		const response = await POST(req);

		expect(response.status).toBe(413);
		const body = await response.json();
		expect(body.code).toBe("PAYLOAD_TOO_LARGE");
	});

	it("rejects malformed JSON with 400 'Request body must be valid JSON'", async () => {
		const owner = await createTestUser();
		await mockAuth(owner.id, owner.username, owner.email);

		const { POST } = await import("@/app/api/cases/import/route");
		const req = importRequest("POST", "{ this is not valid json");

		const response = await POST(req);

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toBe("Request body must be valid JSON");
	});
});

describe("PUT /api/cases/import — validate without creating", () => {
	it("validates a small valid case document without creating it", async () => {
		const owner = await createTestUser();
		await mockAuth(owner.id, owner.username, owner.email);

		const { PUT } = await import("@/app/api/cases/import/route");
		const req = importRequest("PUT", JSON.stringify(createNestedCaseJSON()));

		const response = await PUT(req);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.isValid).toBe(true);

		const inDb = await prisma.assuranceCase.findFirst({
			where: { name: "Test Import Case" },
		});
		expect(inDb).toBeNull();
	});
});
