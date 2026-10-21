import { z } from "zod";

/**
 * The query string shared by the cron routes that can do a trial run. The
 * schema is strict, so a parameter it does not name is refused rather than
 * ignored, and a misspelt or repeated `dryRun` never turns a trial run into a
 * real one. A route with more parameters extends this schema.
 *
 * - `dryRun`: `1` or `true` computes what would happen and changes nothing;
 *   `0`, `false` or no parameter does the work. Values are case-sensitive.
 */
export const cronDryRunQuerySchema = z.strictObject({
	dryRun: z
		.enum(["1", "true", "0", "false"], {
			message: "must be one of 1, true, 0 or false",
		})
		.transform((value) => value === "1" || value === "true")
		.default(false),
});

/**
 * Turns a request's query string into an object for a query schema. A
 * parameter given more than once becomes an array, which no schema field
 * accepts, since it has no single value to act on.
 */
export function queryInputFromSearchParams(searchParams: URLSearchParams) {
	return Object.fromEntries(
		[...new Set(searchParams.keys())].map((key) => {
			const values = searchParams.getAll(key);
			return [key, values.length === 1 ? values[0] : values];
		})
	);
}

/** Checks a request's query string against the shared dry-run schema. */
export function parseCronDryRunQuery(searchParams: URLSearchParams) {
	return cronDryRunQuerySchema.safeParse(
		queryInputFromSearchParams(searchParams)
	);
}
