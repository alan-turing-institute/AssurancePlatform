import { NextResponse } from "next/server";
import { z } from "zod";
import { validateSession } from "@/lib/auth/validate-session";
import { importCase } from "@/lib/services/case-import-service";
import {
	downloadFileFromDrive,
	type GoogleDriveError,
	type GoogleDriveErrorCode,
	hasGoogleToken,
	listBackupFiles,
} from "@/lib/services/google-drive-service";

const ImportSchema = z.object({
	fileId: z.string().min(1, "File ID is required"),
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
				message: "Please sign in with Google to import from Google Drive.",
			},
			{ status: 403 }
		);
	}

	const parseResult = ImportSchema.safeParse(
		await request.json().catch(() => null)
	);
	if (!parseResult.success) {
		return NextResponse.json(
			{ error: "Invalid request", validationErrors: parseResult.error.errors },
			{ status: 400 }
		);
	}

	const { fileId } = parseResult.data;

	// Download file from Drive
	let fileContent: string;
	let fileName: string;
	try {
		const result = await downloadFileFromDrive(validated.userId, fileId);
		fileContent = result.content;
		fileName = result.name;
	} catch (error) {
		const driveError = error as GoogleDriveError;
		const status = getStatusForDriveError(driveError.code);
		return NextResponse.json(
			{ error: driveError.message, code: driveError.code },
			{ status }
		);
	}

	// Parse JSON
	let jsonData: unknown;
	try {
		jsonData = JSON.parse(fileContent);
	} catch {
		return NextResponse.json(
			{ error: "Invalid JSON file", message: `${fileName} is not valid JSON.` },
			{ status: 400 }
		);
	}

	// Import the case
	const importResult = await importCase(validated.userId, jsonData);
	if (!importResult.success) {
		return NextResponse.json(
			{
				error: importResult.error,
				validationErrors: importResult.validationErrors,
			},
			{ status: 400 }
		);
	}

	return NextResponse.json({
		id: importResult.caseId,
		name: importResult.caseName,
		elementCount: importResult.elementCount,
		evidenceLinkCount: importResult.evidenceLinkCount,
		warnings: importResult.warnings,
		source: { type: "gdrive", fileId, fileName },
	});
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
	const validated = await validateSession();
	if (!validated) {
		return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
	}

	const hasToken = await hasGoogleToken(validated.userId);
	if (!hasToken) {
		return NextResponse.json({ connected: false, files: [] });
	}

	try {
		const files = await listBackupFiles(validated.userId);
		return NextResponse.json({ connected: true, files });
	} catch {
		return NextResponse.json({ connected: true, files: [] });
	}
}
