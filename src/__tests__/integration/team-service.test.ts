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
import {
	expectError,
	expectSameError,
	expectSuccess,
} from "../utils/assertion-helpers";
import { createTestUser } from "../utils/prisma-factories";

const TEAM_SLUG_PATTERN = /^my-new-team-/;

describe("team-service", () => {
	describe("createTeam", () => {
		it("returns a team with a slug and the creator as ADMIN", async () => {
			const user = await createTestUser();

			const data = expectSuccess(
				await createTeam(user.id, { name: "My New Team" })
			);
			expect(data.name).toBe("My New Team");
			expect(data.slug).toMatch(TEAM_SLUG_PATTERN);
			expect(data.my_role).toBe("ADMIN");
			expect(data.member_count).toBe(1);
		});

		it("returns an error when name is empty", async () => {
			const user = await createTestUser();

			expectError(
				await createTeam(user.id, { name: "" }),
				"Team name is required"
			);
		});

		it("returns an error when name is whitespace only", async () => {
			const user = await createTestUser();

			expectError(
				await createTeam(user.id, { name: "   " }),
				"Team name is required"
			);
		});

		it("returns an error when name exceeds 100 characters", async () => {
			const user = await createTestUser();
			const longName = "A".repeat(101);

			expectError(
				await createTeam(user.id, { name: longName }),
				"Team name must be less than 100 characters"
			);
		});

		it("creates the team with an optional description", async () => {
			const user = await createTestUser();

			const data = expectSuccess(
				await createTeam(user.id, {
					name: "Described Team",
					description: "A team with a description",
				})
			);
			expect(data.description).toBe("A team with a description");
		});

		it("persists the new team in the database", async () => {
			const user = await createTestUser();

			const data = expectSuccess(
				await createTeam(user.id, { name: "Persisted Team" })
			);
			expect(data.id).toBeDefined();
			const found = await prisma.team.findUnique({
				where: { id: data.id },
			});
			expect(found).not.toBeNull();
			expect(found?.name).toBe("Persisted Team");
		});
	});

	describe("getTeam", () => {
		it("returns a team when the user is a member", async () => {
			const user = await createTestUser();
			const created = expectSuccess(
				await createTeam(user.id, { name: "Visible Team" })
			);

			const data = expectSuccess(await getTeam(user.id, created.id));
			expect(data.name).toBe("Visible Team");
			expect(data.my_role).toBe("ADMIN");
		});

		it("returns 'Team not found' for a non-member", async () => {
			const owner = await createTestUser();
			const outsider = await createTestUser();
			const created = expectSuccess(
				await createTeam(owner.id, { name: "Private Team" })
			);

			expectError(await getTeam(outsider.id, created.id), "Team not found");
		});

		it("returns 'Team not found' for a non-existent team ID", async () => {
			const user = await createTestUser();

			expectError(
				await getTeam(user.id, "00000000-0000-0000-0000-000000000000"),
				"Team not found"
			);
		});

		it("includes member data in the response", async () => {
			const user = await createTestUser();
			const created = expectSuccess(
				await createTeam(user.id, { name: "Team With Members" })
			);

			const data = expectSuccess(await getTeam(user.id, created.id));
			expect(data.members).toHaveLength(1);
			expect(data.members![0]!.user.username).toBe(user.username);
		});
	});

	describe("getTeamBySlug", () => {
		it("returns a team when the user is a member and slug matches", async () => {
			const user = await createTestUser();
			const created = expectSuccess(
				await createTeam(user.id, { name: "Slug Team" })
			);

			const data = expectSuccess(await getTeamBySlug(user.id, created.slug));
			expect(data.name).toBe("Slug Team");
		});

		it("returns 'Team not found' for a non-member accessing by slug", async () => {
			const owner = await createTestUser();
			const outsider = await createTestUser();
			const created = expectSuccess(
				await createTeam(owner.id, { name: "Slug Private" })
			);

			expectError(
				await getTeamBySlug(outsider.id, created.slug),
				"Team not found"
			);
		});

		it("returns 'Team not found' for a non-existent slug", async () => {
			const user = await createTestUser();

			expectError(
				await getTeamBySlug(user.id, "this-slug-does-not-exist-xyz"),
				"Team not found"
			);
		});
	});

	describe("listUserTeams", () => {
		it("returns only the teams the user belongs to", async () => {
			const userA = await createTestUser();
			const userB = await createTestUser();
			await createTeam(userA.id, { name: "Team Alpha" });
			await createTeam(userB.id, { name: "Team Beta" });

			const data = expectSuccess(await listUserTeams(userA.id));
			expect(data).toHaveLength(1);
			expect(data[0]!.name).toBe("Team Alpha");
		});

		it("returns an empty array when the user has no teams", async () => {
			const user = await createTestUser();

			const data = expectSuccess(await listUserTeams(user.id));
			expect(data).toEqual([]);
		});

		it("returns all teams the user is a member of", async () => {
			const admin = await createTestUser();
			const member = await createTestUser();
			await createTeam(admin.id, { name: "First Team" });
			const secondTeam = expectSuccess(
				await createTeam(admin.id, { name: "Second Team" })
			);

			// Add member to second team via Prisma directly
			await prisma.teamMember.create({
				data: {
					teamId: secondTeam.id,
					userId: member.id,
					role: "MEMBER",
				},
			});

			const data = expectSuccess(await listUserTeams(member.id));
			expect(data).toHaveLength(1);
			expect(data[0]!.name).toBe("Second Team");
			expect(data[0]!.my_role).toBe("MEMBER");
		});
	});

	describe("updateTeam", () => {
		it("allows an ADMIN to update the team name", async () => {
			const user = await createTestUser();
			const created = expectSuccess(
				await createTeam(user.id, { name: "Old Name" })
			);

			const data = expectSuccess(
				await updateTeam(user.id, created.id, {
					name: "New Name",
				})
			);
			expect(data.name).toBe("New Name");

			const inDb = await prisma.team.findUnique({
				where: { id: created.id },
			});
			expect(inDb?.name).toBe("New Name");
		});

		it("returns 'Permission denied' when a MEMBER tries to update", async () => {
			const admin = await createTestUser();
			const member = await createTestUser();
			const created = expectSuccess(
				await createTeam(admin.id, { name: "Locked Team" })
			);

			await prisma.teamMember.create({
				data: { teamId: created.id, userId: member.id, role: "MEMBER" },
			});

			expectError(
				await updateTeam(member.id, created.id, { name: "Attempted Rename" }),
				"Permission denied"
			);
		});

		it("returns 'Permission denied' for a non-member", async () => {
			const owner = await createTestUser();
			const outsider = await createTestUser();
			const created = expectSuccess(
				await createTeam(owner.id, { name: "Protected Team" })
			);

			expectError(
				await updateTeam(outsider.id, created.id, { name: "Hacked Name" }),
				"Permission denied"
			);
		});
	});

	describe("anti-enumeration: consistent error responses", () => {
		it("updateTeam returns the same error for a non-existent team as for an inaccessible team", async () => {
			const owner = await createTestUser();
			const outsider = await createTestUser();
			const created = expectSuccess(
				await createTeam(owner.id, { name: "Protected Team" })
			);

			// Outsider tries to update a team they are not a member of
			const noAccessResult = await updateTeam(outsider.id, created.id, {
				name: "Hijacked Name",
			});

			// Outsider tries to update a non-existent team
			const notFoundResult = await updateTeam(
				outsider.id,
				"00000000-0000-0000-0000-000000000000",
				{ name: "Ghost Name" }
			);

			expectSameError(noAccessResult, notFoundResult);
		});

		it("deleteTeam returns the same error for a non-existent team as for an inaccessible team", async () => {
			const owner = await createTestUser();
			const outsider = await createTestUser();
			const created = expectSuccess(
				await createTeam(owner.id, { name: "Guarded Team" })
			);

			// Outsider tries to delete a team they are not a member of
			const noAccessResult = await deleteTeam(outsider.id, created.id);

			// Outsider tries to delete a non-existent team
			const notFoundResult = await deleteTeam(
				outsider.id,
				"00000000-0000-0000-0000-000000000000"
			);

			expectSameError(noAccessResult, notFoundResult);
		});
	});

	describe("deleteTeam", () => {
		it("allows an ADMIN to delete a team", async () => {
			const user = await createTestUser();
			const created = expectSuccess(
				await createTeam(user.id, { name: "Doomed Team" })
			);

			expectSuccess(await deleteTeam(user.id, created.id));

			const inDb = await prisma.team.findUnique({
				where: { id: created.id },
			});
			expect(inDb).toBeNull();
		});

		it("cascades deletion to all team members", async () => {
			const admin = await createTestUser();
			const member = await createTestUser();
			const created = expectSuccess(
				await createTeam(admin.id, { name: "Cascading Delete" })
			);

			await prisma.teamMember.create({
				data: { teamId: created.id, userId: member.id, role: "MEMBER" },
			});

			await deleteTeam(admin.id, created.id);

			const members = await prisma.teamMember.findMany({
				where: { teamId: created.id },
			});
			expect(members).toHaveLength(0);
		});

		it("returns 'Permission denied' when a MEMBER tries to delete", async () => {
			const admin = await createTestUser();
			const member = await createTestUser();
			const created = expectSuccess(
				await createTeam(admin.id, { name: "Safe Team" })
			);

			await prisma.teamMember.create({
				data: { teamId: created.id, userId: member.id, role: "MEMBER" },
			});

			expectError(await deleteTeam(member.id, created.id), "Permission denied");
		});

		it("returns 'Permission denied' for a non-member", async () => {
			const owner = await createTestUser();
			const outsider = await createTestUser();
			const created = expectSuccess(
				await createTeam(owner.id, { name: "Intact Team" })
			);

			expectError(
				await deleteTeam(outsider.id, created.id),
				"Permission denied"
			);
		});
	});
});
