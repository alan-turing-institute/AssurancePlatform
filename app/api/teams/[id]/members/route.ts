import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { validationError } from "@/lib/errors";
import { addTeamMemberSchema } from "@/lib/schemas/team";
import {
	addTeamMember,
	getTeamMembers,
} from "@/lib/services/team-member-service";

/**
 * GET /api/teams/[id]/members
 * Lists all members of a team. User must be a member.
 */
export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const userId = await requireAuth();
		const { id: teamId } = await params;

		const result = await getTeamMembers(userId, teamId);

		if (result.error) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess(result.data);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}

/**
 * POST /api/teams/[id]/members
 * Adds a new member to a team by email. Requires ADMIN role.
 */
export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const userId = await requireAuth();
		const { id: teamId } = await params;

		const parsed = addTeamMemberSchema.safeParse(
			await request.json().catch(() => null)
		);
		if (!parsed.success) {
			return apiError(
				validationError(parsed.error.errors[0]?.message ?? "Invalid input")
			);
		}

		const result = await addTeamMember(userId, teamId, parsed.data);

		if (result.error) {
			return apiError(serviceErrorToAppError(result.error));
		}

		// Return appropriate response based on result
		if (result.data?.already_member) {
			return apiSuccess({ message: "User is already a member" });
		}

		if (result.data?.user_not_found) {
			// Don't reveal if user exists - just say invite would be needed
			return apiSuccess({
				message: "User not found. An invite link can be shared instead.",
			});
		}

		return apiSuccess(result.data?.member, 201);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
