import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { mockAuth, mockNoAuth } from "../utils/auth-helpers";
import {
	addTeamMember,
	createTestCaseWithGoal,
	createTestPermission,
	createTestTeam,
	createTestTeamPermission,
	createTestUser,
} from "../utils/prisma-factories";

vi.mock("@/lib/auth/validate-session", () => ({
	validateSession: vi.fn().mockResolvedValue(null),
}));

/**
 * Mock boundary: `googleapis` only, exactly as
 * `google-drive-service.test.ts` sets it up — the route delegates every
 * Drive interaction to `lib/services/google-drive-service.ts`, so this file
 * exercises that same seam rather than mocking the service module directly.
 */
const {
	mockSetCredentials,
	mockRefreshAccessToken,
	mockFilesList,
	mockFilesCreate,
	mockDrive,
} = vi.hoisted(() => ({
	mockSetCredentials: vi.fn(),
	mockRefreshAccessToken: vi.fn(),
	mockFilesList: vi.fn(),
	mockFilesCreate: vi.fn(),
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
		files: { list: mockFilesList, create: mockFilesCreate, get: vi.fn() },
	});
});

/** Sets the Google OAuth columns on a test user's row so hasGoogleToken()/uploadBackupToDrive() succeed. */
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

/** Configures a successful "existing folder, file created" upload round trip. */
function mockSuccessfulUpload() {
	mockFilesList.mockResolvedValueOnce({
		data: { files: [{ id: "folder-id", name: "TEA Platform Backups" }] },
	});
	mockFilesCreate.mockResolvedValueOnce({
		data: {
			id: "uploaded-file-id",
			webViewLink: "https://drive/uploaded-file-id",
		},
	});
}

function buildRequest(body: unknown) {
	return new NextRequest("http://localhost:3000/api/cases/backup/gdrive", {
		method: "POST",
		body: JSON.stringify(body),
		headers: { "Content-Type": "application/json" },
	});
}

