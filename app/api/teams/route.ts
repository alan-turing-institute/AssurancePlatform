import { revalidatePath } from "next/cache";
import { parseJsonBody } from "@/lib/api-request";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { createTeamSchema } from "@/lib/schemas/team";
import { createTeam, listUserTeams } from "@/lib/services/team-service";

/**
 * GET /api/teams
 * Lists all teams the authenticated user is a member of.
 */
export async function GET() {
	try {
		const userId = await requireAuth();
		const result = await listUserTeams(userId);

		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		return apiSuccess(result.data);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}

/**
 * POST /api/teams
 * Creates a new team with the authenticated user as ADMIN.
 */
export async function POST(request: Request) {
	try {
		const userId = await requireAuth();

		const data = await parseJsonBody(request, createTeamSchema);

		const result = await createTeam(userId, data);

		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}

		revalidatePath("/dashboard/teams");
		return apiSuccess(result.data, 201);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
