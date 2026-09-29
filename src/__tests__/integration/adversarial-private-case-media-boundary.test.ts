import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import { createTestCase, createTestUser } from "../utils/prisma-factories";

/**
 * Looks beyond the four named access cases for other ways a caller might
 * reach image bytes it shouldn't: a stored key manipulated into a path-
 * traversal payload, and the Azure-backed storage path (mocked at the SDK
 * boundary, per the shared convention) receiving the same access check as
 * the local-disk path.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/services/azure-blob-adapter", () => ({
	azureUploadBlob: vi.fn(),
	azureDownloadBlob: vi.fn(),
	azureDeleteBlob: vi.fn(),
}));

beforeEach(async () => {
	await mockNoAuth();
});

afterEach(() => {
	vi.clearAllMocks();
});

describe("a stored key manipulated into a path-traversal payload", () => {
	const traversalPayloads = [
		"../../../../etc/passwd",
		"/etc/passwd",
		"images/../../../etc/passwd",
		"..\\..\\windows\\win.ini",
	];

	it.each(
		traversalPayloads
	)("never reads outside the uploads root for %s", async (payload) => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const { prisma } = await import("@/lib/prisma");
		await prisma.caseInformation.create({
			data: { caseId: testCase.id, featureImageUrl: payload },
		});
		await mockAuth(owner.id, owner.username, owner.email);

		const { GET } = await import("@/app/api/cases/[id]/media/feature/route");
		const response = await GET(
			new NextRequest(
				`http://localhost:3000/api/cases/${testCase.id}/media/feature`
			),
			{ params: Promise.resolve({ id: testCase.id }) }
		);

		expect(response.status).toBe(404);
		const body = await response.arrayBuffer();
		expect(body.byteLength).toBe(0);
	});
});

describe("the Azure-backed storage path", () => {
	const blobs = new Map<string, { data: Buffer; contentType: string }>();

	beforeEach(async () => {
		process.env.AZURE_STORAGE_ACCOUNT_NAME = "testaccount";
		process.env.AZURE_STORAGE_ACCOUNT_KEY = "dGVzdGtleQ==";
		blobs.clear();

		const adapter = await import("@/lib/services/azure-blob-adapter");
		vi.mocked(adapter.azureUploadBlob).mockImplementation(
			(key: string, data: Buffer, contentType: string) => {
				blobs.set(key, { data, contentType });
				return Promise.resolve(true);
			}
		);
		vi.mocked(adapter.azureDownloadBlob).mockImplementation((key: string) => {
			const blob = blobs.get(key);
			return Promise.resolve(blob ? { ...blob } : null);
		});
		vi.mocked(adapter.azureDeleteBlob).mockImplementation((key: string) => {
			blobs.delete(key);
			return Promise.resolve(true);
		});
	});

	afterEach(() => {
		process.env.AZURE_STORAGE_ACCOUNT_NAME = undefined;
		process.env.AZURE_STORAGE_ACCOUNT_KEY = undefined;
	});

	it("still refuses a user without access, and still serves VIEW access, on the Azure backend", async () => {
		const owner = await createTestUser();
		const stranger = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const key = "images/azure-shot.png";
		blobs.set(key, {
			data: Buffer.from([1, 2, 3, 4]),
			contentType: "image/png",
		});
		const { prisma } = await import("@/lib/prisma");
		await prisma.caseImage.create({
			data: {
				caseId: testCase.id,
				imageUrl: key,
				uploadedAt: new Date(),
				uploadedById: owner.id,
			},
		});

		const { GET } = await import("@/app/api/cases/[id]/media/screenshot/route");

		await mockAuth(stranger.id, stranger.username, stranger.email);
		const denied = await GET(
			new NextRequest(
				`http://localhost:3000/api/cases/${testCase.id}/media/screenshot`
			),
			{ params: Promise.resolve({ id: testCase.id }) }
		);
		expect(denied.status).toBe(404);

		await mockAuth(owner.id, owner.username, owner.email);
		const allowed = await GET(
			new NextRequest(
				`http://localhost:3000/api/cases/${testCase.id}/media/screenshot`
			),
			{ params: Promise.resolve({ id: testCase.id }) }
		);
		expect(allowed.status).toBe(200);
		const body = Buffer.from(await allowed.arrayBuffer());
		expect(body.equals(Buffer.from([1, 2, 3, 4]))).toBe(true);
	});

	it("copies and deletes a published image copy on the Azure backend", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const { createTestElement } = await import("../utils/prisma-factories");
		await createTestElement(testCase.id, owner.id, {
			elementType: "GOAL",
			role: "TOP_LEVEL",
		});
		// Shaped `cases/<caseId>/case-information/...` — the only shape the
		// publish-time copy step accepts for a given case (F1c).
		const liveKey = `cases/${testCase.id}/case-information/feature.png`;
		blobs.set(liveKey, {
			data: Buffer.from([9, 9, 9]),
			contentType: "image/png",
		});
		const { prisma } = await import("@/lib/prisma");
		await prisma.caseInformation.create({
			data: {
				caseId: testCase.id,
				description: "d",
				authors: "a",
				sector: "Healthcare",
				featureImageUrl: liveKey,
			},
		});

		const { publishAssuranceCase, unpublishAssuranceCase } = await import(
			"@/lib/services/publish-service"
		);
		const published = await publishAssuranceCase(owner.id, testCase.id);
		if ("error" in published) {
			throw new Error(published.error);
		}

		const publishedKeys = [...blobs.keys()].filter((k) =>
			k.startsWith("published/")
		);
		expect(publishedKeys).toHaveLength(1);

		const unpublished = await unpublishAssuranceCase(owner.id, testCase.id);
		expect("error" in unpublished).toBe(false);

		expect(blobs.has(publishedKeys[0] as string)).toBe(false);
	});
});
