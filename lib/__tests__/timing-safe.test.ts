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
			const now = 1_000_000;
			vi.setSystemTime(now);
			expect(isTimestampValid(now + 10_000)).toBe(true);
		});

		it("should return false for past timestamp", () => {
			const now = 1_000_000;
			vi.setSystemTime(now);
			expect(isTimestampValid(now - 10_000)).toBe(false);
		});

		it("should return true for undefined (no expiry)", () => {
			expect(isTimestampValid(undefined)).toBe(true);
		});

		it("should return true when timestamp equals current time", () => {
			const now = 1_000_000;
			vi.setSystemTime(now);
			// now <= timestamp, so equal should be valid
			expect(isTimestampValid(now, now)).toBe(true);
		});

		it("should accept custom now parameter", () => {
			const customNow = 500_000;
			expect(isTimestampValid(600_000, customNow)).toBe(true);
			expect(isTimestampValid(400_000, customNow)).toBe(false);
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
});
