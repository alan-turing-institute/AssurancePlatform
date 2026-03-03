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
	expectError,
	expectSameError,
	expectSuccess,
} from "../utils/assertion-helpers";
import {
	createTestCase,
	createTestCaseStudy,
	createTestCaseWithGoal,
	createTestPermission,
	createTestUser,
} from "../utils/prisma-factories";

// Top-level regex constants required by lint/performance/useTopLevelRegex
const CANNOT_MARK_AS_READY = /Cannot mark as ready/;
const STATUS_READY_TO_PUBLISH = /READY_TO_PUBLISH/;
const STATUS_PUBLISHED = /PUBLISHED/;
const CANNOT_UNMARK = /Cannot unmark/;
const STATUS_DRAFT = /DRAFT/;
const INVALID_STATUS_TRANSITION = /Invalid status transition/;

// ============================================
// markCaseAsReady
// ============================================

describe("markCaseAsReady", () => {
	it("transitions a DRAFT case to READY_TO_PUBLISH", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id, {
			publishStatus: "DRAFT",
		});

		const data = expectSuccess(await markCaseAsReady(owner.id, testCase.id));
		expect(data.markedReadyAt).toBeInstanceOf(Date);

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
		expectError(result, CANNOT_MARK_AS_READY);
		expectError(result, STATUS_READY_TO_PUBLISH);
	});

	it("returns error when case is already PUBLISHED", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id, {
			publishStatus: "PUBLISHED",
			published: true,
		});

		const result = await markCaseAsReady(owner.id, testCase.id);
		expectError(result, CANNOT_MARK_AS_READY);
		expectError(result, STATUS_PUBLISHED);
	});

	it("returns error when caller lacks EDIT permission", async () => {
		const owner = await createTestUser();
		const viewer = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");

		expectError(
			await markCaseAsReady(viewer.id, testCase.id),
			"Permission denied"
		);
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

		const data = expectSuccess(await unmarkCaseAsReady(owner.id, testCase.id));
		expect(data.success).toBe(true);

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
		expectError(result, CANNOT_UNMARK);
		expectError(result, STATUS_DRAFT);
	});

	it("returns error when case is PUBLISHED (not READY_TO_PUBLISH)", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id, {
			publishStatus: "PUBLISHED",
			published: true,
		});

		const result = await unmarkCaseAsReady(owner.id, testCase.id);
		expectError(result, CANNOT_UNMARK);
	});
});

// ============================================
// publishAssuranceCase
// ============================================

describe("publishAssuranceCase", () => {
	it("publishes a case and creates a PublishedAssuranceCase record", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id);

		const data = expectSuccess(
			await publishAssuranceCase(owner.id, testCase.id)
		);
		expect(data.publishedId).toBeDefined();
		expect(data.publishedAt).toBeInstanceOf(Date);

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
		const testCase = await createTestCaseWithGoal(
			owner.id,
			"My Published Case"
		);

		const data = expectSuccess(
			await publishAssuranceCase(owner.id, testCase.id, "Initial release")
		);

		const published = await prisma.publishedAssuranceCase.findUnique({
			where: { id: data.publishedId },
		});
		expect(published).not.toBeNull();
		expect(published?.title).toBe("My Published Case");
		expect(published?.description).toBe("Initial release");
		expect(published?.assuranceCaseId).toBe(testCase.id);
	});

	it("returns error when caller lacks EDIT permission", async () => {
		const owner = await createTestUser();
		const viewer = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id);
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");

		expectError(
			await publishAssuranceCase(viewer.id, testCase.id),
			"Permission denied"
		);
	});

	it("returns error when caller has no access at all", async () => {
		const owner = await createTestUser();
		const stranger = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id);

		expectError(
			await publishAssuranceCase(stranger.id, testCase.id),
			"Permission denied"
		);
	});
});

// ============================================
// unpublishAssuranceCase
// ============================================

describe("unpublishAssuranceCase", () => {
	it("unpublishes a published case and resets status to DRAFT", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id);

		// Publish first
		await publishAssuranceCase(owner.id, testCase.id);

		const data = expectSuccess(
			await unpublishAssuranceCase(owner.id, testCase.id)
		);
		expect(data.success).toBe(true);

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

		expectError(
			await unpublishAssuranceCase(owner.id, testCase.id),
			"Case is not published"
		);
	});

	it("returns error when case is linked to case studies and force is false", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id);

		// Publish the case
		const publishData = expectSuccess(
			await publishAssuranceCase(owner.id, testCase.id)
		);

		// Create a case study and link to the published version
		const caseStudy = await createTestCaseStudy(owner.id, {
			published: true,
		});
		await prisma.caseStudyPublishedCase.create({
			data: {
				caseStudyId: caseStudy.id,
				publishedAssuranceCaseId: publishData.publishedId,
			},
		});

		expectError(
			await unpublishAssuranceCase(owner.id, testCase.id, false),
			"Cannot unpublish: linked to case studies"
		);
	});

	it("deletes case study links and unpublishes when force is true", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id);

		// Publish the case
		const publishData = expectSuccess(
			await publishAssuranceCase(owner.id, testCase.id)
		);

		const caseStudy = await createTestCaseStudy(owner.id, {
			published: true,
		});
		await prisma.caseStudyPublishedCase.create({
			data: {
				caseStudyId: caseStudy.id,
				publishedAssuranceCaseId: publishData.publishedId,
			},
		});

		const data = expectSuccess(
			await unpublishAssuranceCase(owner.id, testCase.id, true)
		);
		expect(data.success).toBe(true);

		// Published versions should be deleted
		const remaining = await prisma.publishedAssuranceCase.findMany({
			where: { assuranceCaseId: testCase.id },
		});
		expect(remaining).toHaveLength(0);
	});

	it("returns error when caller lacks EDIT permission", async () => {
		const owner = await createTestUser();
		const viewer = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id);
		await publishAssuranceCase(owner.id, testCase.id);
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");

		expectError(
			await unpublishAssuranceCase(viewer.id, testCase.id),
			"Permission denied"
		);
	});
});

