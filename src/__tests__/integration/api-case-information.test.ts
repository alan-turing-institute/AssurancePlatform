import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	createTestCase,
	createTestCaseInformation,
	createTestPermission,
	createTestUser,
} from "../utils/prisma-factories";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

const NON_EXISTENT_CASE_ID = "00000000-0000-0000-0000-000000000000";
const FEATURE_IMAGE_ROUTE_PATTERN = (caseId: string) =>
	new RegExp(`^/api/cases/${caseId}/media/feature\\?v=[0-9a-f]{12}$`);

beforeEach(async () => {
	await mockNoAuth();
});

// ============================================
// GET /api/cases/[id]/information
// ============================================

describe("GET /api/cases/[id]/information", () => {
	it("returns null for a case with no case information yet", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { GET } = await import("@/app/api/cases/[id]/information/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/information`
		);
		const response = await GET(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toBeNull();
	});

	it("returns the record when one exists", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await createTestCaseInformation(testCase.id, {
			description: "A narrative description",
			authors: "Ada Lovelace",
			sector: "Healthcare",
			featureImageUrl: "https://example.com/feature.png",
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const { GET } = await import("@/app/api/cases/[id]/information/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/information`
		);
		const response = await GET(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.description).toBe("A narrative description");
		expect(body.authors).toBe("Ada Lovelace");
		expect(body.sector).toBe("Healthcare");
		expect(body.featureImageUrl).toBe("https://example.com/feature.png");
	});

	it("projects a stored key to this case's own media route, never the raw key", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await createTestCaseInformation(testCase.id, {
			featureImageUrl: "cases/some-id/case-information/original.png",
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const { GET } = await import("@/app/api/cases/[id]/information/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/information`
		);
		const response = await GET(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		const body = await response.json();
		expect(body.featureImageUrl).toMatch(
			FEATURE_IMAGE_ROUTE_PATTERN(testCase.id)
		);
	});

	it("returns 401 when the request is not authenticated", async () => {
		const { GET } = await import("@/app/api/cases/[id]/information/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${NON_EXISTENT_CASE_ID}/information`
		);
		const response = await GET(req, {
			params: Promise.resolve({ id: NON_EXISTENT_CASE_ID }),
		});

		expect(response.status).toBe(401);
	});

	it("returns 403 for a non-existent case (anti-enumeration via Permission denied)", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);

		const { GET } = await import("@/app/api/cases/[id]/information/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${NON_EXISTENT_CASE_ID}/information`
		);
		const response = await GET(req, {
			params: Promise.resolve({ id: NON_EXISTENT_CASE_ID }),
		});

		expect(response.status).toBe(403);
	});

	it("returns 403 for a case the user has no permission on", async () => {
		const owner = await createTestUser();
		const stranger = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await mockAuth(stranger.id, stranger.username, stranger.email);

		const { GET } = await import("@/app/api/cases/[id]/information/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/information`
		);
		const response = await GET(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(403);
	});

	it("returns 200 for a user with VIEW permission", async () => {
		const owner = await createTestUser();
		const viewer = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");
		await mockAuth(viewer.id, viewer.username, viewer.email);

		const { GET } = await import("@/app/api/cases/[id]/information/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/information`
		);
		const response = await GET(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(200);
	});
});

// ============================================
// PUT /api/cases/[id]/information
// ============================================

describe("PUT /api/cases/[id]/information", () => {
	it("creates a case-information record for the owner", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { PUT } = await import("@/app/api/cases/[id]/information/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/information`,
			{
				method: "PUT",
				body: JSON.stringify({
					description: "New description",
					authors: "Grace Hopper",
					sector: "Defence",
				}),
			}
		);
		const response = await PUT(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.description).toBe("New description");
		expect(body.authors).toBe("Grace Hopper");
		expect(body.sector).toBe("Defence");
	});

	it("updates only the fields supplied, leaving others untouched", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await createTestCaseInformation(testCase.id, {
			description: "Original description",
			authors: "Original authors",
			sector: "Original sector",
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const { PUT } = await import("@/app/api/cases/[id]/information/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/information`,
			{
				method: "PUT",
				body: JSON.stringify({ description: "Updated description" }),
			}
		);
		const response = await PUT(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.description).toBe("Updated description");
		expect(body.authors).toBe("Original authors");
		expect(body.sector).toBe("Original sector");
	});

	it("leaves the stored feature-image key unchanged when the form re-submits this case's own media route address", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const storedKey = "cases/some-id/case-information/original.png";
		await createTestCaseInformation(testCase.id, {
			description: "Original description",
			featureImageUrl: storedKey,
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const { PUT } = await import("@/app/api/cases/[id]/information/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/information`,
			{
				method: "PUT",
				body: JSON.stringify({
					description: "Original description",
					// Exactly what GET would have returned for this case's stored
					// key — the value the form was shown and re-submits unchanged.
					featureImageUrl: `/api/cases/${testCase.id}/media/feature`,
				}),
			}
		);
		const response = await PUT(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(200);
		const body = await response.json();
		// The response is projected too — this case's own route address back,
		// not the key.
		expect(body.featureImageUrl).toMatch(
			FEATURE_IMAGE_ROUTE_PATTERN(testCase.id)
		);

		const { getCaseInformation } = await import(
			"@/lib/services/case-information-service"
		);
		const result = await getCaseInformation(owner.id, testCase.id);
		expect("data" in result && result.data?.featureImageUrl).toBe(storedKey);
	});

	it("leaves the stored feature-image key unchanged when the form re-submits this case's own media route address with a ?v= query", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const storedKey = "cases/some-id/case-information/original.png";
		await createTestCaseInformation(testCase.id, {
			description: "Original description",
			featureImageUrl: storedKey,
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const { PUT } = await import("@/app/api/cases/[id]/information/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/information`,
			{
				method: "PUT",
				body: JSON.stringify({
					description: "Original description",
					featureImageUrl: `/api/cases/${testCase.id}/media/feature?v=abc123def456`,
				}),
			}
		);
		const response = await PUT(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(200);

		const { getCaseInformation } = await import(
			"@/lib/services/case-information-service"
		);
		const result = await getCaseInformation(owner.id, testCase.id);
		expect("data" in result && result.data?.featureImageUrl).toBe(storedKey);
	});

	it("returns 400 for a bare storage key naming another case, leaving the stored value unchanged", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const storedKey = "cases/some-id/case-information/original.png";
		await createTestCaseInformation(testCase.id, {
			featureImageUrl: storedKey,
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const { PUT } = await import("@/app/api/cases/[id]/information/route");
		const otherCaseId = "00000000-0000-0000-0000-000000000001";
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/information`,
			{
				method: "PUT",
				body: JSON.stringify({
					featureImageUrl: `cases/${otherCaseId}/case-information/x.png`,
				}),
			}
		);
		const response = await PUT(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(400);

		const { getCaseInformation } = await import(
			"@/lib/services/case-information-service"
		);
		const result = await getCaseInformation(owner.id, testCase.id);
		expect("data" in result && result.data?.featureImageUrl).toBe(storedKey);
	});

	it("returns 400 for an http:// feature-image address", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { PUT } = await import("@/app/api/cases/[id]/information/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/information`,
			{
				method: "PUT",
				body: JSON.stringify({
					featureImageUrl: "http://example.com/feature.png",
				}),
			}
		);
		const response = await PUT(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(400);
	});

	it("does clear the feature image when explicitly set to null, not treated as the media route", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await createTestCaseInformation(testCase.id, {
			featureImageUrl: "cases/some-id/case-information/original.png",
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const { PUT } = await import("@/app/api/cases/[id]/information/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/information`,
			{ method: "PUT", body: JSON.stringify({ featureImageUrl: null }) }
		);
		const response = await PUT(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.featureImageUrl).toBeNull();
	});

	it("returns 400 when no fields are supplied", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { PUT } = await import("@/app/api/cases/[id]/information/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/information`,
			{ method: "PUT", body: JSON.stringify({}) }
		);
		const response = await PUT(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(400);
	});

	it("returns 401 when the request is not authenticated", async () => {
		const { PUT } = await import("@/app/api/cases/[id]/information/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${NON_EXISTENT_CASE_ID}/information`,
			{ method: "PUT", body: JSON.stringify({ description: "x" }) }
		);
		const response = await PUT(req, {
			params: Promise.resolve({ id: NON_EXISTENT_CASE_ID }),
		});

		expect(response.status).toBe(401);
	});

	it("returns 403 for a user with only VIEW permission", async () => {
		const owner = await createTestUser();
		const viewer = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");
		await mockAuth(viewer.id, viewer.username, viewer.email);

		const { PUT } = await import("@/app/api/cases/[id]/information/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/information`,
			{ method: "PUT", body: JSON.stringify({ description: "x" }) }
		);
		const response = await PUT(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(403);
	});

	it("returns 200 for a user with EDIT permission", async () => {
		const owner = await createTestUser();
		const editor = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await createTestPermission(testCase.id, editor.id, owner.id, "EDIT");
		await mockAuth(editor.id, editor.username, editor.email);

		const { PUT } = await import("@/app/api/cases/[id]/information/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/information`,
			{ method: "PUT", body: JSON.stringify({ description: "x" }) }
		);
		const response = await PUT(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(200);
	});
});
