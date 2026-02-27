import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import {
	acceptInvite,
	listCasePermissions,
	revokeTeamPermission,
	revokeUserPermission,
	shareByEmail,
	shareWithTeam,
	updateTeamPermission,
	updateUserPermission,
} from "@/lib/services/case-permission-service";
import {
	addTeamMember,
	createTestCase,
	createTestPermission,
	createTestTeam,
	createTestTeamPermission,
	createTestUser,
} from "../utils/prisma-factories";

// ============================================
// listCasePermissions
// ============================================

describe("listCasePermissions", () => {
	it("returns permissions list for case owner (implicit ADMIN)", async () => {
		const owner = await createTestUser();
		const viewer = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");

		const result = await listCasePermissions(owner.id, testCase.id);

		expect(result.error).toBeUndefined();
		expect(result.data).toBeDefined();
		expect(result.data?.is_owner).toBe(true);
		expect(result.data?.owner.id).toBe(owner.id);
		expect(result.data?.user_permissions).toHaveLength(1);
		expect(result.data?.user_permissions[0].user.id).toBe(viewer.id);
		expect(result.data?.user_permissions[0].permission).toBe("VIEW");
	});

	it("returns permissions list for user with explicit ADMIN permission", async () => {
		const owner = await createTestUser();
		const admin = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await createTestPermission(testCase.id, admin.id, owner.id, "ADMIN");

		const result = await listCasePermissions(admin.id, testCase.id);

		expect(result.error).toBeUndefined();
		expect(result.data).toBeDefined();
		expect(result.data?.is_owner).toBe(false);
	});

	it("returns error for user with EDIT permission (ADMIN required)", async () => {
		const owner = await createTestUser();
		const editor = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await createTestPermission(testCase.id, editor.id, owner.id, "EDIT");

		const result = await listCasePermissions(editor.id, testCase.id);

		expect(result.error).toBe("Permission denied");
		expect(result.data).toBeUndefined();
	});

	it("returns error for user with no access", async () => {
		const owner = await createTestUser();
		const stranger = await createTestUser();
		const testCase = await createTestCase(owner.id);

		const result = await listCasePermissions(stranger.id, testCase.id);

		expect(result.error).toBe("Permission denied");
	});

	it("returns team permissions alongside user permissions", async () => {
		const owner = await createTestUser();
		const teamMember = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const team = await createTestTeam(teamMember.id);
		await createTestTeamPermission(testCase.id, team.id, owner.id, "VIEW");

		const result = await listCasePermissions(owner.id, testCase.id);

		expect(result.error).toBeUndefined();
		expect(result.data?.team_permissions).toHaveLength(1);
		expect(result.data?.team_permissions[0].team.id).toBe(team.id);
	});
});

// ============================================
// shareByEmail — existing user paths
// ============================================

