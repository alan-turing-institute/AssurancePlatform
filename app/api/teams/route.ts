import { revalidatePath } from "next/cache";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { validationError } from "@/lib/errors";
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

		if (result.error) {
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

		const parsed = createTeamSchema.safeParse(
			await request.json().catch(() => null)
		);
		if (!parsed.success) {
			return apiError(
				validationError(parsed.error.errors[0]?.message ?? "Invalid input")
			);
		}

		const result = await createTeam(userId, parsed.data);

		if (result.error) {
			return apiError(serviceErrorToAppError(result.error));
		}

		revalidatePath("/dashboard/teams");
		return apiSuccess(result.data, 201);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
