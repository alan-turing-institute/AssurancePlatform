import { apiError, apiErrorFromUnknown, apiSuccess } from "@/lib/api-response";
import { AppError } from "@/lib/errors";
import { purgeExpiredCases } from "@/lib/services/case-trash-service";

/**
 * Purge expired trash items (cron job)
 *
 * @description Permanently deletes cases that have been in trash longer than
 * the retention period (30 days). Protected by CRON_SECRET environment variable.
 * Intended to be called by an external scheduler (Azure Logic Apps, GitHub Actions, etc.)
 *
 * @header Authorization - Bearer token matching CRON_SECRET env var
 * @response 200 - { success: true, purgedCount: number, cutoffDate: string }
 * @response 401 - Unauthorised (invalid or missing token)
 * @response 500 - Server error
 * @tag Cron
 */
export async function POST(request: Request) {
	try {
		const authHeader = request.headers.get("authorization");
		const token = authHeader?.replace("Bearer ", "") ?? null;

		const result = await purgeExpiredCases(token);

		if (result.error) {
			return apiError(
				new AppError({
					code: result.status === 401 ? "UNAUTHORISED" : "INTERNAL",
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
