import { headers } from "next/headers";
import {
	apiError,
	apiErrorFromUnknown,
	apiRateLimited,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { extractClientIp } from "@/lib/auth/extract-client-ip";
import { acceptInvite } from "@/lib/services/case-invite-service";
import {
	checkAndRecordRateLimit,
	RATE_LIMIT_CONFIGS,
} from "@/lib/services/rate-limit-service";

/**
 * POST /api/invites/[token]/accept
 * Accepts a case invite using the token.
 * User must be authenticated.
 *
 * @response 200 - `{ success, case_id, redirect_url }`
 * @response 400 - The code matches no invitation, or the invitation has expired
 * @response 401 - No session
 * @response 403 - The invitation was sent to a different email address
 * @response 409 - The invitation has already been used
 * @response 429 - Too many attempts
 * @add 409,429
 * @auth SessionAuth
 * @tag Invites
 */
export async function POST(
	_request: Request,
	{ params }: { params: Promise<{ token: string }> }
) {
	try {
		const { token } = await params;
		const userId = await requireAuth();

		// Extract security context for audit logging
		const headersList = await headers();
		const ipAddress = extractClientIp(headersList);
		const userAgent = headersList.get("user-agent") ?? null;

		// Check rate limit before processing
		const rateLimitResult = await checkAndRecordRateLimit(
			RATE_LIMIT_CONFIGS.inviteAccept,
			{ ipAddress, userId },
			{ userId, ipAddress, userAgent: userAgent ?? undefined }
		);

		if (!rateLimitResult.allowed) {
			return apiRateLimited(
				rateLimitResult.reason ?? "Too many requests",
				rateLimitResult.retryAfterMs
			);
		}

		const result = await acceptInvite(userId, token, {
			ipAddress,
			userAgent,
		});

		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess({
			success: true,
			case_id: result.data.caseId,
			redirect_url: `/cases/${result.data.caseId}`,
		});
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
