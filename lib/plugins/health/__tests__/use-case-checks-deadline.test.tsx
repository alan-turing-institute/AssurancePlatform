import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCaseChecks } from "../use-criteria";
import { checkLists } from "./criteria-test-data";

describe("useCaseChecks deadline", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	function stubFetch(answerAtMs: number | null) {
		vi.stubGlobal(
			"fetch",
			(_url: string, init?: RequestInit) =>
				new Promise((resolve, reject) => {
					init?.signal?.addEventListener("abort", () =>
						reject(new DOMException("aborted", "AbortError"))
					);
					if (answerAtMs !== null) {
						setTimeout(
							() =>
								resolve(
									new Response(JSON.stringify(checkLists()), { status: 200 })
								),
							answerAtMs
						);
					}
				})
		);
	}

	it("is ready when the answer arrives at 14 seconds", async () => {
		stubFetch(14_000);
		const { result } = renderHook(() => useCaseChecks("case-1", true));
		await act(async () => {
			await vi.advanceTimersByTimeAsync(14_000);
		});
		expect(result.current.status).toBe("ready");
		await act(async () => {
			await vi.advanceTimersByTimeAsync(5000);
		});
		expect(result.current.status).toBe("ready");
	});

	it("is in error with no lists when nothing arrives within 15 seconds", async () => {
		stubFetch(null);
		const { result } = renderHook(() => useCaseChecks("case-1", true));
		await act(async () => {
			await vi.advanceTimersByTimeAsync(15_000);
		});
		expect(result.current).toEqual({ lists: null, status: "error" });
	});
});
