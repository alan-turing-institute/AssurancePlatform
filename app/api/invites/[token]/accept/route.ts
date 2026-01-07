import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { acceptInvite } from "@/lib/services/case-permission-service";
import {
	checkAndRecordRateLimit,
	RATE_LIMIT_CONFIGS,
} from "@/lib/services/rate-limit-service";

/**
 * Map invite acceptance errors to HTTP status codes.
 */
function getErrorStatus(error: string): number {
	const badRequestErrors = [
		"Invalid invite",
		"Invite has expired",
		"Invite has already been used",
	];
	if (badRequestErrors.includes(error)) {
		return 400;
	}
	if (error === "Invite was sent to a different email address") {
		return 403;
	}
	if (error === "User not found") {
		return 404;
	}
	return 500;
}

/**
 * POST /api/invites/[token]/accept
 * Accepts a case invite using the token.
 * User must be authenticated.
 */
export async function POST(
	_request: Request,
	{ params }: { params: Promise<{ token: string }> }
) {
	const { token } = await params;
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
	}

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
		{ ipAddress, userId: session.user.id },
		{ userId: session.user.id, ipAddress, userAgent: userAgent ?? undefined }
	);

	if (!rateLimitResult.allowed) {
		const response = NextResponse.json(
			{ error: rateLimitResult.reason },
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

	const result = await acceptInvite(session.user.id, token, {
		ipAddress,
		userAgent,
	});

	if (!result.success) {
		const status = getErrorStatus(result.error);
		return NextResponse.json({ error: result.error }, { status });
	}

	return NextResponse.json({
		success: true,
		case_id: result.case_id,
		redirect_url: `/cases/${result.case_id}`,
	});
}
