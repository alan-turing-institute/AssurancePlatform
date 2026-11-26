import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HealthCriteriaSettings } from "@/lib/schemas/health-criteria";
import { server } from "@/src/__tests__/mocks/server";
import { retireCriteria, saveCriteria, useCaseChecks } from "../use-criteria";
import { checkLists, NO_CRITERIA } from "./criteria-test-data";

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

describe("useCaseChecks while reads come and go", () => {
	interface Call {
		answer: (lists: unknown) => void;
		fail: () => void;
		signal: AbortSignal;
		url: string;
	}
	let calls: Call[];

	beforeEach(() => {
		calls = [];
		vi.useFakeTimers();
		vi.stubGlobal(
			"fetch",
			(url: string, init: RequestInit) =>
				new Promise((resolve, reject) => {
					calls.push({
						url,
						signal: init.signal as AbortSignal,
						answer: (lists) => resolve(Response.json(lists)),
						fail: () => reject(new Error("late")),
					});
				})
		);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	async function flush() {
		await act(async () => {
			await vi.advanceTimersByTimeAsync(0);
		});
	}

	const OTHER_LISTS = [{ ...checkLists()[0], pipeline: "other" }];

	it("holds no deadline timer once the answer is in", async () => {
		renderHook(() => useCaseChecks("case-1", true));

		calls[0]?.answer(checkLists());
		await flush();

		expect(vi.getTimerCount()).toBe(0);
	});

	it("abandons the read, and its deadline, when the caller goes away", () => {
		const { unmount } = renderHook(() => useCaseChecks("case-1", true));
		expect(vi.getTimerCount()).toBe(1);

		unmount();

		expect(calls[0]?.signal.aborted).toBe(true);
		expect(vi.getTimerCount()).toBe(0);
	});

	it("keeps the lists of the case now shown when an earlier case's answer comes late", async () => {
		const { result, rerender } = renderHook(
			({ id }) => useCaseChecks(id, true),
			{ initialProps: { id: "case-1" } }
		);
		rerender({ id: "case-2" });
		calls[1]?.answer(OTHER_LISTS);
		await flush();

		calls[0]?.answer(checkLists());
		await flush();

		expect(calls.map((call) => call.url)).toEqual([
			"/api/cases/case-1/health/checks",
			"/api/cases/case-2/health/checks",
		]);
		expect(result.current).toEqual({ lists: OTHER_LISTS, status: "ready" });
	});

	it("keeps the lists of the case now shown when an earlier case's read fails late", async () => {
		const { result, rerender } = renderHook(
			({ id }) => useCaseChecks(id, true),
			{ initialProps: { id: "case-1" } }
		);
		rerender({ id: "case-2" });
		calls[1]?.answer(OTHER_LISTS);
		await flush();

		calls[0]?.fail();
		await flush();

		expect(result.current).toEqual({ lists: OTHER_LISTS, status: "ready" });
	});
});

describe("saving and retiring settings", () => {
	const SAVE_URL = "/api/elements/claim-1/health/criteria";
	const RETIRE_URL = "/api/elements/claim-1/health/criteria/retirement";

	function capture(method: "post" | "put", url: string) {
		const seen: { body: unknown; contentType: string | null }[] = [];
		server.use(
			http[method](url, async ({ request }) => {
				const text = await request.text();
				seen.push({
					contentType: request.headers.get("content-type"),
					body: text ? JSON.parse(text) : undefined,
				});
				return HttpResponse.json(NO_CRITERIA);
			})
		);
		return seen;
	}

	it("sends a save as JSON", async () => {
		const seen = capture("put", SAVE_URL);

		const outcome = await saveCriteria("claim-1", {
			accept: true,
			expectedRevision: 3,
			integrationId: "integration-1",
			settings: {} as HealthCriteriaSettings,
		});

		expect(outcome).toEqual({ ok: true, view: NO_CRITERIA });
		expect(seen[0]?.contentType).toContain("application/json");
		expect(seen[0]?.body).toMatchObject({
			accept: true,
			expected_revision: 3,
			integration_id: "integration-1",
		});
	});

	it("sends a retirement with the reason when there is one", async () => {
		const seen = capture("post", RETIRE_URL);

		await retireCriteria("claim-1", "replaced");

		expect(seen[0]?.contentType).toContain("application/json");
		expect(seen[0]?.body).toStrictEqual({ reason: "replaced" });
	});

	it("sends a retirement with an empty body when there is no reason", async () => {
		const seen = capture("post", RETIRE_URL);

		await retireCriteria("claim-1");

		expect(seen[0]?.body).toStrictEqual({});
	});

	it.each([
		["a field list that is null", { error: "Refused", fieldErrors: null }, {}],
		[
			"field messages that are not all text",
			{
				error: "Refused",
				fieldErrors: { a: 5, "settings.b": "bad", c: "worse" },
			},
			{ b: "bad", c: "worse" },
		],
	])("reads a refusal with %s", async (_name, body, fieldErrors) => {
		server.use(
			http.put(SAVE_URL, () => HttpResponse.json(body, { status: 422 }))
		);

		const outcome = await saveCriteria("claim-1", {
			accept: false,
			expectedRevision: null,
			integrationId: "integration-1",
			settings: {} as HealthCriteriaSettings,
		});

		expect(outcome).toStrictEqual({
			ok: false,
			message: "Refused",
			fieldErrors,
			status: 422,
		});
	});

	it.each([
		["not text", { error: 5 }],
		["empty", { error: "" }],
	])("words a refusal whose error is %s with the status", async (_name, body) => {
		server.use(
			http.put(SAVE_URL, () => HttpResponse.json(body, { status: 409 }))
		);

		const outcome = await saveCriteria("claim-1", {
			accept: false,
			expectedRevision: null,
			integrationId: "integration-1",
			settings: {} as HealthCriteriaSettings,
		});

		expect(outcome).toMatchObject({ ok: false, status: 409 });
		expect(outcome).toMatchObject({ message: expect.stringContaining("409") });
	});
});
