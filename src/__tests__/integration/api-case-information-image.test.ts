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

// PNG's fixed 8-byte signature — real magic bytes, so the content-signature
// check (AP-QA-007) accepts these fixtures as a genuine PNG rather than
// rejecting them for a declared/detected mismatch.
const PNG_MAGIC_BYTES = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
// Cap enforced by the route (`MAX_IMAGE_UPLOAD_BYTES` in route.ts) —
// MAX_FILE_SIZE (5 MB) plus 16 KiB of multipart framing headroom.
const MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024 + 16 * 1024;

function buildImageFormData(filename = "feature.png"): FormData {
	const formData = new FormData();
	const file = new File(
		[new Uint8Array([...PNG_MAGIC_BYTES, 0, 0, 0, 0])],
		filename,
		{ type: "image/png" }
	);
	formData.append("image", file);
	return formData;
}

/** Declares image/png but the bytes are not a real PNG signature. */
function buildMismatchedImageFormData(filename = "feature.png"): FormData {
	const formData = new FormData();
	const file = new File([new Uint8Array([1, 2, 3, 4])], filename, {
		type: "image/png",
	});
	formData.append("image", file);
	return formData;
}

/** A multipart body whose file bytes alone exceed the route's upload cap. */
function buildOversizedImageFormData(filename = "feature.png"): FormData {
	const formData = new FormData();
	const oversized = new Uint8Array(MAX_IMAGE_UPLOAD_BYTES + 1024);
	oversized.set(PNG_MAGIC_BYTES, 0);
	const file = new File([oversized], filename, { type: "image/png" });
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

	it("returns 403 for a user with only VIEW permission and never touches storage", async () => {
		const owner = await createTestUser();
		const viewer = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");
		await mockAuth(viewer.id, viewer.username, viewer.email);

		// EDIT is now checked before the body is even parsed (AP-QA-007), so a
		// VIEW-only user's request should never reach saveFile or deleteFile —
		// spy on both (default vi.spyOn behaviour still calls through) to prove
		// it, rather than only inferring it from the response status.
		const fileStorageService = await import(
			"@/lib/services/file-storage-service"
		);
		const saveFileSpy = vi.spyOn(fileStorageService, "saveFile");
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
		expect(saveFileSpy).toHaveBeenCalledTimes(0);
		expect(deleteFileSpy).toHaveBeenCalledTimes(0);

		saveFileSpy.mockRestore();
		deleteFileSpy.mockRestore();
	});

	it("returns 403 for a user with no access at all and never touches storage", async () => {
		const owner = await createTestUser();
		const outsider = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await mockAuth(outsider.id, outsider.username, outsider.email);

		const fileStorageService = await import(
			"@/lib/services/file-storage-service"
		);
		const saveFileSpy = vi.spyOn(fileStorageService, "saveFile");
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
		expect(saveFileSpy).toHaveBeenCalledTimes(0);
		expect(deleteFileSpy).toHaveBeenCalledTimes(0);

		saveFileSpy.mockRestore();
		deleteFileSpy.mockRestore();
	});

	it("returns 413 for a body whose actual bytes exceed the cap, without calling storage", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const fileStorageService = await import(
			"@/lib/services/file-storage-service"
		);
		const saveFileSpy = vi.spyOn(fileStorageService, "saveFile");
		const deleteFileSpy = vi.spyOn(fileStorageService, "deleteFile");

		const { POST } = await import(
			"@/app/api/cases/[id]/information/image/route"
		);
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/information/image`,
			{ method: "POST", body: buildOversizedImageFormData() }
		);
		const response = await POST(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(413);
		expect(saveFileSpy).toHaveBeenCalledTimes(0);
		expect(deleteFileSpy).toHaveBeenCalledTimes(0);

		saveFileSpy.mockRestore();
		deleteFileSpy.mockRestore();
	});

	it("returns 413 when Content-Length alone declares more than the cap, without calling storage", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		const fileStorageService = await import(
			"@/lib/services/file-storage-service"
		);
		const saveFileSpy = vi.spyOn(fileStorageService, "saveFile");
		const deleteFileSpy = vi.spyOn(fileStorageService, "deleteFile");

		const { POST } = await import(
			"@/app/api/cases/[id]/information/image/route"
		);
		// A raw stream so the declared header can lie about the actual (small)
		// body — proves the header check alone rejects the request, before any
		// byte of the body is read.
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new TextEncoder().encode("irrelevant"));
				controller.close();
			},
		});
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/information/image`,
			{
				method: "POST",
				body: stream,
				duplex: "half",
				headers: {
					"content-type": "multipart/form-data; boundary=x",
					"content-length": String(MAX_IMAGE_UPLOAD_BYTES + 1),
				},
			}
		);
		const response = await POST(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(413);
		expect(saveFileSpy).toHaveBeenCalledTimes(0);
		expect(deleteFileSpy).toHaveBeenCalledTimes(0);

		saveFileSpy.mockRestore();
		deleteFileSpy.mockRestore();
	});

	it("returns 400 when the declared type is image/png but the bytes are not a real PNG, and never deletes anything", async () => {
		const owner = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await mockAuth(owner.id, owner.username, owner.email);

		// The content-signature check runs inside saveFile()'s own validation
		// (AP-QA-007 §3), so saveFile is still called — what must not happen is
		// an actual write reaching disk/blob storage, which a failed
		// validation never gets to, and no cleanup delete (nothing was ever
		// written to clean up).
		const fileStorageService = await import(
			"@/lib/services/file-storage-service"
		);
		const deleteFileSpy = vi.spyOn(fileStorageService, "deleteFile");

		const { POST } = await import(
			"@/app/api/cases/[id]/information/image/route"
		);
		const req = new NextRequest(
			`http://localhost:3000/api/cases/${testCase.id}/information/image`,
			{ method: "POST", body: buildMismatchedImageFormData() }
		);
		const response = await POST(req, {
			params: Promise.resolve({ id: testCase.id }),
		});

		expect(response.status).toBe(400);
		expect(deleteFileSpy).toHaveBeenCalledTimes(0);

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

	it("returns 403 for a user with only VIEW permission and never calls deleteFile", async () => {
		const owner = await createTestUser();
		const viewer = await createTestUser();
		const testCase = await createTestCase(owner.id);
		await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");
		await createTestCaseInformation(testCase.id, {
			featureImageUrl: "/uploads/cases/pre-existing.png",
		});
		await mockAuth(viewer.id, viewer.username, viewer.email);

		const fileStorageService = await import(
			"@/lib/services/file-storage-service"
		);
		const deleteFileSpy = vi.spyOn(fileStorageService, "deleteFile");

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
		expect(deleteFileSpy).toHaveBeenCalledTimes(0);

		deleteFileSpy.mockRestore();
	});
});
