import { describe, expect, it, vi } from "vitest";
import type { ValidatedSession } from "@/lib/auth/validate-session";
import prisma from "@/lib/prisma";
import {
	listArchivedCopies,
	purgeExpiredCases,
	removeArchivedCopy,
	restoreCase,
	softDeleteCase,
} from "@/lib/services/case-trash-service";
import {
	publishAssuranceCase,
	updatePublishedCase,
} from "@/lib/services/publish-service";
import { deleteAccount } from "@/lib/services/user-management-service";
import {
	expectError,
	expectSameError,
	expectSuccess,
} from "../utils/assertion-helpers";
import {
	createTestCase,
	createTestCaseWithGoal,
	createTestPermission,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * Adversarial coverage for the published-copy choice made when trashing a
 * published case: no orphan row is left behind by a refused publish or
 * republish, an Admin collaborator who archives cannot become the copy's
 * remover, the daily batch purge (`purgeExpiredCases`) handles a mix of
 * archived-copy and ordinary cases correctly, a restore after the archived
 * copy has already been individually removed still succeeds, a kept
 * account-deletion case's publication is left completely untouched, and the
 * DELETE route's own `archive` query-param parsing is exercised.
 */

const CRON_SECRET = "test-cron-secret";

// ============================================
// A refused publish/republish leaves no new row
// ============================================

describe("publish-versus-trash overlap — no orphan row on refusal", () => {
	it("creates no PublishedAssuranceCase row when first-publish of a trashed case is refused", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id, "Trashed Draft");
		await softDeleteCase(owner.id, testCase.id);

		expectError(await publishAssuranceCase(owner.id, testCase.id));

		const rows = await prisma.publishedAssuranceCase.findMany({
			where: { assuranceCaseId: testCase.id },
		});
		expect(rows).toHaveLength(0);
	});

	it("leaves the existing archived row untouched when republish of a trashed, archived case is refused", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id, "Trashed Archived");
		const published = expectSuccess(
			await publishAssuranceCase(owner.id, testCase.id)
		);
		await softDeleteCase(owner.id, testCase.id, { publishedCopy: "archive" });

		expectError(
			await updatePublishedCase(owner.id, testCase.id, "Should not land")
		);

		const rows = await prisma.publishedAssuranceCase.findMany({
			where: { assuranceCaseId: testCase.id },
		});
		expect(rows).toHaveLength(1);
		expect(rows[0]!.id).toBe(published.publishedId);
		expect(rows[0]!.archivedAt).not.toBeNull();
		expect(rows[0]!.isCurrent).toBe(true);
	});
});

// ============================================
// An Admin collaborator who archives cannot remove the copy
// ============================================

describe("removeArchivedCopy — the archiving Admin collaborator holds no remover right", () => {
	it("refuses the collaborator who trashed the case; the owner still succeeds", async () => {
		const owner = await createTestUser();
		const admin = await createTestUser();
		const testCase = await createTestCaseWithGoal(
			owner.id,
			"Collaborator Trash"
		);
		await createTestPermission(testCase.id, admin.id, owner.id, "ADMIN");
		const published = expectSuccess(
			await publishAssuranceCase(owner.id, testCase.id)
		);

		expectSuccess(
			await softDeleteCase(admin.id, testCase.id, { publishedCopy: "archive" })
		);

		const adminAttempt = await removeArchivedCopy(
			admin.id,
			published.publishedId
		);
		const missingAttempt = await removeArchivedCopy(
			admin.id,
			"00000000-0000-0000-0000-000000000000"
		);
		expectSameError(adminAttempt, missingAttempt);

		// The row survives the collaborator's failed attempt, and the true
		// owner can still remove it.
		expectSuccess(await removeArchivedCopy(owner.id, published.publishedId));
		const gone = await prisma.publishedAssuranceCase.findUnique({
			where: { id: published.publishedId },
		});
		expect(gone).toBeNull();
	});
});

// ============================================
// purgeExpiredCases — the daily batch purge
// ============================================

