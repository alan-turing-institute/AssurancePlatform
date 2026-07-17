import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	createTestCase,
	createTestCaseInformation,
	createTestPermission,
	createTestUser,
} from "../utils/prisma-factories";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

const NON_EXISTENT_CASE_ID = "00000000-0000-0000-0000-000000000000";
const UPLOADED_PATH_PATTERN = /^\/uploads\/cases\//;

function buildImageFormData(filename = "feature.png"): FormData {
	const formData = new FormData();
	const file = new File([new Uint8Array([1, 2, 3, 4])], filename, {
		type: "image/png",
	});
	formData.append("image", file);
	return formData;
}

beforeEach(async () => {
	await mockNoAuth();
	// saveFile() only writes to local disk (rather than erroring with
	// "Storage not configured") when NODE_ENV is "development" or this flag
	// is set — vitest runs with NODE_ENV "test", so this is required for the
	// upload branch under test to be reachable at all.
	vi.stubEnv("USE_LOCAL_STORAGE", "true");
});

afterEach(async () => {
	vi.unstubAllEnvs();
	// Clean up any files actually written to local disk during this suite.
	const { deleteFile } = await import("@/lib/services/file-storage-service");
	for (const path of writtenPaths.splice(0)) {
		await deleteFile(path);
	}
});

// Written-file tracker so afterEach can clean up local-disk uploads made
// during the test run (public/uploads/ is gitignored but not otherwise
// cleaned between runs).
const writtenPaths: string[] = [];

describe("POST /api/cases/[id]/information/image", () => {
	it("uploads a feature image and persists it on the case-information record", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { POST } = await import(
			"@/app/api/cases/[id]/information/image/route"
		);
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/information/image`,
			{ method: "POST", body: buildImageFormData() }
		);
		const response = await POST(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.featureImageUrl).toMatch(UPLOADED_PATH_PATTERN);
		writtenPaths.push(body.featureImageUrl);

		const { getCaseInformation } = await import(
			"@/lib/services/case-information-service"
		);
		const result = await getCaseInformation(owner.id, testCase.id);
		expect("data" in result && result.data?.featureImageUrl).toBe(
			body.featureImageUrl
		);
	});

	it("deletes the previous image when a new one is uploaded", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { POST } = await import(
			"@/app/api/cases/[id]/information/image/route"
		);
		const firstReq = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/information/image`,
			{ method: "POST", body: buildImageFormData("first.png") }
		);
		const firstResponse = await POST(firstReq, {
			params: Promise.resolve({ id: testCase.id }),
		});
		const firstBody = await firstResponse.json();

		const secondReq = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/information/image`,
			{ method: "POST", body: buildImageFormData("second.png") }
		);
		const secondResponse = await POST(secondReq, {
			params: Promise.resolve({ id: testCase.id }),
		});
		const secondBody = await secondResponse.json();
		writtenPaths.push(secondBody.featureImageUrl);

		expect(secondBody.featureImageUrl).not.toBe(firstBody.featureImageUrl);

		const { fileExists } = await import("@/lib/services/file-storage-service");
		expect(await fileExists(firstBody.featureImageUrl)).toBe(false);
	});

	it("returns 400 when no file is provided", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { POST } = await import(
			"@/app/api/cases/[id]/information/image/route"
		);
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/information/image`,
			{ method: "POST", body: new FormData() }
		);
		const response = await POST(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(400);
	});

	it("returns 401 when the request is not authenticated", async () => {
		const { POST } = await import(
			"@/app/api/cases/[id]/information/image/route"
		);
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${NON_EXISTENT_CASE_ID}/information/image`,
			{ method: "POST", body: buildImageFormData() }
		);
		const response = await POST(req, {
			params: Promise.resolve({ id: NON_EXISTENT_CASE_ID }),
		});

		expect(response.status).toBe(401);
	});

	it("returns 403 for a user with only VIEW permission and does not orphan the file", async () => {
		const owner = await createTestUser();
		const viewer = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");
		await mockAuth(viewer.id, viewer.username, viewer.email);

		// The route saves the file to disk before the EDIT-permission check
		// rejects the persist step, then cleans up via deleteFile(). Spy on
		// deleteFile (default vi.spyOn behaviour still calls through to the
		// real implementation) to capture the path it was given, so we can
		// independently verify the file is actually gone from disk rather
		// than just trusting that deleteFile() was invoked.
		const fileStorageService = await import(
			"@/lib/services/file-storage-service"
		);
		const deleteFileSpy = vi.spyOn(fileStorageService, "deleteFile");

		const { POST } = await import(
			"@/app/api/cases/[id]/information/image/route"
		);
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/information/image`,
			{ method: "POST", body: buildImageFormData() }
		);
		const response = await POST(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(403);
		expect(deleteFileSpy).toHaveBeenCalledTimes(1);
		const deleteFileCall = deleteFileSpy.mock.calls[0];
		if (!deleteFileCall) {
			throw new Error("deleteFile was not called");
		}
		const [savedPath] = deleteFileCall;
		expect(savedPath).toMatch(UPLOADED_PATH_PATTERN);

		const { fileExists } = fileStorageService;
		expect(await fileExists(savedPath)).toBe(false);

		deleteFileSpy.mockRestore();
	});
});

describe("DELETE /api/cases/[id]/information/image", () => {
	it("clears the feature image and deletes the stored file", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const { POST, DELETE } = await import(
			"@/app/api/cases/[id]/information/image/route"
		);
		const uploadReq = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/information/image`,
			{ method: "POST", body: buildImageFormData() }
		);
		const uploadResponse = await POST(uploadReq, {
			params: Promise.resolve({ id: testCase.id }),
		});
		const { featureImageUrl } = await uploadResponse.json();

		const deleteReq = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/information/image`,
			{ method: "DELETE" }
		);
		const deleteResponse = await DELETE(deleteReq, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(deleteResponse.status).toBe(200);

		const { fileExists } = await import("@/lib/services/file-storage-service");
		expect(await fileExists(featureImageUrl)).toBe(false);

		const { getCaseInformation } = await import(
			"@/lib/services/case-information-service"
		);
		const result = await getCaseInformation(owner.id, testCase.id);
		expect("data" in result && result.data?.featureImageUrl).toBe(null);
	});

	it("is a no-op when there is no feature image", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await createTestCaseInformation(testCase.id, { featureImageUrl: "" });
		await mockAuth(owner.id, owner.username, owner.email);

		const { DELETE } = await import(
			"@/app/api/cases/[id]/information/image/route"
		);
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/information/image`,
			{ method: "DELETE" }
		);
		const response = await DELETE(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(200);
	});

	it("returns 401 when the request is not authenticated", async () => {
		const { DELETE } = await import(
			"@/app/api/cases/[id]/information/image/route"
		);
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${NON_EXISTENT_CASE_ID}/information/image`,
			{ method: "DELETE" }
		);
		const response = await DELETE(req, {
			params: Promise.resolve({ id: NON_EXISTENT_CASE_ID }),
		});

		expect(response.status).toBe(401);
	});

	it("returns 403 for a user with only VIEW permission", async () => {
		const owner = await createTestUser();
		const viewer = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");
		await createTestCaseInformation(testCase.id, {
			featureImageUrl: "/uploads/cases/pre-existing.png",
		});
		await mockAuth(viewer.id, viewer.username, viewer.email);

		const { DELETE } = await import(
			"@/app/api/cases/[id]/information/image/route"
		);
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/information/image`,
			{ method: "DELETE" }
		);
		const response = await DELETE(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(403);
	});
});
