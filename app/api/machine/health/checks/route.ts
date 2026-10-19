import type { NextRequest } from "next/server";
import {
	apiError,
	apiErrorFromUnknown,
	apiSuccess,
	serviceErrorToAppError,
} from "@/lib/api-response";
import { requireApiToken } from "@/lib/auth/require-api-token";
import { parseHealthBody } from "@/lib/health-route-helpers";
import {
	CHECK_LIST_MAX_BYTES,
	healthCheckListSchema,
} from "@/lib/schemas/health-checks";
import { publishHealthCheckList } from "@/lib/services/health-check-catalogue-service";

/**
 * PUT /api/machine/health/checks
 *
 * Publishes the list of checks a pipeline can run.
 *
 * The body is `{ pipeline, checks }` with at most 200 checks, one entry per
 * check name, and at most 256 KB.
 * Each check has `name`, `version`, `scope` and `value` (an object whose
 * `type` is `boolean`, `number`, `string` or `datetime`), and optionally
 * `description`, `scope_label`, `params` (the settings the check describes)
 * and `recommended` (settings the check suggests).
 * Unknown keys are refused.
 * The list replaces the integration's previous one, and publishing never
 * changes any claim's settings.
 * A recommendation that would not pass as evidence settings is stored all the
 * same and named in `warnings`.
 *
 * @description Publishes the list of checks a pipeline can run, replacing the integration's previous list, and returns how many checks it holds with a warning for each recommendation that would not pass as evidence settings. Needs a bearer token with the `health:checks:write` scope and the Claim/Evidence Health plugin on for the integration's account, which counts as opted in unless the deployment withholds the plugin; it addresses no case, so the integration needs no case grant. The body is `{ pipeline, checks }` with at most 200 checks, one per check name, in at most 256 KB, and unknown keys are refused.
 * @body { pipeline, checks }
 * @response 200 - `{ checks: number, warnings: [{ check, problem }] }`
 * @response 400 - Invalid body; the field is named
 * @response 401 - Unauthorised (missing, invalid or wrong-scope token)
 * @response 403 - The `tea.health` plugin is not on for the integration's account: the deployment withholds it
 * @response 413 - Payload too large
 * @auth bearer
 * @tag Machine
 */
export async function PUT(request: NextRequest) {
	try {
		const principal = await requireApiToken(request, "health:checks:write");
		const list = await parseHealthBody(request, healthCheckListSchema, {
			maxBytes: CHECK_LIST_MAX_BYTES,
		});

		const result = await publishHealthCheckList(principal, list);
		if ("error" in result) {
			return apiError(serviceErrorToAppError(result.error));
		}
		return apiSuccess(result.data);
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
