import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	createTestCase,
	createTestPermission,
	createTestUser,
} from "../utils/prisma-factories";

/**
 * Adversarial coverage for the two access-checked private media routes
 * (screenshot and feature image): the four access outcomes named in the
 * design's acceptance list, run against both routes so neither one can
 * silently diverge from the other. Storage is exercised for real against
 * the local filesystem backend (no Azure env vars set), writing the fixture
 * bytes directly so a passing test proves the route actually streamed a
 * real file, not a mocked stand-in.
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

/** Writes fixture bytes directly to the local storage backend under a fresh key, bypassing the upload routes. */
async function writeFixtureMedia(
	subdirectory: string,
	filename: string,
	data: Buffer
): Promise<string> {
	const root = await uploadsDir();
	const dir = join(root, subdirectory);
	await mkdir(dir, { recursive: true });
	const key = `${subdirectory}/${filename}`;
	await writeFile(join(root, key), data);
	return key;
}

function getRequest(url: string): NextRequest {
	return new NextRequest(url);
}

beforeEach(async () => {
	await mockNoAuth();
});

afterEach(() => {
	vi.clearAllMocks();
});

describe.each([
	{
		name: "screenshot",
		routeModule: () => import("@/app/api/cases/[id]/media/screenshot/route"),
		url: (caseId: string) =>
			`http://localhost:3000/api/cases/${caseId}/media/screenshot`,
		seed: async (caseId: string, key: string, uploadedById: string) => {
			const { prisma } = await import("@/lib/prisma");
			await prisma.caseImage.upsert({
				where: { caseId },
				create: { caseId, imageUrl: key, uploadedAt: new Date(), uploadedById },
				update: { imageUrl: key, uploadedAt: new Date() },
			});
		},
		writeMedia: (caseId: string, data: Buffer, filename = "shot.png") =>
			writeFixtureMedia("images", `${caseId}-${filename}`, data),
	},
	{
		name: "feature",
		routeModule: () => import("@/app/api/cases/[id]/media/feature/route"),
		url: (caseId: string) =>
			`http://localhost:3000/api/cases/${caseId}/media/feature`,
		seed: async (caseId: string, key: string, _uploadedById: string) => {
			const { prisma } = await import("@/lib/prisma");
			await prisma.caseInformation.upsert({
				where: { caseId },
				create: { caseId, featureImageUrl: key },
				update: { featureImageUrl: key },
			});
		},
		writeMedia: (caseId: string, data: Buffer, filename = "feature.png") =>
			writeFixtureMedia("case-studies", `${caseId}-${filename}`, data),
	},
])("GET /api/cases/[id]/media/$name", (route) => {
	it("returns the proxy's 401 with no session, before any case lookup", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const key = await route.writeMedia(testCase.id, PNG_BYTES);
		await route.seed(testCase.id, key, owner.id);

		const { GET } = await route.routeModule();
		const response = await GET(getRequest(route.url(testCase.id)), {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(401);
	});

	it("returns 404 with an empty body for a logged-in user without access", async () => {
		const owner = await createTestUser();
		const stranger = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const key = await route.writeMedia(testCase.id, PNG_BYTES);
		await route.seed(testCase.id, key, owner.id);
		await mockAuth(stranger.id, stranger.username, stranger.email);

		const { GET } = await route.routeModule();
		const response = await GET(getRequest(route.url(testCase.id)), {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(404);
		const body = await response.arrayBuffer();
		expect(body.byteLength).toBe(0);
	});

	it("returns the same 404 shape for a missing file as for no access", async () => {
		const owner = await createTestUser();
		const stranger = await createTestUser();
		const testCase = await createTestCase(owner.id);
		// A record pointing at a key that was never written.
		await route.seed(testCase.id, "images/does-not-exist.png", owner.id);

		await mockAuth(owner.id, owner.username, owner.email);
		const { GET } = await route.routeModule();
		const ownerMissingFile = await GET(getRequest(route.url(testCase.id)), {
			params: Promise.resolve({ id: testCase.id }),
		});

		await mockAuth(stranger.id, stranger.username, stranger.email);
		const noAccess = await GET(getRequest(route.url(testCase.id)), {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(ownerMissingFile.status).toBe(404);
		expect(noAccess.status).toBe(404);
		expect(await ownerMissingFile.arrayBuffer()).toEqual(
			await noAccess.arrayBuffer()
		);
		expect(ownerMissingFile.headers.get("content-type")).toBe(
			noAccess.headers.get("content-type")
		);
	});

	it("serves the bytes, content type and an ETag to a user with VIEW-only access", async () => {
		const owner = await createTestUser();
		const viewer = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const key = await route.writeMedia(testCase.id, PNG_BYTES);
		await route.seed(testCase.id, key, owner.id);
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");
		await mockAuth(viewer.id, viewer.username, viewer.email);

		const { GET } = await route.routeModule();
		const response = await GET(getRequest(route.url(testCase.id)), {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("image/png");
		expect(response.headers.get("etag")).toBeTruthy();
		expect(response.headers.get("x-content-type-options")).toBe("nosniff");
		const body = Buffer.from(await response.arrayBuffer());
		expect(body.equals(PNG_BYTES)).toBe(true);
	});

	it("serves new bytes and a new ETag after the owner replaces the stored media", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		const firstKey = await route.writeMedia(testCase.id, PNG_BYTES, "v1.png");
		await route.seed(testCase.id, firstKey, owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { GET } = await route.routeModule();
		const before = await GET(getRequest(route.url(testCase.id)), {
			params: Promise.resolve({ id: testCase.id }),
		});
		const beforeEtag = before.headers.get("etag");
		const beforeBody = Buffer.from(await before.arrayBuffer());

		// Simulate a re-upload: a fresh key, fresh bytes, record updated to point at it.
		const secondKey = await route.writeMedia(
			testCase.id,
			OTHER_PNG_BYTES,
			"v2.png"
		);
		await route.seed(testCase.id, secondKey, owner.id);

		const after = await GET(getRequest(route.url(testCase.id)), {
			params: Promise.resolve({ id: testCase.id }),
		});
		const afterEtag = after.headers.get("etag");
		const afterBody = Buffer.from(await after.arrayBuffer());

		expect(afterEtag).toBeTruthy();
		expect(afterEtag).not.toBe(beforeEtag);
		expect(afterBody.equals(OTHER_PNG_BYTES)).toBe(true);
		expect(afterBody.equals(beforeBody)).toBe(false);
	});
});
