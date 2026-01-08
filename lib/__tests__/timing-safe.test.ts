import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addTimingNoise, isTimestampValid } from "../auth/timing-safe";

describe("timing-safe utilities", () => {
	describe("isTimestampValid", () => {
		beforeEach(() => {
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it("should return true for future timestamp", () => {
			const now = 1000000;
			vi.setSystemTime(now);
			expect(isTimestampValid(now + 10000)).toBe(true);
		});

		it("should return false for past timestamp", () => {
			const now = 1000000;
			vi.setSystemTime(now);
			expect(isTimestampValid(now - 10000)).toBe(false);
		});

		it("should return true for undefined (no expiry)", () => {
			expect(isTimestampValid(undefined)).toBe(true);
		});

		it("should return true when timestamp equals current time", () => {
			const now = 1000000;
			vi.setSystemTime(now);
			// now <= timestamp, so equal should be valid
			expect(isTimestampValid(now, now)).toBe(true);
		});

		it("should accept custom now parameter", () => {
			const customNow = 500000;
			expect(isTimestampValid(600000, customNow)).toBe(true);
			expect(isTimestampValid(400000, customNow)).toBe(false);
		});

		it("should handle edge case with MAX_SAFE_INTEGER", () => {
			expect(isTimestampValid(Number.MAX_SAFE_INTEGER)).toBe(true);
		});

		it("should handle edge case with zero timestamp", () => {
			const now = 1000;
			vi.setSystemTime(now);
			expect(isTimestampValid(0)).toBe(false);
		});

		it("should handle negative timestamp", () => {
			const now = 1000;
			vi.setSystemTime(now);
			expect(isTimestampValid(-1000)).toBe(false);
		});
	});

	describe("addTimingNoise", () => {
		beforeEach(() => {
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it("should complete without errors", async () => {
			// Use real timers for this test since we need actual async behaviour
			vi.useRealTimers();
			await expect(addTimingNoise(1)).resolves.toBeUndefined();
		});

		it("should add a delay", async () => {
			vi.useRealTimers();
			const start = Date.now();
			await addTimingNoise(10);
			const elapsed = Date.now() - start;
			// Delay should be between 0 and maxMs (with some tolerance)
			expect(elapsed).toBeGreaterThanOrEqual(0);
			expect(elapsed).toBeLessThan(50); // Allow some tolerance
		});

		it("should accept default maxMs parameter", async () => {
			vi.useRealTimers();
			await expect(addTimingNoise()).resolves.toBeUndefined();
		});

		it("should accept custom maxMs parameter", async () => {
			vi.useRealTimers();
			await expect(addTimingNoise(5)).resolves.toBeUndefined();
		});

		it("should handle zero maxMs", async () => {
			vi.useRealTimers();
			const start = Date.now();
			await addTimingNoise(0);
			const elapsed = Date.now() - start;
			// Should be nearly instant
			expect(elapsed).toBeLessThan(10);
		});
	});

	describe("timing consistency", () => {
		it("isTimestampValid should take similar time regardless of result", () => {
			const iterations = 1000;
			const futureTimestamp = Date.now() + 100000;
			const pastTimestamp = Date.now() - 100000;

			// Measure time for valid timestamp
			const validStart = performance.now();
			for (let i = 0; i < iterations; i++) {
				isTimestampValid(futureTimestamp);
			}
			const validTime = performance.now() - validStart;

			// Measure time for invalid timestamp
			const invalidStart = performance.now();
			for (let i = 0; i < iterations; i++) {
				isTimestampValid(pastTimestamp);
			}
			const invalidTime = performance.now() - invalidStart;

			// Measure time for undefined timestamp
			const undefinedStart = performance.now();
			for (let i = 0; i < iterations; i++) {
				isTimestampValid(undefined);
			}
			const undefinedTime = performance.now() - undefinedStart;

			// All execution times should be within reasonable tolerance of each other
			// Note: This is a rough check - actual timing attacks require more sophisticated analysis
			const avgTime = (validTime + invalidTime + undefinedTime) / 3;
			const tolerance = avgTime * 0.5; // 50% tolerance for test stability

			expect(Math.abs(validTime - avgTime)).toBeLessThan(tolerance);
			expect(Math.abs(invalidTime - avgTime)).toBeLessThan(tolerance);
			expect(Math.abs(undefinedTime - avgTime)).toBeLessThan(tolerance);
		});
	});
});
