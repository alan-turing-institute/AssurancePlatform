import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UPLOADS_DIR } from "@/lib/services/blob-storage-service";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	createTestCase,
	createTestCaseInformation,
	createTestPermission,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * Route-level coverage for the two private-media routes (D1):
 * `GET /api/cases/[id]/media/screenshot` and `GET /api/cases/[id]/media/
 * feature`. Both are exercised against the local-disk backend (the default
 * in this test environment) and again with Azure "configured" — stubbing
 * `AZURE_STORAGE_ACCOUNT_NAME`/`_KEY` and mocking `azure-blob-adapter.ts`,
 * the one seam this repo mocks for Azure, so the branching logic in
 * `readMedia` runs for real against real Postgres either way.
 */

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/services/azure-blob-adapter", () => ({
	azureDownloadBlob: vi.fn(),
	azureUploadBlob: vi.fn(),
	azureDeleteBlob: vi.fn(),
}));

const NON_EXISTENT_CASE_ID = "00000000-0000-0000-0000-000000000000";
const PNG_MAGIC_BYTES = Buffer.from([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

beforeEach(async () => {
	await mockNoAuth();
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
});

/** Writes a fake image file under `UPLOADS_DIR` and returns its key. */
async function writeLocalFixture(key: string): Promise<void> {
	const filePath = join(UPLOADS_DIR, key);
	await mkdir(join(filePath, ".."), { recursive: true });
	await writeFile(filePath, PNG_MAGIC_BYTES);
}

/** Configures Azure as the active backend and makes the mocked adapter serve `key` from an in-memory map. */
async function configureAzureBackend(): Promise<void> {
	vi.stubEnv("AZURE_STORAGE_ACCOUNT_NAME", "teststorageaccount");
	vi.stubEnv("AZURE_STORAGE_ACCOUNT_KEY", "testkey");
	const adapter = await import("@/lib/services/azure-blob-adapter");
	vi.mocked(adapter.azureDownloadBlob).mockImplementation((key: string) =>
		key === "azure/feature.png" || key === "azure/screenshot.png"
			? Promise.resolve({ data: PNG_MAGIC_BYTES, contentType: "image/png" })
			: Promise.resolve(null)
	);
}

describe.each([
	{ backend: "local" as const },
	{ backend: "azure" as const },
])("GET /api/cases/[id]/media/screenshot — $backend backend", ({ backend }) => {
	async function seedScreenshot(caseId: string): Promise<void> {
		const { prisma } = await import("@/lib/prisma");
		const key =
			backend === "azure" ? "azure/screenshot.png" : `images/${caseId}.png`;
		if (backend === "local") {
			await writeLocalFixture(key);
		} else {
			await configureAzureBackend();
		}
		await prisma.caseImage.create({
			data: {
				caseId,
				imageUrl: key,
				uploadedAt: new Date(),
				uploadedById: caseId,
			},
		});
	}

	it("returns 401 with no session", async () => {
		const { GET } = await import("@/app/api/cases/[id]/media/screenshot/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${NON_EXISTENT_CASE_ID}/media/screenshot`
		);
		const response = await GET(req, {
			params: Promise.resolve({ id: NON_EXISTENT_CASE_ID }),
		});
		expect(response.status).toBe(401);
	});

	it("returns 404 with an empty body for a user with no access", async () => {
		const owner = await createTestUser();
		const outsider = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await seedScreenshot(testCase.id);
		await mockAuth(outsider.id, outsider.username, outsider.email);

		const { GET } = await import("@/app/api/cases/[id]/media/screenshot/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/media/screenshot`
		);
		const response = await GET(req, {
			params: Promise.resolve({ id: testCase.id }),
		});
		expect(response.status).toBe(404);
		expect(await response.text()).toBe("");
	});

	it("returns the identical 404 for a missing screenshot as for no access", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { GET } = await import("@/app/api/cases/[id]/media/screenshot/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/media/screenshot`
		);
		const response = await GET(req, {
			params: Promise.resolve({ id: testCase.id }),
		});
		expect(response.status).toBe(404);
		expect(await response.text()).toBe("");
	});

	it("returns the bytes, content type and an ETag for a user with VIEW", async () => {
		const owner = await createTestUser();
		const viewer = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");
		await seedScreenshot(testCase.id);
		await mockAuth(viewer.id, viewer.username, viewer.email);

		const { GET } = await import("@/app/api/cases/[id]/media/screenshot/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/media/screenshot`
		);
		const response = await GET(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("image/png");
		expect(response.headers.get("ETag")).toBeTruthy();
		expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
		const body = Buffer.from(await response.arrayBuffer());
		expect(body.equals(PNG_MAGIC_BYTES)).toBe(true);
	});
});

describe.each([
	{ backend: "local" as const },
	{ backend: "azure" as const },
])("GET /api/cases/[id]/media/feature — $backend backend", ({ backend }) => {
	async function seedFeatureImage(caseId: string): Promise<void> {
		const key =
			backend === "azure" ? "azure/feature.png" : `cases/${caseId}/feature.png`;
		if (backend === "local") {
			await writeLocalFixture(key);
		} else {
			await configureAzureBackend();
		}
		await createTestCaseInformation(caseId, { featureImageUrl: key });
	}

	it("returns 401 with no session", async () => {
		const { GET } = await import("@/app/api/cases/[id]/media/feature/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${NON_EXISTENT_CASE_ID}/media/feature`
		);
		const response = await GET(req, {
			params: Promise.resolve({ id: NON_EXISTENT_CASE_ID }),
		});
		expect(response.status).toBe(401);
	});

	it("returns 404 with an empty body for a user with no access", async () => {
		const owner = await createTestUser();
		const outsider = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await seedFeatureImage(testCase.id);
		await mockAuth(outsider.id, outsider.username, outsider.email);

		const { GET } = await import("@/app/api/cases/[id]/media/feature/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/media/feature`
		);
		const response = await GET(req, {
			params: Promise.resolve({ id: testCase.id }),
		});
		expect(response.status).toBe(404);
		expect(await response.text()).toBe("");
	});

	it("returns the identical 404 for a case with no feature image as for no access", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { GET } = await import("@/app/api/cases/[id]/media/feature/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/media/feature`
		);
		const response = await GET(req, {
			params: Promise.resolve({ id: testCase.id }),
		});
		expect(response.status).toBe(404);
		expect(await response.text()).toBe("");
	});

	it("returns the bytes, content type and an ETag for a user with VIEW", async () => {
		const owner = await createTestUser();
		const viewer = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");
		await seedFeatureImage(testCase.id);
		await mockAuth(viewer.id, viewer.username, viewer.email);

		const { GET } = await import("@/app/api/cases/[id]/media/feature/route");
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/media/feature`
		);
		const response = await GET(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("image/png");
		expect(response.headers.get("ETag")).toBeTruthy();
		const body = Buffer.from(await response.arrayBuffer());
		expect(body.equals(PNG_MAGIC_BYTES)).toBe(true);
	});
});
