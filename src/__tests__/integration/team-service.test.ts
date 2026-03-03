import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import {
	createTeam,
	deleteTeam,
	getTeam,
	getTeamBySlug,
	listUserTeams,
	updateTeam,
} from "@/lib/services/team-service";
import { createTestUser } from "../utils/prisma-factories";

const TEAM_SLUG_PATTERN = /^my-new-team-/;

describe("team-service", () => {
	describe("createTeam", () => {
		it("returns a team with a slug and the creator as ADMIN", async () => {
			const user = await createTestUser();

			const result = await createTeam(user.id, { name: "My New Team" });

			expect("error" in result).toBe(false);
			if ("error" in result) {
				return;
			}
			expect(result.data.name).toBe("My New Team");
			expect(result.data.slug).toMatch(TEAM_SLUG_PATTERN);
			expect(result.data.my_role).toBe("ADMIN");
			expect(result.data.member_count).toBe(1);
		});

		it("returns an error when name is empty", async () => {
			const user = await createTestUser();

			const result = await createTeam(user.id, { name: "" });

			expect("error" in result).toBe(true);
			if (!("error" in result)) {
				return;
			}
			expect(result.error).toBe("Team name is required");
		});

		it("returns an error when name is whitespace only", async () => {
			const user = await createTestUser();

			const result = await createTeam(user.id, { name: "   " });

			expect("error" in result).toBe(true);
			if (!("error" in result)) {
				return;
			}
			expect(result.error).toBe("Team name is required");
		});

		it("returns an error when name exceeds 100 characters", async () => {
			const user = await createTestUser();
			const longName = "A".repeat(101);

			const result = await createTeam(user.id, { name: longName });

			expect("error" in result).toBe(true);
			if (!("error" in result)) {
				return;
			}
			expect(result.error).toBe("Team name must be less than 100 characters");
		});

		it("creates the team with an optional description", async () => {
			const user = await createTestUser();

			const result = await createTeam(user.id, {
				name: "Described Team",
				description: "A team with a description",
			});

			expect("error" in result).toBe(false);
			if ("error" in result) {
				return;
			}
			expect(result.data.description).toBe("A team with a description");
		});

		it("persists the new team in the database", async () => {
			const user = await createTestUser();

			const result = await createTeam(user.id, { name: "Persisted Team" });

			expect("error" in result).toBe(false);
			if ("error" in result) {
				throw new Error("createTeam failed unexpectedly");
			}
			expect(result.data.id).toBeDefined();
			const found = await prisma.team.findUnique({
				where: { id: result.data.id },
			});
			expect(found).not.toBeNull();
			expect(found?.name).toBe("Persisted Team");
		});
	});

	describe("getTeam", () => {
		it("returns a team when the user is a member", async () => {
			const user = await createTestUser();
			const created = await createTeam(user.id, { name: "Visible Team" });

			expect("error" in created).toBe(false);
			if ("error" in created) {
				throw new Error("createTeam failed unexpectedly");
			}

			const result = await getTeam(user.id, created.data.id);

			expect("error" in result).toBe(false);
			if ("error" in result) {
				return;
			}
			expect(result.data.name).toBe("Visible Team");
			expect(result.data.my_role).toBe("ADMIN");
		});

		it("returns 'Team not found' for a non-member", async () => {
			const owner = await createTestUser();
			const outsider = await createTestUser();
			const created = await createTeam(owner.id, { name: "Private Team" });

			expect("error" in created).toBe(false);
			if ("error" in created) {
				throw new Error("createTeam failed unexpectedly");
			}

			const result = await getTeam(outsider.id, created.data.id);

			expect("error" in result).toBe(true);
			if (!("error" in result)) {
				return;
			}
			expect(result.error).toBe("Team not found");
		});

		it("returns 'Team not found' for a non-existent team ID", async () => {
			const user = await createTestUser();

			const result = await getTeam(
				user.id,
				"00000000-0000-0000-0000-000000000000"
			);

			expect("error" in result).toBe(true);
			if (!("error" in result)) {
				return;
			}
			expect(result.error).toBe("Team not found");
		});

		it("includes member data in the response", async () => {
			const user = await createTestUser();
			const created = await createTeam(user.id, { name: "Team With Members" });

			expect("error" in created).toBe(false);
			if ("error" in created) {
				throw new Error("createTeam failed unexpectedly");
			}

			const result = await getTeam(user.id, created.data.id);

			expect("error" in result).toBe(false);
			if ("error" in result) {
				return;
			}
			expect(result.data.members).toHaveLength(1);
			expect(result.data.members?.[0].user.username).toBe(user.username);
		});
	});

	describe("getTeamBySlug", () => {
		it("returns a team when the user is a member and slug matches", async () => {
			const user = await createTestUser();
			const created = await createTeam(user.id, { name: "Slug Team" });

			expect("error" in created).toBe(false);
			if ("error" in created) {
				throw new Error("createTeam failed unexpectedly");
			}

			const result = await getTeamBySlug(user.id, created.data.slug);

			expect("error" in result).toBe(false);
			if ("error" in result) {
				return;
			}
			expect(result.data.name).toBe("Slug Team");
		});

		it("returns 'Team not found' for a non-member accessing by slug", async () => {
			const owner = await createTestUser();
			const outsider = await createTestUser();
			const created = await createTeam(owner.id, { name: "Slug Private" });

			expect("error" in created).toBe(false);
			if ("error" in created) {
				throw new Error("createTeam failed unexpectedly");
			}

			const result = await getTeamBySlug(outsider.id, created.data.slug);

			expect("error" in result).toBe(true);
			if (!("error" in result)) {
				return;
			}
			expect(result.error).toBe("Team not found");
		});

		it("returns 'Team not found' for a non-existent slug", async () => {
			const user = await createTestUser();

			const result = await getTeamBySlug(
				user.id,
				"this-slug-does-not-exist-xyz"
			);

			expect("error" in result).toBe(true);
			if (!("error" in result)) {
				return;
			}
			expect(result.error).toBe("Team not found");
		});
	});

	describe("listUserTeams", () => {
		it("returns only the teams the user belongs to", async () => {
			const userA = await createTestUser();
			const userB = await createTestUser();
			await createTeam(userA.id, { name: "Team Alpha" });
			await createTeam(userB.id, { name: "Team Beta" });

			const result = await listUserTeams(userA.id);

			expect("error" in result).toBe(false);
			if ("error" in result) {
				return;
			}
			expect(result.data).toHaveLength(1);
			expect(result.data[0].name).toBe("Team Alpha");
		});

		it("returns an empty array when the user has no teams", async () => {
			const user = await createTestUser();

			const result = await listUserTeams(user.id);

			expect("error" in result).toBe(false);
			if ("error" in result) {
				return;
			}
			expect(result.data).toEqual([]);
		});

		it("returns all teams the user is a member of", async () => {
			const admin = await createTestUser();
			const member = await createTestUser();
			await createTeam(admin.id, { name: "First Team" });
			const secondTeam = await createTeam(admin.id, { name: "Second Team" });

			expect("error" in secondTeam).toBe(false);
			if ("error" in secondTeam) {
				throw new Error("createTeam failed unexpectedly");
			}

			// Add member to second team via Prisma directly
			await prisma.teamMember.create({
				data: {
					teamId: secondTeam.data.id,
					userId: member.id,
					role: "MEMBER",
				},
			});

			const result = await listUserTeams(member.id);

			expect("error" in result).toBe(false);
			if ("error" in result) {
				return;
			}
			expect(result.data).toHaveLength(1);
			expect(result.data[0].name).toBe("Second Team");
			expect(result.data[0].my_role).toBe("MEMBER");
		});
	});

	describe("updateTeam", () => {
		it("allows an ADMIN to update the team name", async () => {
			const user = await createTestUser();
			const created = await createTeam(user.id, { name: "Old Name" });

			expect("error" in created).toBe(false);
			if ("error" in created) {
				throw new Error("createTeam failed unexpectedly");
			}

			const result = await updateTeam(user.id, created.data.id, {
				name: "New Name",
			});

			expect("error" in result).toBe(false);
			if ("error" in result) {
				return;
			}
			expect(result.data.name).toBe("New Name");

			const inDb = await prisma.team.findUnique({
				where: { id: created.data.id },
			});
			expect(inDb?.name).toBe("New Name");
		});

		it("returns 'Permission denied' when a MEMBER tries to update", async () => {
			const admin = await createTestUser();
			const member = await createTestUser();
			const created = await createTeam(admin.id, { name: "Locked Team" });

			expect("error" in created).toBe(false);
			if ("error" in created) {
				throw new Error("createTeam failed unexpectedly");
			}

			await prisma.teamMember.create({
				data: { teamId: created.data.id, userId: member.id, role: "MEMBER" },
			});

			const result = await updateTeam(member.id, created.data.id, {
				name: "Attempted Rename",
			});

			expect("error" in result).toBe(true);
			if (!("error" in result)) {
				return;
			}
			expect(result.error).toBe("Permission denied");
		});

		it("returns 'Permission denied' for a non-member", async () => {
			const owner = await createTestUser();
			const outsider = await createTestUser();
			const created = await createTeam(owner.id, { name: "Protected Team" });

			expect("error" in created).toBe(false);
			if ("error" in created) {
				throw new Error("createTeam failed unexpectedly");
			}

			const result = await updateTeam(outsider.id, created.data.id, {
				name: "Hacked Name",
			});

			expect("error" in result).toBe(true);
			if (!("error" in result)) {
				return;
			}
			expect(result.error).toBe("Permission denied");
		});
	});

	describe("deleteTeam", () => {
		it("allows an ADMIN to delete a team", async () => {
			const user = await createTestUser();
			const created = await createTeam(user.id, { name: "Doomed Team" });

			expect("error" in created).toBe(false);
			if ("error" in created) {
				throw new Error("createTeam failed unexpectedly");
			}

			const result = await deleteTeam(user.id, created.data.id);

			expect("error" in result).toBe(false);

			const inDb = await prisma.team.findUnique({
				where: { id: created.data.id },
			});
			expect(inDb).toBeNull();
		});

		it("cascades deletion to all team members", async () => {
			const admin = await createTestUser();
			const member = await createTestUser();
			const created = await createTeam(admin.id, { name: "Cascading Delete" });

			expect("error" in created).toBe(false);
			if ("error" in created) {
				throw new Error("createTeam failed unexpectedly");
			}

			await prisma.teamMember.create({
				data: { teamId: created.data.id, userId: member.id, role: "MEMBER" },
			});

			await deleteTeam(admin.id, created.data.id);

			const members = await prisma.teamMember.findMany({
				where: { teamId: created.data.id },
			});
			expect(members).toHaveLength(0);
		});

		it("returns 'Permission denied' when a MEMBER tries to delete", async () => {
			const admin = await createTestUser();
			const member = await createTestUser();
			const created = await createTeam(admin.id, { name: "Safe Team" });

			expect("error" in created).toBe(false);
			if ("error" in created) {
				throw new Error("createTeam failed unexpectedly");
			}

			await prisma.teamMember.create({
				data: { teamId: created.data.id, userId: member.id, role: "MEMBER" },
			});

			const result = await deleteTeam(member.id, created.data.id);

			expect("error" in result).toBe(true);
			if (!("error" in result)) {
				return;
			}
			expect(result.error).toBe("Permission denied");
		});

		it("returns 'Permission denied' for a non-member", async () => {
			const owner = await createTestUser();
			const outsider = await createTestUser();
			const created = await createTeam(owner.id, { name: "Intact Team" });

			expect("error" in created).toBe(false);
			if ("error" in created) {
				throw new Error("createTeam failed unexpectedly");
			}

			const result = await deleteTeam(outsider.id, created.data.id);

			expect("error" in result).toBe(true);
			if (!("error" in result)) {
				return;
			}
			expect(result.error).toBe("Permission denied");
		});
	});
});
