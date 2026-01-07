import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { acceptInvite } from "@/lib/services/case-permission-service";

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

	const result = await acceptInvite(session.user.id, token, {
		ipAddress,
		userAgent,
	});

	if (!result.success) {
		let status = 500;
		if (
			result.error === "Invalid invite" ||
			result.error === "Invite has expired" ||
			result.error === "Invite has already been used"
		) {
			status = 400;
		} else if (
			result.error === "Invite was sent to a different email address"
		) {
			status = 403;
		} else if (result.error === "User not found") {
			status = 404;
		}
		return NextResponse.json({ error: result.error }, { status });
	}

	return NextResponse.json({
		success: true,
		case_id: result.case_id,
		redirect_url: `/cases/${result.case_id}`,
	});
}
