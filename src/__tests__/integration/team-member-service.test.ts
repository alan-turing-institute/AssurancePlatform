import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import {
	addTeamMember,
	getTeamMembers,
	leaveTeam,
	removeMember,
	updateMemberRole,
} from "@/lib/services/team-member-service";
import {
	expectError,
	expectSameError,
	expectSuccess,
} from "../utils/assertion-helpers";
import {
	createTestTeamWithAdmin,
	createTestUser,
} from "../utils/prisma-factories";

// Top-level regex constant required by lint/performance/useTopLevelRegex
const LAST_ADMIN = /last admin/;

describe("team-member-service", () => {
	describe("getTeamMembers", () => {
		it("lists all members with their roles", async () => {
			const admin = await createTestUser();
			const member = await createTestUser();
			const teamId = await createTestTeamWithAdmin(admin.id, "List Members");

			await prisma.teamMember.create({
				data: { teamId, userId: member.id, role: "MEMBER" },
			});

			const data = expectSuccess(await getTeamMembers(admin.id, teamId));
			expect(data).toHaveLength(2);

			const usernames = data.map((m) => m.user.username);
			expect(usernames).toContain(admin.username);
			expect(usernames).toContain(member.username);
		});

		it("returns 'Permission denied' for a non-member", async () => {
			const admin = await createTestUser();
			const outsider = await createTestUser();
			const teamId = await createTestTeamWithAdmin(admin.id, "Hidden Team");

			expectError(
				await getTeamMembers(outsider.id, teamId),
				"Permission denied"
			);
		});
	});

	describe("anti-enumeration: consistent error responses", () => {
		it("getTeamMembers returns the same error for a non-existent team as for an inaccessible team", async () => {
			const admin = await createTestUser();
			const outsider = await createTestUser();
			const teamId = await createTestTeamWithAdmin(admin.id, "Anti-Enum Team");

			// Outsider is not a member of the existing team
			const noAccessResult = await getTeamMembers(outsider.id, teamId);

			// Outsider queries a non-existent team
			const notFoundResult = await getTeamMembers(
				outsider.id,
				"00000000-0000-0000-0000-000000000000"
			);

			expectSameError(noAccessResult, notFoundResult);
		});
	});

	describe("addTeamMember", () => {
		it("adds an existing user as MEMBER by email", async () => {
			const admin = await createTestUser();
			const newMember = await createTestUser();
			const teamId = await createTestTeamWithAdmin(admin.id, "Growing Team");

			const data = expectSuccess(
				await addTeamMember(admin.id, teamId, {
					email: newMember.email,
					role: "MEMBER",
				})
			);
			expect(data.member).toBeDefined();
			expect(data.member?.user.email).toBe(newMember.email);
			expect(data.member?.role).toBe("MEMBER");
		});

		it("adds an existing user as ADMIN when role is specified", async () => {
			const admin = await createTestUser();
			const promotedUser = await createTestUser();
			const teamId = await createTestTeamWithAdmin(admin.id, "Admin Adding");

			const data = expectSuccess(
				await addTeamMember(admin.id, teamId, {
					email: promotedUser.email,
					role: "ADMIN",
				})
			);
			expect(data.member?.role).toBe("ADMIN");
		});

		it("returns already_member when user is already on the team", async () => {
			const admin = await createTestUser();
			const teamId = await createTestTeamWithAdmin(admin.id, "Duplicate Add");

			// Admin is already a member — try to add them again
			const data = expectSuccess(
				await addTeamMember(admin.id, teamId, {
					email: admin.email,
				})
			);
			expect(data.already_member).toBe(true);
		});

		it("returns user_not_found when no user matches the email", async () => {
			const admin = await createTestUser();
			const teamId = await createTestTeamWithAdmin(admin.id, "Ghost Invite");

			const data = expectSuccess(
				await addTeamMember(admin.id, teamId, {
					email: "ghost@nowhere.example.com",
				})
			);
			expect(data.user_not_found).toBe(true);
		});

		it("returns 'Permission denied' when a MEMBER tries to add someone", async () => {
			const admin = await createTestUser();
			const member = await createTestUser();
			const newUser = await createTestUser();
			const teamId = await createTestTeamWithAdmin(admin.id, "Restricted Add");

			await prisma.teamMember.create({
				data: { teamId, userId: member.id, role: "MEMBER" },
			});

			expectError(
				await addTeamMember(member.id, teamId, { email: newUser.email }),
				"Permission denied"
			);
		});
	});

	describe("updateMemberRole", () => {
		it("allows an ADMIN to change a MEMBER's role to ADMIN", async () => {
			const admin = await createTestUser();
			const member = await createTestUser();
			const teamId = await createTestTeamWithAdmin(
				admin.id,
				"Role Update Team"
			);

			await prisma.teamMember.create({
				data: { teamId, userId: member.id, role: "MEMBER" },
			});

			const data = expectSuccess(
				await updateMemberRole(admin.id, teamId, member.id, { role: "ADMIN" })
			);
			expect(data.role).toBe("ADMIN");

			const inDb = await prisma.teamMember.findUnique({
				where: { teamId_userId: { teamId, userId: member.id } },
			});
			expect(inDb?.role).toBe("ADMIN");
		});

		it("returns an error when an ADMIN tries to change their own role", async () => {
			const admin = await createTestUser();
			const teamId = await createTestTeamWithAdmin(admin.id, "Self Role Team");

			expectError(
				await updateMemberRole(admin.id, teamId, admin.id, { role: "MEMBER" }),
				"Cannot change your own role"
			);
		});

		it("returns 'Permission denied' when a MEMBER tries to update roles", async () => {
			const admin = await createTestUser();
			const memberA = await createTestUser();
			const memberB = await createTestUser();
			const teamId = await createTestTeamWithAdmin(admin.id, "Perm Check Team");

			await prisma.teamMember.create({
				data: { teamId, userId: memberA.id, role: "MEMBER" },
			});
			await prisma.teamMember.create({
				data: { teamId, userId: memberB.id, role: "MEMBER" },
			});

			expectError(
				await updateMemberRole(memberA.id, teamId, memberB.id, {
					role: "ADMIN",
				}),
				"Permission denied"
			);
		});
	});

	describe("removeMember", () => {
		it("allows an ADMIN to remove a MEMBER from the team", async () => {
			const admin = await createTestUser();
			const member = await createTestUser();
			const teamId = await createTestTeamWithAdmin(
				admin.id,
				"Remove Member Team"
			);

			await prisma.teamMember.create({
				data: { teamId, userId: member.id, role: "MEMBER" },
			});

			expectSuccess(await removeMember(admin.id, teamId, member.id));

			const inDb = await prisma.teamMember.findUnique({
				where: { teamId_userId: { teamId, userId: member.id } },
			});
			expect(inDb).toBeNull();
		});

		it("returns an error when an ADMIN tries to remove themselves", async () => {
			const admin = await createTestUser();
			const teamId = await createTestTeamWithAdmin(
				admin.id,
				"Self Remove Team"
			);

			expectError(
				await removeMember(admin.id, teamId, admin.id),
				"Cannot remove yourself. Use leave team instead."
			);
		});

		it("returns 'Permission denied' when a MEMBER tries to remove someone", async () => {
			const admin = await createTestUser();
			const memberA = await createTestUser();
			const memberB = await createTestUser();
			const teamId = await createTestTeamWithAdmin(
				admin.id,
				"Member Remove Team"
			);

			await prisma.teamMember.create({
				data: { teamId, userId: memberA.id, role: "MEMBER" },
			});
			await prisma.teamMember.create({
				data: { teamId, userId: memberB.id, role: "MEMBER" },
			});

			expectError(
				await removeMember(memberA.id, teamId, memberB.id),
				"Permission denied"
			);
		});
	});

	describe("leaveTeam", () => {
		it("allows a MEMBER to leave a team", async () => {
			const admin = await createTestUser();
			const member = await createTestUser();
			const teamId = await createTestTeamWithAdmin(admin.id, "Leave Team");

			await prisma.teamMember.create({
				data: { teamId, userId: member.id, role: "MEMBER" },
			});

			expectSuccess(await leaveTeam(member.id, teamId));

			const inDb = await prisma.teamMember.findUnique({
				where: { teamId_userId: { teamId, userId: member.id } },
			});
			expect(inDb).toBeNull();
		});

		it("blocks the last ADMIN from leaving", async () => {
			const admin = await createTestUser();
			const teamId = await createTestTeamWithAdmin(
				admin.id,
				"Last Admin Leave"
			);

			expectError(await leaveTeam(admin.id, teamId), LAST_ADMIN);
		});

		it("returns an error when user is not a member of the team", async () => {
			const admin = await createTestUser();
			const outsider = await createTestUser();
			const teamId = await createTestTeamWithAdmin(
				admin.id,
				"Not Member Leave"
			);

			expectError(
				await leaveTeam(outsider.id, teamId),
				"Not a member of this team"
			);
		});
	});
});
