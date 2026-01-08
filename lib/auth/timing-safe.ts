import { randomBytes } from "node:crypto";

/**
 * Constant-time timestamp validation.
 * Returns true if timestamp is in the future (or undefined = no expiry).
 * Always performs the same operations regardless of result to prevent timing attacks.
 */
export function isTimestampValid(
	timestamp: number | undefined,
	now: number = Date.now()
): boolean {
	// If no timestamp, treat as valid (no expiry set)
	const effectiveTimestamp = timestamp ?? Number.MAX_SAFE_INTEGER;
	return now <= effectiveTimestamp;
}

/**
 * Adds random delay to mask timing variations in validation paths.
 * Use after database operations to prevent timing-based token enumeration.
 *
 * @param maxMs - Maximum delay in milliseconds (default: 10ms)
 */
export async function addTimingNoise(maxMs = 10): Promise<void> {
	// Use cryptographically random bytes for the delay
	const delay = (randomBytes(2).readUInt16BE(0) / 65_535) * maxMs;
	await new Promise((resolve) => setTimeout(resolve, delay));
}
