import { describe, expect, it } from "vitest";
import {
	HEARTBEAT_INTERVAL_MS,
	HEARTBEAT_JITTER_MS,
	heartbeatPeriodMs,
} from "../sse-heartbeat";

describe("heartbeatPeriodMs", () => {
	it("is the full interval when the random draw is zero", () => {
		expect(heartbeatPeriodMs(() => 0)).toBe(HEARTBEAT_INTERVAL_MS);
	});

	it("stays more than 25 seconds when the random draw is as high as it can be", () => {
		expect(heartbeatPeriodMs(() => 0.999_999_999)).toBe(
			HEARTBEAT_INTERVAL_MS - HEARTBEAT_JITTER_MS + 1
		);
	});

	it("is always a whole number of milliseconds in (25 s, 30 s]", () => {
		for (let i = 0; i < 1000; i += 1) {
			const period = heartbeatPeriodMs();
			expect(Number.isInteger(period)).toBe(true);
			expect(period).toBeGreaterThan(25_000);
			expect(period).toBeLessThanOrEqual(30_000);
		}
	});

	it("gives different periods to different streams", () => {
		const periods = new Set(
			Array.from({ length: 50 }, () => heartbeatPeriodMs())
		);
		expect(periods.size).toBeGreaterThan(1);
	});
});
