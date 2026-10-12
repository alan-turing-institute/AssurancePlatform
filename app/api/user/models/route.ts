import { apiSuccess } from "@/lib/api-response";
import {
	authoriseModelRoute,
	modelRouteFailureResponse,
	modelServiceErrorResponse,
} from "@/lib/model-routes";
import {
	CONNECTION_TYPES,
	MODEL_CONNECTION_TYPES,
} from "@/lib/models/connection-types";
import {
	embeddingCheckId,
	fetchEmbeddingSpec,
} from "@/lib/models/embedding-check";
import { RECOMMENDED_MODELS } from "@/lib/models/recommended";
import {
	getRoles,
	listConnections,
	type ModelRoles,
} from "@/lib/services/model-connection-service";

/**
 * Whether the recorded search check is for the catalogue model and test
 * sentences the techniques service publishes now. False when no check is
 * recorded, and when the service does not answer, because a check cannot be
 * called current without being compared.
 */
async function searchCheckIsCurrent(
	recorded: ModelRoles["searchCheck"]
): Promise<boolean> {
	if (!recorded) {
		return false;
	}
	const spec = await fetchEmbeddingSpec();
	return spec !== null && recorded.verifiedFor === embeddingCheckId(spec);
}

/**
 * GET /api/user/models — the session user's connections, jobs, recommended models and connection types.
 *
 * Returns `{ connections, roles, recommended, connectionTypes }`.
 * A connection is `{ id, label, type, baseUrl, hasKey }`; the key itself is never returned, only whether one is set.
 * `roles` is `{ chat, ranking, search, searchCheck, searchCheckCurrent }`: each job is `{ connectionId, model }` or `null`, and `searchCheck` is `{ verifiedAt, verifiedFor }` once the search job has passed its check, otherwise `null`.
 * `searchCheckCurrent` is true when that check matches the catalogue model and test sentences the techniques service publishes now; it is false when there is no check, when the catalogue has changed since, and when the service cannot be asked.
 * `recommended` maps each connection type to a model per job (`null` where there is none).
 * `connectionTypes` lists each type's fixed address (or `null` when the user enters one), the jobs it can do and whether it needs a key.
 * Needs a plugin that uses models to be on.
 *
 * @description Connections (never with their keys), the three jobs, the recommended model per connection type and job, and the connection types on offer.
 * @auth SessionAuth
 * @tag User
 */
export async function GET() {
	try {
		const userId = await authoriseModelRoute();
		if (typeof userId !== "string") {
			return userId;
		}
		const [connections, roles] = await Promise.all([
			listConnections(userId),
			getRoles(userId),
		]);
		if ("error" in connections) {
			return modelServiceErrorResponse(connections);
		}
		if ("error" in roles) {
			return modelServiceErrorResponse(roles);
		}
		return apiSuccess({
			connections: connections.data,
			roles: {
				...roles.data,
				searchCheckCurrent: await searchCheckIsCurrent(roles.data.searchCheck),
			},
			recommended: RECOMMENDED_MODELS,
			connectionTypes: MODEL_CONNECTION_TYPES.map((type) => ({
				type,
				...CONNECTION_TYPES[type],
			})),
		});
	} catch (error) {
		return modelRouteFailureResponse(error);
	}
}
