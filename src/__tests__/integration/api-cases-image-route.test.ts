import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import { createTestCase, createTestUser } from "../utils/prisma-factories";

/**
 * Route-level coverage for POST /api/cases/[id]/image — the canvas
 * screenshot upload, both from the editor UI and from the unload-time
 * `navigator.sendBeacon` auto-screenshot (`hooks/use-auto-screenshot.ts`,
 * which sends `Content-Type: text/plain`). Previously had no test at all.
 *
 * Storage is mocked at the service boundary (`blob-storage-service.ts`'s
 * `uploadToBlob`) rather than exercising real Azure Blob Storage or relying
 * on `NODE_ENV === "development"`'s local-filesystem fallback, which the
 * vitest integration environment doesn't set.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/services/blob-storage-service", () => ({
	uploadToBlob: vi.fn().mockResolvedValue({
		data: { url: "https://example.blob.core.windows.net/media/mock.png" },
	}),
	generateScreenshotBlobPath: vi.fn().mockReturnValue("images/mock.png"),
}));

const ONE_MIB = 1024 * 1024;

beforeEach(async () => {
	await mockNoAuth();
});

function postImage(
	caseId: string,
	body: string,
	init?: { headers?: Record<string, string> }
): NextRequest {
	return new NextRequest(`http://localhost:3000/api/cases/${caseId}/image`, {
		method: "POST",
		body,
		headers: init?.headers,
	});
}

describe("POST /api/cases/[id]/image", () => {
	it("accepts a real-shaped body sent as text/plain (the sendBeacon path) for a user with EDIT", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { POST } = await import("@/app/api/cases/[id]/image/route");
		const req = postImage(
			testCase.id,
			JSON.stringify({ image: "data:image/png;base64,iVBORw0KGgo=" }),
			{ headers: { "content-type": "text/plain" } }
		);

		const response = await POST(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.success).toBe(true);
		expect(typeof body.image).toBe("string");
	});

	it("rejects an unknown key with 400", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { POST } = await import("@/app/api/cases/[id]/image/route");
		const req = postImage(
			testCase.id,
			JSON.stringify({
				image: "data:image/png;base64,iVBORw0KGgo=",
				extra: "not allowed",
			})
		);

		const response = await POST(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toBe('Unrecognized key: "extra"');
	});

	it("accepts a valid ~1.5 MiB body — above the 1 MiB default, proving the caseImage override applies", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const payload = JSON.stringify({ image: "x".repeat(1.5 * ONE_MIB) });
		expect(payload.length).toBeGreaterThan(ONE_MIB);

		const { POST } = await import("@/app/api/cases/[id]/image/route");
		const req = postImage(testCase.id, payload);

		const response = await POST(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.success).toBe(true);
		expect(typeof body.image).toBe("string");
	});

	it("rejects a body over the 10 MiB caseImage cap, declared via Content-Length, with 413", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const oversized = JSON.stringify({
			image: "x".repeat(10 * ONE_MIB + 1024),
		});

		const { POST } = await import("@/app/api/cases/[id]/image/route");
		const req = postImage(testCase.id, oversized, {
			headers: { "content-length": String(oversized.length) },
		});

		const response = await POST(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(413);
		const body = await response.json();
		expect(body.code).toBe("PAYLOAD_TOO_LARGE");
	});
});
