import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useChangeDetection } from "../use-change-detection";

const CASE_ID = "case-1";

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

interface Deferred<T> {
	promise: Promise<T>;
	resolve: (value: T) => void;
}

function createDeferred<T>(): Deferred<T> {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((res) => {
		resolve = res;
	});
	return { promise, resolve };
}

function jsonResponse(hasChanges: boolean): Response {
	return {
		ok: true,
		text: () =>
			Promise.resolve(
				JSON.stringify({
					hasChanges,
					publishedAt: null,
					publishedId: null,
				})
			),
	} as Response;
}

describe("useChangeDetection — stale-response guard", () => {
	it("keeps state from the later request when overlapping fetches resolve in reverse order", async () => {
		const first = createDeferred<Response>();
		const second = createDeferred<Response>();
		const fetchMock = vi
			.fn()
			.mockImplementationOnce(() => first.promise)
			.mockImplementationOnce(() => second.promise);
		vi.stubGlobal("fetch", fetchMock);

		const { result, rerender } = renderHook(
			({ refreshKey }: { refreshKey: unknown }) =>
				useChangeDetection({ caseId: CASE_ID, enabled: true, refreshKey }),
			{ initialProps: { refreshKey: { rev: 1 } } }
		);

		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

		// A second fetch fires before the first resolves — the refreshKey
		// invalidation path, which can overlap requests for the same caseId.
		rerender({ refreshKey: { rev: 2 } });
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

		// The LATER (second) request resolves FIRST.
		second.resolve(jsonResponse(true));
		await waitFor(() => expect(result.current.hasChanges).toBe(true));

		// The EARLIER (first, now-stale) request resolves AFTER — must be
		// ignored rather than clobbering the newer state.
		first.resolve(jsonResponse(false));
		await new Promise((resolveTick) => setTimeout(resolveTick, 0));

		expect(result.current.hasChanges).toBe(true);
	});
});
