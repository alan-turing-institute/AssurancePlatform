import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	addTeamMember,
	createTestIntegrationWithSystemUser,
	createTestTeam,
	createTestUser,
} from "../utils/prisma-factories";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

beforeEach(async () => {
	await mockNoAuth();
});

const NOTHING_TO_UPDATE = "At least one field to update must be provided";

const BLANKS: [string, unknown][] = [
	["null", null],
	["an empty string", ""],
	["spaces", "   "],
];

function patch(url: string, body: unknown): NextRequest {
	return new NextRequest(`http://localhost:3000${url}`, {
		method: "PATCH",
		body: JSON.stringify(body),
		headers: { "Content-Type": "application/json" },
	});
}

function idParams(id: string) {
	return { params: Promise.resolve({ id }) };
}

async function patchProfile(body: unknown) {
	const { PATCH } = await import("@/app/api/users/me/route");
	return PATCH(patch("/api/users/me", body));
}

async function patchTeam(id: string, body: unknown) {
	const { PATCH } = await import("@/app/api/teams/[id]/route");
	return PATCH(patch(`/api/teams/${id}`, body), idParams(id));
}

async function patchIntegration(id: string, body: unknown) {
	const { PATCH } = await import("@/app/api/integrations/[id]/route");
	return PATCH(patch(`/api/integrations/${id}`, body), idParams(id));
}

async function refusalOf(response: Response) {
	return {
		status: response.status,
		text: JSON.stringify(await response.json()),
	};
}

function userRow(id: string) {
	return prisma.user.findUniqueOrThrow({ where: { id } });
}

function teamRow(id: string) {
	return prisma.team.findUniqueOrThrow({ where: { id } });
}

function integrationRow(id: string) {
	return prisma.integration.findUniqueOrThrow({ where: { id } });
}

async function signedInUser(overrides = {}) {
	const user = await createTestUser({
		firstName: "Ada",
		lastName: "Lovelace",
		...overrides,
	});
	await mockAuth(user.id, user.username, user.email);
	return user;
}

async function teamWithAdmin(description = "About the team") {
	const admin = await createTestUser();
	const team = await createTestTeam(admin.id, {
		name: "Original name",
		description,
	});
	await mockAuth(admin.id, admin.username, admin.email);
	return { admin, team };
}

async function ownedIntegration(description = "About it") {
	const owner = await createTestUser();
	const { integration } = await createTestIntegrationWithSystemUser(owner.id, {
		description,
		scopes: ["case:read"],
	});
	await mockAuth(owner.id, owner.username, owner.email);
	return { owner, integration };
}

// ============================================
// PATCH /api/users/me
// ============================================

