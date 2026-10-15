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
 * @description Machine-only (`requireApiToken("health:checks:write")`). The
 * body is `{ pipeline, checks }` with at most 200 checks, one entry per check
 * name, and at most 256 KB. Each check has `name`, `version`, `scope`,
 * `value` (`boolean`, `number`, `scalar`, `string` or `datetime`), and
 * optionally `description`, `scope_label`, `params` (the settings the check
 * describes) and `recommended` (settings the check suggests). A value type of
 * `scalar` is stored as `number`. `params` is either a list of `{ key, label,
 * type, default?, unit?, options? }` or a plain object of setting name to
 * default value, which is stored as the list: the type comes from the value
 * (`boolean`, `number`, `duration` for text that is an ISO 8601 duration,
 * otherwise `string`) and the label from the name, with underscores as
 * spaces, the first letter in upper case and the rest lower case. A `null`,
 * list or object value is refused, naming the setting. Version labels
 * inside a recommendation are accepted and dropped. A recommended
 * `aggregation` may carry a `rule` that judges the combined result; a share
 * (`proportion`) that gives its pass mark as `params.threshold`, and a
 * percentile reduction that gives it as `params.p`, are read as `rule` and
 * `params.percentile`. Unknown keys are refused. The list replaces the
 * integration's previous one. Publishing never changes any claim's
 * settings. A recommendation that would not pass as evidence settings, such
 * as a combining step with no rule, is stored all the same and named in
 * `warnings`.
 * @body { pipeline, checks }
 * @response 200 - `{ checks: number, warnings: [{ check, problem }] }`
 * @response 400 - Invalid body; the field is named
 * @response 401 - Unauthorised (missing/invalid/wrong-scope token)
 * @response 403 - The `tea.health` plugin is not enabled for this integration
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
