const DEFAULT_MODEL_TIMEOUT_MS = 60_000;
const DEFAULT_TECHNIQUES_TIMEOUT_MS = 70_000;
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
 * The wall-time bound on one model call, read from ASSISTANT_MODEL_TIMEOUT_MS
 * on every call. Integer milliseconds, clamped to 5000-600000; an unset, empty
 * or non-numeric value means 60000.
 */
export function modelTimeoutMs(
	raw: string | undefined = process.env.ASSISTANT_MODEL_TIMEOUT_MS
): number {
	return boundedMs(raw, DEFAULT_MODEL_TIMEOUT_MS);
}

/**
 * How long the assistant waits for the techniques service, read from
 * ASSISTANT_TECHNIQUES_TIMEOUT_MS on every call. Integer milliseconds, clamped
 * to 5000-600000; an unset, empty or non-numeric value means 70000, the
 * service's own 60 second ranking deadline plus time to retrieve.
 */
export function techniquesTimeoutMs(
	raw: string | undefined = process.env.ASSISTANT_TECHNIQUES_TIMEOUT_MS
): number {
	return boundedMs(raw, DEFAULT_TECHNIQUES_TIMEOUT_MS);
}
