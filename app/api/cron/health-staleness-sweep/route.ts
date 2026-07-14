import { apiError, apiErrorFromUnknown, apiSuccess } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import { sweepHealthStaleness } from "@/lib/services/health-staleness-sweep-service";

/**
 * Sweep tea.health claims for newly-stale state (cron job)
 *
 * @description Scans every claim carrying `tea.health` PluginData and emits
 * `tea.health/state-changed` for any claim that has newly crossed into
 * staleness since the last sweep, so an open case canvas shows
 * green-but-stale live without a page refresh (ADR 0002 v2 §3). Idempotent —
 * re-running never re-emits for a claim already notified as stale.
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
