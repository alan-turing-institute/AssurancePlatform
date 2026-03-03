import { headers } from "next/headers";
import { NextResponse } from "next/server";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { acceptInvite } from "@/lib/services/case-invite-service";
import {
	checkAndRecordRateLimit,
	RATE_LIMIT_CONFIGS,
} from "@/lib/services/rate-limit-service";

/**
 * POST /api/invites/[token]/accept
 * Accepts a case invite using the token.
 * User must be authenticated.
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
		const forwarded = headersList.get("x-forwarded-for");
		const ipAddress = forwarded
			? forwarded.split(",")[0].trim()
			: (headersList.get("x-real-ip") ?? "unknown");
		const userAgent = headersList.get("user-agent") ?? null;

		// Check rate limit before processing
		const rateLimitResult = await checkAndRecordRateLimit(
			RATE_LIMIT_CONFIGS.inviteAccept,
			{ ipAddress, userId },
			{ userId, ipAddress, userAgent: userAgent ?? undefined }
		);

		if (!rateLimitResult.allowed) {
			const response = new NextResponse(
				JSON.stringify({
					error: rateLimitResult.reason,
					code: "RATE_LIMITED",
				}),
				{ status: 429 }
			);

			if (rateLimitResult.retryAfterMs) {
				response.headers.set(
					"Retry-After",
					String(Math.ceil(rateLimitResult.retryAfterMs / 1000))
				);
			}

			return response;
		}

		const result = await acceptInvite(userId, token, {
			ipAddress,
			userAgent,
		});

		if (!result.success) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess({
			success: true,
			case_id: result.case_id,
			redirect_url: `/cases/${result.case_id}`,
		});
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
