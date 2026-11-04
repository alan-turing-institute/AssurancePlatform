/** The longest time between two heartbeats on a live-update stream. */
export const HEARTBEAT_INTERVAL_MS = 30_000;

/**
 * How much shorter than `HEARTBEAT_INTERVAL_MS` a stream's own period can be.
 * Streams opened together, such as every browser reconnecting after a deploy,
 * then drift apart instead of checking access in step.
 */
export const HEARTBEAT_JITTER_MS = 5000;

/**
 * The heartbeat period for one new stream: `HEARTBEAT_INTERVAL_MS` less a
 * random whole number of milliseconds below `HEARTBEAT_JITTER_MS`, so it is
 * always more than 25 s and at most 30 s.
 */
export function heartbeatPeriodMs(random: () => number = Math.random): number {
	return HEARTBEAT_INTERVAL_MS - Math.floor(random() * HEARTBEAT_JITTER_MS);
}
