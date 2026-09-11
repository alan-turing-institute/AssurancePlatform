/**
 * Google Drive API Service
 *
 * Provides functions to interact with Google Drive using the user's
 * OAuth tokens. Used for backing up and importing assurance cases.
 */

import { Readable } from "node:stream";
import { google } from "googleapis";
import { googleNeedsReauthorisation } from "@/lib/auth/google-account-status";
import {
	decryptToken,
	encryptToken,
	TokenEncryptionUnavailableError,
} from "@/lib/auth/token-encryption";
import type { ErrorCode } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const FOLDER_NAME = "TEA Platform Backups";
const MIME_TYPE_JSON = "application/json";
const MIME_TYPE_FOLDER = "application/vnd.google-apps.folder";
const tokenEncryptionLog = logger.child({ component: "token-encryption" });

/**
 * Encrypts an OAuth token before it is written to storage. In production, a
 * missing/misconfigured encryption key must not break the Drive flow: the
 * token is dropped (the caller omits it from the write) and the failure is
 * logged. Outside production, the error propagates.
 */
function encryptForStorage(token: string, field: string): string | undefined {
	try {
		return encryptToken(token);
	} catch (error) {
		if (
			error instanceof TokenEncryptionUnavailableError &&
			process.env.NODE_ENV === "production"
		) {
			tokenEncryptionLog.error(
				"Token encryption unavailable; not persisting token",
				{ field, error: error.message }
			);
			return undefined;
		}
		throw error;
	}
}

/**
 * Decrypts a stored token, treating any failure (tampered ciphertext, an
 * unknown envelope version, the wrong key, or no key configured) as if the
 * token were absent rather than throwing out of the service — the caller
 * should end up at "reconnect your account", not a 500. Logs via the
 * `token-encryption` component, never the value.
 */
function tryDecrypt(
	value: string,
	field: string,
	userId: string
): string | undefined {
	try {
		return decryptToken(value);
	} catch (error) {
		tokenEncryptionLog.error(
			"Failed to decrypt stored token; treating as absent",
			{
				userId,
				field,
				error: error instanceof Error ? error.message : String(error),
			}
		);
		return undefined;
	}
}

export type GoogleDriveErrorCode =
	| "NO_TOKEN"
	| "TOKEN_EXPIRED"
	| "REFRESH_FAILED"
	| "TOKEN_REVOKED"
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
	TOKEN_REVOKED: "UNAUTHORISED",
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
				"NO_TOKEN" | "TOKEN_EXPIRED" | "REFRESH_FAILED" | "TOKEN_REVOKED"
			>;
	  };

/**
 * True when a caught refresh error is Google reporting the grant has been
 * revoked (`invalid_grant`), rather than a transient failure. The
 * `googleapis` client throws a `GaxiosError` whose Google-returned error
 * body lands at `error.response.data.error`; some paths only surface it in
 * the message text (e.g. "invalid_grant: Token has been expired or
 * revoked."), so both are checked.
 */
function isGoogleRevocationError(error: unknown): boolean {
	if (typeof error !== "object" || error === null) {
		return false;
	}
	const record = error as Record<string, unknown>;
	const response = record.response;
	if (typeof response === "object" && response !== null) {
		const data = (response as Record<string, unknown>).data;
		if (
			typeof data === "object" &&
			data !== null &&
			(data as Record<string, unknown>).error === "invalid_grant"
		) {
			return true;
		}
	}
	const message = error instanceof Error ? error.message : String(error);
	return message.includes("invalid_grant");
}

/**
 * Clears a user's Drive tokens after Google reports the grant revoked
 * (`invalid_grant`), keeping `googleId`/`googleEmail` so Google sign-in
 * still works, logs the event, and returns the `TOKEN_REVOKED` result for
 * `getUserGoogleTokens`'s catch block to hand back.
 */
async function clearRevokedGoogleTokens(
	userId: string,
	error: unknown
): Promise<TokenFetchResult> {
	await prisma.user.update({
		where: { id: userId },
		data: {
			googleAccessToken: null,
			googleRefreshToken: null,
			googleTokenExpiresAt: null,
		},
	});
	logger.warn("Google access revoked; cleared stored Drive tokens", {
		userId,
		error: error instanceof Error ? error.message : String(error),
	});
	return { tokenError: "TOKEN_REVOKED" };
}

const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;

/** True once `expiresAt` is within 5 minutes of now, or already past. A null
 * `expiresAt` (no expiry recorded) is treated as not expiring. */
function isTokenExpiringSoon(expiresAt: Date | null): boolean {
	if (!expiresAt) {
		return false;
	}
	return expiresAt.getTime() - TOKEN_EXPIRY_BUFFER_MS < Date.now();
}

