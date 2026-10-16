import { apiError, apiErrorFromUnknown, apiSuccess } from "@/lib/api-response";
import { AppError, validationError } from "@/lib/errors";
import { parseHealthEvidenceThinningQuery } from "@/lib/schemas/health-evidence-thinning";
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
 * @queryParam dryRun - "1" or "true" counts what would be removed without removing or writing anything; "0", "false" or absent does the work; any other value is refused with 400 and nothing is done
 * @queryParam now - An ISO 8601 date-time the one-day cut-off is measured from (the start of that UTC hour, a day back), so a caller making several calls in one night can pass the same value on each; a time later than the server's is treated as the server's time; a malformed value is refused with 400 and nothing is done
 * @response 200 - { success: true, dryRun: boolean, busy: boolean, claimsProcessed: number, recordsRemoved: number, runsRecorded: number, more: boolean }
 * @response 400 - Invalid query (an unknown or repeated parameter, or a malformed dryRun or now)
 * @response 401 - Unauthorised (invalid or missing token)
 * @response 500 - Server error
 * @tag Cron
 */
export async function POST(request: Request) {
	try {
		const authHeader = request.headers.get("authorization");
		const token = authHeader?.replace("Bearer ", "") ?? null;

		const auth = requireCronSecret(token);
		if (!auth.authorised) {
			return apiError(
				new AppError({
					code: auth.error === "Unauthorised" ? "UNAUTHORISED" : "INTERNAL",
					message: auth.error,
				})
			);
		}

		const query = parseHealthEvidenceThinningQuery(
			new URL(request.url).searchParams
		);
		if (!query.success) {
			const issue = query.error.issues[0];
			const field = issue?.path.join(".");
			return apiError(
				validationError(
					field
						? `${field} ${issue?.message}`
						: (issue?.message ?? "Invalid query")
				)
			);
		}
		const { dryRun } = query.data;

		// A cut-off measured from a later time can only thin more, so the
		// caller's time counts only when it is not ahead of the server's.
		const serverNow = new Date();
		const now =
			query.data.now && query.data.now < serverNow ? query.data.now : serverNow;

		const result = await thinHealthEvidence({ dryRun, now });
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
