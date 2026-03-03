import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import {
	listTrashedCases,
	purgeCase,
	restoreCase,
	softDeleteCase,
} from "@/lib/services/case-trash-service";
import {
	createTestCase,
	createTestComment,
	createTestElement,
	createTestPermission,
	createTestUser,
} from "../utils/prisma-factories";

describe("case-trash-service", () => {
	describe("softDeleteCase", () => {
		it("soft-deletes a case (sets deletedAt) for the owner", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id, { name: "To Trash" });

			const result = await softDeleteCase(user.id, testCase.id);

			expect("error" in result).toBe(false);

			const inDb = await prisma.assuranceCase.findUnique({
				where: { id: testCase.id },
			});
			expect(inDb?.deletedAt).not.toBeNull();
		});

		it("returns 'Permission denied' for a VIEW-only user", async () => {
			const owner = await createTestUser();
			const viewer = await createTestUser();
			const testCase = await createTestCase(owner.id, {
				name: "Protected Case",
			});
			await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");

			const result = await softDeleteCase(viewer.id, testCase.id);

			expect("error" in result).toBe(true);
			if (!("error" in result)) {
				return;
			}
			expect(result.error).toBe("Permission denied");
		});

		it("returns 'Permission denied' for a non-member", async () => {
			const owner = await createTestUser();
			const outsider = await createTestUser();
			const testCase = await createTestCase(owner.id, {
				name: "Locked Case",
			});

			const result = await softDeleteCase(outsider.id, testCase.id);

			expect("error" in result).toBe(true);
			if (!("error" in result)) {
				return;
			}
			expect(result.error).toBe("Permission denied");
		});

		it("returns an error when the case is already in trash", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id, {
				name: "Double Delete",
			});

			await softDeleteCase(user.id, testCase.id);

			const second = await softDeleteCase(user.id, testCase.id);

			expect("error" in second).toBe(true);
			if (!("error" in second)) {
				return;
			}
			expect(second.error).toBe("Case is already in trash");
		});
	});

	describe("listTrashedCases", () => {
		it("returns only the owner's trashed cases", async () => {
			const userA = await createTestUser();
			const userB = await createTestUser();
			const caseA = await createTestCase(userA.id, { name: "User A Trash" });
			const caseB = await createTestCase(userB.id, { name: "User B Trash" });

			await softDeleteCase(userA.id, caseA.id);
			await softDeleteCase(userB.id, caseB.id);

			const result = await listTrashedCases(userA.id);

			expect("error" in result).toBe(false);
			if ("error" in result) {
				return;
			}
			expect(result.data.cases).toHaveLength(1);
			expect(result.data.cases[0]!.id).toBe(caseA.id);
		});

		it("returns an empty list when no cases are trashed", async () => {
			const user = await createTestUser();
			await createTestCase(user.id, { name: "Active Case" });

			const result = await listTrashedCases(user.id);

			expect("error" in result).toBe(false);
			if ("error" in result) {
				return;
			}
			expect(result.data.cases).toHaveLength(0);
		});

		it("includes daysRemaining in each trashed case entry", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id, {
				name: "Days Remaining",
			});

			await softDeleteCase(user.id, testCase.id);

			const result = await listTrashedCases(user.id);

			expect("error" in result).toBe(false);
			if ("error" in result) {
				return;
			}
			expect(typeof result.data.cases[0]!.daysRemaining).toBe("number");
			expect(result.data.cases[0]!.daysRemaining).toBeGreaterThan(0);
		});
	});

	describe("restoreCase", () => {
		it("restores a trashed case (clears deletedAt) for the owner", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id, {
				name: "Restore Me",
			});
			await softDeleteCase(user.id, testCase.id);

			const result = await restoreCase(user.id, testCase.id);

			expect("error" in result).toBe(false);

			const inDb = await prisma.assuranceCase.findUnique({
				where: { id: testCase.id },
			});
			expect(inDb?.deletedAt).toBeNull();
		});

		it("returns 'Case is not in trash' when case is active", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id, { name: "Active" });

			const result = await restoreCase(user.id, testCase.id);

			expect("error" in result).toBe(true);
			if (!("error" in result)) {
				return;
			}
			expect(result.error).toBe("Case is not in trash");
		});

		it("returns 'Permission denied' when a non-owner tries to restore", async () => {
			const owner = await createTestUser();
			const admin = await createTestUser();
			const testCase = await createTestCase(owner.id, {
				name: "Owner Only Restore",
			});

			// Grant admin permission — should still be insufficient for restore
			await createTestPermission(testCase.id, admin.id, owner.id, "ADMIN");
			await softDeleteCase(owner.id, testCase.id);

			const result = await restoreCase(admin.id, testCase.id);

			expect("error" in result).toBe(true);
			if (!("error" in result)) {
				return;
			}
			expect(result.error).toBe("Permission denied");
		});
	});

	describe("purgeCase", () => {
		it("permanently deletes a trashed case", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id, { name: "Purge Me" });
			await softDeleteCase(user.id, testCase.id);

			const result = await purgeCase(user.id, testCase.id);

			expect("error" in result).toBe(false);

			const inDb = await prisma.assuranceCase.findUnique({
				where: { id: testCase.id },
			});
			expect(inDb).toBeNull();
		});

		it("returns an error when the case is not in trash", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id, {
				name: "Active Purge",
			});

			const result = await purgeCase(user.id, testCase.id);

			expect("error" in result).toBe(true);
			if (!("error" in result)) {
				return;
			}
			expect(result.error).toContain("must be in trash");
		});

		it("returns 'Permission denied' when a non-owner tries to purge", async () => {
			const owner = await createTestUser();
			const otherUser = await createTestUser();
			const testCase = await createTestCase(owner.id, {
				name: "Protected Purge",
			});
			await softDeleteCase(owner.id, testCase.id);

			const result = await purgeCase(otherUser.id, testCase.id);

			expect("error" in result).toBe(true);
			if (!("error" in result)) {
				return;
			}
			expect(result.error).toBe("Permission denied");
		});

		it("cascades deletion to child elements, permissions, and comments", async () => {
			const owner = await createTestUser();
			const collaborator = await createTestUser();
			const testCase = await createTestCase(owner.id, {
				name: "Cascade Purge",
			});

			// Create child data
			const element = await createTestElement(testCase.id, owner.id);
			const permission = await createTestPermission(
				testCase.id,
				collaborator.id,
				owner.id,
				"VIEW"
			);
			const comment = await createTestComment(owner.id, {
				caseId: testCase.id,
			});

			// Soft-delete then purge
			await softDeleteCase(owner.id, testCase.id);
			const result = await purgeCase(owner.id, testCase.id);

			expect("error" in result).toBe(false);

			// Case is gone
			const caseInDb = await prisma.assuranceCase.findUnique({
				where: { id: testCase.id },
			});
			expect(caseInDb).toBeNull();

			// Child element is gone (cascade)
			const elementInDb = await prisma.assuranceElement.findUnique({
				where: { id: element.id },
			});
			expect(elementInDb).toBeNull();

			// Permission record is gone (cascade)
			const permissionInDb = await prisma.casePermission.findUnique({
				where: { id: permission.id },
			});
			expect(permissionInDb).toBeNull();

			// Comment is gone (cascade)
			const commentInDb = await prisma.comment.findUnique({
				where: { id: comment.id },
			});
			expect(commentInDb).toBeNull();
		});
	});

	describe("cross-service behaviour", () => {
		it("trashed cases are not returned by fetchCaseFromPrisma", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id, {
				name: "Hidden Trashed Case",
			});
			await softDeleteCase(user.id, testCase.id);

			const { AppError } = await import("@/lib/errors");
			const { fetchCaseFromPrisma } = await import(
				"@/lib/services/case-fetch-service"
			);

			await expect(
				fetchCaseFromPrisma(testCase.id, user.id)
			).rejects.toBeInstanceOf(AppError);
		});
	});
});
