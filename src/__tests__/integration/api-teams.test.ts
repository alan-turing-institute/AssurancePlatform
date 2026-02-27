import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import {
	addTeamMember,
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
// GET /api/teams
// ============================================

describe("GET /api/teams", () => {
	it("returns 200 with the list of teams the user belongs to", async () => {
		const user = await createTestUser();
		const otherUser = await createTestUser();
		await createTestTeam(user.id, { name: "My Team" });
		await createTestTeam(otherUser.id, { name: "Their Team" });
		await mockAuth(user.id, user.username, user.email);

		const { GET } = await import("@/app/api/teams/route");
		const response = await GET();

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(Array.isArray(body)).toBe(true);
		expect(body).toHaveLength(1);
		expect(body[0].name).toBe("My Team");
	});

	it("returns 200 with an empty array when the user has no teams", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);

		const { GET } = await import("@/app/api/teams/route");
		const response = await GET();

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body).toEqual([]);
	});

	it("returns 401 when the request is not authenticated", async () => {
		const { GET } = await import("@/app/api/teams/route");
		const response = await GET();

		expect(response.status).toBe(401);
	});
});

// ============================================
// POST /api/teams
// ============================================

describe("POST /api/teams", () => {
	it("returns 201 with the new team when a valid name is provided", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);

		const { POST } = await import("@/app/api/teams/route");
		const req = new NextRequest("http://localhost:3000/api/teams", {
			method: "POST",
			body: JSON.stringify({ name: "Brand New Team" }),
			headers: { "Content-Type": "application/json" },
		});
		const response = await POST(req);

		expect(response.status).toBe(201);
		const body = await response.json();
		expect(body.name).toBe("Brand New Team");
		expect(body.my_role).toBe("ADMIN");
	});

	it("returns 400 when the team name is missing", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);

		const { POST } = await import("@/app/api/teams/route");
		const req = new NextRequest("http://localhost:3000/api/teams", {
			method: "POST",
			body: JSON.stringify({}),
			headers: { "Content-Type": "application/json" },
		});
		const response = await POST(req);

		expect(response.status).toBe(400);
	});

	it("returns 400 when the request body is not valid JSON", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);

		const { POST } = await import("@/app/api/teams/route");
		const req = new NextRequest("http://localhost:3000/api/teams", {
			method: "POST",
			body: "not-json",
			headers: { "Content-Type": "application/json" },
		});
		const response = await POST(req);

		expect(response.status).toBe(400);
	});

	it("returns 401 when the request is not authenticated", async () => {
		const { POST } = await import("@/app/api/teams/route");
		const req = new NextRequest("http://localhost:3000/api/teams", {
			method: "POST",
			body: JSON.stringify({ name: "Unauthenticated Team" }),
			headers: { "Content-Type": "application/json" },
		});
		const response = await POST(req);

		expect(response.status).toBe(401);
	});
});

// ============================================
// GET /api/teams/[id]
// ============================================

