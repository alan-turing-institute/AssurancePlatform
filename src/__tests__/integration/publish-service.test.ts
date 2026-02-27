import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import {
	getFullPublishStatus,
	getPublishStatus,
	markCaseAsReady,
	publishAssuranceCase,
	transitionStatus,
	unmarkCaseAsReady,
	unpublishAssuranceCase,
	updatePublishedCase,
} from "@/lib/services/publish-service";
import {
	createTestCase,
	createTestCaseStudy,
	createTestElement,
	createTestPermission,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * Creates a case with a top-level GOAL element so exportCase succeeds.
 * publishAssuranceCase calls exportCase internally, which requires at least one element.
 */
async function createPublishableCase(ownerId: string, name?: string) {
	const testCase = await createTestCase(ownerId, { name });
	await createTestElement(testCase.id, ownerId, {
		elementType: "GOAL",
		name: "Top-level goal",
		role: "TOP_LEVEL",
	});
	return testCase;
}

// ============================================
// markCaseAsReady
// ============================================

describe("markCaseAsReady", () => {
	it("transitions a DRAFT case to READY_TO_PUBLISH", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id, {
			publishStatus: "DRAFT",
		});

		const result = await markCaseAsReady(owner.id, testCase.id);

		expect(result.error).toBeUndefined();
		if ("data" in result) {
			expect(result.data.markedReadyAt).toBeInstanceOf(Date);
		}

		const updated = await prisma.assuranceCase.findUnique({
			where: { id: testCase.id },
			select: { publishStatus: true, markedReadyAt: true },
		});
		expect(updated?.publishStatus).toBe("READY_TO_PUBLISH");
		expect(updated?.markedReadyAt).not.toBeNull();
	});

	it("returns error when case is already READY_TO_PUBLISH", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id, {
			publishStatus: "READY_TO_PUBLISH",
		});

		const result = await markCaseAsReady(owner.id, testCase.id);

		expect("error" in result).toBe(true);
		if ("error" in result) {
			expect(result.error).toContain("Cannot mark as ready");
			expect(result.error).toContain("READY_TO_PUBLISH");
		}
	});

	it("returns error when case is already PUBLISHED", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id, {
			publishStatus: "PUBLISHED",
			published: true,
		});

		const result = await markCaseAsReady(owner.id, testCase.id);

		expect("error" in result).toBe(true);
		if ("error" in result) {
			expect(result.error).toContain("Cannot mark as ready");
			expect(result.error).toContain("PUBLISHED");
		}
	});

	it("returns error when caller lacks EDIT permission", async () => {
		const owner = await createTestUser();
		const viewer = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");

		const result = await markCaseAsReady(viewer.id, testCase.id);

		expect("error" in result).toBe(true);
		if ("error" in result) {
			expect(result.error).toBe("Permission denied");
		}
	});
});

// ============================================
// unmarkCaseAsReady
// ============================================

describe("unmarkCaseAsReady", () => {
	it("transitions a READY_TO_PUBLISH case back to DRAFT", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id, {
			publishStatus: "READY_TO_PUBLISH",
		});

		const result = await unmarkCaseAsReady(owner.id, testCase.id);

		expect(result.error).toBeUndefined();
		if ("data" in result) {
			expect(result.data.success).toBe(true);
		}

		const updated = await prisma.assuranceCase.findUnique({
			where: { id: testCase.id },
			select: { publishStatus: true, markedReadyAt: true },
		});
		expect(updated?.publishStatus).toBe("DRAFT");
		expect(updated?.markedReadyAt).toBeNull();
	});

	it("returns error when case is in DRAFT status (not READY_TO_PUBLISH)", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id, {
			publishStatus: "DRAFT",
		});

		const result = await unmarkCaseAsReady(owner.id, testCase.id);

		expect("error" in result).toBe(true);
		if ("error" in result) {
			expect(result.error).toContain("Cannot unmark");
			expect(result.error).toContain("DRAFT");
		}
	});

	it("returns error when case is PUBLISHED (not READY_TO_PUBLISH)", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id, {
			publishStatus: "PUBLISHED",
			published: true,
		});

		const result = await unmarkCaseAsReady(owner.id, testCase.id);

		expect("error" in result).toBe(true);
		if ("error" in result) {
			expect(result.error).toContain("Cannot unmark");
		}
	});
});

