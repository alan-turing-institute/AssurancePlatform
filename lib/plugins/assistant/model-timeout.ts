const DEFAULT_MODEL_TIMEOUT_MS = 60_000;
const DEFAULT_TECHNIQUES_TIMEOUT_MS = 45_000;
const DEFAULT_RANKING_TIMEOUT_MS = 30_000;
const MIN_TIMEOUT_MS = 5000;
const MAX_TIMEOUT_MS = 600_000;
const INTEGER = /^\d+$/;

/** A whole number of milliseconds clamped to 5000-600000; anything else is the fallback. */
function boundedMs(raw: string | undefined, fallback: number): number {
	const text = raw?.trim() ?? "";
	if (!INTEGER.test(text)) {
		return fallback;
	}
	return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, Number(text)));
}

/**
 * The wall-time bound on the whole reply, tool calls included, read from
 * ASSISTANT_MODEL_TIMEOUT_MS on every call. Integer milliseconds, clamped to
 * 5000-600000; an unset, empty or non-numeric value means 60000.
 */
export function modelTimeoutMs(
	raw: string | undefined = process.env.ASSISTANT_MODEL_TIMEOUT_MS
): number {
	return boundedMs(raw, DEFAULT_MODEL_TIMEOUT_MS);
}

/**
 * How long one technique lookup may take in all (embedding the claim, asking
 * the techniques service and ranking), read from
 * ASSISTANT_TECHNIQUES_TIMEOUT_MS on every call. Integer milliseconds, clamped
 * to 5000-600000; an unset, empty or non-numeric value means 45000. The
 * service only searches, so most of this is the ranking model's time.
 */
export function techniquesTimeoutMs(
	raw: string | undefined = process.env.ASSISTANT_TECHNIQUES_TIMEOUT_MS
): number {
	return boundedMs(raw, DEFAULT_TECHNIQUES_TIMEOUT_MS);
}

/**
 * The most time the ranking step may take, read from
 * ASSISTANT_RANKING_TIMEOUT_MS on every call. It is also limited by what
 * remains of the lookup's time. Integer milliseconds, clamped to 5000-600000;
 * an unset, empty or non-numeric value means 30000.
 */
export function rankingTimeoutMs(
	raw: string | undefined = process.env.ASSISTANT_RANKING_TIMEOUT_MS
): number {
	return boundedMs(raw, DEFAULT_RANKING_TIMEOUT_MS);
}
