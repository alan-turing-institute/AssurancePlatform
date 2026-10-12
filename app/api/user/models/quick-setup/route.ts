import { parseJsonBody } from "@/lib/api-request";
import { apiError, apiSuccess } from "@/lib/api-response";
import { unprocessable } from "@/lib/errors";
import {
	authoriseModelRoute,
	modelRouteFailureResponse,
	modelServiceErrorResponse,
	takeModelCall,
} from "@/lib/model-routes";
import { testConnection } from "@/lib/models/connection-test";
import {
	CONNECTION_TYPES,
	MODEL_JOBS,
	type ModelJob,
} from "@/lib/models/connection-types";
import { recommendedModel } from "@/lib/models/recommended";
import { quickSetupSchema } from "@/lib/schemas/models";
import {
	createConnectionWithJobs,
	getRoles,
	type NewJobModels,
} from "@/lib/services/model-connection-service";
import { runSearchCheck } from "@/lib/services/model-search-check-service";

const BODY_MAX_BYTES = 4 * 1024;
const CONNECTION_LABEL = "OpenRouter";

/** The recommended model for each job on an OpenRouter connection; a job with none is left out. */
function recommendedJobs(): NewJobModels {
	const models: NewJobModels = {};
	for (const job of MODEL_JOBS) {
		const model = recommendedModel("OPENROUTER", job);
		if (model) {
			models[job] = model;
		}
	}
	return models;
}

/**
 * POST /api/user/models/quick-setup — one OpenRouter key adds a connection and fills the jobs that have a recommended model.
 *
 * Takes `{ openRouterKey }`.
 * The server first tests the key against OpenRouter without saving anything; a key OpenRouter refuses, or an OpenRouter that cannot be reached, is a 422 and nothing is written.
 * Then, in one short step, it adds a connection labelled "OpenRouter" and points each job that has a recommended model at it.
 * A job with no recommended model keeps what it had.
 * If the search job was set, the search check runs as it does for `PUT /api/user/models/roles`.
 * Answers 201 with `{ connection, roles, searchCheck, unsetJobs }`: the new connection, the saved jobs, the outcome of the search check (`null` when none ran) and the jobs that are still unset and need a choice.
 * Quick setup, connection tests and search checks share a limit of 20 every 10 minutes per user; over it the answer is a 429 with no detail.
 * Needs a plugin that uses models to be on.
 *
 * @description Tests an OpenRouter key, then adds the connection and its recommended jobs; a refused key writes nothing.
 * @body quickSetupSchema
 * @add 409,422,429,503
 * @auth SessionAuth
 * @tag User
 */
export async function POST(req: Request) {
	try {
		const userId = await authoriseModelRoute();
		if (typeof userId !== "string") {
			return userId;
		}
		const { openRouterKey } = await parseJsonBody(req, quickSetupSchema, {
			maxBytes: BODY_MAX_BYTES,
		});

		const limited = await takeModelCall(userId);
		if (limited) {
			return limited;
		}
		const tested = await testConnection({
			type: "OPENROUTER",
			baseUrl: CONNECTION_TYPES.OPENROUTER.baseUrl ?? "",
			apiKey: openRouterKey,
		});
		if (!tested.ok) {
			return apiError(unprocessable(tested.message));
		}

		const models = recommendedJobs();
		const created = await createConnectionWithJobs(
			userId,
			{ label: CONNECTION_LABEL, type: "OPENROUTER", apiKey: openRouterKey },
			models
		);
		if ("error" in created) {
			return modelServiceErrorResponse(created);
		}

		const search = created.data.roles.search;
		const searchCheck =
			models.search && search ? await runSearchCheck(userId, search) : null;
		const roles = searchCheck
			? await getRoles(userId)
			: { data: created.data.roles };
		if ("error" in roles) {
			return modelServiceErrorResponse(roles);
		}
		const unsetJobs: ModelJob[] = MODEL_JOBS.filter((job) => !roles.data[job]);
		return apiSuccess(
			{
				connection: created.data.connection,
				roles: roles.data,
				searchCheck,
				unsetJobs,
			},
			201
		);
	} catch (error) {
		return modelRouteFailureResponse(error);
	}
}
