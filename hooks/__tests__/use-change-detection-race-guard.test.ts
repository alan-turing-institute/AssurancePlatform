import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useChangeDetection } from "../use-change-detection";

const CASE_ID = "case-1";

// How long, and how often, to keep re-checking a value that's expected to
// hold steady. A single tick isn't enough here: the unguarded code clobbers
// state a couple of microtask hops after a stale response resolves, later
// than one `setTimeout(0)` — this polls across real time instead of trusting
// one snapshot.
const STAYS_DURATION_MS = 100;
const STAYS_STEP_MS = 20;

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

function jsonResponse(body: Record<string, unknown>): Response {
	return {
		ok: true,
		text: () =>
			Promise.resolve(
				JSON.stringify({
					hasChanges: false,
					publishedAt: null,
					publishedId: null,
					...body,
				})
			),
	} as Response;
}

/**
 * Repeatedly samples `getValue()` across `STAYS_DURATION_MS` of real time,
 * including an immediate first sample. A test that only checks once,
 * immediately after a value first becomes true, can pass even when a later
 * microtask clobbers the state — the caller asserts every sample stayed the
 * same, which catches that.
 */
async function sampleOverTime(getValue: () => unknown): Promise<unknown[]> {
	const samples = [getValue()];
	const iterations = Math.ceil(STAYS_DURATION_MS / STAYS_STEP_MS);
	for (let i = 0; i < iterations; i++) {
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, STAYS_STEP_MS));
		});
		samples.push(getValue());
	}
	return samples;
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
		second.resolve(jsonResponse({ hasChanges: true }));
		await waitFor(() => expect(result.current.hasChanges).toBe(true));

		// The EARLIER (first, now-stale) request resolves AFTER — must be
		// ignored rather than clobbering the newer state. Sample over time
		// rather than checking once.
		first.resolve(jsonResponse({ hasChanges: false }));
		const samples = await sampleOverTime(() => result.current.hasChanges);
		expect(samples.every((value) => value === true)).toBe(true);
	});

	it("keeps state from the latest of three overlapping requests, whatever order they resolve in", async () => {
		const requestOne = createDeferred<Response>();
		const requestTwo = createDeferred<Response>();
		const requestThree = createDeferred<Response>();
		const fetchMock = vi
			.fn()
			.mockImplementationOnce(() => requestOne.promise)
			.mockImplementationOnce(() => requestTwo.promise)
			.mockImplementationOnce(() => requestThree.promise);
		vi.stubGlobal("fetch", fetchMock);

		const { result, rerender } = renderHook(
			({ refreshKey }: { refreshKey: unknown }) =>
				useChangeDetection({ caseId: CASE_ID, enabled: true, refreshKey }),
			{ initialProps: { refreshKey: { rev: 1 } } }
		);

		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		rerender({ refreshKey: { rev: 2 } });
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
		rerender({ refreshKey: { rev: 3 } });
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));

		// All three requests are already in flight before any of them resolve
		// (three rerenders fired synchronously above), so by the time request 2
		// resolves, request 3 has already been issued and is the latest — its
		// resolution must be ignored outright, not just superseded later.
		requestTwo.resolve(jsonResponse({ publishedId: "req-2" }));
		await new Promise((resolveTick) => setTimeout(resolveTick, 0));
		expect(result.current.publishedId).not.toBe("req-2");

		requestThree.resolve(jsonResponse({ publishedId: "req-3" }));
		await waitFor(() => expect(result.current.publishedId).toBe("req-3"));

		// The earliest (first, now doubly-stale) request resolves last — must
		// still be ignored, and the state must stay on request 3's response.
		requestOne.resolve(jsonResponse({ publishedId: "req-1" }));
		const samples = await sampleOverTime(() => result.current.publishedId);
		expect(samples.every((value) => value === "req-3")).toBe(true);
	});
});