// ============================================
// publishAssuranceCase
// ============================================

describe("publishAssuranceCase", () => {
	it("publishes a case and creates a PublishedAssuranceCase record", async () => {
		const owner = await createTestUser();
		const testCase = await createPublishableCase(owner.id);

		const result = await publishAssuranceCase(owner.id, testCase.id);

		expect("error" in result).toBe(false);
		if ("data" in result) {
			expect(result.data.publishedId).toBeDefined();
			expect(result.data.publishedAt).toBeInstanceOf(Date);
		}

		const updated = await prisma.assuranceCase.findUnique({
			where: { id: testCase.id },
			select: { published: true, publishStatus: true, publishedAt: true },
		});
		expect(updated?.published).toBe(true);
		expect(updated?.publishStatus).toBe("PUBLISHED");
		expect(updated?.publishedAt).not.toBeNull();
	});

	it("creates a PublishedAssuranceCase snapshot in the database", async () => {
		const owner = await createTestUser();
		const testCase = await createPublishableCase(owner.id, "My Published Case");

		const result = await publishAssuranceCase(owner.id, testCase.id, "Initial release");

		expect("error" in result).toBe(false);
		if ("data" in result) {
			const published = await prisma.publishedAssuranceCase.findUnique({
				where: { id: result.data.publishedId },
			});
			expect(published).not.toBeNull();
			expect(published?.title).toBe("My Published Case");
			expect(published?.description).toBe("Initial release");
			expect(published?.assuranceCaseId).toBe(testCase.id);
		}
	});

	it("returns error when caller lacks EDIT permission", async () => {
		const owner = await createTestUser();
		const viewer = await createTestUser();
		const testCase = await createPublishableCase(owner.id);
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");

		const result = await publishAssuranceCase(viewer.id, testCase.id);

		expect("error" in result).toBe(true);
		if ("error" in result) {
			expect(result.error).toBe("Permission denied");
		}
	});

	it("returns error when caller has no access at all", async () => {
		const owner = await createTestUser();
		const stranger = await createTestUser();
		const testCase = await createPublishableCase(owner.id);

		const result = await publishAssuranceCase(stranger.id, testCase.id);

		expect("error" in result).toBe(true);
		if ("error" in result) {
			expect(result.error).toBe("Permission denied");
		}
	});
});

// ============================================
// unpublishAssuranceCase
// ============================================