describe("PATCH /api/users/me: clearing names", () => {
	describe.each(["firstName", "lastName"] as const)("%s", (field) => {
		it.each(BLANKS)("stores NULL when sent %s", async (_n, value) => {
			const user = await signedInUser();

			const response = await patchProfile({ [field]: value });

			expect(response.status).toBe(200);
			const row = await userRow(user.id);
			expect(row[field]).toBeNull();
		});

		it("leaves the stored value when the field is left out", async () => {
			const user = await signedInUser();

			const response = await patchProfile({ username: "renamed-user" });

			expect(response.status).toBe(200);
			const row = await userRow(user.id);
			expect(row.firstName).toBe("Ada");
			expect(row.lastName).toBe("Lovelace");
		});

		it("stores trimmed text", async () => {
			const user = await signedInUser();

			const response = await patchProfile({ [field]: "  Grace  " });

			expect(response.status).toBe(200);
			expect((await userRow(user.id))[field]).toBe("Grace");
		});

		it("accepts the limit and refuses one over, leaving the value", async () => {
			const user = await signedInUser();
			const original = user[field];

			const over = await patchProfile({ [field]: "a".repeat(151) });
			expect(over.status).toBe(400);
			expect((await userRow(user.id))[field]).toBe(original);

			const atLimit = await patchProfile({ [field]: "a".repeat(150) });
			expect(atLimit.status).toBe(200);
			expect((await userRow(user.id))[field]).toBe("a".repeat(150));
		});
	});

	it("clearing the first name leaves last name, username and email", async () => {
		const user = await signedInUser();

		const response = await patchProfile({ firstName: null });

		expect(response.status).toBe(200);
		const row = await userRow(user.id);
		expect(row.firstName).toBeNull();
		expect(row.lastName).toBe("Lovelace");
		expect(row.username).toBe(user.username);
		expect(row.email).toBe(user.email);
	});

	it("clearing the last name leaves the first name", async () => {
		const user = await signedInUser();

		await patchProfile({ lastName: "" });

		const row = await userRow(user.id);
		expect(row.lastName).toBeNull();
		expect(row.firstName).toBe("Ada");
	});

	it("clears a name beside another changed field", async () => {
		const user = await signedInUser();

		const response = await patchProfile({
			firstName: "   ",
			lastName: "Byron",
		});

		expect(response.status).toBe(200);
		const row = await userRow(user.id);
		expect(row.firstName).toBeNull();
		expect(row.lastName).toBe("Byron");
	});

	it("still refuses a request with no field", async () => {
		const user = await signedInUser();

		const response = await patchProfile({});

		expect(response.status).toBe(400);
		expect(JSON.stringify(await response.json())).toContain(NOTHING_TO_UPDATE);
		expect((await userRow(user.id)).firstName).toBe("Ada");
	});

	it.each([
		["a blank username", { username: "   " }],
		["a null username", { username: null }],
		["an empty email", { email: "" }],
		["a null email", { email: null }],
	])("still refuses %s and keeps the names", async (_n, body) => {
		const user = await signedInUser();

		const response = await patchProfile({ ...body, firstName: null });

		expect(response.status).toBe(400);
		const row = await userRow(user.id);
		expect(row.firstName).toBe("Ada");
		expect(row.username).toBe(user.username);
		expect(row.email).toBe(user.email);
	});

	it("refuses an unauthenticated caller", async () => {
		const user = await createTestUser({ firstName: "Ada" });

		const response = await patchProfile({ firstName: null });

		expect(response.status).toBe(401);
		expect((await userRow(user.id)).firstName).toBe("Ada");
	});
});

// ============================================
// PATCH /api/teams/[id]
// ============================================

