const DEFAULT_MODEL_TIMEOUT_MS = 60_000;
const MIN_MODEL_TIMEOUT_MS = 5000;
const MAX_MODEL_TIMEOUT_MS = 600_000;
const INTEGER = /^\d+$/;

/**
 * The wall-time bound on one model call, read from ASSISTANT_MODEL_TIMEOUT_MS
 * on every call. Integer milliseconds, clamped to 5000-600000; an unset, empty
 * or non-numeric value means 60000.
 */
export function modelTimeoutMs(
	raw: string | undefined = process.env.ASSISTANT_MODEL_TIMEOUT_MS
): number {
	const text = raw?.trim() ?? "";
	if (!INTEGER.test(text)) {
		return DEFAULT_MODEL_TIMEOUT_MS;
	}
	return Math.min(
		MAX_MODEL_TIMEOUT_MS,
		Math.max(MIN_MODEL_TIMEOUT_MS, Number(text))
	);
}
