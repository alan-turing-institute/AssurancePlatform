import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { UPLOADS_DIR } from "@/lib/services/blob-storage-service";
import {
	purgeCase,
	purgeExpiredCases,
	softDeleteCase,
} from "@/lib/services/case-trash-service";
import { getPublishedItemMedia } from "@/lib/services/discover-service";
import { publishAssuranceCase } from "@/lib/services/publish-service";
import { expectSuccess } from "../utils/assertion-helpers";
import {
	createTestCase,
	createTestCaseInformation,
	createTestCaseWithGoal,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * Permanently deleting a case removes its screenshot and feature-image files
 * from the (local) uploads root, through the real storage service.
 */

const CRON_SECRET = "test-cron-secret";

async function writeUpload(key: string): Promise<string> {
	const filePath = join(UPLOADS_DIR, key);
	await mkdir(join(filePath, ".."), { recursive: true });
	await writeFile(filePath, Buffer.from("fake-image-bytes"));
	return key;
}

function onDisk(key: string): boolean {
	return existsSync(join(UPLOADS_DIR, key));
}

/** A case in Trash with a screenshot and a feature image, both on disk. */
async function trashedCaseWithImages(userId: string, daysAgo = 0) {
	const testCase = await createTestCaseWithGoal(userId);
	const screenshot = await writeUpload(
		`images/case-screenshot-${testCase.id}-1700000000000.png`
	);
	const feature = await writeUpload(
		`cases/${testCase.id}/case-information/live.png`
	);
	await prisma.caseImage.create({
		data: {
			caseId: testCase.id,
			imageUrl: screenshot,
			uploadedAt: new Date(),
			uploadedById: userId,
		},
	});
	await createTestCaseInformation(testCase.id, { featureImageUrl: feature });
	const deletedAt = new Date();
	deletedAt.setDate(deletedAt.getDate() - daysAgo);
	await prisma.assuranceCase.update({
		where: { id: testCase.id },
		data: { deletedAt, deletedById: userId },
	});
	return { testCase, screenshot, feature };
}

describe("purging a case deletes its image files", () => {
	it("purgeCase removes the screenshot and the feature image", async () => {
		const owner = await createTestUser();
		const { testCase, screenshot, feature } = await trashedCaseWithImages(
			owner.id
		);

		expectSuccess(await purgeCase(owner.id, testCase.id));

		expect(onDisk(screenshot)).toBe(false);
		expect(onDisk(feature)).toBe(false);
	});

	it("purgeExpiredCases removes only the expired cases' files", async () => {
		vi.stubEnv("CRON_SECRET", CRON_SECRET);
		try {
			const owner = await createTestUser();
			const expired = await trashedCaseWithImages(owner.id, 31);
			const recent = await trashedCaseWithImages(owner.id, 1);

			const result = expectSuccess(await purgeExpiredCases(CRON_SECRET));

			expect(result.purgedCount).toBe(1);
			expect(onDisk(expired.screenshot)).toBe(false);
			expect(onDisk(expired.feature)).toBe(false);
			expect(onDisk(recent.screenshot)).toBe(true);
			expect(onDisk(recent.feature)).toBe(true);
		} finally {
			vi.unstubAllEnvs();
		}
	});

	it("keeps a feature image and a screenshot that sit outside the case's own keys", async () => {
		const owner = await createTestUser();
		const other = await createTestCase(owner.id);
		const foreignFeature = await writeUpload(
			`cases/${other.id}/case-information/other.png`
		);
		const foreignScreenshot = await writeUpload(
			`images/case-screenshot-${other.id}-1700000000000.png`
		);
		const testCase = await createTestCaseWithGoal(owner.id);
		await prisma.caseImage.create({
			data: {
				caseId: testCase.id,
				imageUrl: foreignScreenshot,
				uploadedAt: new Date(),
				uploadedById: owner.id,
			},
		});
		await createTestCaseInformation(testCase.id, {
			featureImageUrl: foreignFeature,
		});
		await prisma.assuranceCase.update({
			where: { id: testCase.id },
			data: { deletedAt: new Date(), deletedById: owner.id },
		});

		expectSuccess(await purgeCase(owner.id, testCase.id));

		expect(onDisk(foreignFeature)).toBe(true);
		expect(onDisk(foreignScreenshot)).toBe(true);
	});

	it("keeps an archived copy's published/ image", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id);
		const feature = await writeUpload(
			`cases/${testCase.id}/case-information/live.png`
		);
		await createTestCaseInformation(testCase.id, { featureImageUrl: feature });
		const published = expectSuccess(
			await publishAssuranceCase(owner.id, testCase.id)
		);
		await softDeleteCase(owner.id, testCase.id, { publishedCopy: "archive" });
		const row = await prisma.publishedAssuranceCase.findUniqueOrThrow({
			where: { id: published.publishedId },
		});
		const copyKey = (
			row.content as { caseInformation: { featureImageUrl: string } }
		).caseInformation.featureImageUrl;
		expect(copyKey.startsWith("published/")).toBe(true);
		expect(onDisk(copyKey)).toBe(true);

		expectSuccess(await purgeCase(owner.id, testCase.id));

		expect(onDisk(feature)).toBe(false);
		expect(onDisk(copyKey)).toBe(true);
	});

	it.each([
		["a bare key", (key: string) => key],
		["an /uploads/ path", (key: string) => `/uploads/${key}`],
		[
			"an Azure blob URL",
			(key: string) => `https://account.blob.core.windows.net/media/${key}`,
		],
	])("keeps a live key that an older archived snapshot names as %s", async (_label, toStored) => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id);
		const feature = await writeUpload(
			`cases/${testCase.id}/case-information/live.png`
		);
		await createTestCaseInformation(testCase.id, { featureImageUrl: feature });
		const published = expectSuccess(
			await publishAssuranceCase(owner.id, testCase.id)
		);
		await softDeleteCase(owner.id, testCase.id, { publishedCopy: "archive" });
		const row = await prisma.publishedAssuranceCase.findUniqueOrThrow({
			where: { id: published.publishedId },
		});
		const content = row.content as {
			caseInformation: { featureImageUrl: string };
		};
		content.caseInformation.featureImageUrl = toStored(feature);
		await prisma.publishedAssuranceCase.update({
			where: { id: row.id },
			data: { content },
		});

		expectSuccess(await purgeCase(owner.id, testCase.id));

		expect(onDisk(feature)).toBe(true);
	});

	it("keeps a live key that another case's published copy names, and that copy still serves it", async () => {
		const owner = await createTestUser();
		const { testCase, feature } = await trashedCaseWithImages(owner.id);
		const other = await createTestCaseWithGoal(owner.id);
		const published = expectSuccess(
			await publishAssuranceCase(owner.id, other.id)
		);
		const row = await prisma.publishedAssuranceCase.findUniqueOrThrow({
			where: { id: published.publishedId },
		});
		const content = row.content as {
			caseInformation?: { featureImageUrl?: string };
		};
		content.caseInformation = { featureImageUrl: feature };
		await prisma.publishedAssuranceCase.update({
			where: { id: row.id },
			data: { content },
		});

		expectSuccess(await purgeCase(owner.id, testCase.id));

		expect(onDisk(feature)).toBe(true);
		const media = await getPublishedItemMedia(row.slug, row.id);
		expect(media.status).toBe("ok");
	});

	it("leaves a case restored before the purge's transaction untouched", async () => {
		const owner = await createTestUser();
		const { testCase, screenshot, feature } = await trashedCaseWithImages(
			owner.id
		);
		const realFindUnique = prisma.assuranceCase.findUnique.bind(
			prisma.assuranceCase
		);
		const spy = vi
			.spyOn(prisma.assuranceCase, "findUnique")
			.mockImplementationOnce(((args: never) => {
				const pending = realFindUnique(args);
				return pending.then(async (found) => {
					await prisma.assuranceCase.update({
						where: { id: testCase.id },
						data: { deletedAt: null, deletedById: null },
					});
					return found;
				});
			}) as never);
		try {
			const result = await purgeCase(owner.id, testCase.id);

			expect("error" in result).toBe(true);
		} finally {
			spy.mockRestore();
		}

		expect(
			await prisma.assuranceCase.findUnique({ where: { id: testCase.id } })
		).not.toBeNull();
		expect(onDisk(screenshot)).toBe(true);
		expect(onDisk(feature)).toBe(true);
	});

	it("purgeExpiredCases leaves a case restored after the expired list was read", async () => {
		vi.stubEnv("CRON_SECRET", CRON_SECRET);
		const owner = await createTestUser();
		const { testCase, screenshot, feature } = await trashedCaseWithImages(
			owner.id,
			31
		);
		const realFindMany = prisma.assuranceCase.findMany.bind(
			prisma.assuranceCase
		);
		const spy = vi
			.spyOn(prisma.assuranceCase, "findMany")
			.mockImplementationOnce(((args: never) =>
				realFindMany(args).then(async (rows) => {
					await prisma.assuranceCase.update({
						where: { id: testCase.id },
						data: { deletedAt: null, deletedById: null },
					});
					return rows;
				})) as never);
		try {
			const result = expectSuccess(await purgeExpiredCases(CRON_SECRET));

			expect(result.purgedCount).toBe(0);
		} finally {
			spy.mockRestore();
			vi.unstubAllEnvs();
		}

		expect(
			await prisma.assuranceCase.findUnique({ where: { id: testCase.id } })
		).not.toBeNull();
		expect(onDisk(screenshot)).toBe(true);
		expect(onDisk(feature)).toBe(true);
	});

	it("still returns success when a file cannot be deleted", async () => {
		const owner = await createTestUser();
		const { testCase, screenshot, feature } = await trashedCaseWithImages(
			owner.id
		);
		// A directory at the key makes the file delete fail.
		await rm(join(UPLOADS_DIR, feature));
		await mkdir(join(UPLOADS_DIR, feature), { recursive: true });
		await writeFile(join(UPLOADS_DIR, feature, "inner"), "x");

		expectSuccess(await purgeCase(owner.id, testCase.id));

		expect(
			await prisma.assuranceCase.findUnique({ where: { id: testCase.id } })
		).toBeNull();
		expect(onDisk(screenshot)).toBe(false);
	});
});
