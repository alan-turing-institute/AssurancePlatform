import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { UPLOADS_DIR } from "@/lib/services/blob-storage-service";
import { readMedia } from "@/lib/services/file-storage-service";
import { setPluginEnabledForUser } from "@/lib/services/plugin-enablement-service";
import {
	getFullPublishStatus,
	getPublishStatus,
	publishAssuranceCase,
	transitionStatus,
	unpublishAssuranceCase,
	updatePublishedCase,
} from "@/lib/services/publish-service";
import { Prisma } from "@/src/generated/prisma";
import {
	expectError,
	expectSameError,
	expectSuccess,
} from "../utils/assertion-helpers";
import {
	createTestCase,
	createTestCaseInformation,
	createTestCaseWithGoal,
	createTestElement,
	createTestPermission,
	createTestPluginData,
	createTestUser,
} from "../utils/prisma-factories";
import { holdRowLock, waitForLockWait } from "../utils/row-lock-test-utils";

// Top-level regex constants required by lint/performance/useTopLevelRegex
const INVALID_STATUS_TRANSITION = /Invalid status transition/;
const PUBLISHED_MEDIA_KEY_PATTERN = /^published\//;

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

	it("deletes every published version on unpublish", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id);

		// Publish, then republish so more than one historical row exists.
		await publishAssuranceCase(owner.id, testCase.id);
		await updatePublishedCase(owner.id, testCase.id);

		const data = expectSuccess(
			await unpublishAssuranceCase(owner.id, testCase.id)
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

		// The superseded row is retired and the replacement takes over as the
		// sole current row — the exact two-row invariant the partial unique
		// index on (slug) WHERE is_current exists to protect (ADR 0003 §6).
		const oldVersion = await prisma.publishedAssuranceCase.findUnique({
			where: { id: publishData.publishedId },
		});
		expect(oldVersion?.isCurrent).toBe(false);
		expect(newVersion?.isCurrent).toBe(true);
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

	it("reuses a freed slug after the case holding it is unpublished, rather than continuing the suffix sequence", async () => {
		const owner = await createTestUser();
		const caseA = await createTestCaseWithGoal(owner.id, "Foo");
		const caseB = await createTestCaseWithGoal(owner.id, "Foo");
		const caseC = await createTestCaseWithGoal(owner.id, "Foo");

		// A claims "foo", B collides onto "foo-2"
		const publishedA = expectSuccess(
			await publishAssuranceCase(owner.id, caseA.id)
		);
		const publishedB = expectSuccess(
			await publishAssuranceCase(owner.id, caseB.id)
		);
		const [versionA, versionB] = await Promise.all([
			prisma.publishedAssuranceCase.findUnique({
				where: { id: publishedA.publishedId },
			}),
			prisma.publishedAssuranceCase.findUnique({
				where: { id: publishedB.publishedId },
			}),
		]);
		expect(versionA?.slug).toBe("foo");
		expect(versionB?.slug).toBe("foo-2");

		// Unpublishing A frees "foo" — its row (and the slug it held) is gone
		expectSuccess(await unpublishAssuranceCase(owner.id, caseA.id));

		// C should reclaim the freed "foo", not continue on to "foo-3"
		const publishedC = expectSuccess(
			await publishAssuranceCase(owner.id, caseC.id)
		);
		const versionC = await prisma.publishedAssuranceCase.findUnique({
			where: { id: publishedC.publishedId },
		});
		expect(versionC?.slug).toBe("foo");
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
// Database constraint hardening (ADR 0003 §6)
// ============================================

describe("published_assurance_cases_slug_is_current_key — partial unique index", () => {
	it("rejects a raw insert of a second CURRENT row reusing another case's current slug", async () => {
		const owner = await createTestUser();
		const caseA = await createTestCaseWithGoal(owner.id, "Solo Slug");
		const caseB = await createTestCase(owner.id);

		await publishAssuranceCase(owner.id, caseA.id);

		// Bypass the service entirely — the service's own transaction
		// discipline (retire the old current row before inserting the new one,
		// see `swapCurrentPublishedVersion` in publish-service.ts) never
		// produces two CURRENT rows sharing a slug. This proves the partial
		// unique index on (slug) WHERE is_current is itself the backstop, not
		// merely a property of well-behaved callers.
		let caught: unknown;
		try {
			await prisma.publishedAssuranceCase.create({
				data: {
					title: "Colliding Case",
					slug: "solo-slug",
					isCurrent: true,
					content: {},
					assuranceCaseId: caseB.id,
					createdAt: new Date(),
				},
			});
		} catch (error) {
			caught = error;
		}

		expect(caught).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
		expect((caught as Prisma.PrismaClientKnownRequestError).code).toBe("P2002");
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

// ============================================
// archivePublishedCopies — does not re-stamp an already-archived copy
// ============================================

describe("archivePublishedCopies — idempotent against an already-archived copy", () => {
	it("keeps the original archivedAt and archivedOwnerId when run again over the same case", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id, "Re-Archive");
		const published = expectSuccess(
			await publishAssuranceCase(owner.id, testCase.id)
		);

		const { archivePublishedCopies } = await import(
			"@/lib/services/publish-service"
		);
		await prisma.$transaction((tx) =>
			archivePublishedCopies(tx, [testCase.id], owner.id)
		);
		const firstArchive = await prisma.publishedAssuranceCase.findUniqueOrThrow({
			where: { id: published.publishedId },
		});
		expect(firstArchive.archivedAt).not.toBeNull();
		expect(firstArchive.archivedOwnerId).toBe(owner.id);

		// A later sweep over the same already-trashed case — e.g. an
		// account-deletion retry, which archives with `ownerId: null` — must
		// not touch a copy that's already archived.
		await prisma.$transaction((tx) =>
			archivePublishedCopies(tx, [testCase.id], null)
		);
		const secondArchive = await prisma.publishedAssuranceCase.findUniqueOrThrow(
			{
				where: { id: published.publishedId },
			}
		);
		expect(secondArchive.archivedAt).toEqual(firstArchive.archivedAt);
		expect(secondArchive.archivedOwnerId).toBe(owner.id);
	});
});

// ============================================
// A case in Trash cannot be published or republished, including when the
// two actions overlap
// ============================================

describe("publishAssuranceCase / updatePublishedCase — refused for a trashed case", () => {
	it("refuses to publish a trashed, never-published case", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id, "Trashed Draft");
		const { softDeleteCase } = await import(
			"@/lib/services/case-trash-service"
		);
		await softDeleteCase(owner.id, testCase.id);

		expectError(await publishAssuranceCase(owner.id, testCase.id));

		const updated = await prisma.assuranceCase.findUniqueOrThrow({
			where: { id: testCase.id },
		});
		expect(updated.published).toBe(false);
	});

	it("refuses to republish a trashed, already-published case whose copy was kept archived", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(
			owner.id,
			"Trashed Published"
		);
		await publishAssuranceCase(owner.id, testCase.id);
		const { softDeleteCase } = await import(
			"@/lib/services/case-trash-service"
		);
		await softDeleteCase(owner.id, testCase.id, { publishedCopy: "archive" });

		expectError(
			await updatePublishedCase(owner.id, testCase.id, "Should not land")
		);
	});
});

// ============================================
// The trash race, reached for real: every test above trashes the case
// BEFORE calling publish/republish, so the permission check (which treats
// a trashed case as not found) refuses first and never reaches the guard
// inside the transaction. These force a genuine Postgres row-lock wait so
// the case is trashed mid-transaction instead — after the permission
// check has already passed.
// ============================================

describe("publishAssuranceCase / updatePublishedCase — the trash race, reached for real", () => {
	it('returns "Case not found" and creates no row when the case is trashed mid-transaction during first publish', async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(
			owner.id,
			"Race First Publish"
		);

		const holder = await holdRowLock(async (tx) => {
			await tx.assuranceCase.update({
				where: { id: testCase.id },
				data: { deletedAt: new Date(), deletedById: owner.id },
			});
		});

		const publishPromise = publishAssuranceCase(owner.id, testCase.id);
		// `publishAssuranceCase`'s own permission check is a plain read, which
		// (unlike the guarded write further in) never blocks on the holder's
		// row lock — it just races the holder's commit. Waiting for Postgres to
		// report it blocked on a lock proves it has reached the guarded write,
		// so the race lands where it's meant to: inside the transaction, not here.
		await waitForLockWait();
		await holder.release();
		const result = await publishPromise;

		expectError(result, "Case not found");

		const rows = await prisma.publishedAssuranceCase.findMany({
			where: { assuranceCaseId: testCase.id },
		});
		expect(rows).toHaveLength(0);
	});

	it('returns "Case not found" and leaves the existing published row untouched when the case is trashed mid-transaction during republish', async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id, "Race Republish");
		const published = expectSuccess(
			await publishAssuranceCase(owner.id, testCase.id)
		);

		const holder = await holdRowLock(async (tx) => {
			await tx.assuranceCase.update({
				where: { id: testCase.id },
				data: { deletedAt: new Date(), deletedById: owner.id },
			});
		});

		const republishPromise = updatePublishedCase(
			owner.id,
			testCase.id,
			"Should not land"
		);
		// See the equivalent comment in the first-publish test above.
		await waitForLockWait();
		await holder.release();
		const result = await republishPromise;

		expectError(result, "Case not found");

		const rows = await prisma.publishedAssuranceCase.findMany({
			where: { assuranceCaseId: testCase.id },
		});
		expect(rows).toHaveLength(1);
		expect(rows[0]!.id).toBe(published.publishedId);
		expect(rows[0]!.isCurrent).toBe(true);
	});
});

