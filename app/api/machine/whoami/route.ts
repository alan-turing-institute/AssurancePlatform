import type { NextRequest } from "next/server";
import { apiErrorFromUnknown, apiSuccess } from "@/lib/api-response";
import { requireApiToken } from "@/lib/auth/require-api-token";

/**
 * Diagnostic identity check for a machine integration.
 *
 * Returns the name, current scopes and token prefix of the integration whose
 * bearer token authenticated the request.
 * Any valid token for an active integration works, whatever its scopes.
 * A request with an invalid token gets a JSON error, never a redirect to the
 * sign-in page.
 *
 * @description Returns the name, current scopes and token prefix of the integration whose bearer token authenticated the request; any valid token for an active integration works, whatever its scopes, so it is the quickest way to check that a token and the connection to TEA are working.
 * @response 200 - { name, scopes, tokenPrefix }
 * @response 401 - Unauthorised (missing, malformed, unknown, revoked or expired token, or an integration that is not active)
 * @response 429 - Rate limited (too many failed attempts from this IP address)
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
