import { access, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	createTestCase,
	createTestElement,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * Adversarial coverage for the publish-time copy and its removal paths: a
 * published image must survive edits to the live case, a superseded
 * version's address must stop working the moment a new one is published, an
 * archived copy must outlive its case being permanently deleted, and every
 * path that removes a published row must also remove the file it copied —
 * never leaving an orphaned image reachable by an old address, and never
 * deleting a copy a surviving row still needs.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

const PNG_BYTES = Buffer.from([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);
const OTHER_PNG_BYTES = Buffer.from([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xff, 0xff, 0xff, 0xff,
]);

async function uploadsDir(): Promise<string> {
	const { UPLOADS_DIR } = await import("@/lib/services/blob-storage-service");
	return UPLOADS_DIR;
}

async function writeFixtureImage(key: string, data: Buffer): Promise<void> {
	const root = await uploadsDir();
	await mkdir(join(root, key, ".."), { recursive: true });
	await writeFile(join(root, key), data);
}

async function fileExistsOnDisk(key: string): Promise<boolean> {
	const root = await uploadsDir();
	try {
		await access(join(root, key));
		return true;
	} catch {
		return false;
	}
}

/** A case with a real feature-image file and the fields required to publish. */
async function setUpPublishableCase(ownerId: string) {
	const { prisma } = await import("@/lib/prisma");
	const testCase = await createTestCase(ownerId);
	await createTestElement(testCase.id, ownerId, {
		elementType: "GOAL",
		role: "TOP_LEVEL",
	});
	const liveKey = `case-studies/${testCase.id}/feature.png`;
	await writeFixtureImage(liveKey, PNG_BYTES);
	await prisma.caseInformation.create({
		data: {
			caseId: testCase.id,
			description: "A description",
			authors: "An author",
			sector: "Healthcare",
			featureImageUrl: liveKey,
		},
	});
	return { testCase, liveKey };
}

function publicImageUrl(slug: string, versionId: string): string {
	return `http://localhost:3000/api/public/discover/${slug}/image/${versionId}`;
}

async function getPublicImage(slug: string, versionId: string) {
	const { GET } = await import(
		"@/app/api/public/discover/[slug]/image/[versionId]/route"
	);
	return GET(new NextRequest(publicImageUrl(slug, versionId)), {
		params: Promise.resolve({ slug, versionId }),
	});
}

/** Reads the `published/...` key a published row's snapshot carries, or null. */
async function publishedImageKey(publishedId: string): Promise<string | null> {
	const { prisma } = await import("@/lib/prisma");
	const { extractPublishedImageKey } = await import(
		"@/lib/services/publish-service"
	);
	const row = await prisma.publishedAssuranceCase.findUniqueOrThrow({
		where: { id: publishedId },
		select: { content: true },
	});
	return extractPublishedImageKey(row.content);
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("publish-time image copy", () => {
	it("keeps the published copy after the live feature image is replaced", async () => {
		const owner = await createTestUser();
		const { testCase } = await setUpPublishableCase(owner.id);

		const { publishAssuranceCase } = await import(
			"@/lib/services/publish-service"
		);
		const published = await publishAssuranceCase(owner.id, testCase.id);
		if ("error" in published) {
			throw new Error(published.error);
		}
		const key = await publishedImageKey(published.data.publishedId);
		expect(key).toBeTruthy();
		expect(await fileExistsOnDisk(key as string)).toBe(true);

		// Replace the live image, as an editor action.
		const { prisma } = await import("@/lib/prisma");
		const newLiveKey = `case-studies/${testCase.id}/replaced.png`;
		await writeFixtureImage(newLiveKey, OTHER_PNG_BYTES);
		await prisma.caseInformation.update({
			where: { caseId: testCase.id },
			data: { featureImageUrl: newLiveKey },
		});

		// The published copy is untouched.
		expect(await fileExistsOnDisk(key as string)).toBe(true);
		const row = await prisma.publishedAssuranceCase.findUniqueOrThrow({
			where: { id: published.data.publishedId },
		});
		const stillKey = await publishedImageKey(row.id);
		expect(stillKey).toBe(key);
	});

	it("serves 200 for the current published version and 404 for a superseded one after republishing", async () => {
		const owner = await createTestUser();
		const { testCase } = await setUpPublishableCase(owner.id);

		const { publishAssuranceCase, updatePublishedCase } = await import(
			"@/lib/services/publish-service"
		);
		const first = await publishAssuranceCase(owner.id, testCase.id);
		if ("error" in first) {
			throw new Error(first.error);
		}
		const { prisma } = await import("@/lib/prisma");
		const firstRow = await prisma.publishedAssuranceCase.findUniqueOrThrow({
			where: { id: first.data.publishedId },
			select: { slug: true },
		});

		const second = await updatePublishedCase(owner.id, testCase.id);
		if ("error" in second) {
			throw new Error(second.error);
		}

		const currentResponse = await getPublicImage(
			firstRow.slug,
			second.data.publishedId
		);
		expect(currentResponse.status).toBe(200);

		const supersededResponse = await getPublicImage(
			firstRow.slug,
			first.data.publishedId
		);
		expect(supersededResponse.status).toBe(404);
	});

	it("has no public route for a case that has never been published", async () => {
		const owner = await createTestUser();
		const { testCase } = await setUpPublishableCase(owner.id);

		// Never published: fabricate the slug shape and use the case-
		// information row's own id as a plausible-looking version id — neither
		// should resolve to anything.
		const { prisma } = await import("@/lib/prisma");
		const info = await prisma.caseInformation.findUniqueOrThrow({
			where: { caseId: testCase.id },
		});
		const guessedSlug = testCase.name.toLowerCase().replace(/\s+/g, "-");

		const response = await getPublicImage(guessedSlug, info.id);
		expect(response.status).toBe(404);
	});

	it("deletes the published copy when the case is unpublished", async () => {
		const owner = await createTestUser();
		const { testCase } = await setUpPublishableCase(owner.id);

		const { publishAssuranceCase, unpublishAssuranceCase } = await import(
			"@/lib/services/publish-service"
		);
		const published = await publishAssuranceCase(owner.id, testCase.id);
		if ("error" in published) {
			throw new Error(published.error);
		}
		const key = await publishedImageKey(published.data.publishedId);
		expect(await fileExistsOnDisk(key as string)).toBe(true);

		const result = await unpublishAssuranceCase(owner.id, testCase.id);
		expect("error" in result).toBe(false);

		expect(await fileExistsOnDisk(key as string)).toBe(false);
	});

	it("deletes the published copy when the case is trashed with 'Remove from Discover'", async () => {
		const owner = await createTestUser();
		const { testCase } = await setUpPublishableCase(owner.id);

		const { publishAssuranceCase } = await import(
			"@/lib/services/publish-service"
		);
		const { softDeleteCase } = await import(
			"@/lib/services/case-trash-service"
		);
		const published = await publishAssuranceCase(owner.id, testCase.id);
		if ("error" in published) {
			throw new Error(published.error);
		}
		const key = await publishedImageKey(published.data.publishedId);

		const result = await softDeleteCase(owner.id, testCase.id, {
			publishedCopy: "remove",
		});
		expect("error" in result).toBe(false);

		expect(await fileExistsOnDisk(key as string)).toBe(false);
	});

	it("keeps the archived copy's file reachable after its case is permanently deleted", async () => {
		const owner = await createTestUser();
		const { testCase } = await setUpPublishableCase(owner.id);

		const { publishAssuranceCase } = await import(
			"@/lib/services/publish-service"
		);
		const { softDeleteCase, purgeCase } = await import(
			"@/lib/services/case-trash-service"
		);
		const published = await publishAssuranceCase(owner.id, testCase.id);
		if ("error" in published) {
			throw new Error(published.error);
		}
		const { prisma } = await import("@/lib/prisma");
		const row = await prisma.publishedAssuranceCase.findUniqueOrThrow({
			where: { id: published.data.publishedId },
			select: { slug: true, id: true },
		});
		const key = await publishedImageKey(row.id);

		const archiveResult = await softDeleteCase(owner.id, testCase.id, {
			publishedCopy: "archive",
		});
		expect("error" in archiveResult).toBe(false);

		// The archived copy still resolves before the case is purged.
		const beforePurge = await getPublicImage(row.slug, row.id);
		expect(beforePurge.status).toBe(200);

		const purgeResult = await purgeCase(owner.id, testCase.id);
		expect("error" in purgeResult).toBe(false);

		// The case row is gone, but the archived published row (and its file)
		// survive, and Discover's archived page still resolves the image.
		const stillCase = await prisma.assuranceCase.findUnique({
			where: { id: testCase.id },
		});
		expect(stillCase).toBeNull();

		expect(await fileExistsOnDisk(key as string)).toBe(true);
		const afterPurge = await getPublicImage(row.slug, row.id);
		expect(afterPurge.status).toBe(200);
	});

	it("deletes an archived copy's file when its owner removes it through the trash page", async () => {
		const owner = await createTestUser();
		const { testCase } = await setUpPublishableCase(owner.id);

		const { publishAssuranceCase } = await import(
			"@/lib/services/publish-service"
		);
		const { softDeleteCase, removeArchivedCopy } = await import(
			"@/lib/services/case-trash-service"
		);
		const published = await publishAssuranceCase(owner.id, testCase.id);
		if ("error" in published) {
			throw new Error(published.error);
		}
		const key = await publishedImageKey(published.data.publishedId);

		await softDeleteCase(owner.id, testCase.id, { publishedCopy: "archive" });

		const removeResult = await removeArchivedCopy(
			owner.id,
			published.data.publishedId
		);
		expect("error" in removeResult).toBe(false);

		expect(await fileExistsOnDisk(key as string)).toBe(false);
	});
});
