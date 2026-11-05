import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	resetCaseEventStreams,
	subscribeToCaseEvents,
	useCaseEvents,
} from "../use-case-events";

const CONNECTING = 0;
const CLOSED = 2;

/**
 * An EventSource that reports its ready state the way a browser does: it is
 * CLOSED once the browser has given up on the request, and CONNECTING while
 * the browser is about to retry it itself.
 */
class Source {
	static all: Source[] = [];
	closeCalls = 0;
	onopen: (() => void) | null = null;
	onerror: (() => void) | null = null;
	readyState = CONNECTING;
	readonly url: string;
	private readonly listeners = new Map<string, ((e: MessageEvent) => void)[]>();

	constructor(url: string) {
		this.url = url;
		Source.all.push(this);
	}

	addEventListener(type: string, listener: (e: MessageEvent) => void) {
		this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
	}

	close() {
		this.closeCalls += 1;
		this.readyState = CLOSED;
	}

	get closed() {
		return this.closeCalls > 0;
	}

	open() {
		this.onopen?.();
	}

	/** The browser refused the connection and will not try again by itself. */
	refuse() {
		this.readyState = CLOSED;
		this.onerror?.();
	}

	/** The connection dropped and the browser is about to retry it. */
	drop() {
		this.readyState = CONNECTING;
		this.onerror?.();
	}

	/** Delivers an event whose data is the JSON of `data`, or the raw text. */
	emit(type: string, data: unknown) {
		const text = typeof data === "string" ? data : JSON.stringify(data);
		for (const listener of this.listeners.get(type) ?? []) {
			listener({ data: text } as MessageEvent);
		}
	}
}

const source = (index: number): Source => {
	const found = Source.all[index];
	if (!found) {
		throw new Error(`no EventSource at index ${index}`);
	}
	return found;
};
const live = () => Source.all.filter((s) => !s.closed);
const tick = () => act(() => vi.advanceTimersByTime(0));
const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
const settle = () => act(async () => undefined);
/** Runs `fn` and lets the promises it settles run, inside `act`. */
const deliver = (fn: () => void) => act(() => Promise.resolve(fn()));

let fetchMock: ReturnType<typeof vi.fn>;

/** Answers the probe with a response of this status, and records the request. */
function probeAnswers(status: number) {
	fetchMock.mockImplementation(() =>
		Promise.resolve(new Response(null, { status }))
	);
}

function probeFails() {
	fetchMock.mockImplementation(() => Promise.reject(new TypeError("offline")));
}

