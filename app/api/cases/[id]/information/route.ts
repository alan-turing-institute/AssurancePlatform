import type { NextRequest } from "next/server";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { validationError } from "@/lib/errors";
import { upsertCaseInformationSchema } from "@/lib/schemas/case-information";
import {
	getCaseInformation,
	upsertCaseInformation,
} from "@/lib/services/case-information-service";

interface RouteParams {
	params: Promise<{ id: string }>;
}

/**
 * GET /api/cases/[id]/information
 *
 * @description Reads the case-information record for an assurance case
 * (description, authors, sector, feature image — ADR 0003 §1). Requires
 * VIEW permission. Returns `data: null` (not a 404) when the case has not
 * been curated yet — that is a normal state, not an error.
 *
 * @pathParam id - Case ID (UUID)
 * @response 200 - The case-information record, or `null` if none exists
 * @response 401 - Unauthorised
 * @response 403 - Permission denied (also returned for a non-existent case)
 * @auth bearer
 * @tag Cases
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
	try {
		const userId = await requireAuth();
		const { id: caseId } = await params;

		const result = await getCaseInformation(userId, caseId);
		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess(result.data);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}

/**
 * PUT /api/cases/[id]/information
 *
 * @description Creates or updates the case-information record for an
 * assurance case. A single upsert — there is no separate create vs. update
 * distinction (ADR 0003 §1: "editable any time"). Only the fields supplied
 * are written; omitted fields are left untouched on an existing record.
 * Requires EDIT permission.
 *
 * @pathParam id - Case ID (UUID)
 * @body { description?, authors?, sector?, featureImageUrl? }
 * @response 200 - The saved case-information record
 * @response 400 - Validation error
 * @response 401 - Unauthorised
 * @response 403 - Permission denied
 * @auth bearer
 * @tag Cases
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
	try {
		const userId = await requireAuth();
		const { id: caseId } = await params;

		const raw = await request.json().catch(() => null);
		const parsed = upsertCaseInformationSchema.safeParse(raw);
		if (!parsed.success) {
			return apiError(
				validationError(parsed.error.issues[0]?.message ?? "Invalid input")
			);
		}

		const result = await upsertCaseInformation(userId, caseId, parsed.data);
		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess(result.data);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
