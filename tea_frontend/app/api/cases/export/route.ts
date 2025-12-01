import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

const USE_PRISMA_AUTH = process.env.USE_PRISMA_AUTH === "true";

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
	const session = await getServerSession(authOptions);

	if (!session?.key) {
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

	if (USE_PRISMA_AUTH) {
		return await exportWithPrisma(session.key, caseId, { includeComments });
	}

	return await exportWithDjango(session.key, caseId);
}

type ExportApiOptions = {
	includeComments?: boolean;
};

/**
 * Exports a case using the new Prisma-based service.
 */
async function exportWithPrisma(
	refreshToken: string,
	caseId: string,
	options: ExportApiOptions = {}
): Promise<NextResponse> {
	const { validateRefreshToken } = await import(
		"@/lib/auth/refresh-token-service"
	);
	const { exportCase } = await import("@/lib/services/case-export-service");

	const validation = await validateRefreshToken(refreshToken);
	if (!validation.valid) {
		return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
	}

	const result = await exportCase(validation.userId, caseId, {
		includeComments: options.includeComments,
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

/**
 * Exports a case using the legacy Django API.
 * Note: This returns v1 format from Django directly.
 */
async function exportWithDjango(
	token: string,
	caseId: string
): Promise<NextResponse> {
	const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL;

	if (!apiUrl) {
		return NextResponse.json(
			{ error: "API URL not configured" },
			{ status: 500 }
		);
	}

	try {
		const response = await fetch(`${apiUrl}/api/cases/${caseId}/`, {
			headers: {
				Authorization: `Token ${token}`,
			},
		});

		if (!response.ok) {
			if (response.status === 404 || response.status === 403) {
				return NextResponse.json(
					{ error: "Case not found or access denied" },
					{ status: response.status }
				);
			}
			return NextResponse.json(
				{ error: "Failed to fetch case" },
				{ status: response.status }
			);
		}

		const data = await response.json();

		// Generate filename
		const caseName = (data.name || "case").replace(/[^a-zA-Z0-9-_]/g, "_");
		const timestamp = new Date().toISOString().slice(0, 10);
		const filename = `${caseName}-${timestamp}.json`;

		// Return Django format with download header
		return new NextResponse(JSON.stringify(data, null, 2), {
			status: 200,
			headers: {
				"Content-Type": "application/json",
				"Content-Disposition": `attachment; filename="${filename}"`,
			},
		});
	} catch (error) {
		console.error("Failed to export case from Django:", error);
		return NextResponse.json(
			{ error: "Failed to export case" },
			{ status: 500 }
		);
	}
}
