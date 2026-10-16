/**
 * The keep rule for thinning a claim's evidence log: which of a stretch of
 * consecutive records stay when long runs of identical passing results are
 * thinned. Pure and database-free; the thinning job in
 * `lib/services/health-evidence-service.ts` supplies the rows and does the
 * removing.
 */

/** Stored on each thinned-run note, so a verifier knows which rule removed the records. */
export const THINNING_RULE_VERSION = 1;

/** Results at least this far apart (by their own timestamps) are kept on both sides of the pause. */
const HOUR_MS = 3_600_000;

export interface ThinningRow {
	/**
	 * Null when the record is never removed (it is not a passing result that
	 * matched the settings, it has been withdrawn, or its session is protected).
	 * Otherwise the key that is equal for two records exactly when they say the
	 * same thing.
	 */
	resultKey: string | null;
	/** The record's own timestamp, in milliseconds. */
	timestampMs: number;
}

/** Whether `next` carries on the run that `row` is part of. */
function continuesRun(row: ThinningRow, next: ThinningRow): boolean {
	return (
		row.resultKey !== null &&
		row.resultKey === next.resultKey &&
		next.timestampMs >= row.timestampMs
	);
}

/**
 * For records in chain order, whether each one is kept. A run is an
 * unbroken sequence of records with the same result key whose timestamps
 * never go backwards. Everything without a key is kept and ends the run on
 * both sides. Within a run the first and the last record are kept, and so is
 * the first record at least an hour after the previous one kept, and each
 * record whose next record is an hour or more later (the next record is then
 * kept by the hourly step).
 */
export function chooseRecordsToKeep(rows: readonly ThinningRow[]): boolean[] {
	const kept: boolean[] = [];
	let lastKeptAt = Number.NEGATIVE_INFINITY;
	for (const [index, row] of rows.entries()) {
		const previous = rows[index - 1];
		const next = rows[index + 1];
		const startsRun = !(previous && continuesRun(previous, row));
		const endsRun = !(next && continuesRun(row, next));
		const pauseAfter =
			next !== undefined && next.timestampMs - row.timestampMs >= HOUR_MS;
		const keep =
			row.resultKey === null ||
			startsRun ||
			endsRun ||
			pauseAfter ||
			row.timestampMs - lastKeptAt >= HOUR_MS;
		kept.push(keep);
		if (keep) {
			lastKeptAt = row.timestampMs;
		}
	}
	return kept;
}
