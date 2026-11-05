import { describe, expect, it } from "vitest";
import { heartbeatPeriodMs } from "../sse-heartbeat";

const LONGEST_MS = 30_000;
const SHORTEST_EXCLUSIVE_MS = 25_000;

describe("the heartbeat period of one stream", () => {
	it("is the full 30 seconds when the random draw is lowest", () => {
		expect(heartbeatPeriodMs(() => 0)).toBe(LONGEST_MS);
	});

	it("stays above 25 seconds when the random draw is as high as it can be", () => {
		const period = heartbeatPeriodMs(() => 1 - Number.EPSILON);

		expect(period).toBeGreaterThan(SHORTEST_EXCLUSIVE_MS);
		expect(period).toBeLessThanOrEqual(LONGEST_MS);
	});

	it("falls in the range 25 to 30 seconds for any draw below one", () => {
		for (let step = 0; step < 1000; step += 1) {
			const draw = step / 1000;
			const period = heartbeatPeriodMs(() => draw);
			expect(period).toBeGreaterThan(SHORTEST_EXCLUSIVE_MS);
			expect(period).toBeLessThanOrEqual(LONGEST_MS);
		}
	});

	it("falls in the range 25 to 30 seconds on every default draw, as a whole number of milliseconds", () => {
		for (let count = 0; count < 5000; count += 1) {
			const period = heartbeatPeriodMs();
			expect(Number.isInteger(period)).toBe(true);
			expect(period).toBeGreaterThan(SHORTEST_EXCLUSIVE_MS);
			expect(period).toBeLessThanOrEqual(LONGEST_MS);
		}
	});

	it("gets a fresh draw each time it is asked, so streams opened together do not share one period", () => {
		const periods = new Set(
			Array.from({ length: 200 }, () => heartbeatPeriodMs())
		);

		expect(periods.size).toBeGreaterThan(50);
	});

	it("spreads across the window rather than clustering at one end", () => {
		const periods = Array.from({ length: 2000 }, () => heartbeatPeriodMs());
		const early = periods.filter((period) => period <= 27_500).length;

		expect(early).toBeGreaterThan(700);
		expect(early).toBeLessThan(1300);
	});

	it("follows the draw it is given, so two different draws give two different periods", () => {
		expect(heartbeatPeriodMs(() => 0.1)).not.toBe(heartbeatPeriodMs(() => 0.9));
		expect(heartbeatPeriodMs(() => 0.5)).toBe(heartbeatPeriodMs(() => 0.5));
	});
});
