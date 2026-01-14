/**
 * Google Drive API Service
 *
 * Provides functions to interact with Google Drive using the user's
 * OAuth tokens. Used for backing up and importing assurance cases.
 */

import { google } from "googleapis";
import { prismaNew } from "@/lib/prisma";

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
	const user = await prismaNew.user.findUnique({
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
			await prismaNew.user.update({
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
 * Throws GoogleDriveError if no valid token is available.
 */
async function createDriveClient(userId: string) {
	const tokens = await getUserGoogleTokens(userId);

	if (!tokens) {
		throw createDriveError(
			"NO_TOKEN",
			"No Google token found. Please sign in with Google to connect your account."
		);
	}

	const oauth2Client = new google.auth.OAuth2(
		process.env.GOOGLE_CLIENT_ID,
		process.env.GOOGLE_CLIENT_SECRET
	);
	oauth2Client.setCredentials({
		access_token: tokens.accessToken,
		refresh_token: tokens.refreshToken,
	});

	return google.drive({ version: "v3", auth: oauth2Client });
}

/**
 * Finds or creates the TEA Platform backup folder in user's Drive.
 */
async function getOrCreateBackupFolder(userId: string): Promise<string> {
	const drive = await createDriveClient(userId);

	// Search for existing folder
	const response = await drive.files.list({
		q: `name='${FOLDER_NAME}' and mimeType='${MIME_TYPE_FOLDER}' and trashed=false`,
		fields: "files(id, name)",
		spaces: "drive",
	});

	if (response.data.files && response.data.files.length > 0) {
		return response.data.files[0].id as string;
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

	return folder.data.id as string;
}

/**
 * Uploads a case backup to Google Drive.
 *
 * @param userId - The user's ID
 * @param caseName - The name of the assurance case
 * @param jsonContent - The JSON content to upload
 * @returns Upload result with file ID and name
 */
export async function uploadBackupToDrive(
	userId: string,
	caseName: string,
	jsonContent: string
): Promise<UploadResult> {
	const drive = await createDriveClient(userId);
	const folderId = await getOrCreateBackupFolder(userId);

	const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, "-");
	const sanitisedName = caseName.replace(/[^a-zA-Z0-9-_]/g, "_");
	const fileName = `${sanitisedName}-${timestamp}.json`;

	const fileMetadata = {
		name: fileName,
		parents: [folderId],
		mimeType: MIME_TYPE_JSON,
	};

	// Use a readable stream for the media body
	const { Readable } = await import("node:stream");
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
		fileId: file.data.id as string,
		fileName,
		webViewLink: file.data.webViewLink ?? undefined,
	};
}

/**
 * Downloads a file from Google Drive by ID.
 *
 * @param userId - The user's ID
 * @param fileId - The Google Drive file ID
 * @returns The file content and name
 */
export async function downloadFileFromDrive(
	userId: string,
	fileId: string
): Promise<DownloadResult> {
	const drive = await createDriveClient(userId);

	// Get file metadata
	const metadata = await drive.files.get({
		fileId,
		fields: "name, mimeType",
	});

	if (metadata.data.mimeType !== MIME_TYPE_JSON) {
		throw createDriveError("API_ERROR", "Selected file is not a JSON file");
	}

	// Download content
	const response = await drive.files.get(
		{ fileId, alt: "media" },
		{ responseType: "text" }
	);

	return {
		content: response.data as string,
		name: metadata.data.name as string,
	};
}

/**
 * Lists backup files in the TEA Platform folder.
 *
 * @param userId - The user's ID
 * @returns Array of file metadata
 */
export async function listBackupFiles(
	userId: string
): Promise<DriveFileMetadata[]> {
	const drive = await createDriveClient(userId);

	try {
		const folderId = await getOrCreateBackupFolder(userId);

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
 * @returns true if the user has a valid token
 */
export async function hasGoogleToken(userId: string): Promise<boolean> {
	const tokens = await getUserGoogleTokens(userId);
	return tokens !== null;
}
