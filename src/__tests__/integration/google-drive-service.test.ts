import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { createTestUser } from "../utils/prisma-factories";

/**
 * Mock boundary: `googleapis` only (decided in the issue's Design section).
 * `google.auth.OAuth2` is a class exposing the two methods the service
 * calls (`setCredentials`, `refreshAccessToken`); `google.drive()` returns
 * an object with the three `files` methods the service calls, each a
 * `vi.fn()` this file controls per test. Postgres stays real throughout —
 * never mock Prisma.
 */
const {
	mockSetCredentials,
	mockRefreshAccessToken,
	mockFilesList,
	mockFilesCreate,
	mockFilesGet,
	mockDrive,
} = vi.hoisted(() => ({
	mockSetCredentials: vi.fn(),
	mockRefreshAccessToken: vi.fn(),
	mockFilesList: vi.fn(),
	mockFilesCreate: vi.fn(),
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

const FOLDER_MIME = "application/vnd.google-apps.folder";
const JSON_MIME = "application/json";
const BACKUP_FILE_NAME_PATTERN =
	/^My_Case___v2_-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.json$/;

beforeEach(() => {
	vi.clearAllMocks();
	mockDrive.mockReturnValue({
		files: {
			list: mockFilesList,
			create: mockFilesCreate,
			get: mockFilesGet,
		},
	});
});

/** Sets the Google OAuth columns on a test user's row directly via Prisma. */
function setGoogleTokens(
	userId: string,
	overrides: Partial<{
		googleAccessToken: string | null;
		googleRefreshToken: string | null;
		googleTokenExpiresAt: Date | null;
	}> = {}
) {
	return prisma.user.update({
		where: { id: userId },
		data: {
			googleAccessToken:
				overrides.googleAccessToken === undefined
					? "test-access-token"
					: overrides.googleAccessToken,
			googleRefreshToken:
				overrides.googleRefreshToken === undefined
					? "test-refresh-token"
					: overrides.googleRefreshToken,
			googleTokenExpiresAt:
				overrides.googleTokenExpiresAt === undefined
					? new Date(Date.now() + 60 * 60 * 1000)
					: overrides.googleTokenExpiresAt,
			googleId: "google-test-id",
			googleEmail: "googleuser@example.com",
		},
	});
}

/** Folder search resolves to an existing "TEA Platform Backups" folder. */
function mockExistingFolder(folderId = "existing-folder-id") {
	mockFilesList.mockResolvedValueOnce({
		data: { files: [{ id: folderId, name: "TEA Platform Backups" }] },
	});
}

/** Folder search resolves to no match, and files.create makes one. */
function mockFolderCreation(newFolderId = "new-folder-id") {
	mockFilesList.mockResolvedValueOnce({ data: { files: [] } });
	mockFilesCreate.mockResolvedValueOnce({ data: { id: newFolderId } });
}

describe("hasGoogleToken / getUserGoogleTokens (via hasGoogleToken)", () => {
	it("returns true for a valid, unexpired token", async () => {
		const user = await createTestUser();
		await setGoogleTokens(user.id);

		const { hasGoogleToken } = await import(
			"@/lib/services/google-drive-service"
		);
		expect(await hasGoogleToken(user.id)).toBe(true);
	});

	it("returns false when the user has no access token", async () => {
		const user = await createTestUser();
		// No setGoogleTokens call — googleAccessToken stays null.

		const { hasGoogleToken } = await import(
			"@/lib/services/google-drive-service"
		);
		expect(await hasGoogleToken(user.id)).toBe(false);
	});

	it("refreshes an expired token, calling refreshAccessToken and writing the new token + expiry back to the user row", async () => {
		const user = await createTestUser();
		const pastExpiry = new Date(Date.now() - 60 * 1000);
		await setGoogleTokens(user.id, { googleTokenExpiresAt: pastExpiry });

		const newExpiry = Date.now() + 60 * 60 * 1000;
		mockRefreshAccessToken.mockResolvedValueOnce({
			credentials: { access_token: "refreshed-token", expiry_date: newExpiry },
		});

		const { hasGoogleToken } = await import(
			"@/lib/services/google-drive-service"
		);
		expect(await hasGoogleToken(user.id)).toBe(true);
		expect(mockRefreshAccessToken).toHaveBeenCalledTimes(1);

		const updated = await prisma.user.findUnique({ where: { id: user.id } });
		expect(updated?.googleAccessToken).toBe("refreshed-token");
		expect(updated?.googleTokenExpiresAt?.getTime()).toBe(newExpiry);
	});

	it("treats a token inside the 5-minute expiry buffer as expired and refreshes it", async () => {
		const user = await createTestUser();
		const withinBuffer = new Date(Date.now() + 60 * 1000); // 1 min out
		await setGoogleTokens(user.id, { googleTokenExpiresAt: withinBuffer });

		mockRefreshAccessToken.mockResolvedValueOnce({
			credentials: {
				access_token: "buffer-refreshed-token",
				expiry_date: Date.now() + 60 * 60 * 1000,
			},
		});

		const { hasGoogleToken } = await import(
			"@/lib/services/google-drive-service"
		);
		expect(await hasGoogleToken(user.id)).toBe(true);
		expect(mockRefreshAccessToken).toHaveBeenCalledTimes(1);
	});

	it("returns false for an expired token with no refresh token available", async () => {
		const user = await createTestUser();
		await setGoogleTokens(user.id, {
			googleTokenExpiresAt: new Date(Date.now() - 60 * 1000),
			googleRefreshToken: null,
		});

		const { hasGoogleToken } = await import(
			"@/lib/services/google-drive-service"
		);
		expect(await hasGoogleToken(user.id)).toBe(false);
		expect(mockRefreshAccessToken).not.toHaveBeenCalled();
	});

	it("returns false when refreshAccessToken throws", async () => {
		const user = await createTestUser();
		await setGoogleTokens(user.id, {
			googleTokenExpiresAt: new Date(Date.now() - 60 * 1000),
		});
		mockRefreshAccessToken.mockRejectedValueOnce(new Error("refresh failed"));

		const { hasGoogleToken } = await import(
			"@/lib/services/google-drive-service"
		);
		expect(await hasGoogleToken(user.id)).toBe(false);
	});
});

describe("createDriveClient (via uploadBackupToDrive)", () => {
	it("builds the Drive client with the user's stored access token", async () => {
		const user = await createTestUser();
		await setGoogleTokens(user.id, { googleAccessToken: "specific-token" });
		mockExistingFolder();
		mockFilesCreate.mockResolvedValueOnce({
			data: { id: "file-id", webViewLink: "https://drive/file-id" },
		});

		const { uploadBackupToDrive } = await import(
			"@/lib/services/google-drive-service"
		);
		const result = await uploadBackupToDrive(user.id, "Case", "{}");

		expect("data" in result).toBe(true);
		expect(mockSetCredentials).toHaveBeenCalledWith(
			expect.objectContaining({
				access_token: "specific-token",
				refresh_token: "test-refresh-token",
			})
		);
	});
});

describe("getOrCreateBackupFolder (via uploadBackupToDrive)", () => {
	it("reuses an existing 'TEA Platform Backups' folder without creating one", async () => {
		const user = await createTestUser();
		await setGoogleTokens(user.id);
		mockExistingFolder("reused-folder-id");
		mockFilesCreate.mockResolvedValueOnce({
			data: { id: "file-id", webViewLink: undefined },
		});

		const { uploadBackupToDrive } = await import(
			"@/lib/services/google-drive-service"
		);
		await uploadBackupToDrive(user.id, "Case", "{}");

		// files.create is called exactly once — for the file, not the folder.
		expect(mockFilesCreate).toHaveBeenCalledTimes(1);
		expect(mockFilesCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				requestBody: expect.objectContaining({ parents: ["reused-folder-id"] }),
			})
		);
	});

	it("creates the folder with the folder MIME type when none exists", async () => {
		const user = await createTestUser();
		await setGoogleTokens(user.id);
		mockFolderCreation("brand-new-folder-id");
		mockFilesCreate.mockResolvedValueOnce({
			data: { id: "file-id", webViewLink: undefined },
		});

		const { uploadBackupToDrive } = await import(
			"@/lib/services/google-drive-service"
		);
		await uploadBackupToDrive(user.id, "Case", "{}");

		expect(mockFilesCreate).toHaveBeenCalledTimes(2);
		expect(mockFilesCreate).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				requestBody: expect.objectContaining({ mimeType: FOLDER_MIME }),
			})
		);
		expect(mockFilesCreate).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				requestBody: expect.objectContaining({
					parents: ["brand-new-folder-id"],
				}),
			})
		);
	});
});

