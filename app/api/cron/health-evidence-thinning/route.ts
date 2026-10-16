import { apiError, apiErrorFromUnknown, apiSuccess } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import { requireCronSecret } from "@/lib/services/cron-auth";
import { thinHealthEvidence } from "@/lib/services/health-evidence-service";

/**
 * Thin the health plugin's evidence log (cron job)
 *
 * @description Removes repeated passing results older than a day from the evidence log.
 * Each claim's log is thinned: a passing result that repeats its neighbours
 * exactly (same value, uncertainty, judged value, payload, settings revision,
 * session, versions, check, subject and recording account) is removed once
 * it is more than a day old, keeping the first and last of each run, one per
 * hour and both sides of any pause, and a note of each removed stretch lets
 * the hash chain be walked across it. Fails, marginal and indeterminate
 * results, results under changed settings, withdrawn records and everything
 * newer than a day are never removed. One call works for about a minute:
 * when `more` is true there is more to examine and the caller should call
 * again. Only one call runs at a time; a second returns `busy: true` and
 * does nothing. Protected by CRON_SECRET environment variable.
 *
 * @header Authorization - Bearer token matching CRON_SECRET env var
 * @query dryRun - Set to "1" to count what would be removed without removing or writing anything
 * @response 200 - { success: true, dryRun: boolean, busy: boolean, claimsProcessed: number, recordsRemoved: number, runsRecorded: number, more: boolean }
 * @response 401 - Unauthorised (invalid or missing token)
 * @response 500 - Server error
 * @tag Cron
 */
export async function POST(request: Request) {
	try {
		const authHeader = request.headers.get("authorization");
		const token = authHeader?.replace("Bearer ", "") ?? null;
		const { searchParams } = new URL(request.url);
		const dryRun = searchParams.get("dryRun") === "1";

		const auth = requireCronSecret(token);
		if (!auth.authorised) {
			return apiError(
				new AppError({
					code: auth.error === "Unauthorised" ? "UNAUTHORISED" : "INTERNAL",
					message: auth.error,
				})
			);
		}

		const result = await thinHealthEvidence({ dryRun });
		if ("error" in result) {
			return apiError(
				new AppError({ code: "INTERNAL", message: result.error })
			);
		}

		return apiSuccess({
			success: true,
			dryRun,
			...result.data,
		});
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
