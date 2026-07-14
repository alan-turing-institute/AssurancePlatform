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
 * Lists the cases the integration's system user currently has access to.
 * Owner-only at the integration level, and additionally filtered per-row to
 * cases the CALLER themselves can currently view — a reassigned integration
 * owner does not learn the id/name of a case they cannot access just by
 * having been handed the integration (see `listIntegrationCaseGrants`'s doc
 * comment). Not gated on integration status — listing a suspended or
 * revoked integration's grants still works (operator cleanup path).
 *
 * @pathParam id - Integration ID (UUID)
 * @response 200 - `{ grants: Array<{ caseId, caseName, permission, grantedAt }> }`
 * @response 400 - Validation error
 * @response 401 - Unauthorised
 * @response 404 - Integration not found (covers non-existent and not-owned — same message)
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
 * Grants the integration's system user access to a case. The target user
 * is ALWAYS the integration's own system user — the request body has no
 * `userId` field, so a caller can never name a different user to grant.
 * Requires the caller both own the integration and hold ADMIN on the case,
 * AND requires the integration be ACTIVE (mirrors `POST .../tokens`'s own
 * ACTIVE gate) — granting MORE case access through an integration that
 * can't currently authenticate (SUSPENDED) or never will again (REVOKED)
 * makes no sense. `GET`/`DELETE` on this same resource are deliberately NOT
 * gated on integration status — see `grantIntegrationCaseAccess`'s doc
 * comment in `integration-registry-service.ts`.
 *
 * `permission` accepts VIEW/COMMENT/EDIT only, never ADMIN — a machine
 * principal has no use for case-ADMIN today, and requesting it is a 400,
 * not a silent downgrade (see `grantCaseAccessSchema`'s doc comment in
 * `lib/schemas/integration.ts`).
 *
 * @description Never errors on a repeat call for a case the system user
 * already has SOME access to (upsert, not create) — see
 * `grantIntegrationCaseAccess`'s doc comment. Re-granting the EXACT SAME
 * permission level is idempotent success (`alreadyGranted: true`, 200). A
 * fresh grant, OR a repeat call that changes the permission level, is a
 * real write and returns 201 with `alreadyGranted: false`.
 * @pathParam id - Integration ID (UUID)
 * @body { caseId: string, permission: "VIEW" | "COMMENT" | "EDIT" }
 * @response 201 - `{ grant: { caseId, caseName, permission, grantedAt, alreadyGranted: false } }` — new grant, or an existing grant's permission level changed
 * @response 200 - `{ grant: { ..., alreadyGranted: true } }` — already had EXACTLY this permission level
 * @response 400 - Validation error (including `permission: "ADMIN"`, which this endpoint never accepts)
 * @response 401 - Unauthorised
 * @response 404 - Integration not found, OR case not found (incl. soft-deleted/trashed), OR caller lacks case ADMIN (identical message/status for all — no enumeration oracle)
 * @response 409 - The integration is not ACTIVE
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

		const parsed = grantCaseAccessSchema.safeParse(
			await request.json().catch(() => ({}))
		);
		if (!parsed.success) {
			return apiError(
				validationError(parsed.error.issues[0]?.message ?? "Invalid input")
			);
		}

		const result = await grantIntegrationCaseAccess(
			parsedId.data,
			parsed.data.caseId,
			parsed.data.permission,
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