describe("unpublishAssuranceCase", () => {
	it("unpublishes a published case and resets status to DRAFT", async () => {
		const owner = await createTestUser();
		const testCase = await createPublishableCase(owner.id);

		// Publish first
		await publishAssuranceCase(owner.id, testCase.id);

		const result = await unpublishAssuranceCase(owner.id, testCase.id);

		expect("error" in result).toBe(false);
		if ("data" in result) {
			expect(result.data.success).toBe(true);
		}

		const updated = await prisma.assuranceCase.findUnique({
			where: { id: testCase.id },
			select: { published: true, publishStatus: true, publishedAt: true },
		});
		expect(updated?.published).toBe(false);
		expect(updated?.publishStatus).toBe("DRAFT");
		expect(updated?.publishedAt).toBeNull();
	});

	it("returns error when case is not published", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id, {
			publishStatus: "DRAFT",
			published: false,
		});

		const result = await unpublishAssuranceCase(owner.id, testCase.id);

		expect("error" in result).toBe(true);
		if ("error" in result) {
			expect(result.error).toBe("Case is not published");
		}
	});

	it("returns error when case is linked to case studies and force is false", async () => {
		const owner = await createTestUser();
		const testCase = await createPublishableCase(owner.id);

		// Publish the case
		const publishResult = await publishAssuranceCase(owner.id, testCase.id);
		expect("data" in publishResult).toBe(true);

		if ("data" in publishResult) {
			// Create a case study and link to the published version
			const caseStudy = await createTestCaseStudy(owner.id, { published: true });
			await prisma.caseStudyPublishedCase.create({
				data: {
					caseStudyId: caseStudy.id,
					publishedAssuranceCaseId: publishResult.data.publishedId,
				},
			});

			const result = await unpublishAssuranceCase(owner.id, testCase.id, false);

			expect("error" in result).toBe(true);
			if ("error" in result) {
				expect(result.error).toBe("Cannot unpublish: linked to case studies");
			}
		}
	});

	it("deletes case study links and unpublishes when force is true", async () => {
		const owner = await createTestUser();
		const testCase = await createPublishableCase(owner.id);

		// Publish the case
		const publishResult = await publishAssuranceCase(owner.id, testCase.id);
		expect("data" in publishResult).toBe(true);

		if ("data" in publishResult) {
			const caseStudy = await createTestCaseStudy(owner.id, { published: true });
			await prisma.caseStudyPublishedCase.create({
				data: {
					caseStudyId: caseStudy.id,
					publishedAssuranceCaseId: publishResult.data.publishedId,
				},
			});

			const result = await unpublishAssuranceCase(owner.id, testCase.id, true);

			expect("error" in result).toBe(false);
			if ("data" in result) {
				expect(result.data.success).toBe(true);
			}

			// Published versions should be deleted
			const remaining = await prisma.publishedAssuranceCase.findMany({
				where: { assuranceCaseId: testCase.id },
			});
			expect(remaining).toHaveLength(0);
		}
	});

	it("returns error when caller lacks EDIT permission", async () => {
		const owner = await createTestUser();
		const viewer = await createTestUser();
		const testCase = await createPublishableCase(owner.id);
		await publishAssuranceCase(owner.id, testCase.id);
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");

		const result = await unpublishAssuranceCase(viewer.id, testCase.id);

		expect("error" in result).toBe(true);
		if ("error" in result) {
			expect(result.error).toBe("Permission denied");
		}
	});
});

// ============================================
// updatePublishedCase
// ============================================

describe("updatePublishedCase", () => {
	it("creates a new published version snapshot for an already-published case", async () => {
		const owner = await createTestUser();
		const testCase = await createPublishableCase(owner.id);

		// Publish initially
		const publishResult = await publishAssuranceCase(owner.id, testCase.id);
		expect("data" in publishResult).toBe(true);

		// Update published version
		const updateResult = await updatePublishedCase(
			owner.id,
			testCase.id,
			"Updated description"
		);

		expect("error" in updateResult).toBe(false);
		if ("data" in updateResult) {
			expect(updateResult.data.publishedId).toBeDefined();
			// Should be a different ID than the original
			if ("data" in publishResult) {
				expect(updateResult.data.publishedId).not.toBe(
					publishResult.data.publishedId
				);
			}
		}

		// New record exists in DB
		if ("data" in updateResult) {
			const newVersion = await prisma.publishedAssuranceCase.findUnique({
				where: { id: updateResult.data.publishedId },
			});
			expect(newVersion).not.toBeNull();
			expect(newVersion?.description).toBe("Updated description");
		}
	});

	it("returns error when case is not published", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id, {
			publishStatus: "DRAFT",
			published: false,
		});

		const result = await updatePublishedCase(owner.id, testCase.id);

		expect("error" in result).toBe(true);
		if ("error" in result) {
			expect(result.error).toBe("Case is not published");
		}
	});

	it("returns error when caller lacks EDIT permission", async () => {
		const owner = await createTestUser();
		const viewer = await createTestUser();
		const testCase = await createPublishableCase(owner.id);
		await publishAssuranceCase(owner.id, testCase.id);
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");

		const result = await updatePublishedCase(viewer.id, testCase.id);

		expect("error" in result).toBe(true);
		if ("error" in result) {
			expect(result.error).toBe("Permission denied");
		}
	});
});

// ============================================
// getPublishStatus
// ============================================

