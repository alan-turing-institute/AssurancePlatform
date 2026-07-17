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