describe("GET /api/teams/[id]", () => {
	it("returns 200 with team details for a member", async () => {
		const user = await createTestUser();
		const team = await createTestTeam(user.id, { name: "Visible Team" });
		await mockAuth(user.id, user.username, user.email);

		const { GET } = await import("@/app/api/teams/[id]/route");
		const req = new NextRequest(
			`http://localhost:3000/api/teams/${team.id}`
		);
		const response = await GET(req, {
			params: Promise.resolve({ id: team.id }),
		});

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.name).toBe("Visible Team");
		// The createTestTeam factory assigns the founding user the OWNER role
		expect(body.my_role).toBe("OWNER");
	});

	it("returns 404 for a team the user is not a member of", async () => {
		const owner = await createTestUser();
		const outsider = await createTestUser();
		const team = await createTestTeam(owner.id, { name: "Private Team" });
		await mockAuth(outsider.id, outsider.username, outsider.email);

		const { GET } = await import("@/app/api/teams/[id]/route");
		const req = new NextRequest(
			`http://localhost:3000/api/teams/${team.id}`
		);
		const response = await GET(req, {
			params: Promise.resolve({ id: team.id }),
		});

		expect(response.status).toBe(404);
	});

	it("returns 404 for a non-existent team ID", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);

		const { GET } = await import("@/app/api/teams/[id]/route");
		const req = new NextRequest(
			"http://localhost:3000/api/teams/00000000-0000-0000-0000-000000000000"
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
// PATCH /api/teams/[id]
// ============================================

describe("PATCH /api/teams/[id]", () => {
	it("returns 200 with updated team data when the ADMIN updates the name", async () => {
		const user = await createTestUser();
		const team = await createTestTeam(user.id, { name: "Original Name" });
		await mockAuth(user.id, user.username, user.email);

		const { PATCH } = await import("@/app/api/teams/[id]/route");
		const req = new NextRequest(
			`http://localhost:3000/api/teams/${team.id}`,
			{
				method: "PATCH",
				body: JSON.stringify({ name: "Renamed Team" }),
				headers: { "Content-Type": "application/json" },
			}
		);
		const response = await PATCH(req, {
			params: Promise.resolve({ id: team.id }),
		});

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.name).toBe("Renamed Team");

		// Verify DB state
		const inDb = await prisma.team.findUnique({ where: { id: team.id } });
		expect(inDb?.name).toBe("Renamed Team");
	});

	it("returns 403 when a non-admin member attempts to update", async () => {
		const admin = await createTestUser();
		const member = await createTestUser();
		const team = await createTestTeam(admin.id, { name: "Locked Team" });
		await addTeamMember(team.id, member.id, "MEMBER");
		await mockAuth(member.id, member.username, member.email);

		const { PATCH } = await import("@/app/api/teams/[id]/route");
		const req = new NextRequest(
			`http://localhost:3000/api/teams/${team.id}`,
			{
				method: "PATCH",
				body: JSON.stringify({ name: "Sneaky Rename" }),
				headers: { "Content-Type": "application/json" },
			}
		);
		const response = await PATCH(req, {
			params: Promise.resolve({ id: team.id }),
		});

		expect(response.status).toBe(403);
	});
});

// ============================================
// DELETE /api/teams/[id]
// ============================================

describe("DELETE /api/teams/[id]", () => {
	it("returns 200 and deletes the team when the ADMIN requests deletion", async () => {
		const user = await createTestUser();
		const team = await createTestTeam(user.id, { name: "Doomed Team" });
		await mockAuth(user.id, user.username, user.email);

		const { DELETE } = await import("@/app/api/teams/[id]/route");
		const req = new NextRequest(
			`http://localhost:3000/api/teams/${team.id}`,
			{ method: "DELETE" }
		);
		const response = await DELETE(req, {
			params: Promise.resolve({ id: team.id }),
		});

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.success).toBe(true);

		// Verify DB state
		const inDb = await prisma.team.findUnique({ where: { id: team.id } });
		expect(inDb).toBeNull();
	});

	it("returns 403 when a MEMBER attempts to delete the team", async () => {
		const admin = await createTestUser();
		const member = await createTestUser();
		const team = await createTestTeam(admin.id, { name: "Protected Team" });
		await addTeamMember(team.id, member.id, "MEMBER");
		await mockAuth(member.id, member.username, member.email);

		const { DELETE } = await import("@/app/api/teams/[id]/route");
		const req = new NextRequest(
			`http://localhost:3000/api/teams/${team.id}`,
			{ method: "DELETE" }
		);
		const response = await DELETE(req, {
			params: Promise.resolve({ id: team.id }),
		});

		expect(response.status).toBe(403);
	});
});

// ============================================
// GET /api/teams/[id]/members
// ============================================

