import { JSON_BODY_LIMITS, readJsonBody } from "@/lib/api-request";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
} from "@/lib/api-response";
import { validationError } from "@/lib/errors";
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
 * @response 413 - Payload too large
 * @auth bearer
 * @tag Cases
 */
export async function POST(request: Request) {
	try {
		const userId = await requireAuth();

		// The body is a whole case document whose format is detected by the
		// import service itself (`importCase` -> `validateImportData`), not
		// by a zod schema here — the accepted shapes (v1, v2, nested v1.0)
		// vary too much for one schema to usefully bound, so this is the one
		// sanctioned schema-less body read (Design §4). Still size-capped,
		// at the larger `caseImport` limit rather than the 1 MiB default.
		const jsonData = await readJsonBody(request, {
			maxBytes: JSON_BODY_LIMITS.caseImport,
		});

		const result = await importCase(userId, jsonData);

		if ("error" in result) {
			return apiError(
				validationError(result.error, {
					...(result.validationErrors && {
						validation: JSON.stringify(result.validationErrors),
					}),
				})
			);
		}

		return apiSuccess({
			id: result.data.caseId,
			name: result.data.caseName,
			elementCount: result.data.elementCount,
			evidenceLinkCount: result.data.evidenceLinkCount,
			warnings: result.data.warnings,
		});
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
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
 * @response 413 - Payload too large
 * @auth bearer
 * @tag Cases
 */
export async function PUT(request: Request) {
	try {
		await requireAuth();

		const { validateImportData } = await import(
			"@/lib/services/case-import-service"
		);

		// Schema-less for the same reason as POST above — see its comment.
		const jsonData = await readJsonBody(request, {
			maxBytes: JSON_BODY_LIMITS.caseImport,
		});

		const result = await validateImportData(jsonData);

		if (!result.isValid) {
			return apiSuccess(
				{
					isValid: false,
					errors: result.errors,
				},
				400
			);
		}

		return apiSuccess({
			isValid: true,
			version: result.version,
			caseName: result.caseName,
			elementCount: result.elementCount,
			evidenceLinkCount: result.evidenceLinkCount,
			warnings: result.warnings,
		});
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