describe("getPublishStatus", () => {
	it("returns publish status for the case owner", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);

		const status = await getPublishStatus(owner.id, testCase.id);

		expect(status).not.toBeNull();
		expect(status?.isPublished).toBe(false);
		expect(status?.publishedAt).toBeNull();
		expect(status?.linkedCaseStudyCount).toBe(0);
	});

	it("returns null when caller has no access", async () => {
		const owner = await createTestUser();
		const stranger = await createTestUser();
		const testCase = await createTestCase(owner.id);

		const status = await getPublishStatus(stranger.id, testCase.id);

		expect(status).toBeNull();
	});

	it("reflects published state after publishing", async () => {
		const owner = await createTestUser();
		const testCase = await createPublishableCase(owner.id);
		await publishAssuranceCase(owner.id, testCase.id);

		const status = await getPublishStatus(owner.id, testCase.id);

		expect(status?.isPublished).toBe(true);
		expect(status?.publishedAt).not.toBeNull();
	});
});

// ============================================
// getFullPublishStatus
// ============================================

describe("getFullPublishStatus", () => {
	it("returns full status fields for the case owner", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id, {
			publishStatus: "DRAFT",
		});

		const result = await getFullPublishStatus(owner.id, testCase.id);

		expect(result.error).toBeUndefined();
		expect(result.data).toBeDefined();
		expect(result.data?.publishStatus).toBe("DRAFT");
		expect(result.data?.isPublished).toBe(false);
		expect(result.data?.publishedAt).toBeNull();
		expect(result.data?.markedReadyAt).toBeNull();
		expect(result.data?.linkedCaseStudyCount).toBe(0);
		expect(typeof result.data?.hasChanges).toBe("boolean");
	});

	it("returns error when caller has no access", async () => {
		const owner = await createTestUser();
		const stranger = await createTestUser();
		const testCase = await createTestCase(owner.id);

		const result = await getFullPublishStatus(stranger.id, testCase.id);

		expect(result.error).toBeDefined();
	});

	it("reflects READY_TO_PUBLISH status and markedReadyAt", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await markCaseAsReady(owner.id, testCase.id);

		const result = await getFullPublishStatus(owner.id, testCase.id);

		expect(result.data?.publishStatus).toBe("READY_TO_PUBLISH");
		expect(result.data?.markedReadyAt).not.toBeNull();
	});
});

// ============================================
// transitionStatus
// ============================================

describe("transitionStatus", () => {
	it("transitions DRAFT to READY_TO_PUBLISH", async () => {
		const owner = await createTestUser();
		const testCase = await createPublishableCase(owner.id);

		const result = await transitionStatus(
			owner.id,
			testCase.id,
			"READY_TO_PUBLISH"
		);

		expect("error" in result).toBe(false);
		if ("data" in result) {
			expect(result.data.newStatus).toBe("READY_TO_PUBLISH");
		}

		const updated = await prisma.assuranceCase.findUnique({
			where: { id: testCase.id },
			select: { publishStatus: true },
		});
		expect(updated?.publishStatus).toBe("READY_TO_PUBLISH");
	});

	it("transitions READY_TO_PUBLISH to PUBLISHED", async () => {
		const owner = await createTestUser();
		const testCase = await createPublishableCase(owner.id);
		await markCaseAsReady(owner.id, testCase.id);

		const result = await transitionStatus(owner.id, testCase.id, "PUBLISHED");

		expect("error" in result).toBe(false);
		if ("data" in result) {
			expect(result.data.newStatus).toBe("PUBLISHED");
			expect(result.data.publishedId).toBeDefined();
		}
	});

	it("returns error for an invalid transition (DRAFT to PUBLISHED directly)", async () => {
		const owner = await createTestUser();
		const testCase = await createPublishableCase(owner.id);

		const result = await transitionStatus(owner.id, testCase.id, "PUBLISHED");

		expect("error" in result).toBe(true);
		if ("error" in result) {
			expect(result.error).toContain("Invalid status transition");
		}
	});

	it("returns error when caller has no access to the case", async () => {
		const owner = await createTestUser();
		const stranger = await createTestUser();
		const testCase = await createPublishableCase(owner.id);

		const result = await transitionStatus(
			stranger.id,
			testCase.id,
			"READY_TO_PUBLISH"
		);

		expect("error" in result).toBe(true);
	});
});
