/**
 * Google Drive API Service
 *
 * Provides functions to interact with Google Drive using the user's
 * OAuth tokens. Used for backing up and importing assurance cases.
 */

import { google } from "googleapis";
import { prisma } from "@/lib/prisma";
import type { ErrorCode } from "@/types/domain";

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

export type GoogleDriveError = {
	code: GoogleDriveErrorCode;
	message: string;
	status?: number;
};

export type DriveFileMetadata = {
	id: string;
	name: string;
	mimeType: string;
	createdTime: string;
	modifiedTime: string;
	size?: string;
};

export type UploadResult = {
	fileId: string;
	fileName: string;
	webViewLink?: string;
};

export type DownloadResult = {
	content: string;
	name: string;
};

/**
 * Maps Google Drive error codes to application error codes.
 * Moved here from the route layer so callers can use it without coupling to the route.
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
 * Retrieves and potentially refreshes the user's Google tokens.
 * Returns null if no token or refresh fails.
 */
async function getUserGoogleTokens(userId: string): Promise<{
	accessToken: string;
	refreshToken: string | null;
} | null> {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: {
			googleAccessToken: true,
			googleRefreshToken: true,
			googleTokenExpiresAt: true,
		},
	});

	if (!user?.googleAccessToken) {
		return null;
	}

	// Check if token is expired or will expire soon (5 min buffer)
	const now = new Date();
	const expiresAt = user.googleTokenExpiresAt;
	const bufferMs = 5 * 60 * 1000;

	if (expiresAt && expiresAt.getTime() - bufferMs < now.getTime()) {
		// Token expired or expiring soon - attempt refresh
		if (!user.googleRefreshToken) {
			return null;
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
			console.error("Failed to refresh Google token:", error);
			return null;
		}
	}

	return {
		accessToken: user.googleAccessToken,
		refreshToken: user.googleRefreshToken,
	};
}

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

	if (!tokens) {
		return {
			driveError: createDriveError(
				"NO_TOKEN",
				"No Google token found. Please sign in with Google to connect your account."
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
			driveError: createDriveError(
				"API_ERROR",
				error instanceof Error
					? error.message
					: "Failed to find or create backup folder"
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
		const { Readable } = require("node:stream");
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
		const driveError = createDriveError(
			"API_ERROR",
			error instanceof Error
				? error.message
				: "Failed to upload to Google Drive"
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
		const driveError = createDriveError(
			"API_ERROR",
			error instanceof Error
				? error.message
				: "Failed to download from Google Drive"
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
	return tokens !== null;
}
