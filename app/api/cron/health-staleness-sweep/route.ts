import { apiError, apiErrorFromUnknown, apiSuccess } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import { sweepHealthStaleness } from "@/lib/services/health-staleness-sweep-service";

/**
 * Sweep tea.health claims for newly-stale state (cron job)
 *
 * @description Computes the status of every claim that has accepted
 * evidence and emits `tea.health/state-changed` for any claim that has newly
 * become stale since the last sweep (its current record expired, a
 * `valid_while` condition stopped holding, or all its records were revoked),
 * so an open case canvas shows the stale marker live without a page refresh.
 * Idempotent — re-running never re-emits for a claim already notified as
 * stale; a claim that is fresh again is re-armed.
 * Protected by CRON_SECRET environment variable.
 *
 * @header Authorization - Bearer token matching CRON_SECRET env var
 * @response 200 - { success: true, casesNotified: number, staleClaimsNotified: number }
 * @response 401 - Unauthorised (invalid or missing token)
 * @response 500 - Server error
 * @tag Cron
 */
export async function POST(request: Request) {
	try {
		const authHeader = request.headers.get("authorization");
		const token = authHeader?.replace("Bearer ", "") ?? null;

		const result = await sweepHealthStaleness(token);

		if ("error" in result) {
			return apiError(
				new AppError({
					code: result.error === "Unauthorised" ? "UNAUTHORISED" : "INTERNAL",
					message: result.error,
				})
			);
		}

		return apiSuccess({
			success: true,
			...result.data,
		});
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
