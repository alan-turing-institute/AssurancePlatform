import type { NextRequest } from "next/server";
import { parseJsonBody } from "@/lib/api-request";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { toMediaKey } from "@/lib/media-key";
import { mediaVersionToken } from "@/lib/media-response";
import { resolveCaseFeatureImageAddress } from "@/lib/media-routes";
import { upsertCaseInformationSchema } from "@/lib/schemas/case-information";
import {
	getCaseInformation,
	upsertCaseInformation,
} from "@/lib/services/case-information-service";
import type { CaseInformation } from "@/src/generated/prisma";

interface RouteParams {
	params: Promise<{ id: string }>;
}

/**
 * Projects a case-information record's stored `featureImageUrl` to this
 * case's own private-media route address before it ever reaches a browser —
 * the record itself (and every other caller of the service layer) keeps
 * seeing the real stored key. The address carries a `?v=` query derived from
 * the stored key, so it changes on every re-upload.
 */
function withResolvedFeatureImage(
	caseId: string,
	record: CaseInformation | null
): CaseInformation | null {
	if (!record) {
		return record;
	}
	const versionToken = record.featureImageUrl
		? mediaVersionToken(toMediaKey(record.featureImageUrl))
		: undefined;
	return {
		...record,
		featureImageUrl: resolveCaseFeatureImageAddress(
			caseId,
			record.featureImageUrl,
			versionToken
		),
	};
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

		return apiSuccess(withResolvedFeatureImage(caseId, result.data));
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
 * @response 413 - Payload too large
 * @auth bearer
 * @tag Cases
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
	try {
		const userId = await requireAuth();
		const { id: caseId } = await params;

		const data = await parseJsonBody(request, upsertCaseInformationSchema);

		const result = await upsertCaseInformation(userId, caseId, data);
		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess(withResolvedFeatureImage(caseId, result.data));
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
