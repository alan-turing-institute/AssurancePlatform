import { parseJsonBody } from "@/lib/api-request";
import { apiSuccess } from "@/lib/api-response";
import {
	authoriseModelRoute,
	modelRouteFailureResponse,
	modelServiceErrorResponse,
	takeModelCall,
} from "@/lib/model-routes";
import {
	embeddingCheckId,
	fetchEmbeddingSpec,
} from "@/lib/models/embedding-check";
import { setRolesSchema } from "@/lib/schemas/models";
import {
	getRoles,
	type JobAssignment,
	type ModelRoles,
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
 * Whether an unchanged search job has no check that is current: none passed,
 * or the one recorded is for a catalogue model or test sentences the
 * techniques service no longer publishes. When the service does not answer, a
 * recorded pass is left standing.
 */
async function lacksCurrentCheck(
	recorded: ModelRoles["searchCheck"]
): Promise<boolean> {
	if (!recorded) {
		return true;
	}
	const spec = await fetchEmbeddingSpec();
	return spec !== null && recorded.verifiedFor !== embeddingCheckId(spec);
}

/**
 * PUT /api/user/models/roles — saves the session user's chat, ranking and search jobs, and checks a search job that is new or has no current check.
 *
 * Takes `{ chat, ranking, search }`, each `{ connectionId, model }` or `null` to switch the job off.
 * Every connection must be the user's own and its type must be able to do the job (Anthropic: chat only; OpenAI-compatible: chat and search).
 * Saving a changed search job clears the old check, and the server then runs the search check against the techniques service's published vectors.
 * Saving a search job that is unchanged runs the check again when no check has passed for it, or the one that passed is not for the catalogue's current model and test sentences; this is how a failed check is tried again.
 * Answers with `{ roles, searchCheck }`.
 * `roles` is the saved jobs, in the shape `GET /api/user/models` gives.
 * `searchCheck` is `null` when no check ran.
 * It is `{ ok, lowestCosine }` when it ran: `ok` is true when the vectors matched and the result was recorded against the job (a search job changed while the check ran is left unrecorded).
 * It is `{ unavailable: true }` when the techniques service did not give its published vectors.
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
		const wanted = await parseJsonBody(req, setRolesSchema, {
			maxBytes: BODY_MAX_BYTES,
		});

		const before = await getRoles(userId);
		if ("error" in before) {
			return modelServiceErrorResponse(before);
		}
		const searchChanged =
			wanted.search !== null && !sameJob(before.data.search, wanted.search);
		const checkSearch =
			searchChanged ||
			(wanted.search !== null &&
				(await lacksCurrentCheck(before.data.searchCheck)));
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
