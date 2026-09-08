import { parseJsonBody } from "@/lib/api-request";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { AppError, forbidden } from "@/lib/errors";
import { backupToDriveSchema } from "@/lib/schemas/google-drive";
import { exportCase } from "@/lib/services/case-export-service";
import {
	DRIVE_ERROR_MAP,
	hasGoogleToken,
	uploadBackupToDrive,
} from "@/lib/services/google-drive-service";

/**
 * POST /api/cases/backup/gdrive
 *
 * Backs up an assurance case to Google Drive.
 *
 * @body { caseId: string, includeComments?: boolean }
 * @response { success: boolean, fileId: string, fileName: string, webViewLink?: string }
 * @response 413 - Payload too large
 * @auth bearer
 * @tag Cases
 */
export async function POST(request: Request) {
	try {
		const userId = await requireAuth();

		const hasToken = await hasGoogleToken(userId);
		if (!hasToken) {
			return apiError(
				forbidden(
					"Google not connected. Please sign in with Google to back up to Google Drive."
				)
			);
		}

		const { caseId, includeComments } = await parseJsonBody(
			request,
			backupToDriveSchema
		);

		const exportResult = await exportCase(userId, caseId, {
			includeComments,
		});

		if ("error" in exportResult) {
			return apiError(serviceErrorToAppError(exportResult.error));
		}

		const result = await uploadBackupToDrive(
			userId,
			exportResult.data.case.name,
			JSON.stringify(exportResult.data, null, 2)
		);

		if ("error" in result) {
			const code = DRIVE_ERROR_MAP[result.driveError.code] ?? "INTERNAL";
			return apiError(new AppError({ code, message: result.error }));
		}

		return apiSuccess({
			success: true,
			fileId: result.data.fileId,
			fileName: result.data.fileName,
			webViewLink: result.data.webViewLink,
		});
	} catch (error) {
		return apiErrorFromUnknown(error);
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
	try {
		const userId = await requireAuth();
		const connected = await hasGoogleToken(userId);
		return apiSuccess({ connected });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
