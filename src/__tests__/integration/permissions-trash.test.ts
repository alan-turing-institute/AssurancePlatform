import { describe, expect, it } from "vitest";
import { canAccessCase, getCasePermission } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import { shareByEmail } from "@/lib/services/case-permission-service";
import { softDeleteCase } from "@/lib/services/case-trash-service";
import { expectError, expectSuccess } from "../utils/assertion-helpers";
import {
	addTeamMember,
	createTestCase,
	createTestPermission,
	createTestTeam,
	createTestTeamPermission,
	createTestUser,
} from "../utils/prisma-factories";

async function trashCase(caseId: string): Promise<void> {
	await prisma.assuranceCase.update({
		where: { id: caseId },
		data: { deletedAt: new Date() },
	});
}

describe("canAccessCase / getCasePermission — trashed cases", () => {
	describe("default behaviour (trash invisible)", () => {
		it("denies the creator (implicit ADMIN) once the case is trashed", async () => {
			const owner = await createTestUser();
			const testCase = await createTestCase(owner.id);
			await trashCase(testCase.id);

			expect(
				await canAccessCase({ userId: owner.id, caseId: testCase.id })
			).toBe(false);
			const result = await getCasePermission({
				userId: owner.id,
				caseId: testCase.id,
			});
			expect(result).toEqual({
				hasAccess: false,
				permission: null,
				isOwner: false,
			});
		});

		it("denies a direct EDIT grantee once the case is trashed", async () => {
			const owner = await createTestUser();
			const editor = await createTestUser();
			const testCase = await createTestCase(owner.id);
			await createTestPermission(testCase.id, editor.id, owner.id, "EDIT");
			await trashCase(testCase.id);

			expect(
				await canAccessCase({ userId: editor.id, caseId: testCase.id }, "VIEW")
			).toBe(false);
		});

		it("denies a direct VIEW grantee once the case is trashed", async () => {
			const owner = await createTestUser();
			const viewer = await createTestUser();
			const testCase = await createTestCase(owner.id);
			await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");
			await trashCase(testCase.id);

			expect(
				await canAccessCase({ userId: viewer.id, caseId: testCase.id }, "VIEW")
			).toBe(false);
		});

		it("denies a direct COMMENT grantee once the case is trashed", async () => {
			const owner = await createTestUser();
			const commenter = await createTestUser();
			const testCase = await createTestCase(owner.id);
			await createTestPermission(
				testCase.id,
				commenter.id,
				owner.id,
				"COMMENT"
			);
			await trashCase(testCase.id);

			expect(
				await canAccessCase(
					{ userId: commenter.id, caseId: testCase.id },
					"VIEW"
				)
			).toBe(false);
		});

		it("denies a team-grant member once the case is trashed", async () => {
			const owner = await createTestUser();
			const teamAdmin = await createTestUser();
			const teamMember = await createTestUser();
			const testCase = await createTestCase(owner.id);
			const team = await createTestTeam(teamAdmin.id);
			await addTeamMember(team.id, teamMember.id);
			await createTestTeamPermission(testCase.id, team.id, owner.id, "EDIT");
			await trashCase(testCase.id);

			expect(
				await canAccessCase(
					{ userId: teamMember.id, caseId: testCase.id },
					"VIEW"
				)
			).toBe(false);
		});

		it("denies a user with no permission on a trashed case (same as before)", async () => {
			const owner = await createTestUser();
			const stranger = await createTestUser();
			const testCase = await createTestCase(owner.id);
			await trashCase(testCase.id);

			expect(
				await canAccessCase({ userId: stranger.id, caseId: testCase.id })
			).toBe(false);
		});

		it("gives the same response shape for a trashed case as for a non-existent case", async () => {
			const owner = await createTestUser();
			const testCase = await createTestCase(owner.id);
			await trashCase(testCase.id);

			const trashedResult = await getCasePermission({
				userId: owner.id,
				caseId: testCase.id,
			});
			const missingResult = await getCasePermission({
				userId: owner.id,
				caseId: "00000000-0000-0000-0000-000000000000",
			});
			expect(trashedResult).toEqual(missingResult);
		});
	});

	describe("includeTrashed: true (opt-in, full permission logic still applies)", () => {
		it("restores implicit ADMIN for the creator on a trashed case", async () => {
			const owner = await createTestUser();
			const testCase = await createTestCase(owner.id);
			await trashCase(testCase.id);

			const result = await getCasePermission(
				{ userId: owner.id, caseId: testCase.id },
				{ includeTrashed: true }
			);
			expect(result).toEqual({
				hasAccess: true,
				permission: "ADMIN",
				isOwner: true,
			});
			expect(
				await canAccessCase(
					{ userId: owner.id, caseId: testCase.id },
					"ADMIN",
					{ includeTrashed: true }
				)
			).toBe(true);
		});

		it("restores a grantee's own level on a trashed case", async () => {
			const owner = await createTestUser();
			const editor = await createTestUser();
			const testCase = await createTestCase(owner.id);
			await createTestPermission(testCase.id, editor.id, owner.id, "EDIT");
			await trashCase(testCase.id);

			expect(
				await canAccessCase(
					{ userId: editor.id, caseId: testCase.id },
					"EDIT",
					{ includeTrashed: true }
				)
			).toBe(true);
			expect(
				await canAccessCase(
					{ userId: editor.id, caseId: testCase.id },
					"ADMIN",
					{ includeTrashed: true }
				)
			).toBe(false);
		});

		it("still denies a stranger on a trashed case", async () => {
			const owner = await createTestUser();
			const stranger = await createTestUser();
			const testCase = await createTestCase(owner.id);
			await trashCase(testCase.id);

			expect(
				await canAccessCase(
					{ userId: stranger.id, caseId: testCase.id },
					"VIEW",
					{ includeTrashed: true }
				)
			).toBe(false);
		});
	});
});

describe("regression — granting new case access on trashed case is refused", () => {
	it("shareByEmail (ADMIN check via canAccessCase) refuses to grant on a trashed case", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await trashCase(testCase.id);

		expectError(
			await shareByEmail(owner.id, testCase.id, {
				email: "someone@example.com",
				permission: "VIEW",
			}),
			"Permission denied"
		);
	});
});

describe("softDeleteCase — already-trashed case still reports its own error", () => {
	it("returns 'Case is already in trash' to the ADMIN holder", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);

		expectSuccess(await softDeleteCase(owner.id, testCase.id));
		expectError(
			await softDeleteCase(owner.id, testCase.id),
			"Case is already in trash"
		);
	});
});
