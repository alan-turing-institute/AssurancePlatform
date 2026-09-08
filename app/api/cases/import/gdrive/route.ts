import { parseJsonBody } from "@/lib/api-request";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { AppError, forbidden, validationError } from "@/lib/errors";
import { importFromDriveSchema } from "@/lib/schemas/google-drive";
import { importCase } from "@/lib/services/case-import-service";
import {
	DRIVE_ERROR_MAP,
	downloadFileFromDrive,
	hasGoogleToken,
	listBackupFiles,
} from "@/lib/services/google-drive-service";

/**
 * POST /api/cases/import/gdrive
 *
 * Imports an assurance case from Google Drive.
 *
 * @body { fileId: string }
 * @response ImportResult
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
					"Google not connected. Please sign in with Google to import from Google Drive."
				)
			);
		}

		const { fileId } = await parseJsonBody(request, importFromDriveSchema);

		// Download file from Drive
		const downloadResult = await downloadFileFromDrive(userId, fileId);

		if ("error" in downloadResult) {
			const code =
				DRIVE_ERROR_MAP[downloadResult.driveError.code] ?? "INTERNAL";
			return apiError(new AppError({ code, message: downloadResult.error }));
		}

		const fileContent = downloadResult.data.content;
		const fileName = downloadResult.data.name;

		// Parse JSON
		let jsonData: unknown;
		try {
			jsonData = JSON.parse(fileContent);
		} catch {
			return apiError(validationError(`${fileName} is not valid JSON.`));
		}

		// Import the case
		const importResult = await importCase(userId, jsonData);
		if ("error" in importResult) {
			return apiError(serviceErrorToAppError(importResult.error));
		}

		return apiSuccess({
			id: importResult.data.caseId,
			name: importResult.data.caseName,
			elementCount: importResult.data.elementCount,
			evidenceLinkCount: importResult.data.evidenceLinkCount,
			warnings: importResult.data.warnings,
			source: { type: "gdrive", fileId, fileName },
		});
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}

/**
 * GET /api/cases/import/gdrive
 *
 * Lists available backup files from Google Drive.
 *
 * @response { connected: boolean, files: DriveFileMetadata[] }
 * @auth bearer
 * @tag Cases
 */
export async function GET() {
	try {
		const userId = await requireAuth();

		const hasToken = await hasGoogleToken(userId);
		if (!hasToken) {
			return apiSuccess({ connected: false, files: [] });
		}

		// `listBackupFiles` never throws — it swallows Drive/folder failures
		// and returns [] itself (see its docstring), so a try/catch here could
		// never fire. Removed rather than converted to a ServiceResult: an
		// empty-list-on-failure contract is what this GET wants (a Drive
		// hiccup shouldn't turn "list my backups" into a hard error), and
		// changing that contract would be a bigger change than this route
		// asked for.
		const files = await listBackupFiles(userId);
		return apiSuccess({ connected: true, files });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