describe("GET /api/teams/[id]/members", () => {
	it("returns 200 with the member list for a team member", async () => {
		const admin = await createTestUser();
		const member = await createTestUser();
		const team = await createTestTeam(admin.id, {
			name: "Team With Members",
		});
		await addTeamMember(team.id, member.id, "MEMBER");
		await mockAuth(admin.id, admin.username, admin.email);

		const { GET } = await import(
			"@/app/api/teams/[id]/members/route"
		);
		const req = new NextRequest(
			`http://localhost:3000/api/teams/${team.id}/members`
		);
		const response = await GET(req, {
			params: Promise.resolve({ id: team.id }),
		});

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(Array.isArray(body)).toBe(true);
		// Should have at least the admin (OWNER) and the added member
		expect(body.length).toBeGreaterThanOrEqual(2);
	});

	it("returns 404 when the requester is not a team member", async () => {
		const owner = await createTestUser();
		const outsider = await createTestUser();
		const team = await createTestTeam(owner.id, { name: "Exclusive Team" });
		await mockAuth(outsider.id, outsider.username, outsider.email);

		const { GET } = await import(
			"@/app/api/teams/[id]/members/route"
		);
		const req = new NextRequest(
			`http://localhost:3000/api/teams/${team.id}/members`
		);
		const response = await GET(req, {
			params: Promise.resolve({ id: team.id }),
		});

		expect(response.status).toBe(404);
	});
});

// ============================================
// POST /api/teams/[id]/members
// ============================================

describe("POST /api/teams/[id]/members", () => {
	it("returns 201 and adds an existing user as a member by email", async () => {
		const admin = await createTestUser();
		const newMember = await createTestUser({
			email: "new-member@example.com",
		});
		const team = await createTestTeam(admin.id, { name: "Growing Team" });
		await mockAuth(admin.id, admin.username, admin.email);

		const { POST } = await import(
			"@/app/api/teams/[id]/members/route"
		);
		const req = new NextRequest(
			`http://localhost:3000/api/teams/${team.id}/members`,
			{
				method: "POST",
				body: JSON.stringify({ email: "new-member@example.com" }),
				headers: { "Content-Type": "application/json" },
			}
		);
		const response = await POST(req, {
			params: Promise.resolve({ id: team.id }),
		});

		expect(response.status).toBe(201);
		const body = await response.json();
		expect(body.user.id).toBe(newMember.id);
		expect(body.role).toBe("MEMBER");
	});

	it("returns 200 with a user-not-found message when the email is not registered", async () => {
		const admin = await createTestUser();
		const team = await createTestTeam(admin.id, { name: "Invite Team" });
		await mockAuth(admin.id, admin.username, admin.email);

		const { POST } = await import(
			"@/app/api/teams/[id]/members/route"
		);
		const req = new NextRequest(
			`http://localhost:3000/api/teams/${team.id}/members`,
			{
				method: "POST",
				body: JSON.stringify({
					email: "notregistered-member@example.com",
				}),
				headers: { "Content-Type": "application/json" },
			}
		);
		const response = await POST(req, {
			params: Promise.resolve({ id: team.id }),
		});

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.message).toContain("not found");
	});

	it("returns 400 when the email address is invalid", async () => {
		const admin = await createTestUser();
		const team = await createTestTeam(admin.id, { name: "Strict Team" });
		await mockAuth(admin.id, admin.username, admin.email);

		const { POST } = await import(
			"@/app/api/teams/[id]/members/route"
		);
		const req = new NextRequest(
			`http://localhost:3000/api/teams/${team.id}/members`,
			{
				method: "POST",
				body: JSON.stringify({ email: "invalid-email" }),
				headers: { "Content-Type": "application/json" },
			}
		);
		const response = await POST(req, {
			params: Promise.resolve({ id: team.id }),
		});

		expect(response.status).toBe(400);
	});

	it("returns 403 when a non-admin member attempts to add a member", async () => {
		const admin = await createTestUser();
		const member = await createTestUser();
		const target = await createTestUser({
			email: "target-member@example.com",
		});
		const team = await createTestTeam(admin.id, { name: "Restricted Team" });
		await addTeamMember(team.id, member.id, "MEMBER");
		await mockAuth(member.id, member.username, member.email);

		const { POST } = await import(
			"@/app/api/teams/[id]/members/route"
		);
		const req = new NextRequest(
			`http://localhost:3000/api/teams/${team.id}/members`,
			{
				method: "POST",
				body: JSON.stringify({ email: "target-member@example.com" }),
				headers: { "Content-Type": "application/json" },
			}
		);
		const response = await POST(req, {
			params: Promise.resolve({ id: team.id }),
		});

		expect(response.status).toBe(403);
	});
});
