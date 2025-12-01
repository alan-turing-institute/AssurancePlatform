import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { acceptInvite } from "@/lib/services/case-permission-service";

const USE_PRISMA_AUTH = process.env.USE_PRISMA_AUTH === "true";

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

	if (USE_PRISMA_AUTH) {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
		}

		const result = await acceptInvite(session.user.id, token);

		if (result.error) {
			const status =
				result.error === "Invalid invite" ||
				result.error === "Invite has expired" ||
				result.error === "Invite has already been used"
					? 400
					: 500;
			return NextResponse.json({ error: result.error }, { status });
		}

		return NextResponse.json({
			success: true,
			case_id: result.case_id,
			redirect_url: `/cases/${result.case_id}`,
		});
	}

	return NextResponse.json(
		{ error: "Accepting invites requires Prisma auth" },
		{ status: 501 }
	);
}
