import { z } from "zod";

/**
 * The query string of `POST /api/cron/health-evidence-thinning`, a route that
 * deletes records. Anything it does not recognise is refused rather than
 * ignored, so a misspelt or repeated parameter never turns a trial run into a
 * real one.
 *
 * - `dryRun`: `1` or `true` counts what would be removed and writes nothing;
 *   `0`, `false` or no parameter does the work.
 * - `now`: an ISO 8601 date-time the cut-off is measured from. The route
 *   holds it to no later than the server's own time.
 */
const healthEvidenceThinningQuerySchema = z.strictObject({
	dryRun: z
		.enum(["1", "true", "0", "false"], {
			message: "must be one of 1, true, 0 or false",
		})
		.transform((value) => value === "1" || value === "true")
		.default(false),
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
	const input = Object.fromEntries(
		[...new Set(searchParams.keys())].map((key) => {
			const values = searchParams.getAll(key);
			return [key, values.length === 1 ? values[0] : values];
		})
	);
	return healthEvidenceThinningQuerySchema.safeParse(input);
}
