import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { setPluginEnabledForUser } from "@/lib/services/plugin-enablement-service";
import {
	getFullPublishStatus,
	getPublishStatus,
	publishAssuranceCase,
	transitionStatus,
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
	createTestCaseInformation,
	createTestCaseStudy,
	createTestCaseWithGoal,
	createTestElement,
	createTestPermission,
	createTestPluginData,
	createTestUser,
} from "../utils/prisma-factories";

// Top-level regex constants required by lint/performance/useTopLevelRegex
const INVALID_STATUS_TRANSITION = /Invalid status transition/;

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
	it("transitions DRAFT to PUBLISHED directly (the 'Ready to Publish' intermediate step is retired, ADR 0003 §2)", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id);

		const data = expectSuccess(
			await transitionStatus(owner.id, testCase.id, "PUBLISHED")
		);
		expect(data.newStatus).toBe("PUBLISHED");
		expect(data.publishedId).toBeDefined();

		const updated = await prisma.assuranceCase.findUnique({
			where: { id: testCase.id },
			select: { publishStatus: true },
		});
		expect(updated?.publishStatus).toBe("PUBLISHED");
	});

	it("returns error for an invalid transition (DRAFT to DRAFT is a no-op, not a defined transition)", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id);

		const result = await transitionStatus(owner.id, testCase.id, "DRAFT");
		expectError(result, INVALID_STATUS_TRANSITION);
	});

	it("returns error when caller has no access to the case", async () => {
		const owner = await createTestUser();
		const stranger = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id);

		expectError(await transitionStatus(stranger.id, testCase.id, "PUBLISHED"));
	});
});

// ============================================
// Snapshot pluginData capture (ADR 0002 v2 §3)
// ============================================

describe("publishAssuranceCase — snapshot pluginData capture", () => {
	it("embeds captured plugin data in the snapshot content when present", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id);
		const claim = await createTestElement(testCase.id, owner.id, {
			elementType: "PROPERTY_CLAIM",
		});
		await createTestPluginData(testCase.id, {
			pluginId: "tea.health",
			elementId: claim.id,
			data: { score: 1, lastEvaluatedAt: null, validityWindowSeconds: 86_400 },
		});

		const data = expectSuccess(
			await publishAssuranceCase(owner.id, testCase.id)
		);

		const published = await prisma.publishedAssuranceCase.findUnique({
			where: { id: data.publishedId },
		});
		const content = published?.content as {
			pluginData?: Record<string, unknown>;
		};
		expect(content.pluginData).toStrictEqual({
			"tea.health": [
				{
					elementId: claim.id,
					data: {
						score: 1,
						lastEvaluatedAt: null,
						validityWindowSeconds: 86_400,
					},
				},
			],
		});
	});

	it("omits the pluginData section entirely when the case holds no plugin data", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id);

		const data = expectSuccess(
			await publishAssuranceCase(owner.id, testCase.id)
		);

		const published = await prisma.publishedAssuranceCase.findUnique({
			where: { id: data.publishedId },
		});
		const content = published?.content as {
			pluginData?: Record<string, unknown>;
		};
		expect(content.pluginData).toBeUndefined();
	});

	it("captures plugin data even when the plugin is disabled for the publishing user (capture follows data present, not viewer toggles)", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id);
		const claim = await createTestElement(testCase.id, owner.id, {
			elementType: "PROPERTY_CLAIM",
		});
		await createTestPluginData(testCase.id, {
			pluginId: "tea.health",
			elementId: claim.id,
			data: { score: 0.5, lastEvaluatedAt: null, validityWindowSeconds: 60 },
		});
		expectSuccess(
			await setPluginEnabledForUser("tea.health", owner.id, { enabled: false })
		);

		const data = expectSuccess(
			await publishAssuranceCase(owner.id, testCase.id)
		);

		const published = await prisma.publishedAssuranceCase.findUnique({
			where: { id: data.publishedId },
		});
		const content = published?.content as {
			pluginData?: Record<string, unknown>;
		};
		expect(content.pluginData).toStrictEqual({
			"tea.health": [
				{
					elementId: claim.id,
					data: {
						score: 0.5,
						lastEvaluatedAt: null,
						validityWindowSeconds: 60,
					},
				},
			],
		});
	});

	it("captures every plugin namespace present, not just tea.health — core stays plugin-agnostic", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id);
		await createTestPluginData(testCase.id, {
			pluginId: "tea.some-other-plugin",
			data: { anything: "goes" },
		});

		const data = expectSuccess(
			await publishAssuranceCase(owner.id, testCase.id)
		);

		const published = await prisma.publishedAssuranceCase.findUnique({
			where: { id: data.publishedId },
		});
		const content = published?.content as {
			pluginData?: Record<string, unknown>;
		};
		expect(content.pluginData).toStrictEqual({
			"tea.some-other-plugin": [
				{ elementId: null, data: { anything: "goes" } },
			],
		});
	});
});

