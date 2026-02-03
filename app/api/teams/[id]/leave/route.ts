import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { leaveTeam } from "@/lib/services/team-member-service";

/**
 * POST /api/teams/[id]/leave
 * Allows a user to leave a team.
 * Cannot leave if last admin.
 */
export async function POST(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const userId = await requireAuth();
		const { id: teamId } = await params;

		const result = await leaveTeam(userId, teamId);

		if (result.error) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess({ success: true });
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
