import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import type { CreateTeamInput } from "@/lib/services/team-service";
import { createTeam, listUserTeams } from "@/lib/services/team-service";

const USE_PRISMA_AUTH = process.env.USE_PRISMA_AUTH === "true";

/**
 * GET /api/teams
 * Lists all teams the authenticated user is a member of.
 */
export async function GET() {
	if (USE_PRISMA_AUTH) {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
		}

		const result = await listUserTeams(session.user.id);

		if (result.error) {
			return NextResponse.json({ error: result.error }, { status: 400 });
		}

		return NextResponse.json(result.data);
	}

	// Django fallback - not implemented for teams
	return NextResponse.json(
		{ error: "Team listing requires Prisma auth" },
		{ status: 501 }
	);
}

/**
 * POST /api/teams
 * Creates a new team with the authenticated user as ADMIN.
 */
export async function POST(request: Request) {
	if (USE_PRISMA_AUTH) {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
		}

		try {
			const body = await request.json();

			const input: CreateTeamInput = {
				name: body.name,
				description: body.description,
			};

			const result = await createTeam(session.user.id, input);

			if (result.error) {
				return NextResponse.json({ error: result.error }, { status: 400 });
			}

			return NextResponse.json(result.data, { status: 201 });
		} catch (error) {
			console.error("Error creating team:", error);
			return NextResponse.json(
				{ error: "Failed to create team" },
				{ status: 500 }
			);
		}
	}

	return NextResponse.json(
		{ error: "Team creation requires Prisma auth" },
		{ status: 501 }
	);
}
