import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TimeoutError, withTimeout } from "../with-timeout";

describe("withTimeout", () => {
	it("resolves with the underlying value when it settles before the deadline", async () => {
		const result = await withTimeout(Promise.resolve("done"), 50);
		expect(result).toBe("done");
	});

	it("rejects with TimeoutError when the promise never settles in time", async () => {
		const neverSettles = new Promise<never>(() => {
			/* deliberately never resolves or rejects — mirrors a hung DB query */
		});

		await expect(withTimeout(neverSettles, 10)).rejects.toBeInstanceOf(
			TimeoutError
		);
	});

	it("propagates the underlying rejection when it rejects before the deadline", async () => {
		const boom = new Error("boom");
		await expect(withTimeout(Promise.reject(boom), 50)).rejects.toBe(boom);
	});

	it("TimeoutError message names the configured duration", () => {
		const err = new TimeoutError(15_000);
		expect(err.name).toBe("TimeoutError");
		expect(err.message).toContain("15000ms");
	});

	describe("timer lifecycle", () => {
		beforeEach(() => {
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it("clears its internal timer on early resolution, leaving nothing pending", async () => {
			// A leaked timer here would keep the Node process alive after the
			// request that started it has long since responded — the same
			// "silent" failure mode as the original hang, just one layer down.
			await withTimeout(Promise.resolve("done"), 1000);
			expect(vi.getTimerCount()).toBe(0);
		});

		it("clears its internal timer when the underlying promise rejects early", async () => {
			await expect(
				withTimeout(Promise.reject(new Error("boom")), 1000)
			).rejects.toThrow("boom");
			expect(vi.getTimerCount()).toBe(0);
		});

		it("a rejection that arrives after the timeout has already fired produces no unhandled rejection", async () => {
			let rejectLate: (error: unknown) => void = () => {
				/* replaced below */
			};
			const late = new Promise<never>((_resolve, reject) => {
				rejectLate = reject;
			});

			const unhandled: unknown[] = [];
			const onUnhandledRejection = (reason: unknown) => {
				unhandled.push(reason);
			};
			process.on("unhandledRejection", onUnhandledRejection);

			try {
				const result = withTimeout(late, 10);
				const assertion = expect(result).rejects.toBeInstanceOf(TimeoutError);

				await vi.advanceTimersByTimeAsync(10);
				await assertion;

				// The underlying promise settles well after the race is already
				// decided — `withTimeout`'s `.then()` handler still runs (a
				// promise can only be observed, never "unsubscribed from"), but
				// resolving/rejecting an already-settled outer promise is a
				// documented no-op, not a second, unhandled rejection.
				rejectLate(new Error("late failure, after the timeout already won"));
				await vi.advanceTimersByTimeAsync(0);
				// Flush the microtask queue so a genuine unhandled rejection
				// would have had a chance to surface before we assert.
				await Promise.resolve();
				await Promise.resolve();
			} finally {
				process.off("unhandledRejection", onUnhandledRejection);
			}

			expect(unhandled).toHaveLength(0);
		});
	});
});
