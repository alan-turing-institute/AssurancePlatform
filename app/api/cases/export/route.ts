import { NextResponse } from "next/server";
import { validateSession } from "@/lib/auth/validate-session";
import { exportCase } from "@/lib/services/case-export-service";

/**
 * GET /api/cases/export?id=xxx&includeComments=true
 *
 * Exports a case in v2 JSON format.
 * Requires VIEW permission on the case.
 *
 * Query parameters:
 * - id: Case ID (required)
 * - includeComments: Include comments in export (default: true)
 *
 * Returns JSON with Content-Disposition header for download.
 */
export async function GET(request: Request) {
	const validated = await validateSession();

	if (!validated) {
		return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
	}

	// Get parameters from query string
	const { searchParams } = new URL(request.url);
	const caseId = searchParams.get("id");
	const includeCommentsParam = searchParams.get("includeComments");
	// Default to true if not specified or not explicitly "false"
	const includeComments = includeCommentsParam !== "false";

	if (!caseId) {
		return NextResponse.json({ error: "Case ID is required" }, { status: 400 });
	}

	const result = await exportCase(validated.userId, caseId, {
		includeComments,
	});

	if (!result.success) {
		const status = result.error === "Permission denied" ? 403 : 500;
		return NextResponse.json({ error: result.error }, { status });
	}

	// Generate filename with timestamp
	const caseName = result.data.case.name.replace(/[^a-zA-Z0-9-_]/g, "_");
	const timestamp = new Date().toISOString().slice(0, 10);
	const filename = `${caseName}-${timestamp}.json`;

	// Return JSON with download header
	return new NextResponse(JSON.stringify(result.data, null, 2), {
		status: 200,
		headers: {
			"Content-Type": "application/json",
			"Content-Disposition": `attachment; filename="${filename}"`,
		},
	});
}