describe("purgeExpiredCases — batch purge with a mix of archived-copy and ordinary cases", () => {
	async function backdateDeletion(caseId: string, daysAgo: number) {
		const deletedAt = new Date();
		deletedAt.setDate(deletedAt.getDate() - daysAgo);
		await prisma.assuranceCase.update({
			where: { id: caseId },
			data: { deletedAt },
		});
	}

	it("purges a single expired case with an archived copy, and the copy stays public", async () => {
		vi.stubEnv("CRON_SECRET", CRON_SECRET);
		try {
			const owner = await createTestUser();
			const testCase = await createTestCaseWithGoal(
				owner.id,
				"Expired Archived"
			);
			const published = expectSuccess(
				await publishAssuranceCase(owner.id, testCase.id)
			);
			await softDeleteCase(owner.id, testCase.id, { publishedCopy: "archive" });
			await backdateDeletion(testCase.id, 31);

			const result = expectSuccess(await purgeExpiredCases(CRON_SECRET));
			expect(result.purgedCount).toBe(1);

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
		} finally {
			vi.unstubAllEnvs();
		}
	});

	it("purges expired archived-copy AND ordinary cases together, leaving a non-expired case untouched", async () => {
		vi.stubEnv("CRON_SECRET", CRON_SECRET);
		try {
			const owner = await createTestUser();

			// 1. Expired, published, archived at trash time.
			const archivedCase = await createTestCaseWithGoal(
				owner.id,
				"Batch Expired Archived"
			);
			const archivedPublished = expectSuccess(
				await publishAssuranceCase(owner.id, archivedCase.id)
			);
			await softDeleteCase(owner.id, archivedCase.id, {
				publishedCopy: "archive",
			});
			await backdateDeletion(archivedCase.id, 45);

			// 2. Expired, never published — an ordinary trashed case.
			const ordinaryCase = await createTestCase(owner.id, {
				name: "Batch Expired Ordinary",
			});
			await softDeleteCase(owner.id, ordinaryCase.id);
			await backdateDeletion(ordinaryCase.id, 40);

			// 3. Trashed, but well inside the 30-day retention window — must
			// survive the sweep.
			const freshCase = await createTestCase(owner.id, {
				name: "Batch Fresh Trash",
			});
			await softDeleteCase(owner.id, freshCase.id);
			await backdateDeletion(freshCase.id, 2);

			const result = expectSuccess(await purgeExpiredCases(CRON_SECRET));
			expect(result.purgedCount).toBe(2);

			const [archivedGone, ordinaryGone, freshStillThere] = await Promise.all([
				prisma.assuranceCase.findUnique({ where: { id: archivedCase.id } }),
				prisma.assuranceCase.findUnique({ where: { id: ordinaryCase.id } }),
				prisma.assuranceCase.findUnique({ where: { id: freshCase.id } }),
			]);
			expect(archivedGone).toBeNull();
			expect(ordinaryGone).toBeNull();
			expect(freshStillThere).not.toBeNull();

			const stillPublic = await prisma.publishedAssuranceCase.findUniqueOrThrow(
				{ where: { id: archivedPublished.publishedId } }
			);
			expect(stillPublic.assuranceCaseId).toBeNull();
			expect(stillPublic.archivedAt).not.toBeNull();
		} finally {
			vi.unstubAllEnvs();
		}
	});
});

// ============================================
// Restore after the archived copy was individually removed
// ============================================

describe("restoreCase — after the archived copy was removed via removeArchivedCopy (not at trash time)", () => {
	it("restores the case as a draft, with no error, once its archived copy has already been taken down", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(
			owner.id,
			"Archive Then Remove"
		);
		const published = expectSuccess(
			await publishAssuranceCase(owner.id, testCase.id)
		);
		await softDeleteCase(owner.id, testCase.id, { publishedCopy: "archive" });
		expectSuccess(await removeArchivedCopy(owner.id, published.publishedId));

		expectSuccess(await restoreCase(owner.id, testCase.id));

		const restored = await prisma.assuranceCase.findUniqueOrThrow({
			where: { id: testCase.id },
		});
		expect(restored.deletedAt).toBeNull();
		expect(restored.published).toBe(false);
		expect(restored.publishStatus).toBe("DRAFT");
	});
});

// ============================================
// Account deletion — the kept case's publication is left COMPLETELY
// untouched, and nobody can remove the ownerless archived copy afterwards
// ============================================