describe("updatePublishedCase — snapshot pluginData capture", () => {
	it("re-captures current plugin data on each new published version", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id);
		const claim = await createTestElement(testCase.id, owner.id, {
			elementType: "PROPERTY_CLAIM",
		});
		await publishAssuranceCase(owner.id, testCase.id);

		const dataRow = await createTestPluginData(testCase.id, {
			pluginId: "tea.health",
			elementId: claim.id,
			data: { score: 0, lastEvaluatedAt: null, validityWindowSeconds: 60 },
		});

		const updated = expectSuccess(
			await updatePublishedCase(owner.id, testCase.id)
		);
		const published = await prisma.publishedAssuranceCase.findUnique({
			where: { id: updated.publishedId },
		});
		const content = published?.content as {
			pluginData?: Record<string, unknown>;
		};
		expect(content.pluginData).toStrictEqual({
			"tea.health": [{ elementId: claim.id, data: dataRow.data }],
		});
	});
});

// ============================================
// Slugs (ADR 0003 §6)
// ============================================

describe("publishAssuranceCase — slug generation", () => {
	it("generates a name-derived slug on first publish", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id, "My Great Case");

		const data = expectSuccess(
			await publishAssuranceCase(owner.id, testCase.id)
		);
		const published = await prisma.publishedAssuranceCase.findUnique({
			where: { id: data.publishedId },
		});
		expect(published?.slug).toBe("my-great-case");
		expect(published?.type).toBe("ASSURANCE_CASE");
	});

	it("appends a numeric suffix when two cases share a name", async () => {
		const owner = await createTestUser();
		const first = await createTestCaseWithGoal(owner.id, "Duplicate Name");
		const second = await createTestCaseWithGoal(owner.id, "Duplicate Name");

		const firstData = expectSuccess(
			await publishAssuranceCase(owner.id, first.id)
		);
		const secondData = expectSuccess(
			await publishAssuranceCase(owner.id, second.id)
		);

		const [firstPublished, secondPublished] = await Promise.all([
			prisma.publishedAssuranceCase.findUnique({
				where: { id: firstData.publishedId },
			}),
			prisma.publishedAssuranceCase.findUnique({
				where: { id: secondData.publishedId },
			}),
		]);

		expect(firstPublished?.slug).toBe("duplicate-name");
		expect(secondPublished?.slug).toBe("duplicate-name-2");
	});

	it("stays stable across a rename and republish (never regenerated)", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id, "Original Name");

		const published = expectSuccess(
			await publishAssuranceCase(owner.id, testCase.id)
		);
		const firstVersion = await prisma.publishedAssuranceCase.findUnique({
			where: { id: published.publishedId },
		});
		expect(firstVersion?.slug).toBe("original-name");

		await prisma.assuranceCase.update({
			where: { id: testCase.id },
			data: { name: "Renamed Case" },
		});

		const republished = expectSuccess(
			await updatePublishedCase(owner.id, testCase.id)
		);
		const secondVersion = await prisma.publishedAssuranceCase.findUnique({
			where: { id: republished.publishedId },
		});
		expect(secondVersion?.title).toBe("Renamed Case");
		expect(secondVersion?.slug).toBe("original-name");
	});
});

// ============================================
// Case information snapshot freeze (ADR 0003 §3)
// ============================================

describe("publishAssuranceCase — case information snapshot capture", () => {
	it("omits the caseInformation section when the case has none", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id);

		const data = expectSuccess(
			await publishAssuranceCase(owner.id, testCase.id)
		);
		const published = await prisma.publishedAssuranceCase.findUnique({
			where: { id: data.publishedId },
		});
		const content = published?.content as {
			caseInformation?: Record<string, unknown>;
		};
		expect(content.caseInformation).toBeUndefined();
	});

	it("freezes case information present at publish time", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id);
		await createTestCaseInformation(testCase.id, {
			description: "Published-time description",
			authors: "Published-time authors",
			sector: "Finance",
			featureImageUrl: "https://example.com/original.png",
		});

		const data = expectSuccess(
			await publishAssuranceCase(owner.id, testCase.id)
		);
		const published = await prisma.publishedAssuranceCase.findUnique({
			where: { id: data.publishedId },
		});
		const content = published?.content as {
			caseInformation?: Record<string, unknown>;
		};
		expect(content.caseInformation).toStrictEqual({
			description: "Published-time description",
			authors: "Published-time authors",
			sector: "Finance",
			featureImageUrl: "https://example.com/original.png",
		});
	});

	it("leaves the published snapshot unchanged when case information is edited after publish", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id);
		await createTestCaseInformation(testCase.id, {
			description: "Original description",
		});

		const data = expectSuccess(
			await publishAssuranceCase(owner.id, testCase.id)
		);

		await prisma.caseInformation.update({
			where: { caseId: testCase.id },
			data: { description: "Edited after publish" },
		});

		const published = await prisma.publishedAssuranceCase.findUnique({
			where: { id: data.publishedId },
		});
		const content = published?.content as {
			caseInformation?: { description?: string };
		};
		expect(content.caseInformation?.description).toBe("Original description");
	});

	it("captures fresh case information on republish (updatePublishedCase)", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id);
		await createTestCaseInformation(testCase.id, {
			description: "Before republish",
		});
		await publishAssuranceCase(owner.id, testCase.id);

		await prisma.caseInformation.update({
			where: { caseId: testCase.id },
			data: { description: "After republish" },
		});

		const updated = expectSuccess(
			await updatePublishedCase(owner.id, testCase.id)
		);
		const published = await prisma.publishedAssuranceCase.findUnique({
			where: { id: updated.publishedId },
		});
		const content = published?.content as {
			caseInformation?: { description?: string };
		};
		expect(content.caseInformation?.description).toBe("After republish");
	});
});