describe("shareByEmail", () => {
	it("grants VIEW permission to an existing user by email", async () => {
		const owner = await createTestUser();
		const target = await createTestUser({ email: "target@example.com" });
		const testCase = await createTestCase(owner.id);

		const result = await shareByEmail(owner.id, testCase.id, {
			email: "target@example.com",
			permission: "VIEW",
		});

		expect(result.error).toBeUndefined();
		expect(result.data?.permission).toBeDefined();
		expect(result.data?.permission?.user.id).toBe(target.id);
		expect(result.data?.permission?.permission).toBe("VIEW");

		const dbPerm = await prisma.casePermission.findUnique({
			where: { caseId_userId: { caseId: testCase.id, userId: target.id } },
		});
		expect(dbPerm).not.toBeNull();
		expect(dbPerm?.permission).toBe("VIEW");
	});

	it("grants EDIT permission to an existing user by email", async () => {
		const owner = await createTestUser();
		const target = await createTestUser({ email: "editor@example.com" });
		const testCase = await createTestCase(owner.id);

		const result = await shareByEmail(owner.id, testCase.id, {
			email: "editor@example.com",
			permission: "EDIT",
		});

		expect(result.error).toBeUndefined();
		expect(result.data?.permission?.permission).toBe("EDIT");
	});

	it("creates an invite when target email is not registered", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);

		const result = await shareByEmail(owner.id, testCase.id, {
			email: "notregistered@example.com",
			permission: "VIEW",
		});

		expect(result.error).toBeUndefined();
		expect(result.data?.invite_created).toBe(true);
		expect(result.data?.invite_token).toBeDefined();

		const invite = await prisma.caseInvite.findFirst({
			where: { caseId: testCase.id, email: "notregistered@example.com" },
		});
		expect(invite).not.toBeNull();
	});

	it("returns already_shared when user already has permission", async () => {
		const owner = await createTestUser();
		const target = await createTestUser({ email: "already@example.com" });
		const testCase = await createTestCase(owner.id);
		await createTestPermission(testCase.id, target.id, owner.id, "VIEW");

		const result = await shareByEmail(owner.id, testCase.id, {
			email: "already@example.com",
			permission: "EDIT",
		});

		expect(result.error).toBeUndefined();
		expect(result.data?.already_shared).toBe(true);
	});

	it("returns already_shared when target is the case owner", async () => {
		const owner = await createTestUser({ email: "owner@example.com" });
		const testCase = await createTestCase(owner.id);

		const result = await shareByEmail(owner.id, testCase.id, {
			email: "owner@example.com",
			permission: "VIEW",
		});

		expect(result.error).toBeUndefined();
		expect(result.data?.already_shared).toBe(true);
	});

	it("returns error for invalid email address", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);

		const result = await shareByEmail(owner.id, testCase.id, {
			email: "not-an-email",
			permission: "VIEW",
		});

		expect(result.error).toBe("Valid email is required");
	});

	it("returns error when caller has only VIEW access (ADMIN required)", async () => {
		const owner = await createTestUser();
		const viewer = await createTestUser();
		const target = await createTestUser({ email: "newtarget@example.com" });
		const testCase = await createTestCase(owner.id);
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");

		const result = await shareByEmail(viewer.id, testCase.id, {
			email: target.email,
			permission: "VIEW",
		});

		expect(result.error).toBe("Permission denied");
	});

	it("returns the same error for a non-existent case as for a forbidden case (anti-enumeration)", async () => {
		const owner = await createTestUser();
		const stranger = await createTestUser({ email: "stranger@example.com" });
		const existingCase = await createTestCase(owner.id);

		// Stranger has no permission on the existing case
		const noAccessResult = await shareByEmail(stranger.id, existingCase.id, {
			email: "target@example.com",
			permission: "VIEW",
		});

		// Stranger tries to share a non-existent case
		const notFoundResult = await shareByEmail(
			stranger.id,
			"00000000-0000-0000-0000-000000000000",
			{
				email: "target@example.com",
				permission: "VIEW",
			}
		);

		// Both should return the same error to prevent case enumeration
		expect(noAccessResult.error).toBe(notFoundResult.error);
	});
});

// ============================================
// shareWithTeam
// ============================================

