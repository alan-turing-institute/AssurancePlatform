import { NextResponse } from "next/server";
import { validateSession } from "@/lib/auth/validate-session";
import { importCase } from "@/lib/services/case-import-service";

/**
 * Import an assurance case from JSON
 *
 * @description Imports a case from JSON data. Accepts v1 (legacy Django),
 * v2 (flat format), and nested (v1.0) formats. Creates a new case with
 * all elements and evidence links.
 *
 * @body JSON case data in any supported format
 * @response 200 - { id, name, elementCount, evidenceLinkCount, warnings }
 * @response 400 - Validation errors
 * @response 401 - Unauthorised
 * @auth bearer
 * @tag Cases
 */
export async function POST(request: Request) {
	const validated = await validateSession();

	if (!validated) {
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

	const result = await importCase(validated.userId, jsonData);

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
 * Validate import data without creating
 *
 * @description Validates JSON import data and returns preview information
 * without actually creating the case. Useful for preview/confirmation UI.
 *
 * @body JSON case data to validate
 * @response 200 - { isValid, version, caseName, elementCount, evidenceLinkCount, warnings }
 * @response 400 - Validation errors
 * @response 401 - Unauthorised
 * @auth bearer
 * @tag Cases
 */
export async function PUT(request: Request) {
	const validated = await validateSession();

	if (!validated) {
		return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
	}

	const { validateImportData } = await import(
		"@/lib/services/case-import-service"
	);

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
