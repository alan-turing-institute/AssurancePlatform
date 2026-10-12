import { apiSuccess } from "@/lib/api-response";
import {
	authoriseModelRoute,
	modelRouteFailureResponse,
	modelServiceErrorResponse,
	takeModelCall,
} from "@/lib/model-routes";
import { testConnection } from "@/lib/models/connection-test";
import { getConnectionForUse } from "@/lib/services/model-connection-service";

interface RouteParams {
	params: Promise<{ id: string }>;
}

/**
 * POST /api/user/models/connections/[id]/test — checks that one of the session user's connections answers and accepts its key, and lists its models.
 *
 * Takes no body.
 * The server calls the connection's address with the stored key.
 * A connection that fails the check is still a 200, with `ok: false` and a fixed `message` that never contains the key, the address or anything the model server said.
 * Answers 200 with `{ ok, message, models }`, where `models` is `{ chat, ranking, search }`, each a list of model names.
 * Connection tests, search checks and quick setup share a limit of 20 every 10 minutes per user; over it the answer is a 429 with no detail.
 * Another user's connection gets the same 404 as one that does not exist.
 * Needs a plugin that uses models to be on.
 *
 * @description Calls the connection with its stored key and returns whether it works and the models it offers for each job.
 * @pathParam id - Connection ID
 * @add 404,429,503
 * @auth SessionAuth
 * @tag User
 */
export async function POST(_req: Request, { params }: RouteParams) {
	try {
		const userId = await authoriseModelRoute();
		if (typeof userId !== "string") {
			return userId;
		}
		const { id } = await params;
		const connection = await getConnectionForUse(userId, id);
		if ("error" in connection) {
			return modelServiceErrorResponse(connection);
		}
		const limited = await takeModelCall(userId);
		if (limited) {
			return limited;
		}
		return apiSuccess(await testConnection(connection.data));
	} catch (error) {
		return modelRouteFailureResponse(error);
	}
}
