import type { NextRequest } from "next/server";
import { apiErrorFromUnknown } from "@/lib/api-response";
import {
	answerCriteriaChange,
	answerCriteriaRead,
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
 * `evidence_node` says where the claim's evidence node is (`live`, `trashed`,
 * `moved` or `missing`) and is null when the claim has none.
 * `evidence_node_text` is null unless the node is live; then it holds the
 * node's text as it reads now (`description`) and the check and pipeline that
 * text was last written for (`written_for`), which a form uses to offer
 * updating it.
 * @response 200 - `{ criteria, check_description, evidence_node, evidence_node_text, integration, accepted_by, last_change, pipeline_read, check_offer, latest_result }`
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

		return answerCriteriaRead(await readCriteria(userId, claimId));
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
 * `add_evidence_node: true` also adds one evidence element under the claim in
 * the same save, naming the check and its pipeline; it is allowed only when
 * the save moves the settings to accepted from not accepted, and the claim's
 * live node is reused when it has one. `update_evidence_node_text: true`
 * rewrites the live node's text to name the new check; it is allowed only when
 * accepted settings change their check, or stopped or suggested settings are
 * accepted with a check that differs from the one the node's text was last
 * written for (the check of the newest acceptance or edit of accepted
 * settings), and the node is live. Both are refused with a 400 otherwise,
 * except that a request which sets both while the claim has no live node to
 * reuse adds a new node, ignores `update_evidence_node_text` and answers 200,
 * provided the check differs as above.
 * `evidence_node` in the response says where the claim's node is: `live`,
 * `trashed`, `moved` or `missing`.
 * @body { integration_id, settings, accept, expected_revision?, add_evidence_node?, update_evidence_node_text? }
 * @response 200 - The same body as the GET, after the save
 * @response 400 - Invalid body, or a node option the save cannot use; the field is named and nothing is stored
 * @response 401 - No session
 * @response 403 - The `tea.health` plugin is not enabled for this deployment/user
 * @response 404 - Claim not found (a missing claim and no EDIT access give the same message)
 * @response 409 - The settings are accepted and cannot be saved as a suggestion, were changed by someone else, or the case changed while saving
 * @auth SessionAuth
 * @tag Elements
 */
export async function PUT(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { userId, username, claimId } = await requireClaimRequest(params);
		const body = await parseHealthBody(request, criteriaSaveRequestSchema);

		const result = await saveCriteria(userId, claimId, body);
		return await answerCriteriaChange(result, claimId, { userId, username });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
