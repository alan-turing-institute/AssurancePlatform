import { apiError, apiErrorFromUnknown, apiSuccess } from "@/lib/api-response";
import { AppError, validationError } from "@/lib/errors";
import { parseHealthEvidenceThinningQuery } from "@/lib/schemas/health-evidence-thinning";
import { runRetentionSweep } from "@/lib/services/retention-service";

/**
 * Inactive-account data-retention sweep (cron job)
 *
 * @description Warns, then deletes, accounts inactive for two years since
 * last login: a warning email 30 days before deletion, a final reminder 7
 * days before, then deletion via the same path as self-service account
 * deletion. Protected by CRON_SECRET environment variable.
 *
 * @header Authorization - Bearer token matching CRON_SECRET env var
 * @query dryRun - "1" or "true" computes counts without sending emails, writing warning timestamps, or deleting anyone; "0", "false" or absent runs the sweep; any other or repeated value is refused with 400
 * @response 200 - { success: true, dryRun: boolean, warned30: number, warned7: number, deleted: number, skipped: number }
 * @response 400 - Invalid or repeated query parameter
 * @response 401 - Unauthorised (invalid or missing token)
 * @response 500 - Server error
 * @tag Cron
 */
export async function POST(request: Request) {
	try {
		const authHeader = request.headers.get("authorization");
		const token = authHeader?.replace("Bearer ", "") ?? null;
		const { searchParams } = new URL(request.url);
		const query = parseHealthEvidenceThinningQuery(searchParams);
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

		const result = await runRetentionSweep(token, { dryRun });

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
			dryRun,
			...result.data,
		});
	} catch (error) {
		return apiErrorFromUnknown(error);
	}
}
