import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import type {
	ShareByEmailInput,
	ShareWithTeamInput,
} from "@/lib/services/case-permission-service";
import {
	listCasePermissions,
	shareByEmail,
	shareWithTeam,
} from "@/lib/services/case-permission-service";

/**
 * GET /api/cases/[id]/permissions
 * Lists all permissions for a case. Requires ADMIN permission.
 */
export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id: caseId } = await params;
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
	}

	const result = await listCasePermissions(session.user.id, caseId);

	if (result.error) {
		const status =
			result.error === "Permission denied"
				? 403
				: result.error === "Case not found"
					? 404
					: 400;
		return NextResponse.json({ error: result.error }, { status });
	}

	return NextResponse.json(result.data);
}

/**
 * POST /api/cases/[id]/permissions
 * Shares a case with a user (by email) or team.
 * Requires ADMIN permission.
 *
 * Body: { type: "user", email: string, permission: string }
 *    or { type: "team", teamId: string, permission: string }
 */
export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id: caseId } = await params;
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
	}

	try {
		const body = await request.json();

		if (body.type === "team") {
			const input: ShareWithTeamInput = {
				teamId: body.teamId,
				permission: body.permission,
			};

			const result = await shareWithTeam(session.user.id, caseId, input);

			if (result.error) {
				const status =
					result.error === "Permission denied"
						? 403
						: result.error === "Case not found" ||
								result.error === "Team not found"
							? 404
							: 400;
				return NextResponse.json({ error: result.error }, { status });
			}

			return NextResponse.json(result.data, { status: 201 });
		}

		// Default to user share (by email)
		const input: ShareByEmailInput = {
			email: body.email,
			permission: body.permission,
		};

		const result = await shareByEmail(session.user.id, caseId, input);

		if (result.error) {
			const status =
				result.error === "Permission denied"
					? 403
					: result.error === "Case not found"
						? 404
						: 400;
			return NextResponse.json({ error: result.error }, { status });
		}

		// Return appropriate response based on result
		if (result.data?.already_shared) {
			return NextResponse.json(
				{ message: "User already has access to this case" },
				{ status: 200 }
			);
		}

		if (result.data?.invite_created) {
			// Return invite link for the user to share
			const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
			const inviteUrl = `${baseUrl}/invites/${result.data.invite_token}`;
			return NextResponse.json(
				{
					message: "Invite created",
					invite_url: inviteUrl,
				},
				{ status: 201 }
			);
		}

		return NextResponse.json(result.data?.permission, { status: 201 });
	} catch (error) {
		console.error("Error sharing case:", error);
		return NextResponse.json(
			{ error: "Failed to share case" },
			{ status: 500 }
		);
	}
}
