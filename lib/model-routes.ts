import {
	apiError,
	apiErrorFromUnknown,
	apiRateLimited,
	requireAuth,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { TokenEncryptionUnavailableError } from "@/lib/auth/token-encryption";
import { AppError, validationError } from "@/lib/errors";
import type { ModelServiceError } from "@/lib/services/model-connection-service";
import { assertModelPluginEnabled } from "@/lib/services/plugin-enablement-service";
import {
	RATE_LIMIT_CONFIGS,
	takeRateLimitSlot,
} from "@/lib/services/rate-limit-service";

/**
 * What the routes under `/api/user/models` share: the session and plugin
 * gate, the answer for each refusal the connection service gives, and the
 * limit on calls that make the server reach out to a model provider.
 */

const ENCRYPTION_UNAVAILABLE_MESSAGE =
	"This server cannot handle keys: token encryption is not configured.";

/**
 * Authenticates, then refuses unless a plugin that uses models is on for the
 * user. Returns the user's id, or the response to send instead.
 */
export async function authoriseModelRoute(): Promise<string | Response> {
	const userId = await requireAuth();
	const enabled = await assertModelPluginEnabled(userId);
	if ("error" in enabled) {
		return apiError(serviceErrorToAppError(enabled.error));
	}
	return userId;
}

/**
 * The response for a connection service refusal: a bad value or a job the
 * connection cannot do is a 400, an unknown (or another user's) connection a
 * 404, and the limit on connections a 409. A failure without a code is passed
 * through the shared mapping, which answers 500 for text it does not know.
 */
export function modelServiceErrorResponse(
	failure: ModelServiceError
): Response {
	switch (failure.code) {
		case "VALIDATION":
		case "JOB_NOT_SUPPORTED":
			return apiError(validationError(failure.error));
		case "NOT_FOUND":
			return apiError(
				new AppError({ code: "NOT_FOUND", message: failure.error })
			);
		case "LIMIT_REACHED":
			return apiError(
				new AppError({ code: "CONFLICT", message: failure.error })
			);
		default:
			return apiError(serviceErrorToAppError(failure.error));
	}
}

/** The response for anything a model route throws: a missing encryption key is a 503. */
export function modelRouteFailureResponse(error: unknown): Response {
	if (error instanceof TokenEncryptionUnavailableError) {
		return apiError(
			new AppError({
				code: "SERVICE_UNAVAILABLE",
				message: ENCRYPTION_UNAVAILABLE_MESSAGE,
			})
		);
	}
	return apiErrorFromUnknown(error);
}

/**
 * Spends one of the user's calls to model providers. Connection tests, search
 * checks and quick setup share a budget of 20 every 10 minutes, counted and
 * spent together so that requests arriving at once cannot go past it. Returns
 * the 429 to send, which says nothing about the limit, or null when the call
 * may go ahead.
 */
export async function takeModelCall(userId: string): Promise<Response | null> {
	const result = await takeRateLimitSlot(RATE_LIMIT_CONFIGS.modelCalls, {
		userId,
	});
	return result.allowed ? null : apiRateLimited("Too many requests");
}
