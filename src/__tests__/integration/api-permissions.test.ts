import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	addTeamMember,
	createTestCase,
	createTestPermission,
	createTestTeam,
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
// GET /api/cases/[id]/permissions
// ============================================

describe("GET /api/cases/[id]/permissions", () => {
	it("returns 200 with a permissions list for the case owner", async () => {
		const owner = await createTestUser();
		const viewer = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");
		await mockAuth(owner.id, owner.username, owner.email);

		const { GET } = await import(
			"@/app/api/cases/[id]/permissions/route"
		);
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/permissions`
		);
		const response = await GET(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.is_owner).toBe(true);
		expect(body.owner.id).toBe(owner.id);
		expect(body.user_permissions).toHaveLength(1);
		expect(body.user_permissions[0].user.id).toBe(viewer.id);
		expect(body.user_permissions[0].permission).toBe("VIEW");
	});

	it("returns 403 when the requester has only EDIT permission (ADMIN required)", async () => {
		const owner = await createTestUser();
		const editor = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await createTestPermission(testCase.id, editor.id, owner.id, "EDIT");
		await mockAuth(editor.id, editor.username, editor.email);

		const { GET } = await import(
			"@/app/api/cases/[id]/permissions/route"
		);
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/permissions`
		);
		const response = await GET(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(403);
	});

	it("returns 403 when the requester has no permission on the case", async () => {
		const owner = await createTestUser();
		const stranger = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await mockAuth(stranger.id, stranger.username, stranger.email);

		const { GET } = await import(
			"@/app/api/cases/[id]/permissions/route"
		);
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/permissions`
		);
		const response = await GET(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(403);
	});

	it("returns 401 when the request is not authenticated", async () => {
		const { GET } = await import(
			"@/app/api/cases/[id]/permissions/route"
		);
		const req = new NextRequest(
			"http://localhost:3000/api/cases/00000000-0000-0000-0000-000000000000/permissions"
		);
		const response = await GET(req, {
			params: Promise.resolve({
				id: "00000000-0000-0000-0000-000000000000",
			}),
		});

		expect(response.status).toBe(401);
	});

	it("includes team permissions in the response when a team has been shared", async () => {
		const owner = await createTestUser();
		const teamOwner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const team = await createTestTeam(teamOwner.id);

		// Owner shares case with team — requires owner to be a team member too
		// so we use createTestTeamPermission via prisma-factories
		const { createTestTeamPermission } = await import(
			"../utils/prisma-factories"
		);
		await createTestTeamPermission(testCase.id, team.id, owner.id, "VIEW");
		await mockAuth(owner.id, owner.username, owner.email);

		const { GET } = await import(
			"@/app/api/cases/[id]/permissions/route"
		);
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/permissions`
		);
		const response = await GET(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.team_permissions).toHaveLength(1);
		expect(body.team_permissions[0].team.id).toBe(team.id);
	});
});

// ============================================
// POST /api/cases/[id]/permissions — share by email
// ============================================

describe("POST /api/cases/[id]/permissions — share by email", () => {
	it("returns 201 and creates a permission when sharing with a registered user by email", async () => {
		const owner = await createTestUser();
		const target = await createTestUser({
			email: "share-target@example.com",
		});
		const testCase = await createTestCase(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { POST } = await import(
			"@/app/api/cases/[id]/permissions/route"
		);
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/permissions`,
			{
				method: "POST",
				body: JSON.stringify({
					email: "share-target@example.com",
					permission: "VIEW",
				}),
				headers: { "Content-Type": "application/json" },
			}
		);
		const response = await POST(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(201);
		const body = await response.json();
		expect(body.user.id).toBe(target.id);
		expect(body.permission).toBe("VIEW");
	});

	it("returns 201 and creates an invite when the email is not registered", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { POST } = await import(
			"@/app/api/cases/[id]/permissions/route"
		);
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/permissions`,
			{
				method: "POST",
				body: JSON.stringify({
					email: "unregistered-invite@example.com",
					permission: "VIEW",
				}),
				headers: { "Content-Type": "application/json" },
			}
		);
		const response = await POST(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(201);
		const body = await response.json();
		expect(body.message).toBe("Invite created");
		expect(body.invite_url).toContain("/invites/");
	});

	it("returns 403 when the requester has only VIEW permission (ADMIN required)", async () => {
		const owner = await createTestUser();
		const viewer = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");
		await mockAuth(viewer.id, viewer.username, viewer.email);

		const { POST } = await import(
			"@/app/api/cases/[id]/permissions/route"
		);
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/permissions`,
			{
				method: "POST",
				body: JSON.stringify({
					email: "some@example.com",
					permission: "VIEW",
				}),
				headers: { "Content-Type": "application/json" },
			}
		);
		const response = await POST(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(403);
	});

	it("returns 400 when the email address is invalid", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { POST } = await import(
			"@/app/api/cases/[id]/permissions/route"
		);
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/permissions`,
			{
				method: "POST",
				body: JSON.stringify({
					email: "not-a-valid-email",
					permission: "VIEW",
				}),
				headers: { "Content-Type": "application/json" },
			}
		);
		const response = await POST(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(400);
	});

	it("returns 401 when the request is not authenticated", async () => {
		const { POST } = await import(
			"@/app/api/cases/[id]/permissions/route"
		);
		const req = new NextRequest(
			"http://localhost:3000/api/cases/00000000-0000-0000-0000-000000000000/permissions",
			{
				method: "POST",
				body: JSON.stringify({
					email: "anyone@example.com",
					permission: "VIEW",
				}),
				headers: { "Content-Type": "application/json" },
			}
		);
		const response = await POST(req, {
			params: Promise.resolve({
				id: "00000000-0000-0000-0000-000000000000",
			}),
		});

		expect(response.status).toBe(401);
	});
});

// ============================================
// POST /api/cases/[id]/permissions — share with team
// ============================================

describe("POST /api/cases/[id]/permissions — share with team", () => {
	it("returns 201 and creates a team permission when the owner shares with their own team", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const team = await createTestTeam(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { POST } = await import(
			"@/app/api/cases/[id]/permissions/route"
		);
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/permissions`,
			{
				method: "POST",
				body: JSON.stringify({
					type: "team",
					teamId: team.id,
					permission: "VIEW",
				}),
				headers: { "Content-Type": "application/json" },
			}
		);
		const response = await POST(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(201);
		const body = await response.json();
		expect(body.team.id).toBe(team.id);
		expect(body.permission).toBe("VIEW");
	});

	it("returns 400 when the team ID is not a valid UUID", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { POST } = await import(
			"@/app/api/cases/[id]/permissions/route"
		);
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/permissions`,
			{
				method: "POST",
				body: JSON.stringify({
					type: "team",
					teamId: "not-a-uuid",
					permission: "VIEW",
				}),
				headers: { "Content-Type": "application/json" },
			}
		);
		const response = await POST(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(400);
	});
});
