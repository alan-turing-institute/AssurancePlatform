import { parseJsonBody } from "@/lib/api-request";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { validationError } from "@/lib/errors";
import { uuidSchema } from "@/lib/schemas/base";
import { grantCaseAccessSchema } from "@/lib/schemas/integration";
import {
	grantIntegrationCaseAccess,
	listIntegrationCaseGrants,
} from "@/lib/services/integration-registry-service";

/**
 * GET /api/integrations/[id]/case-grants
 *
 * Lists the cases the integration's account can reach, with the permission
 * level on each.
 * Only cases the signed-in user can view themselves are listed, so being
 * handed an integration does not reveal a case the new owner cannot open.
 * It works for a suspended or revoked integration, so an owner can still
 * review and clean up its access.
 *
 * @description Lists the cases the integration can reach and the permission level on each, limited to cases the signed-in user can view; it works for a suspended or revoked integration.
 * @pathParam id - Integration ID (UUID)
 * @response 200 - `{ grants: Array<{ caseId, caseName, permission, grantedAt }> }`
 * @response 400 - Validation error
 * @response 401 - Unauthorised
 * @response 404 - Integration not found (covers non-existent and not-owned, with the same message)
 * @add 404
 * @auth SessionAuth
 * @tag Integrations
 */
export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const userId = await requireAuth();
		const { id } = await params;

		const parsedId = uuidSchema.safeParse(id);
		if (!parsedId.success) {
			return apiError(validationError("Invalid integration id"));
		}

		const result = await listIntegrationCaseGrants(parsedId.data, userId);
		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess({ grants: result.data });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}

/**
 * POST /api/integrations/[id]/case-grants
 *
 * Grants the integration's account access to a case.
 * The grant always goes to the integration's own account, so the body has no
 * user field.
 * The signed-in user must own the integration and hold Admin access to the
 * case, and the integration must be active, because access granted through an
 * integration that cannot authenticate would do nothing.
 * `permission` is View, Comment or Edit and never Admin; asking for Admin is a
 * 400, not a silent downgrade.
 * Granting again is not an error.
 * Repeating the same permission level succeeds with `alreadyGranted: true`
 * (200), and a different level updates the grant and returns 201.
 *
 * @description Grants the integration's account View, Comment or Edit access to a case (Admin is refused); the integration must be active, and the signed-in user must own it and hold Admin on the case.
 * @pathParam id - Integration ID (UUID)
 * @body { caseId: string, permission: "VIEW" | "COMMENT" | "EDIT" }
 * @response 201 - `{ grant: { caseId, caseName, permission, grantedAt, alreadyGranted: false } }` for a new grant, or an existing grant whose permission level changed
 * @response 200 - `{ grant: { ..., alreadyGranted: true } }` when the grant already had exactly this permission level
 * @response 400 - Validation error (including `permission: "ADMIN"`)
 * @response 401 - Unauthorised
 * @response 404 - Integration not found, case not found (including a trashed case), or the signed-in user lacks Admin on the case, all with the same message
 * @response 409 - The integration is not active; the message says whether it is suspended or revoked
 * @response 413 - Payload too large
 * @add 404,409
 * @auth SessionAuth
 * @tag Integrations
 */
export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const userId = await requireAuth();
		const { id } = await params;

		const parsedId = uuidSchema.safeParse(id);
		if (!parsedId.success) {
			return apiError(validationError("Invalid integration id"));
		}

		const data = await parseJsonBody(request, grantCaseAccessSchema, {
			emptyBodyAs: {},
		});

		const result = await grantIntegrationCaseAccess(
			parsedId.data,
			data.caseId,
			data.permission,
			userId
		);
		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess(
			{ grant: result.data },
			result.data.alreadyGranted ? 200 : 201
		);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
