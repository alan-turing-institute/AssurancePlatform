import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { UPLOADS_DIR } from "@/lib/services/blob-storage-service";
import {
	publishAssuranceCase,
	updatePublishedCase,
} from "@/lib/services/publish-service";
import {
	createTestCaseInformation,
	createTestCaseWithGoal,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * Route-level coverage for `GET /api/public/discover/[slug]/image/
 * [versionId]` — anonymous, no session anywhere in this file. Local disk is
 * this test environment's active backend (Azure is exercised at the service
 * layer and via the private-media route tests).
 */

const PNG_MAGIC_BYTES = Buffer.from([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const NON_EXISTENT_VERSION_ID = "00000000-0000-0000-0000-000000000000";

async function seedLiveFeatureImage(caseId: string): Promise<string> {
	const key = `cases/${caseId}/case-information/original.png`;
	const filePath = join(UPLOADS_DIR, key);
	await mkdir(join(filePath, ".."), { recursive: true });
	await writeFile(filePath, PNG_MAGIC_BYTES);
	return key;
}

async function publishWithFeatureImage() {
	const owner = await createTestUser();
	const testCase = await createTestCaseWithGoal(owner.id);
	const liveKey = await seedLiveFeatureImage(testCase.id);
	await createTestCaseInformation(testCase.id, { featureImageUrl: liveKey });
	const result = await publishAssuranceCase(owner.id, testCase.id);
	if ("error" in result) {
		throw new Error(result.error);
	}
	const row = await prisma.publishedAssuranceCase.findUniqueOrThrow({
		where: { id: result.data.publishedId },
	});
	return { owner, testCase, slug: row.slug, versionId: row.id };
}

function getRoute() {
	return import("@/app/api/public/discover/[slug]/image/[versionId]/route");
}

describe("GET /api/public/discover/[slug]/image/[versionId]", () => {
	it("returns 200 anonymously for the current published version", async () => {
		const { slug, versionId } = await publishWithFeatureImage();

		const { GET } = await getRoute();
		const req = new NextRequest(
			`http://localhost:3000/api/public/discover/${slug}/image/${versionId}`
		);
		const response = await GET(req, {
			params: Promise.resolve({ slug, versionId }),
		});

		expect(response.status).toBe(200);
		expect(response.headers.get("Cache-Control")).toBe(
			"public, max-age=31536000, immutable"
		);
		expect(response.headers.get("Content-Length")).toBe(
			String(PNG_MAGIC_BYTES.byteLength)
		);
		const body = Buffer.from(await response.arrayBuffer());
		expect(body.equals(PNG_MAGIC_BYTES)).toBe(true);
	});

	it("returns 404 for a superseded version after a republish", async () => {
		const {
			owner,
			testCase,
			slug,
			versionId: firstVersionId,
		} = await publishWithFeatureImage();
		const republished = await updatePublishedCase(owner.id, testCase.id);
		if ("error" in republished) {
			throw new Error(republished.error);
		}

		const { GET } = await getRoute();
		const req = new NextRequest(
			`http://localhost:3000/api/public/discover/${slug}/image/${firstVersionId}`
		);
		const response = await GET(req, {
			params: Promise.resolve({ slug, versionId: firstVersionId }),
		});

		expect(response.status).toBe(404);
		expect(await response.text()).toBe("");
	});

	it("returns 200 at the new address after a republish", async () => {
		const { owner, testCase, slug } = await publishWithFeatureImage();
		const republished = await updatePublishedCase(owner.id, testCase.id);
		if ("error" in republished) {
			throw new Error(republished.error);
		}

		const { GET } = await getRoute();
		const req = new NextRequest(
			`http://localhost:3000/api/public/discover/${slug}/image/${republished.data.publishedId}`
		);
		const response = await GET(req, {
			params: Promise.resolve({
				slug,
				versionId: republished.data.publishedId,
			}),
		});

		expect(response.status).toBe(200);
	});

	it("returns 404 for an unknown slug", async () => {
		const { GET } = await getRoute();
		const req = new NextRequest(
			`http://localhost:3000/api/public/discover/no-such-slug/image/${NON_EXISTENT_VERSION_ID}`
		);
		const response = await GET(req, {
			params: Promise.resolve({
				slug: "no-such-slug",
				versionId: NON_EXISTENT_VERSION_ID,
			}),
		});
		expect(response.status).toBe(404);
	});

	it("returns 404 for a malformed versionId rather than erroring", async () => {
		const { slug } = await publishWithFeatureImage();

		const { GET } = await getRoute();
		const req = new NextRequest(
			`http://localhost:3000/api/public/discover/${slug}/image/not-a-uuid`
		);
		const response = await GET(req, {
			params: Promise.resolve({ slug, versionId: "not-a-uuid" }),
		});
		expect(response.status).toBe(404);
	});

	it("returns 404 for a published case with no feature image", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id);
		// No case-information at all — captureCaseInformationForSnapshot omits
		// the key entirely, same outcome as an explicit null.
		const result = await publishAssuranceCase(owner.id, testCase.id);
		if ("error" in result) {
			throw new Error(result.error);
		}
		const row = await prisma.publishedAssuranceCase.findUniqueOrThrow({
			where: { id: result.data.publishedId },
		});

		const { GET } = await getRoute();
		const req = new NextRequest(
			`http://localhost:3000/api/public/discover/${row.slug}/image/${row.id}`
		);
		const response = await GET(req, {
			params: Promise.resolve({ slug: row.slug, versionId: row.id }),
		});
		expect(response.status).toBe(404);
	});

	it("serves bytes for an older snapshot whose recorded value is a legacy /uploads/<key> path", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id);
		const result = await publishAssuranceCase(owner.id, testCase.id);
		if ("error" in result) {
			throw new Error(result.error);
		}
		const row = await prisma.publishedAssuranceCase.findUniqueOrThrow({
			where: { id: result.data.publishedId },
		});
		// Simulates a snapshot published before this app started copying
		// images at publish time — its recorded value is a live, uncopied
		// legacy path rather than a `published/` key.
		const key = `legacy/${testCase.id}.png`;
		const filePath = join(UPLOADS_DIR, key);
		await mkdir(join(filePath, ".."), { recursive: true });
		await writeFile(filePath, PNG_MAGIC_BYTES);
		await prisma.publishedAssuranceCase.update({
			where: { id: row.id },
			data: {
				content: {
					...(row.content as Record<string, unknown>),
					caseInformation: { featureImageUrl: `/uploads/${key}` },
				},
			},
		});

		const { GET } = await getRoute();
		const req = new NextRequest(
			`http://localhost:3000/api/public/discover/${row.slug}/image/${row.id}`
		);
		const response = await GET(req, {
			params: Promise.resolve({ slug: row.slug, versionId: row.id }),
		});

		expect(response.status).toBe(200);
		const body = Buffer.from(await response.arrayBuffer());
		expect(body.equals(PNG_MAGIC_BYTES)).toBe(true);
	});

	it("serves bytes for an older snapshot whose recorded value is a legacy Azure blob URL", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCaseWithGoal(owner.id);
		const result = await publishAssuranceCase(owner.id, testCase.id);
		if ("error" in result) {
			throw new Error(result.error);
		}
		const row = await prisma.publishedAssuranceCase.findUniqueOrThrow({
			where: { id: result.data.publishedId },
		});
		const key = `legacy/${testCase.id}-blob.png`;
		const filePath = join(UPLOADS_DIR, key);
		await mkdir(join(filePath, ".."), { recursive: true });
		await writeFile(filePath, PNG_MAGIC_BYTES);
		await prisma.publishedAssuranceCase.update({
			where: { id: row.id },
			data: {
				content: {
					...(row.content as Record<string, unknown>),
					caseInformation: {
						featureImageUrl: `https://teststorageaccount.blob.core.windows.net/media/${key}`,
					},
				},
			},
		});

		const { GET } = await getRoute();
		const req = new NextRequest(
			`http://localhost:3000/api/public/discover/${row.slug}/image/${row.id}`
		);
		const response = await GET(req, {
			params: Promise.resolve({ slug: row.slug, versionId: row.id }),
		});

		expect(response.status).toBe(200);
		const body = Buffer.from(await response.arrayBuffer());
		expect(body.equals(PNG_MAGIC_BYTES)).toBe(true);
	});
});