// ============================================
// Feature-image copy at publish time
// ============================================

/** Writes a fake feature-image file directly under `UPLOADS_DIR`, as if `saveFile` had stored it there, and returns its key. */
async function seedLiveFeatureImage(caseId: string): Promise<string> {
	const key = `cases/${caseId}/case-information/original.png`;
	const filePath = join(UPLOADS_DIR, key);
	await mkdir(join(filePath, ".."), { recursive: true });
	await writeFile(filePath, Buffer.from("fake-png-bytes"));
	return key;
}

describe("publishAssuranceCase / updatePublishedCase — feature-image copy", () => {
	it("copies an internal feature image to its own published/ key, leaving the live key untouched", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id);
		const liveKey = await seedLiveFeatureImage(testCase.id);
		await createTestCaseInformation(testCase.id, { featureImageUrl: liveKey });

		const data = expectSuccess(
			await publishAssuranceCase(owner.id, testCase.id)
		);
		const published = await prisma.publishedAssuranceCase.findUnique({
			where: { id: data.publishedId },
		});
		const content = published?.content as {
			caseInformation?: { featureImageUrl?: string };
		};
		const copiedKey = content.caseInformation?.featureImageUrl;

		expect(copiedKey).toMatch(PUBLISHED_MEDIA_KEY_PATTERN);
		expect(copiedKey).not.toBe(liveKey);
		expect(await readMedia(copiedKey ?? "")).not.toBeNull();
		// The live key is untouched — still there, still itself.
		expect(await readMedia(liveKey)).not.toBeNull();
	});

	it("leaves a published copy intact when the live image is replaced afterwards", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id);
		const liveKey = await seedLiveFeatureImage(testCase.id);
		await createTestCaseInformation(testCase.id, { featureImageUrl: liveKey });

		const data = expectSuccess(
			await publishAssuranceCase(owner.id, testCase.id)
		);
		const published = await prisma.publishedAssuranceCase.findUnique({
			where: { id: data.publishedId },
		});
		const copiedKey = (
			published?.content as { caseInformation?: { featureImageUrl?: string } }
		).caseInformation?.featureImageUrl as string;

		// Simulate the editor replacing the live image (a new upload writes a
		// new key and the old one is deleted — see the information/image route).
		await prisma.caseInformation.update({
			where: { caseId: testCase.id },
			data: { featureImageUrl: "cases/x/case-information/replacement.png" },
		});

		const stillThere = await readMedia(copiedKey);
		expect(stillThere).not.toBeNull();
		expect(stillThere?.data.toString()).toBe("fake-png-bytes");
	});

	it("gives a republish its own new copy, distinct from the first publish's", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id);
		const liveKey = await seedLiveFeatureImage(testCase.id);
		await createTestCaseInformation(testCase.id, { featureImageUrl: liveKey });

		const first = expectSuccess(
			await publishAssuranceCase(owner.id, testCase.id)
		);
		const second = expectSuccess(
			await updatePublishedCase(owner.id, testCase.id)
		);

		const firstRow = await prisma.publishedAssuranceCase.findUnique({
			where: { id: first.publishedId },
		});
		const secondRow = await prisma.publishedAssuranceCase.findUnique({
			where: { id: second.publishedId },
		});
		const firstKey = (
			firstRow?.content as { caseInformation?: { featureImageUrl?: string } }
		).caseInformation?.featureImageUrl;
		const secondKey = (
			secondRow?.content as { caseInformation?: { featureImageUrl?: string } }
		).caseInformation?.featureImageUrl;

		expect(secondKey).not.toBe(firstKey);
	});

	it("does not attempt a copy for a genuine external address", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id);
		await createTestCaseInformation(testCase.id, {
			featureImageUrl: "https://example.com/original.png",
		});

		const data = expectSuccess(
			await publishAssuranceCase(owner.id, testCase.id)
		);
		const published = await prisma.publishedAssuranceCase.findUnique({
			where: { id: data.publishedId },
		});
		const content = published?.content as {
			caseInformation?: { featureImageUrl?: string };
		};
		expect(content.caseInformation?.featureImageUrl).toBe(
			"https://example.com/original.png"
		);
	});

	it("deletes the publish-time copy when the transaction fails after the copy was made", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id);
		const liveKey = await seedLiveFeatureImage(testCase.id);
		await createTestCaseInformation(testCase.id, { featureImageUrl: liveKey });

		// The worker's `published/` directory is shared across this file's
		// tests (each publish adds its own `<random id>/<filename>` file, and
		// a deleted copy leaves its now-empty parent directory behind), so a
		// snapshot of the actual FILES already there — not a top-level
		// directory listing — is what proves this test's own copy,
		// specifically, was cleaned up rather than left orphaned.
		const publishedDir = join(UPLOADS_DIR, "published");
		const listPublishedFiles = async (): Promise<string[]> => {
			const { readdir } = await import("node:fs/promises");
			const subDirs = await readdir(publishedDir).catch(() => []);
			const files = await Promise.all(
				subDirs.map(async (sub) => {
					const nested = await readdir(join(publishedDir, sub)).catch(() => []);
					return nested.map((file) => `${sub}/${file}`);
				})
			);
			return files.flat();
		};
		const filesBefore = await listPublishedFiles();

		const holder = await holdRowLock(async (tx) => {
			await tx.assuranceCase.update({
				where: { id: testCase.id },
				data: { deletedAt: new Date(), deletedById: owner.id },
			});
		});

		const publishPromise = publishAssuranceCase(owner.id, testCase.id);
		await waitForLockWait();
		await holder.release();
		const result = await publishPromise;

		expectError(result, "Case not found");

		// The copy runs before the transaction, so a transaction failure after
		// the copy was made must clean it up rather than leaving it orphaned —
		// the shared helper both publish flows use is what does this.
		const filesAfter = await listPublishedFiles();
		expect(filesAfter.sort()).toEqual(filesBefore.sort());
		// The live key is a different concern — untouched by the failure.
		expect(await readMedia(liveKey)).not.toBeNull();
	});
});

describe("unpublishAssuranceCase — feature-image copy clean-up", () => {
	it("deletes the published/ copy file when the case is unpublished", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id);
		const liveKey = await seedLiveFeatureImage(testCase.id);
		await createTestCaseInformation(testCase.id, { featureImageUrl: liveKey });

		const data = expectSuccess(
			await publishAssuranceCase(owner.id, testCase.id)
		);
		const published = await prisma.publishedAssuranceCase.findUnique({
			where: { id: data.publishedId },
		});
		const copiedKey = (
			published?.content as { caseInformation?: { featureImageUrl?: string } }
		).caseInformation?.featureImageUrl as string;
		expect(await readMedia(copiedKey)).not.toBeNull();

		expectSuccess(await unpublishAssuranceCase(owner.id, testCase.id));

		expect(await readMedia(copiedKey)).toBeNull();
		// The live key is a different concern — untouched by unpublishing.
		expect(await readMedia(liveKey)).not.toBeNull();
	});
});