describe("PATCH /api/teams/[id]: clearing the description", () => {
	it.each(BLANKS)("stores NULL when sent %s", async (_n, value) => {
		const { team } = await teamWithAdmin();

		const response = await patchTeam(team.id, { description: value });

		expect(response.status).toBe(200);
		expect((await teamRow(team.id)).description).toBeNull();
	});

	it("leaves the description when it is left out", async () => {
		const { team } = await teamWithAdmin();

		const response = await patchTeam(team.id, { name: "Renamed" });

		expect(response.status).toBe(200);
		const row = await teamRow(team.id);
		expect(row.description).toBe("About the team");
		expect(row.name).toBe("Renamed");
	});

	it("clearing the description leaves the name", async () => {
		const { team } = await teamWithAdmin();

		const response = await patchTeam(team.id, { description: null });

		expect(response.status).toBe(200);
		const row = await teamRow(team.id);
		expect(row.description).toBeNull();
		expect(row.name).toBe("Original name");
	});

	it("clears the description beside a new name", async () => {
		const { team } = await teamWithAdmin();

		const response = await patchTeam(team.id, {
			name: "Renamed",
			description: "  ",
		});

		expect(response.status).toBe(200);
		const row = await teamRow(team.id);
		expect(row.description).toBeNull();
		expect(row.name).toBe("Renamed");
	});

	it("stores a trimmed description", async () => {
		const { team } = await teamWithAdmin();

		await patchTeam(team.id, { description: "  New text  " });

		expect((await teamRow(team.id)).description).toBe("New text");
	});

	it("accepts 500 characters and refuses 501, leaving the value", async () => {
		const { team } = await teamWithAdmin();

		const over = await patchTeam(team.id, { description: "a".repeat(501) });
		expect(over.status).toBe(400);
		expect((await teamRow(team.id)).description).toBe("About the team");

		const atLimit = await patchTeam(team.id, { description: "a".repeat(500) });
		expect(atLimit.status).toBe(200);
	});

	it("still refuses a request with no field", async () => {
		const { team } = await teamWithAdmin();

		const response = await patchTeam(team.id, {});

		expect(response.status).toBe(400);
		expect(JSON.stringify(await response.json())).toContain(NOTHING_TO_UPDATE);
	});

	it.each([
		["a blank name", { name: "   " }],
		["an empty name", { name: "" }],
		["a null name", { name: null }],
	])("still refuses %s and keeps the description", async (_n, body) => {
		const { team } = await teamWithAdmin();

		const response = await patchTeam(team.id, { ...body, description: null });

		expect(response.status).toBe(400);
		const row = await teamRow(team.id);
		expect(row.name).toBe("Original name");
		expect(row.description).toBe("About the team");
	});

	it("lets an admin who is not the owner clear it", async () => {
		const { team } = await teamWithAdmin();
		const admin = await createTestUser();
		await addTeamMember(team.id, admin.id, "ADMIN");
		await mockAuth(admin.id, admin.username, admin.email);

		const response = await patchTeam(team.id, { description: null });

		expect(response.status).toBe(200);
		expect((await teamRow(team.id)).description).toBeNull();
	});

	it("refuses a member who is not an admin", async () => {
		const { team } = await teamWithAdmin();
		const member = await createTestUser();
		await addTeamMember(team.id, member.id, "MEMBER");
		await mockAuth(member.id, member.username, member.email);

		const refusal = await refusalOf(
			await patchTeam(team.id, { description: null })
		);

		expect(refusal.status).toBe(403);
		expect(refusal.text).toContain("Permission denied");
		expect((await teamRow(team.id)).description).toBe("About the team");
	});

	it("refuses a user who is not in the team", async () => {
		const { team } = await teamWithAdmin();
		await signedInUser();

		const refusal = await refusalOf(
			await patchTeam(team.id, { description: "" })
		);

		expect(refusal.status).toBe(403);
		expect(refusal.text).toContain("Permission denied");
		expect((await teamRow(team.id)).description).toBe("About the team");
	});

	it("answers a team that does not exist the same way as one the user may not change", async () => {
		await signedInUser();

		const refusal = await refusalOf(
			await patchTeam(crypto.randomUUID(), { description: "" })
		);

		expect(refusal.status).toBe(403);
		expect(refusal.text).toContain("Permission denied");
	});

	it("refuses an unauthenticated caller", async () => {
		const { team } = await teamWithAdmin();
		await mockNoAuth();

		const response = await patchTeam(team.id, { description: null });

		expect(response.status).toBe(401);
		expect((await teamRow(team.id)).description).toBe("About the team");
	});
});

describe("POST /api/teams: a blank description means none given", () => {
	it.each(BLANKS)("creates the team when sent %s", async (_n, value) => {
		const user = await signedInUser();
		const { POST } = await import("@/app/api/teams/route");

		const response = await POST(
			new NextRequest("http://localhost:3000/api/teams", {
				method: "POST",
				body: JSON.stringify({ name: "Fresh team", description: value }),
				headers: { "Content-Type": "application/json" },
			})
		);

		expect(response.status).toBe(201);
		const row = await prisma.team.findFirstOrThrow({
			where: { createdById: user.id },
		});
		expect(row.description).toBeNull();
	});
});

// ============================================
// PATCH /api/integrations/[id]
// ============================================

