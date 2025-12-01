import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { leaveTeam } from "@/lib/services/team-member-service";

const USE_PRISMA_AUTH = process.env.USE_PRISMA_AUTH === "true";

/**
 * POST /api/teams/[id]/leave
 * Allows a user to leave a team.
 * Cannot leave if last admin.
 */
export async function POST(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id: teamId } = await params;

	if (USE_PRISMA_AUTH) {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
		}

		const result = await leaveTeam(session.user.id, teamId);

		if (result.error) {
			const status = result.error === "Not a member of this team" ? 404 : 400;
			return NextResponse.json({ error: result.error }, { status });
		}

		return NextResponse.json({ success: true });
	}

	return NextResponse.json(
		{ error: "Leaving team requires Prisma auth" },
		{ status: 501 }
	);
}
