import type { NextRequest } from "next/server";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	serviceErrorToAppError,
} from "@/lib/api-response";
import {
	announceHealthChange,
	criteriaFailure,
	parseHealthBody,
	requireClaimRequest,
} from "@/lib/health-route-helpers";
import { criteriaSaveRequestSchema } from "@/lib/schemas/health-criteria";
import {
	readCriteria,
	saveCriteria,
} from "@/lib/services/health-criteria-service";

/**
 * GET /api/elements/[id]/health/criteria
 *
 * The evidence settings of one claim, with what a person needs to read them.
 *
 * @description Human session only; the session user needs VIEW on the
 * claim's case. `criteria` is null when the claim has never had settings;
 * otherwise it holds the settings with their version labels (`r<n>` for the
 * rule, `d<n>` for the reduction, `a<n>` for the aggregation), `state`
 * (`suggested`, `accepted` or `inactive`), `revision`, `source` (where each
 * block came from: `recommended`, `edited` or `hand`), `accepted_at` and
 * `updated_at`. `integration` is the pipeline whose check list the check came
 * from, or null once that integration has been deleted. `accepted_by` names
 * who accepted them and whether that person owned the integration at the
 * time. `last_change` is the newest history entry. `pipeline_read` says when
 * the pipeline last fetched the settings and which revision it got.
 * `check_offer` is `current`, `newer-version` or `not-offered`. `latest_result`
 * compares the claim's current result with the accepted settings.
 * `check_description` is the check's entry in the check list as it was when
 * the check was last found there, and is null when the claim has no settings.
 * @response 200 - `{ criteria, check_description, integration, accepted_by, last_change, pipeline_read, check_offer, latest_result }`
 * @response 400 - `id` is not a UUID
 * @response 401 - No session
 * @response 403 - The `tea.health` plugin is not enabled for this deployment/user
 * @response 404 - Claim not found (covers non-existent, wrong element type, and no-access — same message, no enumeration oracle)
 * @auth SessionAuth
 * @tag Elements
 */
export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { userId, claimId } = await requireClaimRequest(params);

		const result = await readCriteria(userId, claimId);
		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}
		return apiSuccess(result.data);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}

/**
 * PUT /api/elements/[id]/health/criteria
 *
 * Creates or changes a claim's evidence settings, as a suggestion or accepted.
 *
 * @description Human session only — a machine token cannot change settings.
 * The session user needs EDIT on the claim's case. `integration_id` names the
 * pipeline whose check list the check comes from; it must be active, hold
 * EDIT on the case and have published a check list containing the check by
 * name and version. `settings` carries `check`, `rule`, optional `reduction`
 * and `aggregation`, `window` and `valid_for`, with no version labels: the
 * server owns those, and `source`, `revision` and the accepting person.
 * `accept: false` stores the settings as a suggestion; `accept: true` accepts
 * them and binds the claim to the check. Saving over accepted settings keeps
 * them accepted, and `accept: false` over accepted settings is refused.
 * @body { integration_id, settings, accept }
 * @response 200 - The same body as the GET, after the save
 * @response 400 - Invalid body; the field is named and nothing is stored
 * @response 401 - No session
 * @response 403 - The `tea.health` plugin is not enabled for this deployment/user
 * @response 404 - Claim not found (a missing claim and no EDIT access give the same message)
 * @response 409 - The settings are accepted and cannot be saved as a suggestion
 * @auth SessionAuth
 * @tag Elements
 */
export async function PUT(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { userId, claimId } = await requireClaimRequest(params);
		const body = await parseHealthBody(request, criteriaSaveRequestSchema);

		const result = await saveCriteria(userId, claimId, body);
		if ("error" in result || "invalid" in result) {
			return criteriaFailure(result);
		}

		await announceHealthChange(claimId, result.data.caseId);
		return apiSuccess(result.data.view);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
