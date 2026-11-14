import { parseJsonBody } from "@/lib/api-request";
import { apiSuccess } from "@/lib/api-response";
import {
	authoriseModelRoute,
	modelRouteFailureResponse,
	modelServiceErrorResponse,
} from "@/lib/model-routes";
import { createConnectionSchema } from "@/lib/schemas/models";
import { createConnection } from "@/lib/services/model-connection-service";

const BODY_MAX_BYTES = 8 * 1024;

/**
 * POST /api/user/models/connections — adds a model connection for the session user (up to 10 each).
 *
 * Takes `{ label, type, baseUrl?, apiKey? }`.
 * `type` is `OPENROUTER`, `OLLAMA`, `OPENAI_COMPATIBLE`, `ANTHROPIC` or `OPENAI`.
 * `baseUrl` is required for Ollama and OpenAI-compatible servers and is ignored for types with a fixed address.
 * `apiKey` is required for OpenRouter, Anthropic and OpenAI, may hold printable ASCII only, and is stored encrypted.
 * Returns the new connection as `{ id, label, type, baseUrl, hasKey }` with status 201; the key is never returned.
 * The connection is checked only when its test route is called.
 * A refused value is a 400, the eleventh connection a 409, and a server without token encryption a 503.
 * Needs a plugin that uses models to be on.
 *
 * @description Adds a connection and returns it without its key; a refused value is a 400, the limit of 10 a 409.
 * @body createConnectionSchema
 * @add 409,503
 * @auth SessionAuth
 * @tag User
 */
export async function POST(req: Request) {
	try {
		const userId = await authoriseModelRoute();
		if (typeof userId !== "string") {
			return userId;
		}
		const body = await parseJsonBody(req, createConnectionSchema, {
			maxBytes: BODY_MAX_BYTES,
		});
		const created = await createConnection(userId, body);
		if ("error" in created) {
			return modelServiceErrorResponse(created);
		}
		return apiSuccess(created.data, 201);
	} catch (error) {
		return modelRouteFailureResponse(error);
	}
}
