import { z } from "zod";
import {
	cronDryRunQuerySchema,
	queryInputFromSearchParams,
} from "@/lib/schemas/cron-dry-run";

/**
 * The query string of `POST /api/cron/health-evidence-thinning`, a route that
 * deletes records. It takes the shared `dryRun` parameter and, like it, refuses
 * anything it does not recognise rather than ignoring it.
 *
 * - `dryRun`: `1` or `true` counts what would be removed and writes nothing;
 *   `0`, `false` or no parameter does the work.
 * - `now`: an ISO 8601 date-time the cut-off is measured from. The route
 *   holds it to no later than the server's own time.
 */
const healthEvidenceThinningQuerySchema = cronDryRunQuerySchema.extend({
	now: z.iso
		.datetime({ offset: true, message: "must be an ISO 8601 date-time" })
		.transform((text) => new Date(text))
		.optional(),
});

/**
 * Checks a request's query string against the schema. A parameter given more
 * than once is refused, since it has no single value to act on.
 */
export function parseHealthEvidenceThinningQuery(
	searchParams: URLSearchParams
) {
	return healthEvidenceThinningQuerySchema.safeParse(
		queryInputFromSearchParams(searchParams)
	);
}
