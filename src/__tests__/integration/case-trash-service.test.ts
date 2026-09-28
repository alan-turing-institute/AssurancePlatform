import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import {
	listArchivedCopies,
	listTrashedCases,
	purgeCase,
	removeArchivedCopy,
	restoreCase,
	softDeleteCase,
} from "@/lib/services/case-trash-service";
import { publishAssuranceCase } from "@/lib/services/publish-service";
import {
	expectError,
	expectSameError,
	expectSuccess,
} from "../utils/assertion-helpers";
import {
	createTestCase,
	createTestCaseWithGoal,
	createTestComment,
	createTestElement,
	createTestPermission,
	createTestUser,
} from "../utils/prisma-factories";
import { holdRowLock } from "../utils/row-lock-test-utils";

const MUST_BE_IN_TRASH_PATTERN = /must be in trash/;

describe("case-trash-service", () => {
	describe("softDeleteCase", () => {
		it("soft-deletes a case (sets deletedAt) for the owner", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id, { name: "To Trash" });

			expectSuccess(await softDeleteCase(user.id, testCase.id));

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

			expectError(
				await softDeleteCase(viewer.id, testCase.id),
				"Permission denied"
			);
		});

		it("returns 'Permission denied' for a non-member", async () => {
			const owner = await createTestUser();
			const outsider = await createTestUser();
			const testCase = await createTestCase(owner.id, {
				name: "Locked Case",
			});

			expectError(
				await softDeleteCase(outsider.id, testCase.id),
				"Permission denied"
			);
		});

		it("returns an error when the case is already in trash", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id, {
				name: "Double Delete",
			});

			await softDeleteCase(user.id, testCase.id);

			expectError(
				await softDeleteCase(user.id, testCase.id),
				"Case is already in trash"
			);
		});

		it("reaches the in-transaction guard, not just the pre-check, when two trashes race", async () => {
			// The test above trashes the case and waits for that call to finish
			// BEFORE starting the second — its pre-transaction read already sees
			// `deletedAt` set, so it never reaches the guarded `updateMany`
			// inside the transaction. This forces a genuine Postgres row-lock
			// wait so the second call's pre-check passes (the row is still
			// untrashed at that point) and its own transaction discovers the
			// trash only when its guarded write blocks, then loses the race.
			const user = await createTestUser();
			const testCase = await createTestCase(user.id, {
				name: "Racing Double Delete",
			});

			const holder = await holdRowLock(async (tx) => {
				await tx.assuranceCase.update({
					where: { id: testCase.id },
					data: { deletedAt: new Date(), deletedById: user.id },
				});
			});

			const secondTrashPromise = softDeleteCase(user.id, testCase.id);
			// `softDeleteCase`'s own pre-check is a plain read, which (unlike
			// the guarded write further in) never blocks on the holder's row
			// lock — it just races the holder's commit. This delay gives it
			// room to run against the pre-trash state, so the race lands
			// where it's meant to: inside the transaction's guarded write.
			await new Promise((resolve) => setTimeout(resolve, 50));
			await holder.release();
			const result = await secondTrashPromise;

			expectError(result, "Case is already in trash");

			const inDb = await prisma.assuranceCase.findUniqueOrThrow({
				where: { id: testCase.id },
			});
			expect(inDb.deletedAt).not.toBeNull();
			expect(inDb.deletedById).toBe(user.id);
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

			const data = expectSuccess(await listTrashedCases(userA.id));
			expect(data.cases).toHaveLength(1);
			expect(data.cases[0]!.id).toBe(caseA.id);
		});

		it("returns an empty list when no cases are trashed", async () => {
			const user = await createTestUser();
			await createTestCase(user.id, { name: "Active Case" });

			const data = expectSuccess(await listTrashedCases(user.id));
			expect(data.cases).toHaveLength(0);
		});

		it("includes daysRemaining in each trashed case entry", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id, {
				name: "Days Remaining",
			});

			await softDeleteCase(user.id, testCase.id);

			const data = expectSuccess(await listTrashedCases(user.id));
			expect(typeof data.cases[0]!.daysRemaining).toBe("number");
			expect(data.cases[0]!.daysRemaining).toBeGreaterThan(0);
		});
	});

	describe("restoreCase", () => {
		it("restores a trashed case (clears deletedAt) for the owner", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id, {
				name: "Restore Me",
			});
			await softDeleteCase(user.id, testCase.id);

			expectSuccess(await restoreCase(user.id, testCase.id));

			const inDb = await prisma.assuranceCase.findUnique({
				where: { id: testCase.id },
			});
			expect(inDb?.deletedAt).toBeNull();
		});

		it("returns 'Case is not in trash' when case is active", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id, { name: "Active" });

			expectError(
				await restoreCase(user.id, testCase.id),
				"Case is not in trash"
			);
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

			expectError(
				await restoreCase(admin.id, testCase.id),
				"Permission denied"
			);
		});
	});

	describe("purgeCase", () => {
		it("permanently deletes a trashed case", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id, { name: "Purge Me" });
			await softDeleteCase(user.id, testCase.id);

			expectSuccess(await purgeCase(user.id, testCase.id));

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
			expectError(result, MUST_BE_IN_TRASH_PATTERN);
		});

		it("returns 'Permission denied' when a non-owner tries to purge", async () => {
			const owner = await createTestUser();
			const otherUser = await createTestUser();
			const testCase = await createTestCase(owner.id, {
				name: "Protected Purge",
			});
			await softDeleteCase(owner.id, testCase.id);

			expectError(
				await purgeCase(otherUser.id, testCase.id),
				"Permission denied"
			);
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
			expectSuccess(await purgeCase(owner.id, testCase.id));

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

		it("cascades deletion to health evidence records — ACCEPTED 1.0 behaviour, not a bug: the append-only log has no independent retention yet (tracked separately in the hardening issue)", async () => {
			const { appendHealthEvidence } = await import(
				"@/lib/services/health-evidence-service"
			);

			const owner = await createTestUser();
			const testCase = await createTestCase(owner.id, {
				name: "Cascade Purge — Health Evidence",
			});
			const claim = await createTestElement(testCase.id, owner.id, {
				elementType: "PROPERTY_CLAIM",
			});

			const appended = expectSuccess(
				await appendHealthEvidence(owner.id, {
					claimId: claim.id,
					metricName: "in-distribution-rate",
					value: 0.98,
					threshold: 0.95,
					verdict: "PASS",
					oddDimensions: [],
					sourceSystem: "darter-pipeline",
					provenance: { check: "ood-monitor/kl-divergence", runId: "run-1" },
					evaluatedAt: new Date().toISOString(),
				})
			);

			await softDeleteCase(owner.id, testCase.id);
			expectSuccess(await purgeCase(owner.id, testCase.id));

			const evidenceInDb = await prisma.pluginHealthEvidence.findUnique({
				where: { id: appended.evidence.id },
			});
			expect(evidenceInDb).toBeNull();
		});
	});

	describe("anti-enumeration: consistent error responses", () => {
		it("softDeleteCase returns the same error for a non-existent case as for an inaccessible case", async () => {
			const owner = await createTestUser();
			const outsider = await createTestUser();
			const testCase = await createTestCase(owner.id, {
				name: "Anti-Enum Case",
			});

			// Outsider tries to delete a case they have no access to
			const noAccessResult = await softDeleteCase(outsider.id, testCase.id);

			// Outsider tries to delete a non-existent case
			const notFoundResult = await softDeleteCase(
				outsider.id,
				"00000000-0000-0000-0000-000000000000"
			);

			expectSameError(noAccessResult, notFoundResult);
		});

		it("restoreCase returns the same error for a non-existent case as for a case the user does not own", async () => {
			const owner = await createTestUser();
			const other = await createTestUser();
			const testCase = await createTestCase(owner.id, {
				name: "Restore Anti-Enum Case",
			});
			// Trash it so restoreCase does not fail on "not in trash" for owner's case
			await softDeleteCase(owner.id, testCase.id);

			// Other user tries to restore a case they do not own (it is in trash)
			const noAccessResult = await restoreCase(other.id, testCase.id);

			// Other user tries to restore a non-existent case
			const notFoundResult = await restoreCase(
				other.id,
				"00000000-0000-0000-0000-000000000000"
			);

			expectSameError(noAccessResult, notFoundResult);
		});
	});

	describe("cross-service behaviour", () => {
		it("trashed cases are not returned by fetchCaseFromPrisma", async () => {
			const user = await createTestUser();
			const testCase = await createTestCase(user.id, {
				name: "Hidden Trashed Case",
			});
			await softDeleteCase(user.id, testCase.id);

			const { fetchCaseFromPrisma } = await import(
				"@/lib/services/case-fetch-service"
			);

			expectError(await fetchCaseFromPrisma(testCase.id, user.id));
		});
	});

	// ============================================
	// softDeleteCase — published-copy choice
	// ============================================

	describe("softDeleteCase — published-copy choice", () => {
		it("removes the published copy by default when trashing a published case", async () => {
			const owner = await createTestUser();
			const testCase = await createTestCaseWithGoal(owner.id, "Remove Me");
			await publishAssuranceCase(owner.id, testCase.id);

			expectSuccess(await softDeleteCase(owner.id, testCase.id));

			const remaining = await prisma.publishedAssuranceCase.findMany({
				where: { assuranceCaseId: testCase.id },
			});
			expect(remaining).toHaveLength(0);

			const updatedCase = await prisma.assuranceCase.findUniqueOrThrow({
				where: { id: testCase.id },
			});
			expect(updatedCase.published).toBe(false);
			expect(updatedCase.publishStatus).toBe("DRAFT");
		});

		it("archives the published copy, owned by the case's creator, when asked to", async () => {
			const owner = await createTestUser();
			const testCase = await createTestCaseWithGoal(owner.id, "Archive Me");
			const published = expectSuccess(
				await publishAssuranceCase(owner.id, testCase.id)
			);

			expectSuccess(
				await softDeleteCase(owner.id, testCase.id, {
					publishedCopy: "archive",
				})
			);

			const archived = await prisma.publishedAssuranceCase.findUniqueOrThrow({
				where: { id: published.publishedId },
			});
			expect(archived.archivedAt).not.toBeNull();
			expect(archived.archivedOwnerId).toBe(owner.id);
			expect(archived.isCurrent).toBe(true);

			// Publish fields on the case are left as they were — a restore finds
			// the case still PUBLISHED.
			const updatedCase = await prisma.assuranceCase.findUniqueOrThrow({
				where: { id: testCase.id },
			});
			expect(updatedCase.published).toBe(true);
			expect(updatedCase.publishStatus).toBe("PUBLISHED");
		});

		it("archives the copy under the case's OWNER, not an Admin collaborator who does the deleting", async () => {
			const owner = await createTestUser();
			const admin = await createTestUser();
			const testCase = await createTestCaseWithGoal(
				owner.id,
				"Collaborator Case"
			);
			await createTestPermission(testCase.id, admin.id, owner.id, "ADMIN");
			const published = expectSuccess(
				await publishAssuranceCase(owner.id, testCase.id)
			);

			expectSuccess(
				await softDeleteCase(admin.id, testCase.id, {
					publishedCopy: "archive",
				})
			);

			const archived = await prisma.publishedAssuranceCase.findUniqueOrThrow({
				where: { id: published.publishedId },
			});
			expect(archived.archivedOwnerId).toBe(owner.id);
		});

		it("keeps only the current version, deleting superseded ones, when archiving", async () => {
			const owner = await createTestUser();
			const testCase = await createTestCaseWithGoal(owner.id, "Multi-Version");
			await publishAssuranceCase(owner.id, testCase.id);
			const { updatePublishedCase } = await import(
				"@/lib/services/publish-service"
			);
			const republished = expectSuccess(
				await updatePublishedCase(owner.id, testCase.id, "Second release")
			);

			expectSuccess(
				await softDeleteCase(owner.id, testCase.id, {
					publishedCopy: "archive",
				})
			);

			const remaining = await prisma.publishedAssuranceCase.findMany({
				where: { assuranceCaseId: testCase.id },
			});
			expect(remaining).toHaveLength(1);
			expect(remaining[0]!.id).toBe(republished.publishedId);
		});
	});

	// ============================================
	// restoreCase — archived copies
	// ============================================

	describe("restoreCase — archived copies", () => {
		it("un-archives the case's archived copy, making it live again", async () => {
			const owner = await createTestUser();
			const testCase = await createTestCaseWithGoal(
				owner.id,
				"Restore Archived"
			);
			const published = expectSuccess(
				await publishAssuranceCase(owner.id, testCase.id)
			);
			await softDeleteCase(owner.id, testCase.id, { publishedCopy: "archive" });

			expectSuccess(await restoreCase(owner.id, testCase.id));

			const restored = await prisma.publishedAssuranceCase.findUniqueOrThrow({
				where: { id: published.publishedId },
			});
			expect(restored.archivedAt).toBeNull();
			expect(restored.archivedOwnerId).toBeNull();
		});

		it("gives a draft when restoring a case whose published copy was removed (not archived)", async () => {
			const owner = await createTestUser();
			const testCase = await createTestCaseWithGoal(
				owner.id,
				"Restore Removed"
			);
			await publishAssuranceCase(owner.id, testCase.id);
			await softDeleteCase(owner.id, testCase.id);

			expectSuccess(await restoreCase(owner.id, testCase.id));

			const updatedCase = await prisma.assuranceCase.findUniqueOrThrow({
				where: { id: testCase.id },
			});
			expect(updatedCase.published).toBe(false);
			expect(updatedCase.publishStatus).toBe("DRAFT");
		});
	});

	// ============================================
	// purgeCase — with an archived copy: a case in Trash has either no
	// published copy, or exactly one archived copy, and nothing else
	// ============================================

	describe("purgeCase — with an archived copy", () => {
		it("succeeds and leaves the archived copy public", async () => {
			const owner = await createTestUser();
			const testCase = await createTestCaseWithGoal(
				owner.id,
				"Purge With Archive"
			);
			const published = expectSuccess(
				await publishAssuranceCase(owner.id, testCase.id)
			);
			await softDeleteCase(owner.id, testCase.id, { publishedCopy: "archive" });

			expectSuccess(await purgeCase(owner.id, testCase.id));

			const caseInDb = await prisma.assuranceCase.findUnique({
				where: { id: testCase.id },
			});
			expect(caseInDb).toBeNull();

			const archived = await prisma.publishedAssuranceCase.findUniqueOrThrow({
				where: { id: published.publishedId },
			});
			expect(archived.assuranceCaseId).toBeNull();
			expect(archived.isCurrent).toBe(true);
			expect(archived.archivedAt).not.toBeNull();
		});
	});

	// ============================================
	// listArchivedCopies / removeArchivedCopy
	// ============================================

	describe("listArchivedCopies", () => {
		it("returns only the caller's own archived copies", async () => {
			const userA = await createTestUser();
			const userB = await createTestUser();
			const caseA = await createTestCaseWithGoal(userA.id, "A's Case");
			const caseB = await createTestCaseWithGoal(userB.id, "B's Case");
			await publishAssuranceCase(userA.id, caseA.id);
			await publishAssuranceCase(userB.id, caseB.id);
			await softDeleteCase(userA.id, caseA.id, { publishedCopy: "archive" });
			await softDeleteCase(userB.id, caseB.id, { publishedCopy: "archive" });

			const data = expectSuccess(await listArchivedCopies(userA.id));
			expect(data).toHaveLength(1);
			expect(data[0]!.title).toBe("A's Case");
		});

		it("includes a copy whose case has since been permanently deleted", async () => {
			const owner = await createTestUser();
			const testCase = await createTestCaseWithGoal(owner.id, "Gone Case");
			await publishAssuranceCase(owner.id, testCase.id);
			await softDeleteCase(owner.id, testCase.id, { publishedCopy: "archive" });
			await purgeCase(owner.id, testCase.id);

			const data = expectSuccess(await listArchivedCopies(owner.id));
			expect(data).toHaveLength(1);
			expect(data[0]!.title).toBe("Gone Case");
		});
	});

	describe("removeArchivedCopy", () => {
		it("removes the owner's own archived copy", async () => {
			const owner = await createTestUser();
			const testCase = await createTestCaseWithGoal(
				owner.id,
				"Removable Archive"
			);
			const published = expectSuccess(
				await publishAssuranceCase(owner.id, testCase.id)
			);
			await softDeleteCase(owner.id, testCase.id, { publishedCopy: "archive" });

			expectSuccess(await removeArchivedCopy(owner.id, published.publishedId));

			const inDb = await prisma.publishedAssuranceCase.findUnique({
				where: { id: published.publishedId },
			});
			expect(inDb).toBeNull();
		});

		it("removes an archived copy whose case has already been permanently deleted", async () => {
			const owner = await createTestUser();
			const testCase = await createTestCaseWithGoal(
				owner.id,
				"Gone Before Removal"
			);
			const published = expectSuccess(
				await publishAssuranceCase(owner.id, testCase.id)
			);
			await softDeleteCase(owner.id, testCase.id, { publishedCopy: "archive" });
			await purgeCase(owner.id, testCase.id);

			const before = await prisma.publishedAssuranceCase.findUniqueOrThrow({
				where: { id: published.publishedId },
			});
			expect(before.assuranceCaseId).toBeNull();

			expectSuccess(await removeArchivedCopy(owner.id, published.publishedId));

			const gone = await prisma.publishedAssuranceCase.findUnique({
				where: { id: published.publishedId },
			});
			expect(gone).toBeNull();
		});

		it("resets the still-trashed case's publish fields to draft after its archived copy is removed", async () => {
			const owner = await createTestUser();
			const testCase = await createTestCaseWithGoal(
				owner.id,
				"Draft After Removal"
			);
			const published = expectSuccess(
				await publishAssuranceCase(owner.id, testCase.id)
			);
			await softDeleteCase(owner.id, testCase.id, { publishedCopy: "archive" });

			expectSuccess(await removeArchivedCopy(owner.id, published.publishedId));

			const updatedCase = await prisma.assuranceCase.findUniqueOrThrow({
				where: { id: testCase.id },
			});
			expect(updatedCase.published).toBe(false);
			expect(updatedCase.publishStatus).toBe("DRAFT");
		});

		it("returns the same error for someone else's archived copy as for a missing id", async () => {
			const owner = await createTestUser();
			const stranger = await createTestUser();
			const testCase = await createTestCaseWithGoal(owner.id, "Someone Else's");
			const published = expectSuccess(
				await publishAssuranceCase(owner.id, testCase.id)
			);
			await softDeleteCase(owner.id, testCase.id, { publishedCopy: "archive" });

			const notOwnedResult = await removeArchivedCopy(
				stranger.id,
				published.publishedId
			);
			const missingResult = await removeArchivedCopy(
				stranger.id,
				"00000000-0000-0000-0000-000000000000"
			);

			expectSameError(notOwnedResult, missingResult);

			// The copy itself is untouched by the failed attempt.
			const stillThere = await prisma.publishedAssuranceCase.findUnique({
				where: { id: published.publishedId },
			});
			expect(stillThere).not.toBeNull();
		});

		it("survives a copy restored (un-archived) between the caller's read and the removal", async () => {
			const owner = await createTestUser();
			const testCase = await createTestCaseWithGoal(
				owner.id,
				"Restored Mid-Removal"
			);
			const published = expectSuccess(
				await publishAssuranceCase(owner.id, testCase.id)
			);
			await softDeleteCase(owner.id, testCase.id, { publishedCopy: "archive" });

			// Holds the published row's lock with an uncommitted restore —
			// exactly what `restoreCase` does to the same two columns — so the
			// removal call below has already read the row as archived by the
			// time this commits underneath it.
			const holder = await holdRowLock(async (tx) => {
				await tx.publishedAssuranceCase.update({
					where: { id: published.publishedId },
					data: { archivedAt: null, archivedOwnerId: null },
				});
			});

			const removalPromise = removeArchivedCopy(
				owner.id,
				published.publishedId
			);
			await holder.release();
			const result = await removalPromise;

			expectError(result);
			const stillLive = await prisma.publishedAssuranceCase.findUniqueOrThrow({
				where: { id: published.publishedId },
			});
			expect(stillLive.archivedAt).toBeNull();
			expect(stillLive.archivedOwnerId).toBeNull();
			expect(stillLive.isCurrent).toBe(true);
		});
	});
});
