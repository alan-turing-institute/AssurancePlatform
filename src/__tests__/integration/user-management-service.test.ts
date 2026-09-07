import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { reassignIntegrationOwner } from "@/lib/services/integration-registry-service";
import {
	deleteAccount,
	deleteAccountForRetention,
} from "@/lib/services/user-management-service";
import { expectError, expectSuccess } from "../utils/assertion-helpers";
import {
	addTeamMember,
	createTestCase,
	createTestIntegrationWithSystemUser,
	createTestPermission,
	createTestTeam,
	createTestTeamPermission,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * Regression test for feasibility review R2 (ADR 0002 v2 §2.4):
 * `getOrCreateSystemUser` used to select the fallback account via bare
 * `findFirst({ isSystemUser: true })`, which — once integration system
 * users exist alongside the generic fallback — could resolve to WHICHEVER
 * system user Postgres returned first. That would hand a deleted user's
 * case ownership (createdById, i.e. implicit ADMIN) to an integration's
 * machine principal instead of the intended generic fallback account: a
 * privilege escalation. The fix selects by the stable
 * `system@tea-platform.internal` email identifier instead.
 */
const SYSTEM_USER_EMAIL = "system@tea-platform.internal";
const SINGLE_INTEGRATION_BLOCK_PATTERN =
	/Remove your 1 integration before deleting your account/;
const MULTIPLE_INTEGRATIONS_BLOCK_PATTERN =
	/Remove your 2 integrations before deleting your account/;

describe("getOrCreateSystemUser (via deleteAccount) — R2 regression", () => {
	it("reassigns a deleted user's case to the generic fallback account, not an unrelated system user created first", async () => {
		// Simulates an integration's machine principal: isSystemUser: true,
		// but NOT the generic fallback — and it exists in the DB before the
		// generic fallback account is ever created.
		const decoySystemUser = await createTestUser({
			email: "integration+decoy@tea-platform.internal",
			username: "integration-decoy",
		});
		await prisma.user.update({
			where: { id: decoySystemUser.id },
			data: { isSystemUser: true },
		});

		// OAuth user — deleteAccount skips password verification for non-LOCAL auth.
		const owner = await createTestUser({ authProvider: "GITHUB" });
		const ownedCase = await createTestCase(owner.id, { name: "Owner's case" });

		expectSuccess(await deleteAccount(owner.id));

		const updatedCase = await prisma.assuranceCase.findUniqueOrThrow({
			where: { id: ownedCase.id },
		});

		// Must NOT have been reassigned to the decoy system user.
		expect(updatedCase.createdById).not.toBe(decoySystemUser.id);

		const fallbackUser = await prisma.user.findUnique({
			where: { email: SYSTEM_USER_EMAIL },
		});
		expect(fallbackUser).not.toBeNull();
		expect(fallbackUser?.isSystemUser).toBe(true);
		expect(updatedCase.createdById).toBe(fallbackUser?.id);
	});

	it("reuses the same fallback account across multiple deletions rather than creating duplicates", async () => {
		const ownerA = await createTestUser({ authProvider: "GITHUB" });
		const ownerB = await createTestUser({ authProvider: "GITHUB" });
		const caseA = await createTestCase(ownerA.id, { name: "Case A" });
		const caseB = await createTestCase(ownerB.id, { name: "Case B" });

		expectSuccess(await deleteAccount(ownerA.id));
		expectSuccess(await deleteAccount(ownerB.id));

		const fallbackUsers = await prisma.user.findMany({
			where: { email: SYSTEM_USER_EMAIL },
		});
		expect(fallbackUsers).toHaveLength(1);

		const [updatedCaseA, updatedCaseB] = await Promise.all([
			prisma.assuranceCase.findUniqueOrThrow({ where: { id: caseA.id } }),
			prisma.assuranceCase.findUniqueOrThrow({ where: { id: caseB.id } }),
		]);
		expect(updatedCaseA.createdById).toBe(fallbackUsers[0]?.id);
		expect(updatedCaseB.createdById).toBe(fallbackUsers[0]?.id);
	});
});

/**
 * `deleteAccount` used to hit a raw P2003 from the DB's unconditional
 * `ON DELETE RESTRICT` on `Integration.ownerId` (ADR 0002 v2 §2.4) whenever
 * the deleting user owned any integration — that error was caught by the
 * function's catch-all and flattened into an unhelpful "Failed to delete
 * account". `deleteAccount` now checks `countIntegrationsOwnedBy` FIRST and
 * returns a clean, typed, actionable error instead of ever reaching the
 * transaction.
 */
describe("deleteAccount — owned-integrations block (ADR 0002 v2 §2.4)", () => {
	it("refuses with a clean typed error (not a raw P2003) when the user owns an integration", async () => {
		const owner = await createTestUser({ authProvider: "GITHUB" });
		await createTestIntegrationWithSystemUser(owner.id);

		const result = await deleteAccount(owner.id);

		expectError(result, SINGLE_INTEGRATION_BLOCK_PATTERN);

		// The user must still exist — the transaction was never attempted.
		const stillThere = await prisma.user.findUnique({
			where: { id: owner.id },
		});
		expect(stillThere).not.toBeNull();
	});

	it("pluralises the count for more than one owned integration", async () => {
		const owner = await createTestUser({ authProvider: "GITHUB" });
		await createTestIntegrationWithSystemUser(owner.id);
		await createTestIntegrationWithSystemUser(owner.id);

		const result = await deleteAccount(owner.id);

		expectError(result, MULTIPLE_INTEGRATIONS_BLOCK_PATTERN);
	});

	it("succeeds once the owned integration is reassigned away", async () => {
		const owner = await createTestUser({ authProvider: "GITHUB" });
		const newOwner = await createTestUser();
		const { integration } = await createTestIntegrationWithSystemUser(owner.id);

		expectSuccess(
			await reassignIntegrationOwner(integration.id, newOwner.id, owner.id)
		);

		expectSuccess(await deleteAccount(owner.id));

		const deletedUser = await prisma.user.findUnique({
			where: { id: owner.id },
		});
		expect(deletedUser).toBeNull();
	});

	it("succeeds once the owned integration is deleted outright", async () => {
		const owner = await createTestUser({ authProvider: "GITHUB" });
		const { integration } = await createTestIntegrationWithSystemUser(owner.id);

		await prisma.integration.delete({ where: { id: integration.id } });

		expectSuccess(await deleteAccount(owner.id));
	});

	it("is unaffected by an integration owned by a DIFFERENT user", async () => {
		const owner = await createTestUser({ authProvider: "GITHUB" });
		const otherOwner = await createTestUser();
		await createTestIntegrationWithSystemUser(otherOwner.id);

		expectSuccess(await deleteAccount(owner.id));
	});
});

/**
 * `deleteAccountForRetention` is the password-free counterpart used by the
 * retention sweep (`lib/services/retention-service.ts`) — it shares
 * `deleteAccount`'s cascade without requiring a password.
 */
describe("deleteAccountForRetention", () => {
	it("deletes the user and reassigns their owned case, without a password", async () => {
		const owner = await createTestUser();
		const ownedCase = await createTestCase(owner.id, {
			name: "Retention case",
		});

		expectSuccess(await deleteAccountForRetention(owner.id));

		const deletedUser = await prisma.user.findUnique({
			where: { id: owner.id },
		});
		expect(deletedUser).toBeNull();

		const updatedCase = await prisma.assuranceCase.findUniqueOrThrow({
			where: { id: ownedCase.id },
		});
		expect(updatedCase.createdById).not.toBe(owner.id);
	});

	it("refuses with the same typed error as deleteAccount when the user owns an integration", async () => {
		const owner = await createTestUser();
		await createTestIntegrationWithSystemUser(owner.id);

		const result = await deleteAccountForRetention(owner.id);

		expectError(result, SINGLE_INTEGRATION_BLOCK_PATTERN);

		const stillThere = await prisma.user.findUnique({
			where: { id: owner.id },
		});
		expect(stillThere).not.toBeNull();
	});

	it("returns an error for a non-existent user", async () => {
		expectError(
			await deleteAccountForRetention("00000000-0000-0000-0000-000000000000"),
			"User not found"
		);
	});
});

/**
 * Chris's ruling (2026-09-07): a case the deleted user created is KEPT
 * (authorship reassigned to the system account, as before) only if another
 * principal already holds ADMIN on it — otherwise it is trashed so it
 * disappears for every collaborator too.
 */
describe("deleteAccount — kept vs trashed cases (Chris's deletion rule)", () => {
	it("keeps a case (does not trash it) when another user holds ADMIN via CasePermission", async () => {
		const owner = await createTestUser({ authProvider: "GITHUB" });
		const admin = await createTestUser();
		const testCase = await createTestCase(owner.id, { name: "Co-admin case" });
		await createTestPermission(testCase.id, admin.id, owner.id, "ADMIN");

		expectSuccess(await deleteAccount(owner.id));

		const updatedCase = await prisma.assuranceCase.findUniqueOrThrow({
			where: { id: testCase.id },
		});
		expect(updatedCase.deletedAt).toBeNull();
		expect(updatedCase.createdById).not.toBe(owner.id);
	});

	it("keeps a case when a team holds ADMIN via CaseTeamPermission AND has a member besides the deleted owner", async () => {
		const owner = await createTestUser({ authProvider: "GITHUB" });
		const otherMember = await createTestUser();
		const testCase = await createTestCase(owner.id, {
			name: "Team-admin case (team of two)",
		});
		const team = await createTestTeam(owner.id);
		await addTeamMember(team.id, otherMember.id);
		await createTestTeamPermission(testCase.id, team.id, owner.id, "ADMIN");

		expectSuccess(await deleteAccount(owner.id));

		const updatedCase = await prisma.assuranceCase.findUniqueOrThrow({
			where: { id: testCase.id },
		});
		expect(updatedCase.deletedAt).toBeNull();
	});

	/**
	 * Vincent, review round 2 (blocker): a team-ADMIN grant only counts as
	 * "another admin" if the team has a member other than the deleted user.
	 * A "team of one" IS the deleted user — `createTestTeam` creates exactly
	 * that (the creator as its only member) — and `runAccountDeletionTransaction`
	 * deletes precisely this shape of team, cascading its CaseTeamPermission
	 * away. Without the fix, this case would be marked "kept" but end up
	 * owned by the system account with no permission for anyone: orphaned,
	 * never trashed, never purged.
	 */
	it("trashes a case when the only ADMIN-holding team has no member besides the deleted owner (team of one)", async () => {
		const owner = await createTestUser({ authProvider: "GITHUB" });
		const testCase = await createTestCase(owner.id, {
			name: "Team-admin case (team of one)",
		});
		const team = await createTestTeam(owner.id);
		await createTestTeamPermission(testCase.id, team.id, owner.id, "ADMIN");

		expectSuccess(await deleteAccount(owner.id));

		const updatedCase = await prisma.assuranceCase.findUniqueOrThrow({
			where: { id: testCase.id },
		});
		expect(updatedCase.deletedAt).not.toBeNull();

		// The team-of-one is deleted by the team-handling step, which cascades
		// its CaseTeamPermission away — this is the exact sequence the
		// blocker warned about, so assert the permission is really gone too.
		const teamStillExists = await prisma.team.findUnique({
			where: { id: team.id },
		});
		expect(teamStillExists).toBeNull();
	});

	it("trashes a case when the only other access is VIEW/EDIT/COMMENT, not ADMIN", async () => {
		const owner = await createTestUser({ authProvider: "GITHUB" });
		const editor = await createTestUser();
		const testCase = await createTestCase(owner.id, {
			name: "Collaborator-only case",
		});
		await createTestPermission(testCase.id, editor.id, owner.id, "EDIT");

		expectSuccess(await deleteAccount(owner.id));

		const updatedCase = await prisma.assuranceCase.findUniqueOrThrow({
			where: { id: testCase.id },
		});
		expect(updatedCase.deletedAt).not.toBeNull();
		// Trashed cases are hidden from EVERY viewer, not just the deleted
		// owner — listUserCases/listSharedCases and fetchCaseFromPrisma all
		// filter deletedAt: null unconditionally (verified by reading those
		// services), so the editor loses access exactly like a hard delete
		// would show them, without needing one.
		const { listSharedCases } = await import(
			"@/lib/services/case-fetch-service"
		);
		const shared = expectSuccess(await listSharedCases(editor.id));
		expect(shared.find((c) => c.id === testCase.id)).toBeUndefined();
	});

	it("trashes a case with no collaborators at all", async () => {
		const owner = await createTestUser({ authProvider: "GITHUB" });
		const testCase = await createTestCase(owner.id, { name: "Solo case" });

		expectSuccess(await deleteAccount(owner.id));

		const updatedCase = await prisma.assuranceCase.findUniqueOrThrow({
			where: { id: testCase.id },
		});
		expect(updatedCase.deletedAt).not.toBeNull();
	});
});

/**
 * QA round 1, D1: `CasePermission.grantedById` is a real `ON DELETE
 * RESTRICT` FK with no cascade — deleting a user who had ever granted a
 * permission (on their own case OR someone else's) used to throw P2003,
 * flattened to "Failed to delete account".
 */
describe("deleteAccount — grantedById reassignment (QA round 1, D1)", () => {
	it("succeeds when the user granted a permission on their OWN case", async () => {
		const owner = await createTestUser({ authProvider: "GITHUB" });
		const viewer = await createTestUser();
		const testCase = await createTestCase(owner.id, {
			name: "Shared by owner",
		});
		const permission = await createTestPermission(
			testCase.id,
			viewer.id,
			owner.id,
			"VIEW"
		);

		expectSuccess(await deleteAccount(owner.id));

		const updatedPermission = await prisma.casePermission.findUniqueOrThrow({
			where: { id: permission.id },
		});
		expect(updatedPermission.grantedById).not.toBe(owner.id);
	});

	it("succeeds when the user granted a permission on SOMEONE ELSE'S case (an admin who invited others)", async () => {
		const caseOwner = await createTestUser();
		const admin = await createTestUser({ authProvider: "GITHUB" });
		const viewer = await createTestUser();
		const testCase = await createTestCase(caseOwner.id, {
			name: "Owned by someone else",
		});
		await createTestPermission(testCase.id, admin.id, caseOwner.id, "ADMIN");
		const grantedPermission = await createTestPermission(
			testCase.id,
			viewer.id,
			admin.id,
			"VIEW"
		);

		expectSuccess(await deleteAccount(admin.id));

		const updatedPermission = await prisma.casePermission.findUniqueOrThrow({
			where: { id: grantedPermission.id },
		});
		expect(updatedPermission.grantedById).not.toBe(admin.id);
	});

	it("deleteAccountForRetention succeeds when the user granted a permission on their OWN case (QA round 2, item a)", async () => {
		const owner = await createTestUser();
		const viewer = await createTestUser();
		const testCase = await createTestCase(owner.id, {
			name: "Shared by owner (retention)",
		});
		const permission = await createTestPermission(
			testCase.id,
			viewer.id,
			owner.id,
			"VIEW"
		);

		expectSuccess(await deleteAccountForRetention(owner.id));

		const updatedPermission = await prisma.casePermission.findUniqueOrThrow({
			where: { id: permission.id },
		});
		expect(updatedPermission.grantedById).not.toBe(owner.id);
	});
});