describe("shareWithTeam", () => {
	it("grants team permission when caller owns the case and is a team member", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const team = await createTestTeam(owner.id);

		const result = await shareWithTeam(owner.id, testCase.id, {
			teamId: team.id,
			permission: "VIEW",
		});

		expect(result.error).toBeUndefined();
		expect(result.data).toBeDefined();
		expect(result.data?.team.id).toBe(team.id);
		expect(result.data?.permission).toBe("VIEW");

		const dbPerm = await prisma.caseTeamPermission.findUnique({
			where: { caseId_teamId: { caseId: testCase.id, teamId: team.id } },
		});
		expect(dbPerm).not.toBeNull();
	});

	it("returns error when caller is not a member of the team", async () => {
		const owner = await createTestUser();
		const teamOwner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const team = await createTestTeam(teamOwner.id);

		const result = await shareWithTeam(owner.id, testCase.id, {
			teamId: team.id,
			permission: "VIEW",
		});

		expect(result.error).toBe("Team not found");
	});

	it("returns error when case is already shared with the team", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const team = await createTestTeam(owner.id);
		await createTestTeamPermission(testCase.id, team.id, owner.id, "VIEW");

		const result = await shareWithTeam(owner.id, testCase.id, {
			teamId: team.id,
			permission: "EDIT",
		});

		expect(result.error).toBe("Case already shared with this team");
	});

	it("returns error when caller has EDIT access but not ADMIN", async () => {
		const owner = await createTestUser();
		const editor = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const team = await createTestTeam(owner.id);
		await createTestPermission(testCase.id, editor.id, owner.id, "EDIT");
		await addTeamMember(team.id, editor.id);

		const result = await shareWithTeam(editor.id, testCase.id, {
			teamId: team.id,
			permission: "VIEW",
		});

		expect(result.error).toBe("Permission denied");
	});
});

// ============================================
// updateUserPermission
// ============================================

describe("updateUserPermission", () => {
	it("updates user permission level from VIEW to EDIT", async () => {
		const owner = await createTestUser();
		const target = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const perm = await createTestPermission(
			testCase.id,
			target.id,
			owner.id,
			"VIEW"
		);

		const result = await updateUserPermission(
			owner.id,
			testCase.id,
			perm.id,
			{ permission: "EDIT" }
		);

		expect(result.error).toBeUndefined();
		expect(result.data?.permission).toBe("EDIT");

		const dbPerm = await prisma.casePermission.findUnique({
			where: { id: perm.id },
		});
		expect(dbPerm?.permission).toBe("EDIT");
	});

	it("returns error when permission does not exist", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);

		const result = await updateUserPermission(
			owner.id,
			testCase.id,
			"00000000-0000-0000-0000-000000000000",
			{ permission: "EDIT" }
		);

		expect(result.error).toBe("Permission not found");
	});

	it("returns error when caller has EDIT access but not ADMIN", async () => {
		const owner = await createTestUser();
		const editor = await createTestUser();
		const target = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await createTestPermission(testCase.id, editor.id, owner.id, "EDIT");
		const perm = await createTestPermission(
			testCase.id,
			target.id,
			owner.id,
			"VIEW"
		);

		const result = await updateUserPermission(
			editor.id,
			testCase.id,
			perm.id,
			{ permission: "EDIT" }
		);

		expect(result.error).toBe("Permission denied");
	});
});

// ============================================
// updateTeamPermission
// ============================================

describe("updateTeamPermission", () => {
	it("updates team permission level", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const team = await createTestTeam(owner.id);
		const teamPerm = await createTestTeamPermission(
			testCase.id,
			team.id,
			owner.id,
			"VIEW"
		);

		const result = await updateTeamPermission(
			owner.id,
			testCase.id,
			teamPerm.id,
			{ permission: "EDIT" }
		);

		expect(result.error).toBeUndefined();
		expect(result.data?.permission).toBe("EDIT");

		const dbPerm = await prisma.caseTeamPermission.findUnique({
			where: { id: teamPerm.id },
		});
		expect(dbPerm?.permission).toBe("EDIT");
	});

	it("returns error when team permission does not exist", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);

		const result = await updateTeamPermission(
			owner.id,
			testCase.id,
			"00000000-0000-0000-0000-000000000000",
			{ permission: "EDIT" }
		);

		expect(result.error).toBe("Permission not found");
	});
});

// ============================================
// revokeUserPermission
// ============================================

