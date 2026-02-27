import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
	createTestCase,
	createTestElement,
	createTestPermission,
	createTestUser,
} from "../utils/prisma-factories";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

beforeEach(async () => {
	await mockNoAuth();
});

// ============================================
// GET /api/cases/[id]/publish
// ============================================

describe("GET /api/cases/[id]/publish", () => {
	it("returns 200 with publish status for the case owner", async () => {
		const user = await createTestUser();
		const testCase = await createTestCase(user.id, { name: "Status Case" });
		await mockAuth(user.id, user.username, user.email);

		const { GET } = await import("@/app/api/cases/[id]/publish/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/publish`
		);
		const response = await GET(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body).toHaveProperty("is_published");
		expect(body).toHaveProperty("published_id");
		expect(body).toHaveProperty("published_at");
		expect(body).toHaveProperty("linked_case_study_count");
		expect(body.is_published).toBe(false);
	});

	it("returns 200 with publish status for a user with VIEW permission", async () => {
		const owner = await createTestUser();
		const viewer = await createTestUser();
		const testCase = await createTestCase(owner.id, { name: "Shared Status" });
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");
		await mockAuth(viewer.id, viewer.username, viewer.email);

		const { GET } = await import("@/app/api/cases/[id]/publish/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/publish`
		);
		const response = await GET(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(200);
	});

	it("returns 401 when the request is not authenticated", async () => {
		const { GET } = await import("@/app/api/cases/[id]/publish/route");
		const req = new NextRequest(
			"http://localhost:3000/api/cases/00000000-0000-0000-0000-000000000000/publish"
		);
		const response = await GET(req, {
			params: Promise.resolve({
				id: "00000000-0000-0000-0000-000000000000",
			}),
		});

		expect(response.status).toBe(401);
	});

	it("returns 404 when the case does not exist or the user has no access", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);

		const { GET } = await import("@/app/api/cases/[id]/publish/route");
		const req = new NextRequest(
			"http://localhost:3000/api/cases/00000000-0000-0000-0000-000000000000/publish"
		);
		const response = await GET(req, {
			params: Promise.resolve({
				id: "00000000-0000-0000-0000-000000000000",
			}),
		});

		expect(response.status).toBe(404);
	});
});

// ============================================
// POST /api/cases/[id]/publish
// ============================================

describe("POST /api/cases/[id]/publish", () => {
	it("returns 200 and publishes a case with elements, returning a published ID", async () => {
		const user = await createTestUser();
		const testCase = await createTestCase(user.id, {
			name: "Publishable Case",
		});
		// Add an element so the export has content
		await createTestElement(testCase.id, user.id, {
			elementType: "GOAL",
			name: "G1",
		});
		await mockAuth(user.id, user.username, user.email);

		const { POST } = await import("@/app/api/cases/[id]/publish/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/publish`,
			{
				method: "POST",
				body: JSON.stringify({ description: "First release" }),
				headers: { "Content-Type": "application/json" },
			}
		);
		const response = await POST(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.published_id).toBeDefined();
		expect(body.published_at).toBeDefined();

		// Verify DB state
		const updated = await prisma.assuranceCase.findUnique({
			where: { id: testCase.id },
		});
		expect(updated?.published).toBe(true);
		expect(updated?.publishStatus).toBe("PUBLISHED");
	});

	it("returns 403 when a user with only VIEW permission attempts to publish", async () => {
		const owner = await createTestUser();
		const viewer = await createTestUser();
		const testCase = await createTestCase(owner.id, {
			name: "View-Only Case",
		});
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");
		await mockAuth(viewer.id, viewer.username, viewer.email);

		const { POST } = await import("@/app/api/cases/[id]/publish/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/publish`,
			{ method: "POST" }
		);
		const response = await POST(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(403);
	});

	it("returns 401 when the request is not authenticated", async () => {
		const { POST } = await import("@/app/api/cases/[id]/publish/route");
		const req = new NextRequest(
			"http://localhost:3000/api/cases/00000000-0000-0000-0000-000000000000/publish",
			{ method: "POST" }
		);
		const response = await POST(req, {
			params: Promise.resolve({
				id: "00000000-0000-0000-0000-000000000000",
			}),
		});

		expect(response.status).toBe(401);
	});

	it("returns 200 and publishes a case with no optional body", async () => {
		const user = await createTestUser();
		const testCase = await createTestCase(user.id, {
			name: "No Description Case",
		});
		await createTestElement(testCase.id, user.id, {
			elementType: "GOAL",
			name: "G1",
		});
		await mockAuth(user.id, user.username, user.email);

		const { POST } = await import("@/app/api/cases/[id]/publish/route");
		// No body at all — description is optional
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/publish`,
			{ method: "POST" }
		);
		const response = await POST(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.published_id).toBeDefined();
	});
});

// ============================================
// DELETE /api/cases/[id]/publish
// ============================================

describe("DELETE /api/cases/[id]/publish", () => {
	it("returns 200 and unpublishes a published case, resetting status to DRAFT", async () => {
		const user = await createTestUser();
		const testCase = await createTestCase(user.id, {
			name: "Published To Unpublish",
		});
		await createTestElement(testCase.id, user.id, {
			elementType: "GOAL",
			name: "G1",
		});
		await mockAuth(user.id, user.username, user.email);

		// First publish the case
		const { POST } = await import("@/app/api/cases/[id]/publish/route");
		const publishReq = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/publish`,
			{ method: "POST" }
		);
		const publishResponse = await POST(publishReq, {
			params: Promise.resolve({ id: testCase.id }),
		});
		expect(publishResponse.status).toBe(200);

		// Now unpublish it
		const { DELETE } = await import(
			"@/app/api/cases/[id]/publish/route"
		);
		const deleteReq = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/publish`,
			{ method: "DELETE" }
		);
		const response = await DELETE(deleteReq, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.success).toBe(true);

		// Verify DB state has been reset to DRAFT
		const updated = await prisma.assuranceCase.findUnique({
			where: { id: testCase.id },
		});
		expect(updated?.published).toBe(false);
		expect(updated?.publishStatus).toBe("DRAFT");
		expect(updated?.publishedAt).toBeNull();
	});

	it("returns 403 when a user with only VIEW permission attempts to unpublish", async () => {
		const owner = await createTestUser();
		const viewer = await createTestUser();
		const testCase = await createTestCase(owner.id, {
			name: "Protected Published Case",
			publishStatus: "PUBLISHED",
			published: true,
		});
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");
		await mockAuth(viewer.id, viewer.username, viewer.email);

		const { DELETE } = await import(
			"@/app/api/cases/[id]/publish/route"
		);
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/publish`,
			{ method: "DELETE" }
		);
		const response = await DELETE(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(403);
	});

	it("returns 401 when the request is not authenticated", async () => {
		const { DELETE } = await import(
			"@/app/api/cases/[id]/publish/route"
		);
		const req = new NextRequest(
			"http://localhost:3000/api/cases/00000000-0000-0000-0000-000000000000/publish",
			{ method: "DELETE" }
		);
		const response = await DELETE(req, {
			params: Promise.resolve({
				id: "00000000-0000-0000-0000-000000000000",
			}),
		});

		expect(response.status).toBe(401);
	});
});
