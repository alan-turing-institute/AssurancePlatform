/**
 * Google Drive API Service
 *
 * Provides functions to interact with Google Drive using the user's
 * OAuth tokens. Used for backing up and importing assurance cases.
 */

import { Readable } from "node:stream";
import { google } from "googleapis";
import type { ErrorCode } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const FOLDER_NAME = "TEA Platform Backups";
const MIME_TYPE_JSON = "application/json";
const MIME_TYPE_FOLDER = "application/vnd.google-apps.folder";

export type GoogleDriveErrorCode =
	| "NO_TOKEN"
	| "TOKEN_EXPIRED"
	| "REFRESH_FAILED"
	| "NOT_FOUND"
	| "FORBIDDEN"
	| "API_ERROR";

export interface GoogleDriveError {
	code: GoogleDriveErrorCode;
	message: string;
	status?: number;
}

export interface DriveFileMetadata {
	createdTime: string;
	id: string;
	mimeType: string;
	modifiedTime: string;
	name: string;
	size?: string;
}

export interface UploadResult {
	fileId: string;
	fileName: string;
	webViewLink?: string;
}

export interface DownloadResult {
	content: string;
	name: string;
}

/**
 * Maps Google Drive error codes to application error codes.
 * The single definition — routes import this rather than keeping their own
 * copy (previously duplicated in `app/api/cases/backup/gdrive/route.ts` and
 * `app/api/cases/import/gdrive/route.ts`).
 */
export const DRIVE_ERROR_MAP: Record<GoogleDriveErrorCode, ErrorCode> = {
	NO_TOKEN: "FORBIDDEN",
	TOKEN_EXPIRED: "UNAUTHORISED",
	REFRESH_FAILED: "UNAUTHORISED",
	NOT_FOUND: "NOT_FOUND",
	FORBIDDEN: "FORBIDDEN",
	API_ERROR: "INTERNAL",
};

/**
 * Creates a GoogleDriveError with the specified code and message.
 */
function createDriveError(
	code: GoogleDriveErrorCode,
	message: string,
	status?: number
): GoogleDriveError {
	return { code, message, status };
}

/**
 * Extracts an HTTP status code from a thrown Drive API error, when the SDK
 * (`googleapis`, via `gaxios`) attaches one — either directly on the error
 * (`GaxiosError#status`) or on a nested `response.status`. Returns
 * `undefined` for anything else (network errors, non-HTTP failures), so
 * callers fall back to the generic `API_ERROR` code.
 */
function extractHttpStatus(error: unknown): number | undefined {
	if (typeof error !== "object" || error === null) {
		return undefined;
	}
	// Cast is explained: `error` is an SDK-thrown value of unknown shape, not
	// a type this module defines — narrowing by reading fields defensively is
	// the only option.
	const record = error as Record<string, unknown>;
	if (typeof record.status === "number") {
		return record.status;
	}
	const response = record.response;
	if (typeof response === "object" && response !== null) {
		const responseStatus = (response as Record<string, unknown>).status;
		if (typeof responseStatus === "number") {
			return responseStatus;
		}
	}
	return undefined;
}

/**
 * Maps a thrown Drive API error to the truthful `GoogleDriveErrorCode`: a
 * 403 is FORBIDDEN, a 404 is NOT_FOUND, everything else stays the generic
 * API_ERROR every catch block here used unconditionally before this existed.
 */
function classifyGoogleApiError(error: unknown): GoogleDriveErrorCode {
	const status = extractHttpStatus(error);
	if (status === 403) {
		return "FORBIDDEN";
	}
	if (status === 404) {
		return "NOT_FOUND";
	}
	return "API_ERROR";
}

/** Builds a `GoogleDriveError` from a caught value, classifying its code. */
function driveErrorFromCaught(
	error: unknown,
	fallbackMessage: string
): GoogleDriveError {
	return createDriveError(
		classifyGoogleApiError(error),
		error instanceof Error ? error.message : fallbackMessage
	);
}

type TokenFetchResult =
	| { accessToken: string; refreshToken: string | null }
	| {
			tokenError: Extract<
				GoogleDriveErrorCode,
				"NO_TOKEN" | "TOKEN_EXPIRED" | "REFRESH_FAILED"
			>;
	  };

/**
 * Retrieves and potentially refreshes the user's Google tokens.
 *
 * Distinguishes three failure shapes so callers can produce the truthful
 * `GoogleDriveErrorCode` instead of collapsing every failure into one code:
 * - no access token stored at all -> NO_TOKEN
 * - token expired/expiring soon, and no refresh token to try -> TOKEN_EXPIRED
 * - token expired/expiring soon, refresh attempted and failed (threw, or
 *   returned a response with no access_token) -> REFRESH_FAILED
 */
