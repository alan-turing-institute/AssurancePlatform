import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import {
	addTeamMember,
	getTeamMembers,
	leaveTeam,
	removeMember,
	updateMemberRole,
} from "@/lib/services/team-member-service";
import { createTestUser } from "../utils/prisma-factories";

/**
 * Helper: creates a team with the given user as ADMIN and returns the team ID.
 */
async function setupTeam(adminId: string, name = "Test Team"): Promise<string> {
	const team = await prisma.team.create({
		data: {
			name,
			slug: `${name.toLowerCase().replace(/\s+/g, "-")}-${Math.random().toString(36).substring(2, 6)}`,
			createdById: adminId,
			members: {
				create: { userId: adminId, role: "ADMIN" },
			},
		},
	});
	return team.id;
}

describe("team-member-service", () => {
	describe("getTeamMembers", () => {
		it("lists all members with their roles", async () => {
			const admin = await createTestUser();
			const member = await createTestUser();
			const teamId = await setupTeam(admin.id, "List Members");

			await prisma.teamMember.create({
				data: { teamId, userId: member.id, role: "MEMBER" },
			});

			const result = await getTeamMembers(admin.id, teamId);

			expect("error" in result).toBe(false);
			if ("error" in result) {
				return;
			}
			expect(result.data).toHaveLength(2);

			const usernames = result.data.map((m) => m.user.username);
			expect(usernames).toContain(admin.username);
			expect(usernames).toContain(member.username);
		});

		it("returns 'Team not found' for a non-member", async () => {
			const admin = await createTestUser();
			const outsider = await createTestUser();
			const teamId = await setupTeam(admin.id, "Hidden Team");

			const result = await getTeamMembers(outsider.id, teamId);

			expect("error" in result).toBe(true);
			if (!("error" in result)) {
				return;
			}
			expect(result.error).toBe("Team not found");
		});
	});

	describe("addTeamMember", () => {
		it("adds an existing user as MEMBER by email", async () => {
			const admin = await createTestUser();
			const newMember = await createTestUser();
			const teamId = await setupTeam(admin.id, "Growing Team");

			const result = await addTeamMember(admin.id, teamId, {
				email: newMember.email,
				role: "MEMBER",
			});

			expect("error" in result).toBe(false);
			if ("error" in result) {
				return;
			}
			expect(result.data.member).toBeDefined();
			expect(result.data.member?.user.email).toBe(newMember.email);
			expect(result.data.member?.role).toBe("MEMBER");
		});

		it("adds an existing user as ADMIN when role is specified", async () => {
			const admin = await createTestUser();
			const promotedUser = await createTestUser();
			const teamId = await setupTeam(admin.id, "Admin Adding");

			const result = await addTeamMember(admin.id, teamId, {
				email: promotedUser.email,
				role: "ADMIN",
			});

			expect("error" in result).toBe(false);
			if ("error" in result) {
				return;
			}
			expect(result.data.member?.role).toBe("ADMIN");
		});

		it("returns already_member when user is already on the team", async () => {
			const admin = await createTestUser();
			const teamId = await setupTeam(admin.id, "Duplicate Add");

			// Admin is already a member — try to add them again
			const result = await addTeamMember(admin.id, teamId, {
				email: admin.email,
			});

			expect("error" in result).toBe(false);
			if ("error" in result) {
				return;
			}
			expect(result.data.already_member).toBe(true);
		});

		it("returns user_not_found when no user matches the email", async () => {
			const admin = await createTestUser();
			const teamId = await setupTeam(admin.id, "Ghost Invite");

			const result = await addTeamMember(admin.id, teamId, {
				email: "ghost@nowhere.example.com",
			});

			expect("error" in result).toBe(false);
			if ("error" in result) {
				return;
			}
			expect(result.data.user_not_found).toBe(true);
		});

		it("returns 'Permission denied' when a MEMBER tries to add someone", async () => {
			const admin = await createTestUser();
			const member = await createTestUser();
			const newUser = await createTestUser();
			const teamId = await setupTeam(admin.id, "Restricted Add");

			await prisma.teamMember.create({
				data: { teamId, userId: member.id, role: "MEMBER" },
			});

			const result = await addTeamMember(member.id, teamId, {
				email: newUser.email,
			});

			expect("error" in result).toBe(true);
			if (!("error" in result)) {
				return;
			}
			expect(result.error).toBe("Permission denied");
		});
	});

	describe("updateMemberRole", () => {
		it("allows an ADMIN to change a MEMBER's role to ADMIN", async () => {
			const admin = await createTestUser();
			const member = await createTestUser();
			const teamId = await setupTeam(admin.id, "Role Update Team");

			await prisma.teamMember.create({
				data: { teamId, userId: member.id, role: "MEMBER" },
			});

			const result = await updateMemberRole(admin.id, teamId, member.id, {
				role: "ADMIN",
			});

			expect("error" in result).toBe(false);
			if ("error" in result) {
				return;
			}
			expect(result.data.role).toBe("ADMIN");

			const inDb = await prisma.teamMember.findUnique({
				where: { teamId_userId: { teamId, userId: member.id } },
			});
			expect(inDb?.role).toBe("ADMIN");
		});

		it("returns an error when an ADMIN tries to change their own role", async () => {
			const admin = await createTestUser();
			const teamId = await setupTeam(admin.id, "Self Role Team");

			const result = await updateMemberRole(admin.id, teamId, admin.id, {
				role: "MEMBER",
			});

			expect("error" in result).toBe(true);
			if (!("error" in result)) {
				return;
			}
			expect(result.error).toBe("Cannot change your own role");
		});

		it("returns 'Permission denied' when a MEMBER tries to update roles", async () => {
			const admin = await createTestUser();
			const memberA = await createTestUser();
			const memberB = await createTestUser();
			const teamId = await setupTeam(admin.id, "Perm Check Team");

			await prisma.teamMember.create({
				data: { teamId, userId: memberA.id, role: "MEMBER" },
			});
			await prisma.teamMember.create({
				data: { teamId, userId: memberB.id, role: "MEMBER" },
			});

			const result = await updateMemberRole(memberA.id, teamId, memberB.id, {
				role: "ADMIN",
			});

			expect("error" in result).toBe(true);
			if (!("error" in result)) {
				return;
			}
			expect(result.error).toBe("Permission denied");
		});
	});

	describe("removeMember", () => {
		it("allows an ADMIN to remove a MEMBER from the team", async () => {
			const admin = await createTestUser();
			const member = await createTestUser();
			const teamId = await setupTeam(admin.id, "Remove Member Team");

			await prisma.teamMember.create({
				data: { teamId, userId: member.id, role: "MEMBER" },
			});

			const result = await removeMember(admin.id, teamId, member.id);

			expect("error" in result).toBe(false);

			const inDb = await prisma.teamMember.findUnique({
				where: { teamId_userId: { teamId, userId: member.id } },
			});
			expect(inDb).toBeNull();
		});

		it("returns an error when an ADMIN tries to remove themselves", async () => {
			const admin = await createTestUser();
			const teamId = await setupTeam(admin.id, "Self Remove Team");

			const result = await removeMember(admin.id, teamId, admin.id);

			expect("error" in result).toBe(true);
			if (!("error" in result)) {
				return;
			}
			expect(result.error).toBe(
				"Cannot remove yourself. Use leave team instead."
			);
		});

		it("returns 'Permission denied' when a MEMBER tries to remove someone", async () => {
			const admin = await createTestUser();
			const memberA = await createTestUser();
			const memberB = await createTestUser();
			const teamId = await setupTeam(admin.id, "Member Remove Team");

			await prisma.teamMember.create({
				data: { teamId, userId: memberA.id, role: "MEMBER" },
			});
			await prisma.teamMember.create({
				data: { teamId, userId: memberB.id, role: "MEMBER" },
			});

			const result = await removeMember(memberA.id, teamId, memberB.id);

			expect("error" in result).toBe(true);
			if (!("error" in result)) {
				return;
			}
			expect(result.error).toBe("Permission denied");
		});
	});

	describe("leaveTeam", () => {
		it("allows a MEMBER to leave a team", async () => {
			const admin = await createTestUser();
			const member = await createTestUser();
			const teamId = await setupTeam(admin.id, "Leave Team");

			await prisma.teamMember.create({
				data: { teamId, userId: member.id, role: "MEMBER" },
			});

			const result = await leaveTeam(member.id, teamId);

			expect("error" in result).toBe(false);

			const inDb = await prisma.teamMember.findUnique({
				where: { teamId_userId: { teamId, userId: member.id } },
			});
			expect(inDb).toBeNull();
		});

		it("blocks the last ADMIN from leaving", async () => {
			const admin = await createTestUser();
			const teamId = await setupTeam(admin.id, "Last Admin Leave");

			const result = await leaveTeam(admin.id, teamId);

			expect("error" in result).toBe(true);
			if (!("error" in result)) {
				return;
			}
			expect(result.error).toContain("last admin");
		});

		it("returns an error when user is not a member of the team", async () => {
			const admin = await createTestUser();
			const outsider = await createTestUser();
			const teamId = await setupTeam(admin.id, "Not Member Leave");

			const result = await leaveTeam(outsider.id, teamId);

			expect("error" in result).toBe(true);
			if (!("error" in result)) {
				return;
			}
			expect(result.error).toBe("Not a member of this team");
		});
	});
});
