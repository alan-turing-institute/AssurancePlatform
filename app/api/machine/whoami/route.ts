import type { NextRequest } from "next/server";
import { apiErrorFromUnknown, apiSuccess } from "@/lib/api-response";
import { requireApiToken } from "@/lib/auth/require-api-token";

/**
 * Diagnostic identity check for a machine integration.
 *
 * @description Returns the identity of the integration whose bearer token
 * authenticated this request — name, current scopes, and the prefix of the
 * token used. No scope is required beyond a valid, non-suspended/revoked
 * token: this is the end-to-end reachability proof for `/api/machine/*`
 * (a valid token reaches the handler; an invalid one gets the API error
 * envelope, never a login-page redirect) and a genuinely useful "am I
 * talking to the platform correctly" check for integration operators.
 *
 * @response 200 - { name, scopes, tokenPrefix }
 * @response 401 - Unauthorised (missing, malformed, unknown, revoked, or expired token; non-ACTIVE integration)
 * @response 429 - Rate limited (too many failed attempts from this IP)
 * @auth bearer
 * @tag Machine
 */
export async function GET(request: NextRequest) {
	try {
		const principal = await requireApiToken(request);
		return apiSuccess({
			name: principal.integrationName,
			scopes: principal.scopes,
			tokenPrefix: principal.tokenPrefix,
		});
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
