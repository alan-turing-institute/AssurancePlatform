import { NextResponse } from "next/server";
import { z } from "zod";
import { validateSession } from "@/lib/auth/validate-session";
import { exportCase } from "@/lib/services/case-export-service";
import {
	type GoogleDriveError,
	type GoogleDriveErrorCode,
	hasGoogleToken,
	uploadBackupToDrive,
} from "@/lib/services/google-drive-service";

const BackupSchema = z.object({
	caseId: z.string().uuid("Invalid case ID"),
	includeComments: z.boolean().optional().default(true),
});

/**
 * Maps Google Drive error codes to HTTP status codes.
 */
function getStatusForDriveError(code: GoogleDriveErrorCode): number {
	const statusMap: Record<GoogleDriveErrorCode, number> = {
		NO_TOKEN: 403,
		TOKEN_EXPIRED: 401,
		REFRESH_FAILED: 401,
		NOT_FOUND: 404,
		FORBIDDEN: 403,
		API_ERROR: 500,
	};
	return statusMap[code] ?? 500;
}

/**
 * POST /api/cases/backup/gdrive
 *
 * Backs up an assurance case to Google Drive.
 *
 * @body { caseId: string, includeComments?: boolean }
 * @response { success: boolean, fileId: string, fileName: string, webViewLink?: string }
 * @auth bearer
 * @tag Cases
 */
export async function POST(request: Request) {
	const validated = await validateSession();
	if (!validated) {
		return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
	}

	const hasToken = await hasGoogleToken(validated.userId);
	if (!hasToken) {
		return NextResponse.json(
			{
				error: "Google not connected",
				code: "NO_TOKEN",
				message: "Please sign in with Google to back up to Google Drive.",
			},
			{ status: 403 }
		);
	}

	const parseResult = BackupSchema.safeParse(
		await request.json().catch(() => null)
	);
	if (!parseResult.success) {
		return NextResponse.json(
			{ error: "Invalid request", validationErrors: parseResult.error.errors },
			{ status: 400 }
		);
	}

	const { caseId, includeComments } = parseResult.data;

	const exportResult = await exportCase(validated.userId, caseId, {
		includeComments,
	});

	if (!exportResult.success) {
		const status = exportResult.error === "Permission denied" ? 403 : 500;
		return NextResponse.json({ error: exportResult.error }, { status });
	}

	try {
		const result = await uploadBackupToDrive(
			validated.userId,
			exportResult.data.case.name,
			JSON.stringify(exportResult.data, null, 2)
		);

		return NextResponse.json({
			success: true,
			fileId: result.fileId,
			fileName: result.fileName,
			webViewLink: result.webViewLink,
		});
	} catch (error) {
		const driveError = error as GoogleDriveError;
		const status = getStatusForDriveError(driveError.code);
		return NextResponse.json(
			{ error: driveError.message, code: driveError.code },
			{ status }
		);
	}
}

/**
 * GET /api/cases/backup/gdrive
 *
 * Checks if the user has Google Drive connected.
 *
 * @response { connected: boolean }
 * @auth bearer
 * @tag Cases
 */
export async function GET() {
	const validated = await validateSession();
	if (!validated) {
		return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
	}

	const connected = await hasGoogleToken(validated.userId);
	return NextResponse.json({ connected });
}
