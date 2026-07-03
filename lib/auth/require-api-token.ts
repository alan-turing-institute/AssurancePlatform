import type { NextRequest } from "next/server";
import type { Scope } from "@/lib/auth/scopes";
import { AppError, unauthorised } from "@/lib/errors";
import {
	type ValidatedApiTokenPrincipal,
	validateApiToken,
} from "@/lib/services/integration-registry-service";

/**
 * Machine-access counterpart to `validate-session.ts`: identifies the
 * caller of a `/api/machine/*` request. Unlike session auth, a bearer
 * token cannot be trusted without a database lookup, so this module
 * delegates that lookup to `integration-registry-service.ts` — it does
 * NOT import Prisma itself, keeping all Prisma access inside the service
 * layer per house rule.
 */

export type ApiTokenPrincipal = ValidatedApiTokenPrincipal;

const BEARER_PREFIX = "Bearer ";

function extractBearerToken(request: NextRequest): string | null {
	const header = request.headers.get("authorization");
	if (!header?.startsWith(BEARER_PREFIX)) {
		return null;
	}
	const token = header.slice(BEARER_PREFIX.length).trim();
	return token.length > 0 ? token : null;
}

/** Best-effort client IP for throttling — matches the pattern used elsewhere (e.g. forgot-password). */
function extractIpAddress(request: NextRequest): string {
	const forwarded = request.headers.get("x-forwarded-for");
	if (forwarded) {
		return forwarded.split(",")[0]?.trim() ?? "unknown";
	}
	return request.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Validates the bearer token on `request` and returns the acting
 * integration's identity. Pass `scope` to additionally require that scope
 * be present on the integration; omit it for endpoints (like `whoami`)
 * that accept any validly authenticated integration regardless of scope.
 *
 * Throws `unauthorised()` with the SAME message for every auth-failure
 * mode (missing header, malformed token, unknown/revoked/expired token,
 * non-ACTIVE integration, or missing scope) so a caller cannot use the
 * response to distinguish one failure reason from another. A throttled
 * caller instead gets a distinct `RATE_LIMITED` (429) error — that is
 * already a public, expected signal throughout this codebase's other
 * rate limiters and isn't part of the no-oracle guarantee above. Route
 * handlers use this exactly like `requireAuth()`: call inside a try/catch
 * and map to `apiErrorFromUnknown`.
 */
export async function requireApiToken(
	request: NextRequest,
	scope?: Scope
): Promise<ApiTokenPrincipal> {
	const token = extractBearerToken(request);
	const ipAddress = extractIpAddress(request);

	const result = await validateApiToken({ token, scope, ipAddress });
	if ("error" in result) {
		if (result.rateLimited) {
			throw new AppError({ code: "RATE_LIMITED", message: result.error });
		}
		throw unauthorised(result.error);
	}
	return result.data;
}
