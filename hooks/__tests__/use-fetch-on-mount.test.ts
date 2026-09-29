import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useFetchOnMount } from "../use-fetch-on-mount";

describe("useFetchOnMount", () => {
	it("starts loading with no data, then resolves to the fetcher's result", async () => {
		const fetcher = vi.fn().mockResolvedValue({ value: 42 });

		const { result } = renderHook(() => useFetchOnMount(fetcher));

		expect(result.current.loading).toBe(true);
		expect(result.current.data).toBeNull();

		await waitFor(() => expect(result.current.loading).toBe(false));

		expect(result.current.data).toEqual({ value: 42 });
		expect(result.current.error).toBeNull();
		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it("surfaces a rejected fetcher's message as error, with data staying null", async () => {
		const fetcher = vi.fn().mockRejectedValue(new Error("boom"));

		const { result } = renderHook(() => useFetchOnMount(fetcher));

		await waitFor(() => expect(result.current.loading).toBe(false));

		expect(result.current.error).toBe("boom");
		expect(result.current.data).toBeNull();
	});

	it("reload() re-runs the fetcher and clears a previous error on success", async () => {
		const fetcher = vi
			.fn()
			.mockRejectedValueOnce(new Error("first failed"))
			.mockResolvedValueOnce({ value: 1 });

		const { result } = renderHook(() => useFetchOnMount(fetcher));

		await waitFor(() => expect(result.current.error).toBe("first failed"));

		await act(async () => {
			await result.current.reload();
		});

		expect(result.current.data).toEqual({ value: 1 });
		expect(result.current.error).toBeNull();
		expect(fetcher).toHaveBeenCalledTimes(2);
	});
});
