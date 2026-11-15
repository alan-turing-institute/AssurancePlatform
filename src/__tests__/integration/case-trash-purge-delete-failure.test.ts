import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { UPLOADS_DIR } from "@/lib/services/blob-storage-service";
import { purgeCase } from "@/lib/services/case-trash-service";
import { expectSuccess } from "../utils/assertion-helpers";
import {
	createTestCaseInformation,
	createTestCaseWithGoal,
	createTestUser,
} from "../utils/prisma-factories";

// The screenshot delete throws; every other delete runs for real.
vi.mock("@/lib/services/file-storage-service", async (importOriginal) => {
	const actual =
		await importOriginal<
			typeof import("@/lib/services/file-storage-service")
		>();
	return {
		...actual,
		deleteFile: vi.fn((filePath: string) =>
			filePath.startsWith("images/")
				? Promise.reject(new Error("storage unavailable"))
				: actual.deleteFile(filePath)
		),
	};
});

async function writeUpload(key: string): Promise<string> {
	const filePath = join(UPLOADS_DIR, key);
	await mkdir(join(filePath, ".."), { recursive: true });
	await writeFile(filePath, Buffer.from("fake-image-bytes"));
	return key;
}

describe("a file delete that throws during a purge", () => {
	it("is swallowed: the purge succeeds and the other file is still removed", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id);
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
				uploadedById: owner.id,
			},
		});
		await createTestCaseInformation(testCase.id, { featureImageUrl: feature });
		await prisma.assuranceCase.update({
			where: { id: testCase.id },
			data: { deletedAt: new Date(), deletedById: owner.id },
		});

		expectSuccess(await purgeCase(owner.id, testCase.id));

		expect(
			await prisma.assuranceCase.findUnique({ where: { id: testCase.id } })
		).toBeNull();
		expect(existsSync(join(UPLOADS_DIR, feature))).toBe(false);
	});
});