describe("revokeUserPermission", () => {
	it("revokes a user permission successfully", async () => {
		const owner = await createTestUser();
		const target = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const perm = await createTestPermission(
			testCase.id,
			target.id,
			owner.id,
			"VIEW"
		);

		const result = await revokeUserPermission(owner.id, testCase.id, perm.id);

		expect(result.error).toBeUndefined();
		expect(result.success).toBe(true);

		const dbPerm = await prisma.casePermission.findUnique({
			where: { id: perm.id },
		});
		expect(dbPerm).toBeNull();
	});

	it("returns error when permission does not exist", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);

		const result = await revokeUserPermission(
			owner.id,
			testCase.id,
			"00000000-0000-0000-0000-000000000000"
		);

		expect(result.error).toBe("Permission not found");
	});

	it("returns error when caller has EDIT access but not ADMIN", async () => {
		const owner = await createTestUser();
		const editor = await createTestUser();
		const target = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await createTestPermission(testCase.id, editor.id, owner.id, "EDIT");
		const perm = await createTestPermission(
			testCase.id,
			target.id,
			owner.id,
			"VIEW"
		);

		const result = await revokeUserPermission(
			editor.id,
			testCase.id,
			perm.id
		);

		expect(result.error).toBe("Permission denied");
	});
});

// ============================================
// revokeTeamPermission
// ============================================

describe("revokeTeamPermission", () => {
	it("revokes a team permission successfully", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const team = await createTestTeam(owner.id);
		const teamPerm = await createTestTeamPermission(
			testCase.id,
			team.id,
			owner.id,
			"VIEW"
		);

		const result = await revokeTeamPermission(
			owner.id,
			testCase.id,
			teamPerm.id
		);

		expect(result.error).toBeUndefined();
		expect(result.success).toBe(true);

		const dbPerm = await prisma.caseTeamPermission.findUnique({
			where: { id: teamPerm.id },
		});
		expect(dbPerm).toBeNull();
	});

	it("returns error when team permission does not exist", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);

		const result = await revokeTeamPermission(
			owner.id,
			testCase.id,
			"00000000-0000-0000-0000-000000000000"
		);

		expect(result.error).toBe("Permission not found");
	});

	it("returns 'Permission denied' when caller has only EDIT access", async () => {
		const owner = await createTestUser();
		const editor = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const team = await createTestTeam(owner.id);
		const teamPerm = await createTestTeamPermission(
			testCase.id,
			team.id,
			owner.id,
			"VIEW"
		);
		await createTestPermission(testCase.id, editor.id, owner.id, "EDIT");

		const result = await revokeTeamPermission(
			editor.id,
			testCase.id,
			teamPerm.id
		);

		expect(result.error).toBe("Permission denied");
	});
});

// ============================================
// acceptInvite
// ============================================