// ============================================
// updatePublishedCase
// ============================================

describe("updatePublishedCase", () => {
	it("creates a new published version snapshot for an already-published case", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id);

		// Publish initially
		const publishData = expectSuccess(
			await publishAssuranceCase(owner.id, testCase.id)
		);

		// Update published version
		const updateData = expectSuccess(
			await updatePublishedCase(owner.id, testCase.id, "Updated description")
		);
		expect(updateData.publishedId).toBeDefined();
		// Should be a different ID than the original
		expect(updateData.publishedId).not.toBe(publishData.publishedId);

		// New record exists in DB
		const newVersion = await prisma.publishedAssuranceCase.findUnique({
			where: { id: updateData.publishedId },
		});
		expect(newVersion).not.toBeNull();
		expect(newVersion?.description).toBe("Updated description");
	});

	it("returns error when case is not published", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id, {
			publishStatus: "DRAFT",
			published: false,
		});

		expectError(
			await updatePublishedCase(owner.id, testCase.id),
			"Case is not published"
		);
	});

	it("returns error when caller lacks EDIT permission", async () => {
		const owner = await createTestUser();
		const viewer = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id);
		await publishAssuranceCase(owner.id, testCase.id);
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");

		expectError(
			await updatePublishedCase(viewer.id, testCase.id),
			"Permission denied"
		);
	});
});

// ============================================
// getPublishStatus
// ============================================

describe("getPublishStatus", () => {
	it("returns publish status for the case owner", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);

		const data = expectSuccess(await getPublishStatus(owner.id, testCase.id));
		expect(data.isPublished).toBe(false);
		expect(data.publishedAt).toBeNull();
		expect(data.linkedCaseStudyCount).toBe(0);
	});

	it("returns error when caller has no access", async () => {
		const owner = await createTestUser();
		const stranger = await createTestUser();
		const testCase = await createTestCase(owner.id);

		expectError(await getPublishStatus(stranger.id, testCase.id));
	});

	it("reflects published state after publishing", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id);
		await publishAssuranceCase(owner.id, testCase.id);

		const data = expectSuccess(await getPublishStatus(owner.id, testCase.id));
		expect(data.isPublished).toBe(true);
		expect(data.publishedAt).not.toBeNull();
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
// Anti-enumeration: consistent error responses
// ============================================

describe("anti-enumeration: consistent error responses", () => {
	it("publishAssuranceCase returns the same error for a non-existent case as for an inaccessible case", async () => {
		const owner = await createTestUser();
		const stranger = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id);

		// Stranger has no access to the existing case
		const noAccessResult = await publishAssuranceCase(stranger.id, testCase.id);

		// Stranger tries to publish a non-existent case
		const notFoundResult = await publishAssuranceCase(
			stranger.id,
			"00000000-0000-0000-0000-000000000000"
		);

		expectSameError(noAccessResult, notFoundResult);
	});

	it("getPublishStatus returns the same error for a non-existent case as for an inaccessible case", async () => {
		const owner = await createTestUser();
		const stranger = await createTestUser();
		const testCase = await createTestCase(owner.id);

		// Stranger has no access to the existing case
		const noAccessResult = await getPublishStatus(stranger.id, testCase.id);

		// Stranger tries to get status of a non-existent case
		const notFoundResult = await getPublishStatus(
			stranger.id,
			"00000000-0000-0000-0000-000000000000"
		);

		expectSameError(noAccessResult, notFoundResult);
	});
});

// ============================================
// transitionStatus
// ============================================

describe("transitionStatus", () => {
	it("transitions DRAFT to READY_TO_PUBLISH", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id);

		const data = expectSuccess(
			await transitionStatus(owner.id, testCase.id, "READY_TO_PUBLISH")
		);
		expect(data.newStatus).toBe("READY_TO_PUBLISH");

		const updated = await prisma.assuranceCase.findUnique({
			where: { id: testCase.id },
			select: { publishStatus: true },
		});
		expect(updated?.publishStatus).toBe("READY_TO_PUBLISH");
	});

	it("transitions READY_TO_PUBLISH to PUBLISHED", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id);
		await markCaseAsReady(owner.id, testCase.id);

		const data = expectSuccess(
			await transitionStatus(owner.id, testCase.id, "PUBLISHED")
		);
		expect(data.newStatus).toBe("PUBLISHED");
		expect(data.publishedId).toBeDefined();
	});

	it("returns error for an invalid transition (DRAFT to PUBLISHED directly)", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id);

		const result = await transitionStatus(owner.id, testCase.id, "PUBLISHED");
		expectError(result, INVALID_STATUS_TRANSITION);
	});

	it("returns error when caller has no access to the case", async () => {
		const owner = await createTestUser();
		const stranger = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id);

		expectError(
			await transitionStatus(stranger.id, testCase.id, "READY_TO_PUBLISH")
		);
	});
});