describe("uploadBackupToDrive", () => {
	it("names the file '<sanitised case name>-<timestamp>.json', uploads inside the folder, and returns fileId/fileName/webViewLink", async () => {
		const user = await createTestUser();
		await setGoogleTokens(user.id);
		mockExistingFolder("folder-id");
		mockFilesCreate.mockResolvedValueOnce({
			data: { id: "new-file-id", webViewLink: "https://drive/new-file-id" },
		});

		const { uploadBackupToDrive } = await import(
			"@/lib/services/google-drive-service"
		);
		const result = await uploadBackupToDrive(
			user.id,
			"My Case! (v2)",
			'{"hello":"world"}'
		);

		expect("data" in result).toBe(true);
		if (!("data" in result)) {
			throw new Error("expected success");
		}
		expect(result.data.fileId).toBe("new-file-id");
		expect(result.data.webViewLink).toBe("https://drive/new-file-id");
		expect(result.data.fileName).toMatch(BACKUP_FILE_NAME_PATTERN);

		expect(mockFilesCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				requestBody: expect.objectContaining({ parents: ["folder-id"] }),
				media: expect.objectContaining({ mimeType: JSON_MIME }),
			})
		);
	});

	it("returns an API_ERROR result carrying the SDK's message when the upload throws", async () => {
		const user = await createTestUser();
		await setGoogleTokens(user.id);
		mockExistingFolder();
		mockFilesCreate.mockRejectedValueOnce(new Error("quota exceeded"));

		const { uploadBackupToDrive } = await import(
			"@/lib/services/google-drive-service"
		);
		const result = await uploadBackupToDrive(user.id, "Case", "{}");

		expect("error" in result).toBe(true);
		if (!("error" in result)) {
			throw new Error("expected failure");
		}
		expect(result.driveError.code).toBe("API_ERROR");
		expect(result.error).toBe("quota exceeded");
	});

	it("returns a NO_TOKEN error when the user has no Google token", async () => {
		const user = await createTestUser();

		const { uploadBackupToDrive } = await import(
			"@/lib/services/google-drive-service"
		);
		const result = await uploadBackupToDrive(user.id, "Case", "{}");

		expect("error" in result).toBe(true);
		if (!("error" in result)) {
			throw new Error("expected failure");
		}
		expect(result.driveError.code).toBe("NO_TOKEN");
	});
});