async function getUserGoogleTokens(userId: string): Promise<TokenFetchResult> {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: {
			googleAccessToken: true,
			googleRefreshToken: true,
			googleTokenExpiresAt: true,
		},
	});

	if (!user?.googleAccessToken) {
		return { tokenError: "NO_TOKEN" };
	}

	// Check if token is expired or will expire soon (5 min buffer)
	const now = new Date();
	const expiresAt = user.googleTokenExpiresAt;
	const bufferMs = 5 * 60 * 1000;

	if (expiresAt && expiresAt.getTime() - bufferMs < now.getTime()) {
		// Token expired or expiring soon - attempt refresh
		if (!user.googleRefreshToken) {
			return { tokenError: "TOKEN_EXPIRED" };
		}

		try {
			const oauth2Client = new google.auth.OAuth2(
				process.env.GOOGLE_CLIENT_ID,
				process.env.GOOGLE_CLIENT_SECRET
			);
			oauth2Client.setCredentials({
				refresh_token: user.googleRefreshToken,
			});

			const { credentials } = await oauth2Client.refreshAccessToken();

			if (!credentials.access_token) {
				throw new Error("No access token in refresh response");
			}

			// Update stored tokens
			await prisma.user.update({
				where: { id: userId },
				data: {
					googleAccessToken: credentials.access_token,
					googleTokenExpiresAt: credentials.expiry_date
						? new Date(credentials.expiry_date)
						: null,
				},
			});

			return {
				accessToken: credentials.access_token,
				refreshToken: user.googleRefreshToken,
			};
		} catch (error) {
			logger.warn("Failed to refresh Google token", {
				userId,
				error: error instanceof Error ? error.message : String(error),
			});
			return { tokenError: "REFRESH_FAILED" };
		}
	}

	return {
		accessToken: user.googleAccessToken,
		refreshToken: user.googleRefreshToken,
	};
}

const TOKEN_ERROR_MESSAGES: Record<
	Extract<
		GoogleDriveErrorCode,
		"NO_TOKEN" | "TOKEN_EXPIRED" | "REFRESH_FAILED"
	>,
	string
> = {
	NO_TOKEN:
		"No Google token found. Please sign in with Google to connect your account.",
	TOKEN_EXPIRED:
		"Google token has expired and no refresh token is available. Please sign in with Google again.",
	REFRESH_FAILED:
		"Failed to refresh the Google token. Please sign in with Google again.",
};

/**
 * Creates an authenticated Google Drive client for the specified user.
 * Returns a drive error result if no valid token is available.
 */
async function createDriveClient(
	userId: string
): Promise<
	{ drive: ReturnType<typeof google.drive> } | { driveError: GoogleDriveError }
> {
	const tokens = await getUserGoogleTokens(userId);

	if ("tokenError" in tokens) {
		return {
			driveError: createDriveError(
				tokens.tokenError,
				TOKEN_ERROR_MESSAGES[tokens.tokenError]
			),
		};
	}

	const oauth2Client = new google.auth.OAuth2(
		process.env.GOOGLE_CLIENT_ID,
		process.env.GOOGLE_CLIENT_SECRET
	);
	oauth2Client.setCredentials({
		access_token: tokens.accessToken,
		refresh_token: tokens.refreshToken,
	});

	return { drive: google.drive({ version: "v3", auth: oauth2Client }) };
}

/**
 * Finds or creates the TEA Platform backup folder in user's Drive.
 * Returns the folder ID or a drive error.
 */
async function getOrCreateBackupFolder(
	drive: ReturnType<typeof google.drive>
): Promise<{ folderId: string } | { driveError: GoogleDriveError }> {
	try {
		// Search for existing folder
		const response = await drive.files.list({
			q: `name='${FOLDER_NAME}' and mimeType='${MIME_TYPE_FOLDER}' and trashed=false`,
			fields: "files(id, name)",
			spaces: "drive",
		});

		if (response.data.files && response.data.files.length > 0) {
			return { folderId: response.data.files[0]?.id as string };
		}

		// Create new folder
		const folderMetadata = {
			name: FOLDER_NAME,
			mimeType: MIME_TYPE_FOLDER,
		};

		const folder = await drive.files.create({
			requestBody: folderMetadata,
			fields: "id",
		});

		return { folderId: folder.data.id as string };
	} catch (error) {
		return {
			driveError: driveErrorFromCaught(
				error,
				"Failed to find or create backup folder"
			),
		};
	}
}

/**
 * Uploads a case backup to Google Drive.
 *
 * @param userId - The user's ID
 * @param caseName - The name of the assurance case
 * @param jsonContent - The JSON content to upload
 * @returns `{ data: UploadResult }` on success, `{ error: string, driveError: GoogleDriveError }` on failure
 */
