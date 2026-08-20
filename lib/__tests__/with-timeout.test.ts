import { describe, expect, it } from "vitest";
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
});