describe("downloadFileFromDrive", () => {
	function mockMetadataThenContent(mimeType: string, content = "file body") {
		mockFilesGet
			.mockImplementationOnce(async () => ({
				data: { name: "backup.json", mimeType },
			}))
			.mockImplementationOnce(async () => ({ data: content }));
	}

	it("returns content and name for a JSON file", async () => {
		const user = await createTestUser();
		await setGoogleTokens(user.id);
		mockMetadataThenContent(JSON_MIME, '{"case":{}}');

		const { downloadFileFromDrive } = await import(
			"@/lib/services/google-drive-service"
		);
		const result = await downloadFileFromDrive(user.id, "file-id");

		expect("data" in result).toBe(true);
		if (!("data" in result)) {
			throw new Error("expected success");
		}
		expect(result.data.content).toBe('{"case":{}}');
		expect(result.data.name).toBe("backup.json");
		expect(mockFilesGet).toHaveBeenCalledTimes(2);
	});

	it("rejects a non-JSON file before fetching its content", async () => {
		const user = await createTestUser();
		await setGoogleTokens(user.id);
		mockFilesGet.mockImplementationOnce(async () => ({
			data: { name: "notes.txt", mimeType: "text/plain" },
		}));

		const { downloadFileFromDrive } = await import(
			"@/lib/services/google-drive-service"
		);
		const result = await downloadFileFromDrive(user.id, "file-id");

		expect("error" in result).toBe(true);
		if (!("error" in result)) {
			throw new Error("expected failure");
		}
		expect(result.driveError.code).toBe("API_ERROR");
		// Only the metadata fetch happened — content fetch was never attempted.
		expect(mockFilesGet).toHaveBeenCalledTimes(1);
	});

	it("returns an API_ERROR result carrying the SDK's message when the SDK throws", async () => {
		const user = await createTestUser();
		await setGoogleTokens(user.id);
		mockFilesGet.mockRejectedValueOnce(new Error("file not found"));

		const { downloadFileFromDrive } = await import(
			"@/lib/services/google-drive-service"
		);
		const result = await downloadFileFromDrive(user.id, "file-id");

		expect("error" in result).toBe(true);
		if (!("error" in result)) {
			throw new Error("expected failure");
		}
		expect(result.driveError.code).toBe("API_ERROR");
		expect(result.error).toBe("file not found");
	});
});

