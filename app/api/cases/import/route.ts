import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { validateRefreshToken } from "@/lib/auth/refresh-token-service";
import { authOptions } from "@/lib/auth-options";
import { importCase } from "@/lib/services/case-import-service";

/**
 * POST /api/cases/import
 *
 * Imports a case from JSON data.
 * Accepts both v1 (legacy Django) and v2 (Prisma) formats.
 *
 * Body: JSON case data
 * Returns: { id, name, elementCount, evidenceLinkCount, warnings } or validation errors
 */
export async function POST(request: Request) {
	const session = await getServerSession(authOptions);

	if (!session?.key) {
		return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
	}

	const validation = await validateRefreshToken(session.key);
	if (!validation.valid) {
		return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
	}

	let jsonData: unknown;
	try {
		jsonData = await request.json();
	} catch {
		return NextResponse.json(
			{ error: "Invalid JSON in request body" },
			{ status: 400 }
		);
	}

	const result = await importCase(validation.userId, jsonData);

	if (!result.success) {
		return NextResponse.json(
			{
				error: result.error,
				validationErrors: result.validationErrors,
			},
			{ status: 400 }
		);
	}

	return NextResponse.json({
		id: result.caseId,
		name: result.caseName,
		elementCount: result.elementCount,
		evidenceLinkCount: result.evidenceLinkCount,
		warnings: result.warnings,
	});
}

/**
 * GET /api/cases/import/validate
 * (POST for consistency with import endpoint)
 *
 * Validates import data without creating anything.
 * Useful for preview/confirmation UI.
 */
export async function PUT(request: Request) {
	const session = await getServerSession(authOptions);

	if (!session?.key) {
		return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
	}

	const { validateImportData } = await import(
		"@/lib/services/case-import-service"
	);

	const validation = await validateRefreshToken(session.key);
	if (!validation.valid) {
		return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
	}

	let jsonData: unknown;
	try {
		jsonData = await request.json();
	} catch {
		return NextResponse.json(
			{ error: "Invalid JSON in request body" },
			{ status: 400 }
		);
	}

	const result = await validateImportData(jsonData);

	if (!result.isValid) {
		return NextResponse.json(
			{
				isValid: false,
				errors: result.errors,
			},
			{ status: 400 }
		);
	}

	return NextResponse.json({
		isValid: true,
		version: result.version,
		caseName: result.caseName,
		elementCount: result.elementCount,
		evidenceLinkCount: result.evidenceLinkCount,
		warnings: result.warnings,
	});
}
