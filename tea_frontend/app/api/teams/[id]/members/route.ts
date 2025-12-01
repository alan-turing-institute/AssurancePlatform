import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import type { AddTeamMemberInput } from "@/lib/services/team-member-service";
import {
	addTeamMember,
	getTeamMembers,
} from "@/lib/services/team-member-service";

const USE_PRISMA_AUTH = process.env.USE_PRISMA_AUTH === "true";

/**
 * GET /api/teams/[id]/members
 * Lists all members of a team. User must be a member.
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

		const result = await getTeamMembers(session.user.id, teamId);

		if (result.error) {
			const status = result.error === "Team not found" ? 404 : 400;
			return NextResponse.json({ error: result.error }, { status });
		}

		return NextResponse.json(result.data);
	}

	return NextResponse.json(
		{ error: "Team members requires Prisma auth" },
		{ status: 501 }
	);
}

/**
 * POST /api/teams/[id]/members
 * Adds a new member to a team by email. Requires ADMIN role.
 */
export async function POST(
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

			const input: AddTeamMemberInput = {
				email: body.email,
				role: body.role,
			};

			const result = await addTeamMember(session.user.id, teamId, input);

			if (result.error) {
				const status =
					result.error === "Permission denied"
						? 403
						: result.error === "Team not found"
							? 404
							: 400;
				return NextResponse.json({ error: result.error }, { status });
			}

			// Return appropriate response based on result
			if (result.data?.already_member) {
				return NextResponse.json(
					{ message: "User is already a member" },
					{ status: 200 }
				);
			}

			if (result.data?.user_not_found) {
				// Don't reveal if user exists - just say invite would be needed
				return NextResponse.json(
					{ message: "User not found. An invite link can be shared instead." },
					{ status: 200 }
				);
			}

			return NextResponse.json(result.data?.member, { status: 201 });
		} catch (error) {
			console.error("Error adding team member:", error);
			return NextResponse.json(
				{ error: "Failed to add team member" },
				{ status: 500 }
			);
		}
	}

	return NextResponse.json(
		{ error: "Adding team members requires Prisma auth" },
		{ status: 501 }
	);
}
