"use server";

import { validateSession } from "@/lib/auth/validate-session";

interface DriveFile {
	id: string;
	modifiedTime: string;
	name: string;
	size?: string;
}

/**
 * Checks whether the current user has connected their Google Drive account.
 */
export async function checkGoogleDriveAccess(): Promise<{
	connected: boolean;
}> {
	const session = await validateSession();
	if (!session) {
		return { connected: false };
	}

	const { hasGoogleToken } = await import(
		"@/lib/services/google-drive-service"
	);
	const connected = await hasGoogleToken(session.userId);
	return { connected };
}

/**
 * Checks whether the current user has connected their GitHub account.
 */
export async function checkGitHubAccess(): Promise<{ connected: boolean }> {
	const session = await validateSession();
	if (!session) {
		return { connected: false };
	}

	const { hasGitHubToken } = await import("@/lib/services/github-api-service");
	const connected = await hasGitHubToken(session.userId);
	return { connected };
}

/**
 * Fetches Google Drive backup files for the current user.
 * Returns connection status and files list.
 */
export async function fetchGoogleDriveFiles(): Promise<{
	connected: boolean;
	files: DriveFile[];
}> {
	const session = await validateSession();
	if (!session) {
		return { connected: false, files: [] };
	}

	const { hasGoogleToken, listBackupFiles } = await import(
		"@/lib/services/google-drive-service"
	);

	const hasToken = await hasGoogleToken(session.userId);
	if (!hasToken) {
		return { connected: false, files: [] };
	}

	try {
		const files = await listBackupFiles(session.userId);
		return {
			connected: true,
			files: files.map((f) => ({
				id: f.id,
				name: f.name,
				modifiedTime: f.modifiedTime,
				size: f.size,
			})),
		};
	} catch {
		return { connected: true, files: [] };
	}
}
