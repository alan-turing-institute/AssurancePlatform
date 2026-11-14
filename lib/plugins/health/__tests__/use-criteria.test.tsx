import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { server } from "@/src/__tests__/mocks/server";
import { useCaseChecks } from "../use-criteria";
import { checkLists } from "./criteria-test-data";

const CHECKS_URL = "/api/cases/case-1/health/checks";

describe("useCaseChecks", () => {
	it("reads nothing until it is enabled", () => {
		let reads = 0;
		server.use(
			http.get(CHECKS_URL, () => {
				reads += 1;
				return HttpResponse.json(checkLists());
			})
		);
		const { result } = renderHook(() => useCaseChecks("case-1", false));
		expect(result.current).toEqual({ lists: null, status: "idle" });
		expect(reads).toBe(0);
	});

	it("holds the lists once they are read", async () => {
		server.use(http.get(CHECKS_URL, () => HttpResponse.json(checkLists())));
		const { result } = renderHook(() => useCaseChecks("case-1", true));
		await waitFor(() => expect(result.current.status).toBe("ready"));
		expect(result.current.lists).toEqual(checkLists());
	});

	it("is in the error state, holding no lists, when the server refuses the read", async () => {
		server.use(
			http.get(CHECKS_URL, () =>
				HttpResponse.json({ error: "down" }, { status: 500 })
			)
		);
		const { result } = renderHook(() => useCaseChecks("case-1", true));
		await waitFor(() => expect(result.current.status).toBe("error"));
		expect(result.current.lists).toBeNull();
	});

	it("is in the error state when the request cannot be sent", async () => {
		server.use(http.get(CHECKS_URL, () => HttpResponse.error()));
		const { result } = renderHook(() => useCaseChecks("case-1", true));
		await waitFor(() => expect(result.current.status).toBe("error"));
		expect(result.current.lists).toBeNull();
	});

	describe("when the request never answers", () => {
		afterEach(() => {
			vi.useRealTimers();
			vi.unstubAllGlobals();
		});

		it("gives up after 15 seconds and is in the error state", async () => {
			vi.useFakeTimers();
			vi.stubGlobal(
				"fetch",
				(_url: string, init?: RequestInit) =>
					new Promise((_resolve, reject) => {
						init?.signal?.addEventListener("abort", () =>
							reject(new DOMException("aborted", "AbortError"))
						);
					})
			);
			const { result } = renderHook(() => useCaseChecks("case-1", true));
			expect(result.current.status).toBe("loading");

			await act(async () => {
				await vi.advanceTimersByTimeAsync(14_999);
			});
			expect(result.current.status).toBe("loading");

			await act(async () => {
				await vi.advanceTimersByTimeAsync(1);
			});
			expect(result.current).toEqual({ lists: null, status: "error" });
		});
	});
});
