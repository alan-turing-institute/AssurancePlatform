import { parseJsonBody } from "@/lib/api-request";
import { apiSuccess, requireAuth } from "@/lib/api-response";
import {
	authoriseModelRoute,
	modelRouteFailureResponse,
	modelServiceErrorResponse,
} from "@/lib/model-routes";
import { updateConnectionSchema } from "@/lib/schemas/models";
import {
	deleteConnection,
	updateConnection,
} from "@/lib/services/model-connection-service";

const BODY_MAX_BYTES = 8 * 1024;

interface RouteParams {
	params: Promise<{ id: string }>;
}

/**
 * PATCH /api/user/models/connections/[id] — changes the label, address or key of one of the session user's connections.
 *
 * Takes any of `{ label, baseUrl, apiKey }`.
 * A new `apiKey` replaces the old one and `apiKey: null` removes it (refused for types that need a key).
 * `baseUrl` is ignored for types with a fixed address.
 * Changing the key or the address clears the search check of every search job that uses the connection.
 * Returns the connection as `{ id, label, type, baseUrl, hasKey }`; the key is never returned.
 * Another user's connection gets the same 404 as one that does not exist.
 * Needs a plugin that uses models to be on.
 *
 * @description Changes a connection and returns it without its key; another user's connection is a 404.
 * @pathParam id - Connection ID
 * @body updateConnectionSchema
 * @add 404,503
 * @auth SessionAuth
 * @tag User
 */
export async function PATCH(req: Request, { params }: RouteParams) {
	try {
		const userId = await authoriseModelRoute();
		if (typeof userId !== "string") {
			return userId;
		}
		const { id } = await params;
		const body = await parseJsonBody(req, updateConnectionSchema, {
			maxBytes: BODY_MAX_BYTES,
		});
		const updated = await updateConnection(userId, id, body);
		if ("error" in updated) {
			return modelServiceErrorResponse(updated);
		}
		return apiSuccess(updated.data);
	} catch (error) {
		return modelRouteFailureResponse(error);
	}
}

/**
 * DELETE /api/user/models/connections/[id] — removes one of the session user's connections and empties every job that used it.
 *
 * Answers 200 with `{ success: true }`.
 * Needs a session only: a user who has switched the plugins off can still remove a connection, and with it the key.
 * Another user's connection gets the same 404 as one that does not exist.
 *
 * @description Removes a connection, its stored key and its jobs; works while the plugins are off.
 * @pathParam id - Connection ID
 * @response 200
 * @add 404
 * @auth SessionAuth
 * @tag User
 */
export async function DELETE(_req: Request, { params }: RouteParams) {
	try {
		const userId = await requireAuth();
		const { id } = await params;
		const deleted = await deleteConnection(userId, id);
		if ("error" in deleted) {
			return modelServiceErrorResponse(deleted);
		}
		return apiSuccess({ success: true });
	} catch (error) {
		return modelRouteFailureResponse(error);
	}
}
