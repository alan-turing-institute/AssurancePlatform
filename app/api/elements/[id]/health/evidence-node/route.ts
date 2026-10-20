import type { NextRequest } from "next/server";
import { apiErrorFromUnknown } from "@/lib/api-response";
import {
	answerCriteriaChange,
	requireClaimRequest,
} from "@/lib/health-route-helpers";
import { addEvidenceNode } from "@/lib/services/health-criteria-service";

/**
 * POST /api/elements/[id]/health/evidence-node
 *
 * Adds the evidence node for a claim whose settings were accepted without one.
 *
 * @description Human session only. The session user needs EDIT on the claim's
 * case. Takes no body. Adds one evidence element under the claim, with the
 * session user as its creator, whose text names the check and the pipeline
 * that runs it, and remembers it as the claim's node. A pointer to a node that
 * is no longer live (moved, trashed or gone) is replaced. The settings and
 * their history are not changed.
 * @response 200 - The same body as `GET /api/elements/[id]/health/criteria`, after the change
 * @response 400 - `id` is not a UUID
 * @response 401 - No session
 * @response 403 - The `tea.health` plugin is not enabled for this deployment/user
 * @response 404 - Claim not found (a missing claim and no EDIT access give the same message)
 * @response 409 - The claim's settings are not accepted, it already has a live node, or the case changed while saving
 * @auth SessionAuth
 * @tag Elements
 */
export async function POST(
	_request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { userId, username, claimId } = await requireClaimRequest(params);

		const result = await addEvidenceNode(userId, claimId);
		return await answerCriteriaChange(result, claimId, { userId, username });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
