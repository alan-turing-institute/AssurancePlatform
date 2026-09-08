/**
 * Resolves the Postgres connection-pool acquisition timeout
 * (`connectionTimeoutMillis`, see `lib/prisma.ts`) from `DB_POOL_TIMEOUT_MS`.
 *
 * Kept in its own module, with no other project imports besides the logger,
 * so both `lib/prisma.ts` (which needs it to build the `pg.Pool`) and
 * `lib/errors.ts` (which needs the same value to log alongside a detected
 * pool-acquisition timeout) can read it without pulling Prisma/pg into
 * `lib/errors.ts`'s import graph — `lib/errors.ts` has no other dependency
 * on the database.
 */
import { logger } from "@/lib/logger";

export const DEFAULT_DB_POOL_TIMEOUT_MS = 5000;

let warnedInvalidValueOnce = false;

/**
 * Parses `DB_POOL_TIMEOUT_MS` defensively: unset, non-numeric, or
 * non-positive all fall back to `DEFAULT_DB_POOL_TIMEOUT_MS` rather than
 * disabling the timeout (an unset `connectionTimeoutMillis` makes `pg-pool`
 * wait forever for a connection — see the comment in `lib/prisma.ts`, and
 * "TEA — Status endpoint can hang indefinitely"). An invalid (present but
 * unusable) value logs a warning once per process, so a typo in the env var
 * is visible without failing startup.
 */
export function resolveDbPoolTimeoutMs(): number {
	const raw = process.env.DB_POOL_TIMEOUT_MS;
	if (raw === undefined || raw.trim() === "") {
		return DEFAULT_DB_POOL_TIMEOUT_MS;
	}

	const parsed = Number(raw);
	if (Number.isFinite(parsed) && parsed > 0) {
		return parsed;
	}

	if (!warnedInvalidValueOnce) {
		warnedInvalidValueOnce = true;
		logger.warn("Invalid DB_POOL_TIMEOUT_MS — falling back to the default", {
			event: "db.pool.invalid_timeout_config",
			value: raw,
			fallbackMs: DEFAULT_DB_POOL_TIMEOUT_MS,
		});
	}
	return DEFAULT_DB_POOL_TIMEOUT_MS;
}