beforeEach(() => {
	vi.useFakeTimers();
	resetCaseEventStreams();
	Source.all = [];
	vi.stubGlobal("EventSource", Source);
	fetchMock = vi.fn();
	vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
	resetCaseEventStreams();
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe("a closing event from the server", () => {
	it("moves the hook to a final access-removed status and closes the source", () => {
		const onStatusChange = vi.fn();
		const { result } = renderHook(() =>
			useCaseEvents({ caseId: "A", onStatusChange })
		);
		act(() => source(0).open());

		act(() => source(0).emit("stream:closed", { reason: "access-removed" }));

		expect(result.current.status).toBe("access-removed");
		expect(result.current.isConnected).toBe(false);
		expect(onStatusChange).toHaveBeenLastCalledWith("access-removed");
		expect(source(0).closed).toBe(true);
	});

	it("moves the hook to a final signed-out status when the reason is signed-out", () => {
		const { result } = renderHook(() => useCaseEvents({ caseId: "A" }));
		act(() => source(0).open());

		act(() => source(0).emit("stream:closed", { reason: "signed-out" }));

		expect(result.current.status).toBe("signed-out");
		expect(source(0).closed).toBe(true);
	});

	it("is never retried: no new source opens, however long the wait, and nothing is asked of the server", async () => {
		renderHook(() => useCaseEvents({ caseId: "A" }));
		act(() => source(0).open());
		act(() => source(0).emit("stream:closed", { reason: "access-removed" }));

		await advance(10 * 60 * 1000);

		expect(Source.all).toHaveLength(1);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("is not undone by the error the browser raises when the server then ends the response", async () => {
		const { result } = renderHook(() => useCaseEvents({ caseId: "A" }));
		act(() => source(0).open());
		act(() => source(0).emit("stream:closed", { reason: "access-removed" }));

		act(() => source(0).drop());
		act(() => source(0).refuse());
		await advance(60_000);

		expect(result.current.status).toBe("access-removed");
		expect(Source.all).toHaveLength(1);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("keeps a signed-out stream signed out after a late error as well", async () => {
		const { result } = renderHook(() => useCaseEvents({ caseId: "A" }));
		act(() => source(0).open());
		act(() => source(0).emit("stream:closed", { reason: "signed-out" }));

		act(() => source(0).drop());
		await advance(60_000);

		expect(result.current.status).toBe("signed-out");
		expect(Source.all).toHaveLength(1);
	});

	it("still ends the stream for good when its data cannot be read", async () => {
		const { result } = renderHook(() => useCaseEvents({ caseId: "A" }));
		act(() => source(0).open());

		act(() => source(0).emit("stream:closed", "not json {"));
		await advance(60_000);

		expect(["access-removed", "signed-out"]).toContain(result.current.status);
		expect(Source.all).toHaveLength(1);
		expect(live()).toHaveLength(0);
	});

	it("is shown to a subscriber that joins afterwards without opening a new source", () => {
		const first = renderHook(() => useCaseEvents({ caseId: "A" }));
		act(() => source(0).open());
		act(() => source(0).emit("stream:closed", { reason: "access-removed" }));

		const second = renderHook(() => useCaseEvents({ caseId: "A" }));
		tick();

		expect(first.result.current.status).toBe("access-removed");
		expect(second.result.current.status).toBe("access-removed");
		expect(Source.all).toHaveLength(1);
	});

	it("is shown to every subscriber that was already listening", () => {
		const first = renderHook(() => useCaseEvents({ caseId: "A" }));
		const second = renderHook(() => useCaseEvents({ caseId: "A" }));
		act(() => source(0).open());

		act(() => source(0).emit("stream:closed", { reason: "signed-out" }));

		expect(first.result.current.status).toBe("signed-out");
		expect(second.result.current.status).toBe("signed-out");
	});

	it("is not reopened by a plain listener added with subscribeToCaseEvents", () => {
		renderHook(() => useCaseEvents({ caseId: "A" }));
		act(() => source(0).open());
		act(() => source(0).emit("stream:closed", { reason: "access-removed" }));

		const stop = subscribeToCaseEvents("A", vi.fn());
		tick();

		expect(Source.all).toHaveLength(1);
		stop();
	});

	it("survives a remount in the same tick: the final status stays and nothing reconnects", async () => {
		const first = renderHook(() => useCaseEvents({ caseId: "A" }));
		act(() => source(0).open());
		act(() => source(0).emit("stream:closed", { reason: "access-removed" }));

		first.unmount();
		const remounted = renderHook(() => useCaseEvents({ caseId: "A" }));
		tick();
		await advance(60_000);

		expect(remounted.result.current.status).toBe("access-removed");
		expect(Source.all).toHaveLength(1);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("leaves other cases' streams alone", () => {
		const a = renderHook(() => useCaseEvents({ caseId: "A" }));
		const b = renderHook(() => useCaseEvents({ caseId: "B" }));
		act(() => source(0).open());
		act(() => source(1).open());

		act(() => source(0).emit("stream:closed", { reason: "access-removed" }));

		expect(a.result.current.status).toBe("access-removed");
		expect(b.result.current.status).toBe("connected");
		expect(source(1).closed).toBe(false);
	});

	it("is not passed to event handlers as a case event", () => {
		const onEvent = vi.fn();
		renderHook(() => useCaseEvents({ caseId: "A", onEvent }));
		act(() => source(0).open());

		act(() => source(0).emit("stream:closed", { reason: "access-removed" }));

		expect(onEvent).not.toHaveBeenCalled();
	});

	it("can be reopened by an explicit reconnect, which starts a fresh source", () => {
		const { result } = renderHook(() => useCaseEvents({ caseId: "A" }));
		act(() => source(0).open());
		act(() => source(0).emit("stream:closed", { reason: "access-removed" }));
		expect(result.current.status).toBe("access-removed");

		act(() => result.current.reconnect());

		expect(Source.all).toHaveLength(2);
		expect(live()).toEqual([source(1)]);
		expect(result.current.status).toBe("connecting");
		act(() => source(1).open());
		expect(result.current.status).toBe("connected");
	});

	it("applies to a later closing event on the reopened source as well", () => {
		const { result } = renderHook(() => useCaseEvents({ caseId: "A" }));
		act(() => source(0).open());
		act(() => source(0).emit("stream:closed", { reason: "access-removed" }));
		act(() => result.current.reconnect());
		act(() => source(1).open());

		act(() => source(1).emit("stream:closed", { reason: "signed-out" }));

		expect(result.current.status).toBe("signed-out");
		expect(live()).toHaveLength(0);
	});

	it("ignores a closing event from a source the hook has already replaced", () => {
		const { result } = renderHook(() => useCaseEvents({ caseId: "A" }));
		act(() => source(0).open());
		act(() => result.current.reconnect());
		act(() => source(1).open());

		act(() => source(0).emit("stream:closed", { reason: "access-removed" }));

		expect(result.current.status).toBe("connected");
		expect(source(1).closed).toBe(false);
	});
});

describe("a connection the browser refused", () => {
	it("asks the events URL once, and reads a 404 as access removed", async () => {
		probeAnswers(404);
		const { result } = renderHook(() => useCaseEvents({ caseId: "A" }));

		act(() => source(0).refuse());
		await settle();

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/cases/A/events");
		expect(result.current.status).toBe("access-removed");
	});

	it("reads a 401 as signed out", async () => {
		probeAnswers(401);
		const { result } = renderHook(() => useCaseEvents({ caseId: "A" }));

		act(() => source(0).refuse());
		await settle();

		expect(result.current.status).toBe("signed-out");
	});

	it("does not retry after a 404 or a 401, however long the wait", async () => {
		for (const status of [404, 401]) {
			resetCaseEventStreams();
			Source.all = [];
			fetchMock.mockReset();
			probeAnswers(status);
			renderHook(() => useCaseEvents({ caseId: `case-${status}` }));
			act(() => source(0).refuse());
			await settle();

			await advance(10 * 60 * 1000);

			expect(Source.all).toHaveLength(1);
			expect(fetchMock).toHaveBeenCalledTimes(1);
		}
	});

	it("drops the response body of a 200 and goes back to the normal backoff", async () => {
		probeAnswers(200);
		const { result } = renderHook(() =>
			useCaseEvents({ caseId: "A", reconnectDelay: 1000 })
		);

		act(() => source(0).refuse());
		await settle();

		const signal = (fetchMock.mock.calls[0]?.[1] as RequestInit | undefined)
			?.signal;
		expect(signal?.aborted).toBe(true);
		expect(result.current.status).toBe("connecting");
		expect(Source.all).toHaveLength(1);

		await advance(1000);
		expect(Source.all).toHaveLength(2);
	});

	it.each([
		403, 429, 500, 502, 503,
	])("treats a %i as an ordinary failure: the normal backoff, no final status", async (status) => {
		probeAnswers(status);
		const { result } = renderHook(() =>
			useCaseEvents({ caseId: "A", reconnectDelay: 1000 })
		);

		act(() => source(0).refuse());
		await settle();

		expect(result.current.status).toBe("connecting");
		await advance(1000);
		expect(Source.all).toHaveLength(2);
	});

	it("treats a probe that cannot reach the server as an ordinary failure", async () => {
		probeFails();
		const { result } = renderHook(() =>
			useCaseEvents({ caseId: "A", reconnectDelay: 1000 })
		);

		act(() => source(0).refuse());
		await settle();

		expect(result.current.status).toBe("connecting");
		await advance(1000);
		expect(Source.all).toHaveLength(2);
	});

	it("gives up with the error status after the attempts run out when the server keeps failing", async () => {
		probeAnswers(503);
		const { result } = renderHook(() =>
			useCaseEvents({
				caseId: "A",
				maxReconnectAttempts: 3,
				reconnectDelay: 100,
			})
		);

		for (let round = 0; round < 8; round += 1) {
			const latest = Source.all.at(-1);
			if (latest && !latest.closed) {
				act(() => latest.refuse());
			}
			await settle();
			await advance(10_000);
		}

		expect(result.current.status).toBe("error");
		expect(Source.all.length).toBeLessThanOrEqual(5);
	});

	it("keeps asking at most once for each refusal", async () => {
		probeAnswers(503);
		renderHook(() =>
			useCaseEvents({
				caseId: "A",
				maxReconnectAttempts: 5,
				reconnectDelay: 100,
			})
		);

		act(() => source(0).refuse());
		await settle();
		expect(fetchMock).toHaveBeenCalledTimes(1);
		await advance(100);
		act(() => source(1).refuse());
		await settle();

		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("is not probed when the browser is retrying by itself", async () => {
		probeAnswers(404);
		const { result } = renderHook(() =>
			useCaseEvents({ caseId: "A", reconnectDelay: 1000 })
		);
		act(() => source(0).open());

		act(() => source(0).drop());
		await settle();

		expect(fetchMock).not.toHaveBeenCalled();
		expect(result.current.status).toBe("connecting");
		await advance(1000);
		expect(Source.all).toHaveLength(2);
	});

	it("is not probed when nobody is listening any more", async () => {
		probeAnswers(404);
		const { unmount } = renderHook(() => useCaseEvents({ caseId: "A" }));

		unmount();
		act(() => source(0).refuse());
		await settle();

		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("drops a probe answer that arrives after the last listener has gone", async () => {
		let answer!: (response: Response) => void;
		fetchMock.mockImplementation(
			() =>
				new Promise<Response>((resolve) => {
					answer = resolve;
				})
		);
		const onStatusChange = vi.fn();
		const { unmount } = renderHook(() =>
			useCaseEvents({ caseId: "A", onStatusChange })
		);
		act(() => source(0).refuse());
		unmount();
		await advance(10);
		onStatusChange.mockClear();

		await deliver(() => answer(new Response(null, { status: 404 })));
		await advance(60_000);

		expect(onStatusChange).not.toHaveBeenCalled();
		expect(Source.all).toHaveLength(1);
	});

	it("is not turned into a final status by a probe answer that arrives after disconnect", async () => {
		let answer!: (response: Response) => void;
		fetchMock.mockImplementation(
			() =>
				new Promise<Response>((resolve) => {
					answer = resolve;
				})
		);
		const { result } = renderHook(() => useCaseEvents({ caseId: "A" }));
		act(() => source(0).refuse());

		act(() => result.current.disconnect());
		await deliver(() => answer(new Response(null, { status: 404 })));
		await advance(60_000);

		expect(result.current.status).toBe("disconnected");
		expect(Source.all).toHaveLength(1);
	});

	it("is not turned into a final status by a probe answer that arrives after a manual reconnect", async () => {
		const answers: ((response: Response) => void)[] = [];
		fetchMock.mockImplementation(
			() =>
				new Promise<Response>((resolve) => {
					answers.push(resolve);
				})
		);
		const { result } = renderHook(() => useCaseEvents({ caseId: "A" }));
		act(() => source(0).refuse());

		act(() => result.current.reconnect());
		act(() => source(1).open());
		await deliver(() => answers[0]?.(new Response(null, { status: 404 })));

		expect(result.current.status).toBe("connected");
		expect(live()).toEqual([source(1)]);
	});

	it("does not open a second source for a subscriber that joins while the probe waits for its answer", async () => {
		let answer!: (response: Response) => void;
		fetchMock.mockImplementation(
			() =>
				new Promise<Response>((resolve) => {
					answer = resolve;
				})
		);
		const first = renderHook(() => useCaseEvents({ caseId: "A" }));
		act(() => source(0).refuse());

		const second = renderHook(() => useCaseEvents({ caseId: "A" }));
		tick();
		expect(Source.all).toHaveLength(1);
		await deliver(() => answer(new Response(null, { status: 404 })));

		expect(first.result.current.status).toBe("access-removed");
		expect(second.result.current.status).toBe("access-removed");
		expect(Source.all).toHaveLength(1);
		expect(live()).toHaveLength(0);
	});

	it("lets a manual reconnect reopen a stream the probe ended", async () => {
		probeAnswers(404);
		const { result } = renderHook(() => useCaseEvents({ caseId: "A" }));
		act(() => source(0).refuse());
		await settle();
		expect(result.current.status).toBe("access-removed");

		act(() => result.current.reconnect());

		expect(Source.all).toHaveLength(2);
		expect(result.current.status).toBe("connecting");
	});

	it("shows the final status found by the probe to a later subscriber without a new source", async () => {
		probeAnswers(404);
		renderHook(() => useCaseEvents({ caseId: "A" }));
		act(() => source(0).refuse());
		await settle();

		const late = renderHook(() => useCaseEvents({ caseId: "A" }));
		tick();

		expect(late.result.current.status).toBe("access-removed");
		expect(Source.all).toHaveLength(1);
	});
});

describe("a stream that is opened again after every listener had left", () => {
	it("makes one fresh attempt, and a 404 then ends it without a retry loop", async () => {
		probeAnswers(404);
		const first = renderHook(() => useCaseEvents({ caseId: "A" }));
		act(() => source(0).open());
		act(() => source(0).emit("stream:closed", { reason: "access-removed" }));
		first.unmount();
		await advance(10);

		const second = renderHook(() => useCaseEvents({ caseId: "A" }));
		tick();
		expect(Source.all).toHaveLength(2);
		act(() => source(1).refuse());
		await settle();
		await advance(10 * 60 * 1000);

		expect(second.result.current.status).toBe("access-removed");
		expect(Source.all).toHaveLength(2);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});

describe("ordinary events and errors", () => {
	it("still delivers case events to handlers before any closing event", () => {
		const onEvent = vi.fn();
		renderHook(() => useCaseEvents({ caseId: "A", onEvent }));
		act(() => source(0).open());

		act(() =>
			source(0).emit("permission:changed", {
				type: "permission:changed",
				caseId: "A",
				timestamp: "t",
				payload: {},
			})
		);

		expect(onEvent).toHaveBeenCalledTimes(1);
	});
});