/**
 * Attempts to refresh an expiring/expired Google access token, updating the
 * stored token/expiry on success. On failure, distinguishes a revoked grant
 * (`invalid_grant` -> TOKEN_REVOKED, stored tokens cleared) from any other
 * refresh failure (REFRESH_FAILED, stored tokens left untouched — may be
 * transient).
 */
async function refreshGoogleAccessToken(
	userId: string,
	refreshToken: string
): Promise<TokenFetchResult> {
	try {
		const oauth2Client = new google.auth.OAuth2(
			process.env.GOOGLE_CLIENT_ID,
			process.env.GOOGLE_CLIENT_SECRET
		);
		oauth2Client.setCredentials({ refresh_token: refreshToken });

		const { credentials } = await oauth2Client.refreshAccessToken();

		if (!credentials.access_token) {
			throw new Error("No access token in refresh response");
		}

		const encryptedAccessToken = encryptForStorage(
			credentials.access_token,
			"googleAccessToken"
		);
		await prisma.user.update({
			where: { id: userId },
			data: {
				...(encryptedAccessToken !== undefined && {
					googleAccessToken: encryptedAccessToken,
				}),
				googleTokenExpiresAt: credentials.expiry_date
					? new Date(credentials.expiry_date)
					: null,
			},
		});

		return { accessToken: credentials.access_token, refreshToken };
	} catch (error) {
		if (isGoogleRevocationError(error)) {
			return await clearRevokedGoogleTokens(userId, error);
		}

		logger.warn("Failed to refresh Google token", {
			userId,
			error: error instanceof Error ? error.message : String(error),
		});
		return { tokenError: "REFRESH_FAILED" };
	}
}

/**
 * Retrieves and potentially refreshes the user's Google tokens.
 *
 * Distinguishes four failure shapes so callers can produce the truthful
 * `GoogleDriveErrorCode` instead of collapsing every failure into one code:
 * - no access token stored at all, or the stored access token can't be
 *   decrypted (tampered, unknown envelope version, wrong/missing key) ->
 *   NO_TOKEN
 * - token expired/expiring soon, and no refresh token to try (including a
 *   refresh token that failed to decrypt) -> TOKEN_EXPIRED
 * - token expired/expiring soon, refresh attempted and Google reports the
 *   grant revoked (`invalid_grant`) -> TOKEN_REVOKED (stored tokens cleared)
 * - token expired/expiring soon, refresh attempted and failed for any other
 *   reason (threw, or returned a response with no access_token) ->
 *   REFRESH_FAILED (stored tokens left untouched — may be transient)
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

	const decryptedAccessToken = tryDecrypt(
		user.googleAccessToken,
		"googleAccessToken",
		userId
	);
	if (decryptedAccessToken === undefined) {
		return { tokenError: "NO_TOKEN" };
	}

	const decryptedRefreshToken = user.googleRefreshToken
		? tryDecrypt(user.googleRefreshToken, "googleRefreshToken", userId)
		: undefined;

	if (!isTokenExpiringSoon(user.googleTokenExpiresAt)) {
		return {
			accessToken: decryptedAccessToken,
			refreshToken: decryptedRefreshToken ?? null,
		};
	}

	if (!decryptedRefreshToken) {
		return { tokenError: "TOKEN_EXPIRED" };
	}

	return refreshGoogleAccessToken(userId, decryptedRefreshToken);
}

const TOKEN_ERROR_MESSAGES: Record<
	Extract<
		GoogleDriveErrorCode,
		"NO_TOKEN" | "TOKEN_EXPIRED" | "REFRESH_FAILED" | "TOKEN_REVOKED"
	>,
	string
> = {
	NO_TOKEN:
		"No Google token found. Please sign in with Google to connect your account.",
	TOKEN_EXPIRED:
		"Google token has expired and no refresh token is available. Please sign in with Google again.",
	REFRESH_FAILED:
		"Failed to refresh the Google token. Please sign in with Google again.",
	TOKEN_REVOKED:
		"Google access was revoked. Reconnect Google Drive in Settings.",
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

/**
 * True when the user has a linked Google identity but no working Drive
 * refresh token — access was revoked (see `TOKEN_REVOKED` above) or Drive
 * access was never granted with offline access. Distinguishes "needs to
 * reconnect Drive" from "never connected Google at all", both of which
 * `hasGoogleToken` reports as `false`.
 *
 * @param userId - The user's ID
 */
export async function needsGoogleReauthorisation(
	userId: string
): Promise<boolean> {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { googleId: true, googleRefreshToken: true },
	});
	return googleNeedsReauthorisation({
		googleId: user?.googleId ?? null,
		googleRefreshToken: user?.googleRefreshToken ?? null,
	});
}
