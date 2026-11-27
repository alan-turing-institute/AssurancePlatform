import { act, renderHook } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "@/lib/toast";
import { server } from "@/src/__tests__/mocks/server";
import type { HealthCriteriaResponse } from "../health-types";
import { useAddEvidenceNode } from "../use-add-evidence-node";
import type { ClaimScopedFetchResult } from "../use-claim-scoped-fetch";
import { NO_CRITERIA } from "./criteria-test-data";

const URL = "/api/elements/claim-1/health/evidence-node";

function criteria(): ClaimScopedFetchResult<HealthCriteriaResponse | null> {
	return {
		data: null,
		refetch: vi.fn(async () => undefined),
		replace: vi.fn(),
		status: "ready",
	};
}

function shown() {
	return vi.mocked(toast).mock.calls[0]?.[0];
}

beforeEach(() => {
	vi.mocked(toast).mockClear();
});

describe("adding the evidence node", () => {
	it("shows the server's answer at once, with no message and no second read", async () => {
		server.use(http.post(URL, () => HttpResponse.json(NO_CRITERIA)));
		const held = criteria();
		const { result } = renderHook(() => useAddEvidenceNode("claim-1", held));

		await act(() => result.current.add());

		expect(held.replace).toHaveBeenCalledWith(NO_CRITERIA);
		expect(held.refetch).not.toHaveBeenCalled();
		expect(toast).not.toHaveBeenCalled();
		expect(result.current.pending).toBe(false);
	});

	it("is pending until the server answers", async () => {
		let release: () => void = () => undefined;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		server.use(
			http.post(URL, async () => {
				await gate;
				return HttpResponse.json(NO_CRITERIA);
			})
		);
		const { result } = renderHook(() =>
			useAddEvidenceNode("claim-1", criteria())
		);

		let done: Promise<void> = Promise.resolve();
		act(() => {
			done = result.current.add();
		});
		expect(result.current.pending).toBe(true);
		release();
		await act(() => done);

		expect(result.current.pending).toBe(false);
	});

	it("shows the server's refusal and reads the settings again when they are out of date", async () => {
		server.use(
			http.post(URL, () =>
				HttpResponse.json({ error: "Out of date" }, { status: 409 })
			)
		);
		const held = criteria();
		const { result } = renderHook(() => useAddEvidenceNode("claim-1", held));

		await act(() => result.current.add());

		expect(held.refetch).toHaveBeenCalledTimes(1);
		expect(held.replace).not.toHaveBeenCalled();
		expect(shown()).toMatchObject({
			variant: "destructive",
			description: "Out of date",
		});
		expect(shown()?.title).toBeTruthy();
	});

	it("shows any other refusal without reading the settings again", async () => {
		server.use(
			http.post(URL, () =>
				HttpResponse.json({ error: "Not allowed" }, { status: 403 })
			)
		);
		const held = criteria();
		const { result } = renderHook(() => useAddEvidenceNode("claim-1", held));

		await act(() => result.current.add());

		expect(held.refetch).not.toHaveBeenCalled();
		expect(shown()).toMatchObject({
			variant: "destructive",
			description: "Not allowed",
		});
	});
});
