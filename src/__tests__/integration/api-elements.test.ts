import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	createTestCase,
	createTestElement,
	createTestPermission,
	createTestUser,
} from "../utils/prisma-factories";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

beforeEach(async () => {
	await mockNoAuth();
});

function putRequest(elementId: string, body: unknown): NextRequest {
	return new NextRequest(`http://localhost:3000/api/elements/${elementId}`, {
		method: "PUT",
		body: JSON.stringify(body),
		headers: { "Content-Type": "application/json" },
	});
}

function getRequest(elementId: string): NextRequest {
	return new NextRequest(`http://localhost:3000/api/elements/${elementId}`);
}

function importRoute() {
	return import("@/app/api/elements/[id]/route");
}

// ============================================
// PUT /api/elements/[id] — urls forwarding
//
// Regression coverage for the silent no-op: the evidence edit dialog sends
// a validated `urls` array, but `buildUpdateInput` in the route dropped it
// before it ever reached `updateElement`, so edits appeared to succeed while
// the stored URLs never changed.
//
// The schema currently in effect on `staging` normalises entries via
// `lenientUrlSchema` (PR #873, merged) — a scheme-less value such as
// "example.com" is prepended with "https://" rather than rejected. Genuinely
// malformed input (no web scheme, e.g. "mailto:x@y.z") is still rejected;
// see lib/schemas/__tests__/element-url.test.ts for the schema's own
// coverage of the normalisation/rejection boundary.
// ============================================

describe("PUT /api/elements/[id] — urls forwarding", () => {
	it("stores a changed urls array (regression: urls must not be dropped)", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const evidence = await createTestElement(testCase.id, owner.id, {
			elementType: "EVIDENCE",
			url: "https://example.com/original",
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const { PUT } = await importRoute();
		const response = await PUT(
			putRequest(evidence.id, {
				description: evidence.description,
				urls: [
					"https://example.com/updated-one",
					"https://example.com/updated-two",
				],
			}),
			{ params: Promise.resolve({ id: evidence.id }) }
		);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.urls).toEqual([
			"https://example.com/updated-one",
			"https://example.com/updated-two",
		]);
		// Legacy single-URL field stays in sync with urls[0]
		expect(body.URL).toBe("https://example.com/updated-one");

		const { GET } = await importRoute();
		const refetched = await GET(getRequest(evidence.id), {
			params: Promise.resolve({ id: evidence.id }),
		});
		const refetchedBody = await refetched.json();
		expect(refetchedBody.urls).toEqual([
			"https://example.com/updated-one",
			"https://example.com/updated-two",
		]);
	});

	it("clears urls when sent an empty array", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const evidence = await createTestElement(testCase.id, owner.id, {
			elementType: "EVIDENCE",
			url: "https://example.com/original",
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const { PUT } = await importRoute();
		const response = await PUT(
			putRequest(evidence.id, {
				description: evidence.description,
				urls: [],
			}),
			{ params: Promise.resolve({ id: evidence.id }) }
		);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.urls).toBeUndefined();
		expect(body.URL).toBeUndefined();
	});

	it("leaves stored urls untouched when the field is omitted from the request", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const evidence = await createTestElement(testCase.id, owner.id, {
			elementType: "EVIDENCE",
			url: "https://example.com/untouched",
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const { PUT } = await importRoute();
		const response = await PUT(
			putRequest(evidence.id, { description: "Updated description only" }),
			{ params: Promise.resolve({ id: evidence.id }) }
		);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.description).toBe("Updated description only");
		expect(body.URL).toBe("https://example.com/untouched");
	});

	it("returns 400 for a non-web scheme that lenientUrlSchema rejects rather than mangles", async () => {
		// "not-a-url" is no longer a valid regression fixture here: since
		// PR #873, a scheme-less entry is normalised to "https://not-a-url"
		// (a syntactically valid, if useless, URL) rather than rejected.
		// "mailto:x@y.z" carries an explicit non-http(s) scheme, which
		// lenientUrlSchema still rejects outright instead of prepending
		// "https://" onto it.
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const evidence = await createTestElement(testCase.id, owner.id, {
			elementType: "EVIDENCE",
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const { PUT } = await importRoute();
		const response = await PUT(
			putRequest(evidence.id, { urls: ["mailto:x@y.z"] }),
			{ params: Promise.resolve({ id: evidence.id }) }
		);

		expect(response.status).toBe(400);
	});

	it("returns 404 when a VIEW-only permission holder attempts the update (anti-enumeration: same error as not-found)", async () => {
		const owner = await createTestUser();
		const viewer = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const evidence = await createTestElement(testCase.id, owner.id, {
			elementType: "EVIDENCE",
			url: "https://example.com/protected",
		});
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");
		await mockAuth(viewer.id, viewer.username, viewer.email);

		const { PUT } = await importRoute();
		const response = await PUT(
			putRequest(evidence.id, { urls: ["https://example.com/hijacked"] }),
			{ params: Promise.resolve({ id: evidence.id }) }
		);

		expect(response.status).toBe(404);
	});
});
