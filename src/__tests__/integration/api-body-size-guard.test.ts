import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	createTestCase,
	createTestElement,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * Route-level proof that the request-body size guard (`lib/api-request.ts`)
 * is actually wired into real routes, not just the helper's own unit tests.
 * `PUT /api/cases/[id]/information` is the exemplar for the default 1 MiB
 * cap (both enforcement paths — a declared Content-Length and a streamed
 * body); `POST /api/cases/[id]/batch` proves the named override actually
 * raises the limit rather than every route sharing one hard ceiling.
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

const ONE_MIB = 1024 * 1024;

/** A body over `totalBytes`, delivered across several stream chunks — no
 * `Content-Length` header, so only the running-byte-count path can catch
 * it (a NextRequest built from a string body arrives as a single chunk
 * with no header — see lib/__tests__/api-request.test.ts). */
function oversizedStreamBody(totalBytes: number): ReadableStream<Uint8Array> {
	const encoder = new TextEncoder();
	const chunk = encoder.encode(`"${"x".repeat(64 * 1024)}"`); // ~64 KiB
	let sent = 0;
	return new ReadableStream<Uint8Array>({
		pull(controller) {
			if (sent >= totalBytes) {
				controller.close();
				return;
			}
			controller.enqueue(chunk);
			sent += chunk.byteLength;
		},
	});
}

describe("PUT /api/cases/[id]/information — body size guard", () => {
	it("rejects a body whose declared Content-Length exceeds the 1 MiB cap with 413", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const oversized = JSON.stringify({
			description: "x".repeat(ONE_MIB + 1024),
		});
		const { PUT } = await import("@/app/api/cases/[id]/information/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/information`,
			{
				method: "PUT",
				body: oversized,
				headers: { "content-length": String(oversized.length) },
			}
		);

		const response = await PUT(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(413);
		const body = await response.json();
		expect(body.code).toBe("PAYLOAD_TOO_LARGE");
	});

	it("rejects a body over the 1 MiB cap delivered across several stream chunks, with no Content-Length header", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { PUT } = await import("@/app/api/cases/[id]/information/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/information`,
			{
				method: "PUT",
				body: oversizedStreamBody(ONE_MIB + 128 * 1024),
				duplex: "half",
			}
		);

		const response = await PUT(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(413);
		const body = await response.json();
		expect(body.code).toBe("PAYLOAD_TOO_LARGE");
	});

	it("returns 401 for an unauthenticated oversized request — auth is checked before the body is ever read", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		// Deliberately no mockAuth() — stays unauthenticated (mockNoAuth in beforeEach).

		const oversized = JSON.stringify({
			description: "x".repeat(ONE_MIB + 1024),
		});
		const { PUT } = await import("@/app/api/cases/[id]/information/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/information`,
			{
				method: "PUT",
				body: oversized,
				headers: { "content-length": String(oversized.length) },
			}
		);

		const response = await PUT(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(401);
	});
});

describe("POST /api/cases/[id]/batch — named override raises the cap", () => {
	it("accepts a valid change list padded over 1 MiB but under the 5 MiB batchUpdate limit", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const element = await createTestElement(testCase.id, owner.id, {
			elementType: "EVIDENCE",
		});
		await mockAuth(owner.id, owner.username, owner.email);

		// batchUpdateRequestSchema places no length cap on an update's
		// `description`, so a ~2 MiB value is schema-valid — this proves the
		// route's size guard itself, not the zod schema, is what changed.
		const longDescription = "x".repeat(2 * ONE_MIB);

		const { POST } = await import("@/app/api/cases/[id]/batch/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/batch`,
			{
				method: "POST",
				body: JSON.stringify({
					changes: [
						{
							type: "update",
							elementId: element.id,
							data: { description: longDescription },
						},
					],
				}),
				headers: { "Content-Type": "application/json" },
			}
		);

		const response = await POST(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(200);
	});
});