export async function uploadBackupToDrive(
	userId: string,
	caseName: string,
	jsonContent: string
): Promise<
	{ data: UploadResult } | { error: string; driveError: GoogleDriveError }
> {
	const driveResult = await createDriveClient(userId);

	if ("driveError" in driveResult) {
		return {
			error: driveResult.driveError.message,
			driveError: driveResult.driveError,
		};
	}

	const drive = driveResult.drive;
	const folderResult = await getOrCreateBackupFolder(drive);

	if ("driveError" in folderResult) {
		return {
			error: folderResult.driveError.message,
			driveError: folderResult.driveError,
		};
	}

	const folderId = folderResult.folderId;

	try {
		const timestamp = new Date()
			.toISOString()
			.slice(0, 19)
			.replace(/[:.]/g, "-");
		const sanitisedName = caseName.replace(/[^a-zA-Z0-9-_]/g, "_");
		const fileName = `${sanitisedName}-${timestamp}.json`;

		const fileMetadata = {
			name: fileName,
			parents: [folderId],
			mimeType: MIME_TYPE_JSON,
		};

		// Use a readable stream for the media body
		const stream = Readable.from([jsonContent]);

		const file = await drive.files.create({
			requestBody: fileMetadata,
			media: {
				mimeType: MIME_TYPE_JSON,
				body: stream,
			},
			fields: "id, webViewLink",
		});

		return {
			data: {
				fileId: file.data.id as string,
				fileName,
				webViewLink: file.data.webViewLink ?? undefined,
			},
		};
	} catch (error) {
		const driveError = driveErrorFromCaught(
			error,
			"Failed to upload to Google Drive"
		);
		return { error: driveError.message, driveError };
	}
}

/**
 * Downloads a file from Google Drive by ID.
 *
 * @param userId - The user's ID
 * @param fileId - The Google Drive file ID
 * @returns `{ data: DownloadResult }` on success, `{ error: string, driveError: GoogleDriveError }` on failure
 */
export async function downloadFileFromDrive(
	userId: string,
	fileId: string
): Promise<
	{ data: DownloadResult } | { error: string; driveError: GoogleDriveError }
> {
	const driveResult = await createDriveClient(userId);

	if ("driveError" in driveResult) {
		return {
			error: driveResult.driveError.message,
			driveError: driveResult.driveError,
		};
	}

	const drive = driveResult.drive;

	try {
		// Get file metadata
		const metadata = await drive.files.get({
			fileId,
			fields: "name, mimeType",
		});

		if (metadata.data.mimeType !== MIME_TYPE_JSON) {
			const driveError = createDriveError(
				"API_ERROR",
				"Selected file is not a JSON file"
			);
			return { error: driveError.message, driveError };
		}

		// Download content
		const response = await drive.files.get(
			{ fileId, alt: "media" },
			{ responseType: "text" }
		);

		return {
			data: {
				content: response.data as string,
				name: metadata.data.name as string,
			},
		};
	} catch (error) {
		const driveError = driveErrorFromCaught(
			error,
			"Failed to download from Google Drive"
		);
		return { error: driveError.message, driveError };
	}
}

/**
 * Lists backup files in the TEA Platform folder.
 *
 * @param userId - The user's ID
 * @returns Array of file metadata (empty if token unavailable or API error)
 */
export async function listBackupFiles(
	userId: string
): Promise<DriveFileMetadata[]> {
	const driveResult = await createDriveClient(userId);

	if ("driveError" in driveResult) {
		return [];
	}

	const drive = driveResult.drive;

	try {
		const folderResult = await getOrCreateBackupFolder(drive);

		if ("driveError" in folderResult) {
			return [];
		}

		const folderId = folderResult.folderId;

		const response = await drive.files.list({
			q: `'${folderId}' in parents and mimeType='${MIME_TYPE_JSON}' and trashed=false`,
			fields: "files(id, name, mimeType, createdTime, modifiedTime, size)",
			orderBy: "modifiedTime desc",
			pageSize: 50,
		});

		return (response.data.files ?? []).map((f) => ({
			id: f.id as string,
			name: f.name as string,
			mimeType: f.mimeType as string,
			createdTime: f.createdTime as string,
			modifiedTime: f.modifiedTime as string,
			size: f.size ?? undefined,
		}));
	} catch {
		return [];
	}
}

/**
 * Checks if a user has a valid Google token stored.
 *
 * @param userId - The user's ID
 * @returns true if the user has a valid (non-expired) token
 */
export async function hasGoogleToken(userId: string): Promise<boolean> {
	const tokens = await getUserGoogleTokens(userId);
	return !("tokenError" in tokens);
}
