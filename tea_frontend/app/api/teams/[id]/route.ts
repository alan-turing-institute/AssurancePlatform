import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import type { UpdateTeamInput } from "@/lib/services/team-service";
import { deleteTeam, getTeam, updateTeam } from "@/lib/services/team-service";

const USE_PRISMA_AUTH = process.env.USE_PRISMA_AUTH === "true";

/**
 * GET /api/teams/[id]
 * Gets a single team by ID. User must be a member.
 */
export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id: teamId } = await params;

	if (USE_PRISMA_AUTH) {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
		}

		const result = await getTeam(session.user.id, teamId);

		if (result.error) {
			const status =
				result.error === "Permission denied"
					? 403
					: result.error === "Team not found"
						? 404
						: 400;
			return NextResponse.json({ error: result.error }, { status });
		}

		return NextResponse.json(result.data);
	}

	return NextResponse.json(
		{ error: "Team fetch requires Prisma auth" },
		{ status: 501 }
	);
}

/**
 * PATCH /api/teams/[id]
 * Updates a team. Requires ADMIN role.
 */
export async function PATCH(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id: teamId } = await params;

	if (USE_PRISMA_AUTH) {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
		}

		try {
			const body = await request.json();

			const input: UpdateTeamInput = {
				name: body.name,
				description: body.description,
			};

			const result = await updateTeam(session.user.id, teamId, input);

			if (result.error) {
				const status =
					result.error === "Permission denied"
						? 403
						: result.error === "Team not found"
							? 404
							: 400;
				return NextResponse.json({ error: result.error }, { status });
			}

			return NextResponse.json(result.data);
		} catch (error) {
			console.error("Error updating team:", error);
			return NextResponse.json(
				{ error: "Failed to update team" },
				{ status: 500 }
			);
		}
	}

	return NextResponse.json(
		{ error: "Team update requires Prisma auth" },
		{ status: 501 }
	);
}

/**
 * DELETE /api/teams/[id]
 * Deletes a team. Requires ADMIN role.
 */
export async function DELETE(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id: teamId } = await params;

	if (USE_PRISMA_AUTH) {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
		}

		const result = await deleteTeam(session.user.id, teamId);

		if (result.error) {
			const status =
				result.error === "Permission denied"
					? 403
					: result.error === "Team not found"
						? 404
						: 400;
			return NextResponse.json({ error: result.error }, { status });
		}

		return NextResponse.json({ success: true });
	}

	return NextResponse.json(
		{ error: "Team delete requires Prisma auth" },
		{ status: 501 }
	);
}