describe("PATCH /api/integrations/[id]: clearing the description", () => {
	it.each(BLANKS)("stores NULL when sent %s", async (_n, value) => {
		const { integration } = await ownedIntegration();

		const response = await patchIntegration(integration.id, {
			description: value,
		});

		expect(response.status).toBe(200);
		expect((await integrationRow(integration.id)).description).toBeNull();
	});

	it("leaves the description when only scopes change", async () => {
		const { integration } = await ownedIntegration();

		const response = await patchIntegration(integration.id, {
			scopes: ["case:read", "health:criteria:read"],
		});

		expect(response.status).toBe(200);
		const row = await integrationRow(integration.id);
		expect(row.description).toBe("About it");
		expect(row.scopes).toEqual(["case:read", "health:criteria:read"]);
	});

	it("clearing the description leaves the scopes", async () => {
		const { integration } = await ownedIntegration();

		const response = await patchIntegration(integration.id, {
			description: null,
		});

		expect(response.status).toBe(200);
		const row = await integrationRow(integration.id);
		expect(row.description).toBeNull();
		expect(row.scopes).toEqual(["case:read"]);
	});

	it("clears the description beside new scopes", async () => {
		const { integration } = await ownedIntegration();

		const response = await patchIntegration(integration.id, {
			description: "  ",
			scopes: ["case:read", "health:criteria:read"],
		});

		expect(response.status).toBe(200);
		const row = await integrationRow(integration.id);
		expect(row.description).toBeNull();
		expect(row.scopes).toEqual(["case:read", "health:criteria:read"]);
	});

	it("stores a trimmed description", async () => {
		const { integration } = await ownedIntegration();

		await patchIntegration(integration.id, { description: "  Fresh  " });

		expect((await integrationRow(integration.id)).description).toBe("Fresh");
	});

	it("accepts 1000 characters and refuses 1001, leaving the value", async () => {
		const { integration } = await ownedIntegration();

		const over = await patchIntegration(integration.id, {
			description: "a".repeat(1001),
		});
		expect(over.status).toBe(400);
		expect((await integrationRow(integration.id)).description).toBe("About it");

		const atLimit = await patchIntegration(integration.id, {
			description: "a".repeat(1000),
		});
		expect(atLimit.status).toBe(200);
	});

	it("still refuses a request with no field", async () => {
		const { integration } = await ownedIntegration();

		const response = await patchIntegration(integration.id, {});

		expect(response.status).toBe(400);
		expect(JSON.stringify(await response.json())).toContain(NOTHING_TO_UPDATE);
	});

	it("refuses a user who does not own the integration", async () => {
		const { integration } = await ownedIntegration();
		await signedInUser();

		const response = await patchIntegration(integration.id, {
			description: null,
		});

		expect(response.status).toBe(404);
		expect((await integrationRow(integration.id)).description).toBe("About it");
	});

	it("refuses an unauthenticated caller", async () => {
		const { integration } = await ownedIntegration();
		await mockNoAuth();

		const response = await patchIntegration(integration.id, {
			description: null,
		});

		expect(response.status).toBe(401);
		expect((await integrationRow(integration.id)).description).toBe("About it");
	});
});

describe("POST /api/integrations: a blank description means none given", () => {
	it.each(
		BLANKS
	)("registers the integration when sent %s", async (_n, value) => {
		const owner = await signedInUser();
		const { POST } = await import("@/app/api/integrations/route");

		const response = await POST(
			new NextRequest("http://localhost:3000/api/integrations", {
				method: "POST",
				body: JSON.stringify({
					name: "fresh-integration",
					description: value,
					scopes: ["case:read"],
				}),
				headers: { "Content-Type": "application/json" },
			})
		);

		expect(response.status).toBe(201);
		const row = await prisma.integration.findFirstOrThrow({
			where: { ownerId: owner.id },
		});
		expect(row.description).toBeNull();
	});
});