describe("deleteAccount — kept case's publication is untouched; the ownerless archived copy is unremovable by anyone", () => {
	it("leaves a kept case's publish fields, current row and slug exactly as they were", async () => {
		const owner = await createTestUser({ authProvider: "GITHUB" });
		const admin = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id, "Kept Untouched");
		await createTestPermission(testCase.id, admin.id, owner.id, "ADMIN");
		const published = expectSuccess(
			await publishAssuranceCase(owner.id, testCase.id)
		);

		expectSuccess(await deleteAccount(owner.id));

		const stillLive = await prisma.publishedAssuranceCase.findUniqueOrThrow({
			where: { id: published.publishedId },
		});
		expect(stillLive.archivedAt).toBeNull();
		expect(stillLive.archivedOwnerId).toBeNull();
		expect(stillLive.isCurrent).toBe(true);
		expect(stillLive.id).toBe(published.publishedId);

		const survivingCase = await prisma.assuranceCase.findUniqueOrThrow({
			where: { id: testCase.id },
		});
		expect(survivingCase.deletedAt).toBeNull();
		expect(survivingCase.published).toBe(true);
		expect(survivingCase.publishStatus).toBe("PUBLISHED");
	});

	it("refuses anyone at all trying to remove an ownerless archived copy left by account deletion", async () => {
		const owner = await createTestUser({ authProvider: "GITHUB" });
		const testCase = await createTestCaseWithGoal(owner.id, "Orphaned Archive");
		const published = expectSuccess(
			await publishAssuranceCase(owner.id, testCase.id)
		);
		await deleteAccount(owner.id);

		const bystander = await createTestUser();
		const bystanderAttempt = await removeArchivedCopy(
			bystander.id,
			published.publishedId
		);
		const missingAttempt = await removeArchivedCopy(
			bystander.id,
			"00000000-0000-0000-0000-000000000000"
		);
		expectSameError(bystanderAttempt, missingAttempt);

		const stillThere = await prisma.publishedAssuranceCase.findUnique({
			where: { id: published.publishedId },
		});
		expect(stillThere).not.toBeNull();
		expect(stillThere?.archivedOwnerId).toBeNull();
	});
});

// ============================================
// listArchivedCopies never surfaces someone else's copy
// ============================================

describe("listArchivedCopies — never lists another user's archived copy, even a stranger with none of their own", () => {
	it("returns an empty list for a user with no archived copies of their own", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id, "Owned Archive");
		await publishAssuranceCase(owner.id, testCase.id);
		await softDeleteCase(owner.id, testCase.id, { publishedCopy: "archive" });

		const stranger = await createTestUser();
		const data = expectSuccess(await listArchivedCopies(stranger.id));
		expect(data).toHaveLength(0);
	});
});

// ============================================
// DELETE /api/cases/[id] — the route's own `archive` query-param parsing
// ============================================

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn(),
}));

describe("DELETE /api/cases/[id] — archive query-param default and edge values", () => {
	async function callDelete(caseId: string, query: string): Promise<Response> {
		const { DELETE } = await import("@/app/api/cases/[id]/route");
		const request = new Request(
			`http://localhost/api/cases/${caseId}${query}`,
			{ method: "DELETE" }
		);
		return DELETE(request, { params: Promise.resolve({ id: caseId }) });
	}

	async function asUser(userId: string): Promise<void> {
		const { validateSession } = await import("@/lib/auth/validate-session");
		vi.mocked(validateSession).mockResolvedValue({
			userId,
			username: "test",
			email: "test@example.com",
		} satisfies ValidatedSession);
	}

	it("removes the Discover copy when no archive param is given", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id, "Route No Param");
		await publishAssuranceCase(owner.id, testCase.id);
		await asUser(owner.id);

		const response = await callDelete(testCase.id, "");
		expect(response.status).toBe(200);

		const rows = await prisma.publishedAssuranceCase.findMany({
			where: { assuranceCaseId: testCase.id },
		});
		expect(rows).toHaveLength(0);
	});

	it("removes the Discover copy when archive=false", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(
			owner.id,
			"Route False Param"
		);
		await publishAssuranceCase(owner.id, testCase.id);
		await asUser(owner.id);

		const response = await callDelete(testCase.id, "?archive=false");
		expect(response.status).toBe(200);

		const rows = await prisma.publishedAssuranceCase.findMany({
			where: { assuranceCaseId: testCase.id },
		});
		expect(rows).toHaveLength(0);
	});

	it("removes the Discover copy when archive is a junk value", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id, "Route Junk Param");
		await publishAssuranceCase(owner.id, testCase.id);
		await asUser(owner.id);

		const response = await callDelete(testCase.id, "?archive=banana");
		expect(response.status).toBe(200);

		const rows = await prisma.publishedAssuranceCase.findMany({
			where: { assuranceCaseId: testCase.id },
		});
		expect(rows).toHaveLength(0);
	});

	it("archives the Discover copy when archive=true", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id, "Route True Param");
		const published = expectSuccess(
			await publishAssuranceCase(owner.id, testCase.id)
		);
		await asUser(owner.id);

		const response = await callDelete(testCase.id, "?archive=true");
		expect(response.status).toBe(200);

		const archived = await prisma.publishedAssuranceCase.findUniqueOrThrow({
			where: { id: published.publishedId },
		});
		expect(archived.archivedAt).not.toBeNull();
		expect(archived.archivedOwnerId).toBe(owner.id);
	});
});
