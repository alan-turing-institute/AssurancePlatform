import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	createNestedCaseJSON,
	createTestUser,
} from "../utils/prisma-factories";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

/**
 * Mock boundary: `googleapis` only, matching `google-drive-service.test.ts`
 * and `api-cases-backup-gdrive.test.ts` — this route delegates every Drive
 * interaction to `lib/services/google-drive-service.ts`.
 */
const {
	mockSetCredentials,
	mockRefreshAccessToken,
	mockFilesList,
	mockFilesGet,
	mockDrive,
} = vi.hoisted(() => ({
	mockSetCredentials: vi.fn(),
	mockRefreshAccessToken: vi.fn(),
	mockFilesList: vi.fn(),
	mockFilesGet: vi.fn(),
	mockDrive: vi.fn(),
}));

vi.mock("googleapis", () => {
	class OAuth2 {
		setCredentials = mockSetCredentials;
		refreshAccessToken = mockRefreshAccessToken;
	}
	return {
		google: {
			auth: { OAuth2 },
			drive: mockDrive,
		},
	};
});

beforeEach(async () => {
	await mockNoAuth();
	vi.clearAllMocks();
	mockDrive.mockReturnValue({
		files: { list: mockFilesList, create: vi.fn(), get: mockFilesGet },
	});
});

/** Sets the Google OAuth columns on a test user's row so hasGoogleToken()/downloadFileFromDrive() succeed. */
function setGoogleTokens(userId: string) {
	return prisma.user.update({
		where: { id: userId },
		data: {
			googleAccessToken: "test-access-token",
			googleRefreshToken: "test-refresh-token",
			googleTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
			googleId: "google-test-id",
			googleEmail: "googleuser@example.com",
		},
	});
}

/** Metadata fetch then content fetch, as downloadFileFromDrive issues them in sequence. */
function mockDownload(mimeType: string, content: string, name = "backup.json") {
	mockFilesGet
		.mockImplementationOnce(() => Promise.resolve({ data: { name, mimeType } }))
		.mockImplementationOnce(() => Promise.resolve({ data: content }));
}

function buildRequest(body: unknown) {
	return new NextRequest("http://localhost:3000/api/cases/import/gdrive", {
		method: "POST",
		body: JSON.stringify(body),
		headers: { "Content-Type": "application/json" },
	});
}

describe("POST /api/cases/import/gdrive", () => {
	it("returns 401 when the request is not authenticated", async () => {
		const { POST } = await import("@/app/api/cases/import/gdrive/route");
		const response = await POST(buildRequest({ fileId: "some-file-id" }));

		expect(response.status).toBe(401);
	});

	it("returns 403 with a 'not connected' message when the user has no Google token", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);

		const { POST } = await import("@/app/api/cases/import/gdrive/route");
		const response = await POST(buildRequest({ fileId: "some-file-id" }));

		expect(response.status).toBe(403);
		const body = await response.json();
		expect(body.error).toContain("Google not connected");
	});

	it("returns 400 when fileId is missing", async () => {
		const user = await createTestUser();
		await setGoogleTokens(user.id);
		await mockAuth(user.id, user.username, user.email);

		const { POST } = await import("@/app/api/cases/import/gdrive/route");
		const response = await POST(buildRequest({}));

		expect(response.status).toBe(400);
	});

	it("returns 400 when fileId is an empty string", async () => {
		const user = await createTestUser();
		await setGoogleTokens(user.id);
		await mockAuth(user.id, user.username, user.email);

		const { POST } = await import("@/app/api/cases/import/gdrive/route");
		const response = await POST(buildRequest({ fileId: "" }));

		expect(response.status).toBe(400);
	});

	it("maps a Drive API_ERROR download failure to 500", async () => {
		const user = await createTestUser();
		await setGoogleTokens(user.id);
		await mockAuth(user.id, user.username, user.email);
		mockFilesGet.mockRejectedValueOnce(new Error("file not found on Drive"));

		const { POST } = await import("@/app/api/cases/import/gdrive/route");
		const response = await POST(buildRequest({ fileId: "missing-file-id" }));

		expect(response.status).toBe(500);
	});

	it("returns 400 naming the file when its content is not valid JSON", async () => {
		const user = await createTestUser();
		await setGoogleTokens(user.id);
		await mockAuth(user.id, user.username, user.email);
		mockDownload(
			"application/json",
			"this is not { valid json",
			"corrupt.json"
		);

		const { POST } = await import("@/app/api/cases/import/gdrive/route");
		const response = await POST(buildRequest({ fileId: "corrupt-file-id" }));

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toContain("corrupt.json");
	});

	it("imports a valid backup, returning 200 with a gdrive source and creating a real case row", async () => {
		const user = await createTestUser();
		await setGoogleTokens(user.id);
		await mockAuth(user.id, user.username, user.email);
		const backupJson = createNestedCaseJSON({
			case: { name: "Imported From Drive", description: "A backup restore" },
		});
		mockDownload(
			"application/json",
			JSON.stringify(backupJson),
			"tea-backup.json"
		);

		const { POST } = await import("@/app/api/cases/import/gdrive/route");
		const response = await POST(buildRequest({ fileId: "good-file-id" }));

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.name).toBe("Imported From Drive");
		expect(body.source).toEqual({
			type: "gdrive",
			fileId: "good-file-id",
			fileName: "tea-backup.json",
		});

		const createdCase = await prisma.assuranceCase.findUnique({
			where: { id: body.id },
		});
		expect(createdCase).not.toBeNull();
		expect(createdCase?.createdById).toBe(user.id);
	});
});

describe("GET /api/cases/import/gdrive", () => {
	it("returns 401 when the request is not authenticated", async () => {
		const { GET } = await import("@/app/api/cases/import/gdrive/route");
		const response = await GET();

		expect(response.status).toBe(401);
	});

	it("returns {connected: false, files: []} when the user has no Google token", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);

		const { GET } = await import("@/app/api/cases/import/gdrive/route");
		const response = await GET();

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body).toEqual({ connected: false, files: [] });
	});

	it("returns {connected: true, files: [...]} when the user has a token", async () => {
		const user = await createTestUser();
		await setGoogleTokens(user.id);
		await mockAuth(user.id, user.username, user.email);
		mockFilesList
			.mockResolvedValueOnce({
				data: { files: [{ id: "folder-id", name: "TEA Platform Backups" }] },
			})
			.mockResolvedValueOnce({
				data: {
					files: [
						{
							id: "file-1",
							name: "backup-1.json",
							mimeType: "application/json",
							createdTime: "2026-01-01T00:00:00.000Z",
							modifiedTime: "2026-01-02T00:00:00.000Z",
							size: "100",
						},
					],
				},
			});

		const { GET } = await import("@/app/api/cases/import/gdrive/route");
		const response = await GET();

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.connected).toBe(true);
		expect(body.files).toHaveLength(1);
		expect(body.files[0].id).toBe("file-1");
	});
});