describe("listBackupFiles", () => {
	it("maps Drive file fields onto DriveFileMetadata", async () => {
		const user = await createTestUser();
		await setGoogleTokens(user.id);
		mockExistingFolder("folder-id");
		mockFilesList.mockResolvedValueOnce({
			data: {
				files: [
					{
						id: "file-1",
						name: "backup-1.json",
						mimeType: JSON_MIME,
						createdTime: "2026-01-01T00:00:00.000Z",
						modifiedTime: "2026-01-02T00:00:00.000Z",
						size: "1234",
					},
				],
			},
		});

		const { listBackupFiles } = await import(
			"@/lib/services/google-drive-service"
		);
		const files = await listBackupFiles(user.id);

		expect(files).toEqual([
			{
				id: "file-1",
				name: "backup-1.json",
				mimeType: JSON_MIME,
				createdTime: "2026-01-01T00:00:00.000Z",
				modifiedTime: "2026-01-02T00:00:00.000Z",
				size: "1234",
			},
		]);
	});

	it("returns an empty array when the user has no token", async () => {
		const user = await createTestUser();

		const { listBackupFiles } = await import(
			"@/lib/services/google-drive-service"
		);
		expect(await listBackupFiles(user.id)).toEqual([]);
	});

	it("returns an empty array when finding/creating the folder fails", async () => {
		const user = await createTestUser();
		await setGoogleTokens(user.id);
		mockFilesList.mockRejectedValueOnce(new Error("folder search failed"));

		const { listBackupFiles } = await import(
			"@/lib/services/google-drive-service"
		);
		expect(await listBackupFiles(user.id)).toEqual([]);
	});

	it("returns an empty array when listing files in the folder fails", async () => {
		const user = await createTestUser();
		await setGoogleTokens(user.id);
		mockExistingFolder("folder-id");
		mockFilesList.mockRejectedValueOnce(new Error("list failed"));

		const { listBackupFiles } = await import(
			"@/lib/services/google-drive-service"
		);
		expect(await listBackupFiles(user.id)).toEqual([]);
	});
});

describe("DRIVE_ERROR_MAP", () => {
	// TOKEN_EXPIRED, REFRESH_FAILED, FORBIDDEN and NOT_FOUND are declared on
	// GoogleDriveErrorCode and mapped here, but nothing in this service ever
	// constructs a GoogleDriveError with those codes (only NO_TOKEN and
	// API_ERROR are ever produced — confirmed by reading every
	// `createDriveError` call site). This test pins the map's own data
	// rather than a route response, since the unreachable codes can't be
	// exercised through a live request. See the QA report's follow-ups.
	it("maps every GoogleDriveErrorCode to the documented ErrorCode", async () => {
		const { DRIVE_ERROR_MAP } = await import(
			"@/lib/services/google-drive-service"
		);
		expect(DRIVE_ERROR_MAP).toEqual({
			NO_TOKEN: "FORBIDDEN",
			TOKEN_EXPIRED: "UNAUTHORISED",
			REFRESH_FAILED: "UNAUTHORISED",
			NOT_FOUND: "NOT_FOUND",
			FORBIDDEN: "FORBIDDEN",
			API_ERROR: "INTERNAL",
		});
	});
});
