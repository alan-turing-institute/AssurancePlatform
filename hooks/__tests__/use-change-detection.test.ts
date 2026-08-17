import { renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { server } from "@/src/__tests__/mocks/server";
import { useChangeDetection } from "../use-change-detection";

const CASE_ID = "case-1";
const CHANGES_PATH = `/api/cases/${CASE_ID}/changes`;

function jsonResponse(hasChanges: boolean) {
	return HttpResponse.json({
		hasChanges,
		publishedAt: "2026-08-01T00:00:00.000Z",
		publishedId: "published-1",
	});
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe("useChangeDetection — refreshKey invalidation", () => {
	it("re-fetches when refreshKey changes reference while enabled, without polling", async () => {
		let requestCount = 0;
		server.use(
			http.get(CHANGES_PATH, () => {
				requestCount += 1;
				// First fetch: no changes yet. Second fetch (after a structural
				// edit lands and refreshKey changes): changes detected.
				return jsonResponse(requestCount > 1);
			})
		);

		const { result, rerender } = renderHook(
			({ refreshKey }: { refreshKey: unknown }) =>
				useChangeDetection({ caseId: CASE_ID, enabled: true, refreshKey }),
			{ initialProps: { refreshKey: { rev: 1 } } }
		);

		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(result.current.hasChanges).toBe(false);
		expect(requestCount).toBe(1);

		// A structural edit lands — the caller passes a new object reference
		// (the store's assuranceCase is replaced, never mutated, on edits).
		rerender({ refreshKey: { rev: 2 } });

		await waitFor(() => expect(requestCount).toBe(2));
		await waitFor(() => expect(result.current.hasChanges).toBe(true));
	});

	it("does not re-fetch when refreshKey is referentially unchanged across renders", async () => {
		let requestCount = 0;
		server.use(
			http.get(CHANGES_PATH, () => {
				requestCount += 1;
				return jsonResponse(false);
			})
		);

		const stableKey = { rev: 1 };
		const { result, rerender } = renderHook(
			({ refreshKey }: { refreshKey: unknown }) =>
				useChangeDetection({ caseId: CASE_ID, enabled: true, refreshKey }),
			{ initialProps: { refreshKey: stableKey } }
		);

		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(requestCount).toBe(1);

		// Unrelated re-render (e.g. a comment mutation elsewhere in the store)
		// passes the same refreshKey reference — must not trigger a refetch.
		rerender({ refreshKey: stableKey });

		// Give any accidental async refetch a tick to happen before asserting
		// it didn't.
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(requestCount).toBe(1);
	});
});
