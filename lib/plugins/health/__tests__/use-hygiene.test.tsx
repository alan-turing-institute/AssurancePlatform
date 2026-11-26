import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/src/__tests__/mocks/server";
import { type HygieneFigures, useHygiene } from "../use-hygiene";

function figures(count: number): HygieneFigures {
	return {
		checks_without_time_limit: { count, of: 10 },
		claims_without_time_limit: { count: 1, of: 4 },
		settings_as_recommended: { count: 2, of: 6 },
	};
}

const url = (caseId: string) => `/api/cases/${caseId}/health/hygiene`;

function deferred() {
	let release: () => void = () => undefined;
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	return { gate, release };
}

describe("a case's evidence health figures", () => {
	it("are loading with none shown, then ready with the figures", async () => {
		server.use(http.get(url("c1"), () => HttpResponse.json(figures(3))));

		const { result } = renderHook(() => useHygiene("c1"));

		expect(result.current.status).toBe("loading");
		expect(result.current.figures).toBeNull();
		await waitFor(() => expect(result.current.status).toBe("ready"));
		expect(result.current.figures).toEqual(figures(3));
	});

	it("are in the error state, with none shown, when the server refuses", async () => {
		server.use(
			http.get(url("c1"), () => HttpResponse.json({}, { status: 500 }))
		);

		const { result } = renderHook(() => useHygiene("c1"));

		await waitFor(() => expect(result.current.status).toBe("error"));
		expect(result.current.figures).toBeNull();
	});

	it("stay on show, as loading, while a refresh is read, and are replaced by the new ones", async () => {
		const held = deferred();
		let reads = 0;
		server.use(
			http.get(url("c1"), async () => {
				reads += 1;
				if (reads > 1) {
					await held.gate;
				}
				return HttpResponse.json(figures(reads));
			})
		);
		const { result } = renderHook(() => useHygiene("c1"));
		await waitFor(() => expect(result.current.status).toBe("ready"));

		act(() => result.current.refresh());
		await waitFor(() => expect(result.current.status).toBe("loading"));
		expect(result.current.figures).toEqual(figures(1));
		held.release();

		await waitFor(() => expect(result.current.status).toBe("ready"));
		expect(result.current.figures).toEqual(figures(2));
	});

	it("are cleared when a refresh fails", async () => {
		let fail = false;
		server.use(
			http.get(url("c1"), () =>
				fail
					? HttpResponse.json({}, { status: 500 })
					: HttpResponse.json(figures(3))
			)
		);
		const { result } = renderHook(() => useHygiene("c1"));
		await waitFor(() => expect(result.current.status).toBe("ready"));
		fail = true;

		act(() => result.current.refresh());

		await waitFor(() => expect(result.current.status).toBe("error"));
		expect(result.current.figures).toBeNull();
	});

	it("ignore an earlier read that finishes after a later one", async () => {
		const held = deferred();
		let reads = 0;
		server.use(
			http.get(url("c1"), async () => {
				reads += 1;
				const mine = reads;
				if (mine === 1) {
					await held.gate;
				}
				return HttpResponse.json(figures(mine));
			})
		);
		const { result } = renderHook(() => useHygiene("c1"));
		await waitFor(() => expect(reads).toBe(1));
		act(() => result.current.refresh());
		await waitFor(() => expect(result.current.figures).toEqual(figures(2)));

		held.release();
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 20));
		});

		expect(result.current.figures).toEqual(figures(2));
		expect(result.current.status).toBe("ready");
	});

	it("ignore an earlier read that fails after a later one succeeded", async () => {
		const held = deferred();
		let reads = 0;
		server.use(
			http.get(url("c1"), async () => {
				reads += 1;
				if (reads === 1) {
					await held.gate;
					return HttpResponse.json({}, { status: 500 });
				}
				return HttpResponse.json(figures(2));
			})
		);
		const { result } = renderHook(() => useHygiene("c1"));
		await waitFor(() => expect(reads).toBe(1));
		act(() => result.current.refresh());
		await waitFor(() => expect(result.current.status).toBe("ready"));

		held.release();
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 20));
		});

		expect(result.current.status).toBe("ready");
		expect(result.current.figures).toEqual(figures(2));
	});

	it("are read for the new case, and not from the old one, when the case changes", async () => {
		const held = deferred();
		server.use(
			http.get(url("old"), async () => {
				await held.gate;
				return HttpResponse.json(figures(1));
			}),
			http.get(url("new"), () => HttpResponse.json(figures(9)))
		);
		const { result, rerender } = renderHook(({ id }) => useHygiene(id), {
			initialProps: { id: "old" },
		});

		rerender({ id: "new" });
		await waitFor(() => expect(result.current.figures).toEqual(figures(9)));
		held.release();
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 20));
		});

		expect(result.current.figures).toEqual(figures(9));
	});
});