describe("acceptInvite", () => {
	it("accepts a valid invite and grants case permission", async () => {
		const owner = await createTestUser();
		const invitee = await createTestUser({ email: "invitee@example.com" });
		const testCase = await createTestCase(owner.id);

		// Create invite directly in DB
		const expiresAt = new Date();
		expiresAt.setDate(expiresAt.getDate() + 7);
		const invite = await prisma.caseInvite.create({
			data: {
				caseId: testCase.id,
				email: "invitee@example.com",
				permission: "VIEW",
				inviteToken: "valid-token-abc123",
				inviteExpiresAt: expiresAt,
				invitedById: owner.id,
			},
		});

		const result = await acceptInvite(invitee.id, invite.inviteToken);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.case_id).toBe(testCase.id);
		}

		const perm = await prisma.casePermission.findUnique({
			where: { caseId_userId: { caseId: testCase.id, userId: invitee.id } },
		});
		expect(perm).not.toBeNull();
		expect(perm?.permission).toBe("VIEW");
	});

	it("returns error for an expired invite", async () => {
		const owner = await createTestUser();
		const invitee = await createTestUser({ email: "expired@example.com" });
		const testCase = await createTestCase(owner.id);

		const expiredAt = new Date();
		expiredAt.setDate(expiredAt.getDate() - 1); // yesterday
		await prisma.caseInvite.create({
			data: {
				caseId: testCase.id,
				email: "expired@example.com",
				permission: "VIEW",
				inviteToken: "expired-token-xyz789",
				inviteExpiresAt: expiredAt,
				invitedById: owner.id,
			},
		});

		const result = await acceptInvite(invitee.id, "expired-token-xyz789");

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toBe("Invite has expired");
		}
	});

	it("returns error for an already-used invite", async () => {
		const owner = await createTestUser();
		const invitee = await createTestUser({ email: "used@example.com" });
		const testCase = await createTestCase(owner.id);

		const expiresAt = new Date();
		expiresAt.setDate(expiresAt.getDate() + 7);
		await prisma.caseInvite.create({
			data: {
				caseId: testCase.id,
				email: "used@example.com",
				permission: "VIEW",
				inviteToken: "used-token-def456",
				inviteExpiresAt: expiresAt,
				invitedById: owner.id,
				acceptedAt: new Date(),
				acceptedById: invitee.id,
			},
		});

		const result = await acceptInvite(invitee.id, "used-token-def456");

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toBe("Invite has already been used");
		}
	});

	it("returns error for an invalid (non-existent) invite token", async () => {
		const invitee = await createTestUser();

		const result = await acceptInvite(invitee.id, "completely-fake-token");

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toBe("Invalid invite");
		}
	});

	it("returns error when the accepting user's email does not match the invite email", async () => {
		const owner = await createTestUser();
		const invitee = await createTestUser({ email: "actual@example.com" });
		const testCase = await createTestCase(owner.id);

		const expiresAt = new Date();
		expiresAt.setDate(expiresAt.getDate() + 7);
		await prisma.caseInvite.create({
			data: {
				caseId: testCase.id,
				email: "different@example.com",
				permission: "VIEW",
				inviteToken: "mismatch-token-abc123",
				inviteExpiresAt: expiresAt,
				invitedById: owner.id,
			},
		});

		const result = await acceptInvite(invitee.id, "mismatch-token-abc123");

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toBe("Invite was sent to a different email address");
		}
	});
});

// ============================================
// Anti-enumeration: same error for not-found vs no-permission
// ============================================

describe("anti-enumeration: consistent error responses", () => {
	it("returns the same error for a non-existent case as for a forbidden case", async () => {
		const stranger = await createTestUser();
		const owner = await createTestUser();
		const existingCase = await createTestCase(owner.id);

		const noAccessResult = await listCasePermissions(
			stranger.id,
			existingCase.id
		);
		const notFoundResult = await listCasePermissions(
			stranger.id,
			"00000000-0000-0000-0000-000000000000"
		);

		// Both should return the same error
		expect(noAccessResult.error).toBe(notFoundResult.error);
	});
});

// ============================================
// Team-based access via CaseTeamPermission
// ============================================

describe("team-based case access", () => {
	it("team member inherits case access granted to their team", async () => {
		const owner = await createTestUser();
		const teamAdmin = await createTestUser();
		const teamMember = await createTestUser();
		const testCase = await createTestCase(owner.id);

		// Create a team, add members
		const team = await createTestTeam(teamAdmin.id);
		await addTeamMember(team.id, teamMember.id);

		// Share case with team
		await createTestTeamPermission(testCase.id, team.id, owner.id, "VIEW");

		// Verify team member can list permissions via ADMIN check on owner
		// (The team member has VIEW — not ADMIN — so listCasePermissions should deny them)
		const memberResult = await listCasePermissions(teamMember.id, testCase.id);
		expect(memberResult.error).toBe("Permission denied");

		// But the owner (with ADMIN) can see the team permission recorded
		const ownerResult = await listCasePermissions(owner.id, testCase.id);
		expect(ownerResult.data?.team_permissions).toHaveLength(1);
		expect(ownerResult.data?.team_permissions[0].team.id).toBe(team.id);
	});
});
