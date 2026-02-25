import { z } from "zod";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { AppError, forbidden, validationError } from "@/lib/errors";
import { importCase } from "@/lib/services/case-import-service";
import {
	downloadFileFromDrive,
	type GoogleDriveError,
	type GoogleDriveErrorCode,
	hasGoogleToken,
	listBackupFiles,
} from "@/lib/services/google-drive-service";
import type { ErrorCode } from "@/types/domain";

const ImportSchema = z.object({
	fileId: z.string().min(1, "File ID is required"),
});

/**
 * Maps Google Drive error codes to application error codes.
 */
const DRIVE_ERROR_MAP: Record<GoogleDriveErrorCode, ErrorCode> = {
	NO_TOKEN: "FORBIDDEN",
	TOKEN_EXPIRED: "UNAUTHORISED",
	REFRESH_FAILED: "UNAUTHORISED",
	NOT_FOUND: "NOT_FOUND",
	FORBIDDEN: "FORBIDDEN",
	API_ERROR: "INTERNAL",
};

/**
 * POST /api/cases/import/gdrive
 *
 * Imports an assurance case from Google Drive.
 *
 * @body { fileId: string }
 * @response ImportResult
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

		const parseResult = ImportSchema.safeParse(
			await request.json().catch(() => null)
		);
		if (!parseResult.success) {
			return apiError(validationError("Invalid request"));
		}

		const { fileId } = parseResult.data;

		// Download file from Drive
		let fileContent: string;
		let fileName: string;
		try {
			const result = await downloadFileFromDrive(userId, fileId);
			fileContent = result.content;
			fileName = result.name;
		} catch (error) {
			const driveError = error as GoogleDriveError;
			const code = DRIVE_ERROR_MAP[driveError.code] ?? "INTERNAL";
			return apiError(new AppError({ code, message: driveError.message }));
		}

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

		try {
			const files = await listBackupFiles(userId);
			return apiSuccess({ connected: true, files });
		} catch {
			return apiSuccess({ connected: true, files: [] });
		}
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