describe("POST /api/cases/backup/gdrive", () => {
	it("returns 401 when the request is not authenticated", async () => {
		const { POST } = await import("@/app/api/cases/backup/gdrive/route");
		const response = await POST(buildRequest({ caseId: crypto.randomUUID() }));

		expect(response.status).toBe(401);
	});

	it("returns 403 with a 'not connected' message when the user has no Google token", async () => {
		const user = await createTestUser();
		const testCase = await createTestCaseWithGoal(user.id);
		await mockAuth(user.id, user.username, user.email);

		const { POST } = await import("@/app/api/cases/backup/gdrive/route");
		const response = await POST(buildRequest({ caseId: testCase.id }));

		expect(response.status).toBe(403);
		const body = await response.json();
		expect(body.error).toContain("Google not connected");
	});

	it("returns 400 when caseId is missing", async () => {
		const user = await createTestUser();
		await setGoogleTokens(user.id);
		await mockAuth(user.id, user.username, user.email);

		const { POST } = await import("@/app/api/cases/backup/gdrive/route");
		const response = await POST(buildRequest({}));

		expect(response.status).toBe(400);
	});

	it("returns 400 when caseId is not a UUID", async () => {
		const user = await createTestUser();
		await setGoogleTokens(user.id);
		await mockAuth(user.id, user.username, user.email);

		const { POST } = await import("@/app/api/cases/backup/gdrive/route");
		const response = await POST(buildRequest({ caseId: "not-a-uuid" }));

		expect(response.status).toBe(400);
	});

	describe("permission matrix", () => {
		it("returns 200 for the case owner", async () => {
			const owner = await createTestUser();
			await setGoogleTokens(owner.id);
			const testCase = await createTestCaseWithGoal(owner.id);
			await mockAuth(owner.id, owner.username, owner.email);
			mockSuccessfulUpload();

			const { POST } = await import("@/app/api/cases/backup/gdrive/route");
			const response = await POST(buildRequest({ caseId: testCase.id }));

			expect(response.status).toBe(200);
		});

		it("returns 200 for a user with VIEW permission via a direct share", async () => {
			const owner = await createTestUser();
			const viewer = await createTestUser();
			await setGoogleTokens(viewer.id);
			const testCase = await createTestCaseWithGoal(owner.id);
			await createTestPermission(testCase.id, viewer.id, owner.id, "VIEW");
			await mockAuth(viewer.id, viewer.username, viewer.email);
			mockSuccessfulUpload();

			const { POST } = await import("@/app/api/cases/backup/gdrive/route");
			const response = await POST(buildRequest({ caseId: testCase.id }));

			expect(response.status).toBe(200);
		});

		it("returns 200 for a user with EDIT permission via a direct share", async () => {
			const owner = await createTestUser();
			const editor = await createTestUser();
			await setGoogleTokens(editor.id);
			const testCase = await createTestCaseWithGoal(owner.id);
			await createTestPermission(testCase.id, editor.id, owner.id, "EDIT");
			await mockAuth(editor.id, editor.username, editor.email);
			mockSuccessfulUpload();

			const { POST } = await import("@/app/api/cases/backup/gdrive/route");
			const response = await POST(buildRequest({ caseId: testCase.id }));

			expect(response.status).toBe(200);
		});

		it("returns 200 for a user with VIEW permission via a team grant", async () => {
			const owner = await createTestUser();
			const teamMember = await createTestUser();
			await setGoogleTokens(teamMember.id);
			const testCase = await createTestCaseWithGoal(owner.id);
			const team = await createTestTeam(owner.id);
			await addTeamMember(team.id, teamMember.id, "MEMBER");
			await createTestTeamPermission(testCase.id, team.id, owner.id, "VIEW");
			await mockAuth(teamMember.id, teamMember.username, teamMember.email);
			mockSuccessfulUpload();

			const { POST } = await import("@/app/api/cases/backup/gdrive/route");
			const response = await POST(buildRequest({ caseId: testCase.id }));

			expect(response.status).toBe(200);
		});

		it("returns 403 for a user with no permission on the case", async () => {
			const owner = await createTestUser();
			const stranger = await createTestUser();
			await setGoogleTokens(stranger.id);
			const testCase = await createTestCaseWithGoal(owner.id);
			await mockAuth(stranger.id, stranger.username, stranger.email);

			const { POST } = await import("@/app/api/cases/backup/gdrive/route");
			const response = await POST(buildRequest({ caseId: testCase.id }));

			expect(response.status).toBe(403);
		});

		// exportCase returns the same "Permission denied" error for a
		// non-existent case as it does for no access (case-export.test.ts,
		// api-cases.test.ts) — the route's anti-enumeration behaviour, not a
		// 404. This deliberately deviates from the brief's "nonexistent case
		// → 404": see the QA report's deviations section.
		it("returns 403 (not 404) for a non-existent caseId, matching the anti-enumeration behaviour of every other case route", async () => {
			const user = await createTestUser();
			await setGoogleTokens(user.id);
			await mockAuth(user.id, user.username, user.email);

			const { POST } = await import("@/app/api/cases/backup/gdrive/route");
			const response = await POST(
				buildRequest({ caseId: "00000000-0000-0000-0000-000000000000" })
			);

			expect(response.status).toBe(403);
		});
	});

	// TOKEN_EXPIRED and REFRESH_FAILED have no route-level test: this route
	// (and the import route) calls `hasGoogleToken()` first and returns its
	// own 403 "not connected" before ever reaching `uploadBackupToDrive`, and
	// `hasGoogleToken()` fails on exactly the same condition that would
	// produce either code — so a route request can never observe them in
	// normal operation. They're proven at the service level instead, calling
	// `uploadBackupToDrive` directly:
	// `google-drive-service.test.ts` > "createDriveClient — TOKEN_EXPIRED / REFRESH_FAILED".

	it("maps a Drive 403 on folder lookup to FORBIDDEN (403)", async () => {
		const user = await createTestUser();
		await setGoogleTokens(user.id);
		const testCase = await createTestCaseWithGoal(user.id);
		await mockAuth(user.id, user.username, user.email);
		mockFilesList.mockRejectedValueOnce(
			Object.assign(
				new Error("The user does not have sufficient permissions"),
				{
					status: 403,
				}
			)
		);

		const { POST } = await import("@/app/api/cases/backup/gdrive/route");
		const response = await POST(buildRequest({ caseId: testCase.id }));

		expect(response.status).toBe(403);
	});

	it("maps a Drive API_ERROR upload failure to 500", async () => {
		const user = await createTestUser();
		await setGoogleTokens(user.id);
		const testCase = await createTestCaseWithGoal(user.id);
		await mockAuth(user.id, user.username, user.email);
		mockFilesList.mockResolvedValueOnce({
			data: { files: [{ id: "folder-id", name: "TEA Platform Backups" }] },
		});
		mockFilesCreate.mockRejectedValueOnce(new Error("Drive quota exceeded"));

		const { POST } = await import("@/app/api/cases/backup/gdrive/route");
		const response = await POST(buildRequest({ caseId: testCase.id }));

		expect(response.status).toBe(500);
	});

	it("returns success body {success, fileId, fileName, webViewLink}", async () => {
		const user = await createTestUser();
		await setGoogleTokens(user.id);
		const testCase = await createTestCaseWithGoal(user.id, "Backup Body Case");
		await mockAuth(user.id, user.username, user.email);
		mockSuccessfulUpload();

		const { POST } = await import("@/app/api/cases/backup/gdrive/route");
		const response = await POST(buildRequest({ caseId: testCase.id }));

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body).toEqual({
			success: true,
			fileId: "uploaded-file-id",
			fileName: expect.any(String),
			webViewLink: "https://drive/uploaded-file-id",
		});
	});
});

describe("GET /api/cases/backup/gdrive", () => {
	it("returns 401 when the request is not authenticated", async () => {
		const { GET } = await import("@/app/api/cases/backup/gdrive/route");
		const response = await GET();

		expect(response.status).toBe(401);
	});

	it("returns {connected: true} when the user has a Google token", async () => {
		const user = await createTestUser();
		await setGoogleTokens(user.id);
		await mockAuth(user.id, user.username, user.email);

		const { GET } = await import("@/app/api/cases/backup/gdrive/route");
		const response = await GET();

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body).toEqual({ connected: true });
	});

	it("returns {connected: false} when the user has no Google token", async () => {
		const user = await createTestUser();
		await mockAuth(user.id, user.username, user.email);

		const { GET } = await import("@/app/api/cases/backup/gdrive/route");
		const response = await GET();

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body).toEqual({ connected: false });
	});
});
