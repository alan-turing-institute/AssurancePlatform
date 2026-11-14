import { parseJsonBody } from "@/lib/api-request";
import { apiSuccess } from "@/lib/api-response";
import {
	authoriseModelRoute,
	modelRouteFailureResponse,
	modelServiceErrorResponse,
	takeModelCall,
} from "@/lib/model-routes";
import { setRolesSchema } from "@/lib/schemas/models";
import {
	checkRoles,
	getRoles,
	type JobAssignment,
	setRoles,
} from "@/lib/services/model-connection-service";
import { runSearchCheck } from "@/lib/services/model-search-check-service";

const BODY_MAX_BYTES = 8 * 1024;

function sameJob(stored: JobAssignment | null, wanted: JobAssignment): boolean {
	return (
		stored?.connectionId === wanted.connectionId &&
		stored.model === wanted.model
	);
}

/**
 * PUT /api/user/models/roles — saves the session user's chat, ranking and search jobs, and checks a search job that is new or that the caller asks to have checked again.
 *
 * Takes `{ chat, ranking, search, recheckSearch? }`, each job `{ connectionId, model }` or `null` to switch the job off.
 * Every connection must be the user's own and its type must be able to do the job (Anthropic and OpenAI: chat only; OpenAI-compatible: chat and search).
 * Saving a changed search job clears the old check, and the server then runs the search check against the techniques service's published vectors.
 * Saving a search job that is unchanged runs no check, so a save of the chat or ranking job never spends a provider call on a search job that is failing.
 * `recheckSearch: true` runs the check again for the search job as saved, which is how a failed or out-of-date check is tried again.
 * Answers with `{ roles, searchCheck }`.
 * `roles` is the saved jobs and their check, as in `GET /api/user/models` but without `searchCheckCurrent`.
 * `searchCheck` is `null` when no check ran.
 * It is `{ ok, lowestCosine }` when it ran: `ok` is true when the vectors matched and the result was recorded against the job (a search job changed while the check ran is left unrecorded).
 * It is `{ unavailable: true }` when the techniques service did not give its published vectors.
 * Ownership and job rules are checked before the limit is touched, so a request that would be refused anyway costs nothing.
 * Search checks, connection tests and quick setup share a limit of 20 every 10 minutes per user; over it the answer is a 429 with no detail and nothing is saved.
 * Needs a plugin that uses models to be on.
 *
 * @description Saves the three jobs and returns them with the outcome of the search check, if one ran.
 * @body setRolesSchema
 * @add 404,429,503
 * @auth SessionAuth
 * @tag User
 */
export async function PUT(req: Request) {
	try {
		const userId = await authoriseModelRoute();
		if (typeof userId !== "string") {
			return userId;
		}
		const { recheckSearch, ...wanted } = await parseJsonBody(
			req,
			setRolesSchema,
			{ maxBytes: BODY_MAX_BYTES }
		);

		const usable = await checkRoles(userId, wanted);
		if ("error" in usable) {
			return modelServiceErrorResponse(usable);
		}

		const before = await getRoles(userId);
		if ("error" in before) {
			return modelServiceErrorResponse(before);
		}
		const checkSearch =
			wanted.search !== null &&
			(recheckSearch === true || !sameJob(before.data.search, wanted.search));
		if (checkSearch) {
			const limited = await takeModelCall(userId);
			if (limited) {
				return limited;
			}
		}

		const saved = await setRoles(userId, wanted);
		if ("error" in saved) {
			return modelServiceErrorResponse(saved);
		}
		if (!(checkSearch && saved.data.search)) {
			return apiSuccess({ roles: saved.data, searchCheck: null });
		}

		const searchCheck = await runSearchCheck(userId, saved.data.search);
		const after = await getRoles(userId);
		if ("error" in after) {
			return modelServiceErrorResponse(after);
		}
		return apiSuccess({ roles: after.data, searchCheck });
	} catch (error) {
		return modelRouteFailureResponse(error);
	}
}
