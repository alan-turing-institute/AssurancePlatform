import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	createTestCase,
	createTestPermission,
	createTestUser,
} from "../utils/prisma-factories";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

// next/cache is not available in a Node test environment
vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

beforeEach(async () => {
	await mockNoAuth();
});

// ============================================
// GET /api/cases/[id]
// ============================================

describe("GET /api/cases/[id]", () => {
	it("returns 200 with case data for the owner", async () => {
		const user = await createTestUser();
		const testCase = await createTestCase(user.id, { name: "Owner's Case" });
		await mockAuth(user.id, user.username, user.email);

		const { GET } = await import("@/app/api/cases/[id]/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}`
		);
		const response = await GET(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.id).toBe(testCase.id);
		expect(body.name).toBe("Owner's Case");
		expect(body.permissions).toBe("manage");
	});

	it("returns 401 when the request is not authenticated", async () => {
		const { GET } = await import("@/app/api/cases/[id]/route");
		const req = new NextRequest(
			"http://localhost:3000/api/cases/00000000-0000-0000-0000-000000000000"
		);
		const response = await GET(req, {
			params: Promise.resolve({
				id: "00000000-0000-0000-0000-000000000000",
			}),
		});

		expect(response.status).toBe(401);
	});

	it("returns 404 for a non-existent case ID (anti-enumeration)", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);

		const { GET } = await import("@/app/api/cases/[id]/route");
		const req = new NextRequest(
			"http://localhost:3000/api/cases/00000000-0000-0000-0000-000000000000"
		);
		const response = await GET(req, {
			params: Promise.resolve({
				id: "00000000-0000-0000-0000-000000000000",
			}),
		});

		expect(response.status).toBe(404);
	});

	it("returns 404 for a case the user has no permission on (anti-enumeration)", async () => {
		const owner = await createTestUser();
		const stranger = await createTestUser();
		const testCase = await createTestCase(owner.id, { name: "Private Case" });
		await mockAuth(stranger.id, stranger.username, stranger.email);

		const { GET } = await import("@/app/api/cases/[id]/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}`
		);
		const response = await GET(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(404);
	});

	it("returns 200 for a user with VIEW permission", async () => {
		const owner = await createTestUser();
		const viewer = await createTestUser();
		const testCase = await createTestCase(owner.id, { name: "Shared Case" });
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");
		await mockAuth(viewer.id, viewer.username, viewer.email);

		const { GET } = await import("@/app/api/cases/[id]/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}`
		);
		const response = await GET(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.permissions).toBe("view");
	});

	it("returns 200 for a user with EDIT permission", async () => {
		const owner = await createTestUser();
		const editor = await createTestUser();
		const testCase = await createTestCase(owner.id, { name: "Edit Case" });
		await createTestPermission(testCase.id, editor.id, owner.id, "EDIT");
		await mockAuth(editor.id, editor.username, editor.email);

		const { GET } = await import("@/app/api/cases/[id]/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}`
		);
		const response = await GET(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.permissions).toBe("edit");
	});
});

// ============================================
// PUT /api/cases/[id]
// ============================================

describe("PUT /api/cases/[id]", () => {
	it("returns 200 with updated case data when the owner updates the name", async () => {
		const user = await createTestUser();
		const testCase = await createTestCase(user.id, { name: "Old Name" });
		await mockAuth(user.id, user.username, user.email);

		const { PUT } = await import("@/app/api/cases/[id]/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}`,
			{
				method: "PUT",
				body: JSON.stringify({ name: "New Name" }),
				headers: { "Content-Type": "application/json" },
			}
		);
		const response = await PUT(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.name).toBe("New Name");
	});

	it("returns 403 when a user with VIEW permission attempts to update", async () => {
		const owner = await createTestUser();
		const viewer = await createTestUser();
		const testCase = await createTestCase(owner.id, { name: "Protected" });
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");
		await mockAuth(viewer.id, viewer.username, viewer.email);

		const { PUT } = await import("@/app/api/cases/[id]/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}`,
			{
				method: "PUT",
				body: JSON.stringify({ name: "Forbidden Update" }),
				headers: { "Content-Type": "application/json" },
			}
		);
		const response = await PUT(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(403);
	});

	it("returns 400 when the request body fails schema validation", async () => {
		const user = await createTestUser();
		const testCase = await createTestCase(user.id, { name: "Case" });
		await mockAuth(user.id, user.username, user.email);

		const { PUT } = await import("@/app/api/cases/[id]/route");
		// layout_direction must be "TB" or "LR"
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}`,
			{
				method: "PUT",
				body: JSON.stringify({ layout_direction: "INVALID" }),
				headers: { "Content-Type": "application/json" },
			}
		);
		const response = await PUT(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(400);
	});

	it("returns 401 when the request is not authenticated", async () => {
		const { PUT } = await import("@/app/api/cases/[id]/route");
		const req = new NextRequest(
			"http://localhost:3000/api/cases/00000000-0000-0000-0000-000000000000",
			{
				method: "PUT",
				body: JSON.stringify({ name: "Update" }),
				headers: { "Content-Type": "application/json" },
			}
		);
		const response = await PUT(req, {
			params: Promise.resolve({
				id: "00000000-0000-0000-0000-000000000000",
			}),
		});

		expect(response.status).toBe(401);
	});

	it("returns 200 when a user with EDIT permission updates the description", async () => {
		const owner = await createTestUser();
		const editor = await createTestUser();
		const testCase = await createTestCase(owner.id, {
			name: "Collaborative Case",
		});
		await createTestPermission(testCase.id, editor.id, owner.id, "EDIT");
		await mockAuth(editor.id, editor.username, editor.email);

		const { PUT } = await import("@/app/api/cases/[id]/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}`,
			{
				method: "PUT",
				body: JSON.stringify({ description: "Collaboratively updated" }),
				headers: { "Content-Type": "application/json" },
			}
		);
		const response = await PUT(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.description).toBe("Collaboratively updated");
	});
});

// ============================================
// DELETE /api/cases/[id]
// ============================================

describe("DELETE /api/cases/[id]", () => {
	it("returns 200 and soft-deletes the case as the owner", async () => {
		const user = await createTestUser();
		const testCase = await createTestCase(user.id, { name: "To Delete" });
		await mockAuth(user.id, user.username, user.email);

		const { DELETE } = await import("@/app/api/cases/[id]/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}`,
			{ method: "DELETE" }
		);
		const response = await DELETE(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.success).toBe(true);
	});

	it("returns 403 when a user with only VIEW permission attempts to delete", async () => {
		const owner = await createTestUser();
		const viewer = await createTestUser();
		const testCase = await createTestCase(owner.id, {
			name: "Undeletable For Viewer",
		});
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");
		await mockAuth(viewer.id, viewer.username, viewer.email);

		const { DELETE } = await import("@/app/api/cases/[id]/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}`,
			{ method: "DELETE" }
		);
		const response = await DELETE(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(403);
	});

	it("returns 401 when the request is not authenticated", async () => {
		const { DELETE } = await import("@/app/api/cases/[id]/route");
		const req = new NextRequest(
			"http://localhost:3000/api/cases/00000000-0000-0000-0000-000000000000",
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
