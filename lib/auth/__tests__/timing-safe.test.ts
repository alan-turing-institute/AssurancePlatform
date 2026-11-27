import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addTimingNoise, timingSafeCompare } from "../timing-safe";

describe("addTimingNoise", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	it("does not finish until a timer has run", async () => {
		let finished = false;
		const pending = addTimingNoise(1000).then(() => {
			finished = true;
		});

		await Promise.resolve();
		expect(finished).toBe(false);
		expect(vi.getTimerCount()).toBe(1);

		await vi.advanceTimersByTimeAsync(1000);
		await pending;
		expect(finished).toBe(true);
	});

	it("waits no longer than the maximum it is given", async () => {
		const timeouts = vi.spyOn(globalThis, "setTimeout");
		const maxMs = 0.001;

		for (let run = 0; run < 25; run++) {
			const pending = addTimingNoise(maxMs);
			await vi.runAllTimersAsync();
			await pending;
		}

		const delays = timeouts.mock.calls.map((call) => Number(call[1]));
		expect(delays).toHaveLength(25);
		for (const delay of delays) {
			expect(delay).toBeGreaterThanOrEqual(0);
			expect(delay).toBeLessThanOrEqual(maxMs);
		}
	});
});

describe("timingSafeCompare", () => {
	it.each([
		["equal strings", "secret-value", "secret-value", true],
		["equal empty strings", "", "", true],
		["same length, different content", "secret-value", "secret-valuf", false],
		["a prefix of the other", "secret", "secret-value", false],
		["the other as a prefix", "secret-value", "secret", false],
		["empty against non-empty", "", "secret", false],
	])("compares %s", (_label, a, b, expected) => {
		expect(timingSafeCompare(a, b)).toBe(expected);
	});
});
