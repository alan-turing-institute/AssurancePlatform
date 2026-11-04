import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STREAM_CLOSED_EVENT } from "@/lib/sse-stream-closed";
import { resetCaseEventStreams, useCaseEvents } from "../use-case-events";

/**
 * A fake `EventSource` that, like the real one, is CONNECTING while the
 * browser retries a dropped connection and CLOSED once it has given up or
 * been closed.
 */
class Source {
	static all: Source[] = [];
	static readonly CONNECTING = 0;
	static readonly CLOSED = 2;

	readyState = Source.CONNECTING;
	onopen: (() => void) | null = null;
	onerror: (() => void) | null = null;
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
		this.readyState = Source.CLOSED;
	}

	get closed() {
		return this.readyState === Source.CLOSED;
	}

	open() {
		this.onopen?.();
	}

	/** The connection dropped and the browser is about to retry it. */
	drop() {
		this.readyState = Source.CONNECTING;
		this.onerror?.();
	}

	/** The server answered the request with an error status, so the browser gave up. */
	refuse() {
		this.readyState = Source.CLOSED;
		this.onerror?.();
	}

	emit(type: string, data: unknown) {
		for (const listener of this.listeners.get(type) ?? []) {
			listener({ data: JSON.stringify(data) } as MessageEvent);
		}
	}

	/** The closing event the server sends before it ends the stream. */
	serverEndsStream(reason = "access-removed") {
		this.emit(STREAM_CLOSED_EVENT, { reason });
	}
}

const source = (index: number): Source => {
	const found = Source.all[index];
	if (!found) {
		throw new Error(`no EventSource at index ${index}`);
	}
	return found;
};

/** Lets a probe's request and the code waiting on it finish. */
const settle = () =>
	act(async () => {
		await vi.advanceTimersByTimeAsync(0);
	});

const passTime = (ms: number) =>
	act(async () => {
		await vi.advanceTimersByTimeAsync(ms);
	});

interface Probe {
	fetch: ReturnType<typeof vi.fn>;
	signals: AbortSignal[];
}

/** Answers every request with `status` and records the signal each was given. */
function answerProbesWith(status: number): Probe {
	const signals: AbortSignal[] = [];
	const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
		if (init?.signal) {
			signals.push(init.signal);
		}
		return Promise.resolve(new Response(null, { status }));
	});
	vi.stubGlobal("fetch", fetchMock);
	return { fetch: fetchMock, signals };
}

beforeEach(() => {
	vi.useFakeTimers();
	resetCaseEventStreams();
	Source.all = [];
	vi.stubGlobal("EventSource", Source);
});

afterEach(() => {
	resetCaseEventStreams();
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe("a stream the server closed because access was removed", () => {
	it("moves to the final status, closes the source and never reconnects", async () => {
		const probe = answerProbesWith(200);
		const { result } = renderHook(() => useCaseEvents({ caseId: "A" }));
		act(() => source(0).open());

		act(() => source(0).serverEndsStream());
		await passTime(120_000);

		expect(result.current.status).toBe("access-removed");
		expect(result.current.isConnected).toBe(false);
		expect(source(0).closed).toBe(true);
		expect(Source.all).toHaveLength(1);
		expect(probe.fetch).not.toHaveBeenCalled();
	});

	it("tells every subscriber of the case", () => {
		const first = renderHook(() => useCaseEvents({ caseId: "A" }));
		const onStatusChange = vi.fn();
		const second = renderHook(() =>
			useCaseEvents({ caseId: "A", onStatusChange })
		);

		act(() => source(0).serverEndsStream());

		expect(first.result.current.status).toBe("access-removed");
		expect(second.result.current.status).toBe("access-removed");
		expect(onStatusChange).toHaveBeenLastCalledWith("access-removed");
	});

	it("is not reopened by the error the browser may raise as the connection ends", async () => {
		const { result } = renderHook(() => useCaseEvents({ caseId: "A" }));
		act(() => source(0).open());
		act(() => source(0).serverEndsStream());

		act(() => source(0).drop());
		await passTime(120_000);

		expect(result.current.status).toBe("access-removed");
		expect(Source.all).toHaveLength(1);
	});

	it("is not reopened by a new subscriber, who is told the final status", () => {
		renderHook(() => useCaseEvents({ caseId: "A" }));
		act(() => source(0).serverEndsStream());

		const later = renderHook(() => useCaseEvents({ caseId: "A" }));

		expect(Source.all).toHaveLength(1);
		expect(later.result.current.status).toBe("access-removed");
	});

	it("is opened again by a manual reconnect", () => {
		const { result } = renderHook(() => useCaseEvents({ caseId: "A" }));
		act(() => source(0).serverEndsStream());

		act(() => result.current.reconnect());

		expect(Source.all).toHaveLength(2);
		expect(source(1).closed).toBe(false);
		expect(result.current.status).toBe("connecting");
		act(() => source(1).open());
		expect(result.current.status).toBe("connected");
	});
});

describe("a stream the server closed because the session ended", () => {
	it("moves to the final status, closes the source and never reconnects", async () => {
		const probe = answerProbesWith(200);
		const { result } = renderHook(() => useCaseEvents({ caseId: "A" }));
		act(() => source(0).open());

		act(() => source(0).serverEndsStream("signed-out"));
		await passTime(120_000);

		expect(result.current.status).toBe("signed-out");
		expect(source(0).closed).toBe(true);
		expect(Source.all).toHaveLength(1);
		expect(probe.fetch).not.toHaveBeenCalled();
	});

	it("is not reopened by a new subscriber, but a manual reconnect opens it", () => {
		const first = renderHook(() => useCaseEvents({ caseId: "A" }));
		act(() => source(0).serverEndsStream("signed-out"));

		const later = renderHook(() => useCaseEvents({ caseId: "A" }));
		expect(Source.all).toHaveLength(1);
		expect(later.result.current.status).toBe("signed-out");

		act(() => first.result.current.reconnect());
		expect(Source.all).toHaveLength(2);
		expect(first.result.current.status).toBe("connecting");
	});

	it.each([
		["a reason it does not know", { reason: "something-new" }],
		["no reason", {}],
	])("treats a closing event with %s as access removed", (_name, data) => {
		const { result } = renderHook(() => useCaseEvents({ caseId: "A" }));

		act(() => source(0).emit(STREAM_CLOSED_EVENT, data));

		expect(result.current.status).toBe("access-removed");
	});
});

describe("a connection the browser refused", () => {
	it("moves to the signed-out status when the events URL answers 401, and does not reconnect", async () => {
		const probe = answerProbesWith(401);
		const { result } = renderHook(() => useCaseEvents({ caseId: "A" }));

		act(() => source(0).refuse());
		await settle();
		await passTime(120_000);

		expect(probe.fetch).toHaveBeenCalledTimes(1);
		expect(result.current.status).toBe("signed-out");
		expect(Source.all).toHaveLength(1);
	});

	it("moves to the final status when the events URL answers 404, and does not reconnect", async () => {
		const probe = answerProbesWith(404);
		const { result } = renderHook(() => useCaseEvents({ caseId: "A" }));

		act(() => source(0).refuse());
		await settle();
		await passTime(120_000);

		expect(probe.fetch).toHaveBeenCalledTimes(1);
		expect(probe.fetch.mock.calls[0]?.[0]).toBe("/api/cases/A/events");
		expect(result.current.status).toBe("access-removed");
		expect(Source.all).toHaveLength(1);
	});

	it("drops the stream the probe opened and reconnects as usual when the events URL answers 200", async () => {
		const probe = answerProbesWith(200);
		const { result } = renderHook(() => useCaseEvents({ caseId: "A" }));

		act(() => source(0).refuse());
		await settle();

		expect(probe.signals).toHaveLength(1);
		expect(probe.signals[0]?.aborted).toBe(true);
		expect(result.current.status).toBe("connecting");
		expect(Source.all).toHaveLength(1);

		await passTime(1000);
		expect(Source.all).toHaveLength(2);
		expect(probe.fetch).toHaveBeenCalledTimes(1);
	});

	it.each([
		403, 500,
	])("reconnects as usual when the events URL answers %i", async (status) => {
		answerProbesWith(status);
		const { result } = renderHook(() => useCaseEvents({ caseId: "A" }));

		act(() => source(0).refuse());
		await settle();

		expect(result.current.status).toBe("connecting");
		await passTime(1000);
		expect(Source.all).toHaveLength(2);
	});

	it("reconnects as usual when the probe gets no answer", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(() => Promise.reject(new TypeError("network error")))
		);
		const { result } = renderHook(() => useCaseEvents({ caseId: "A" }));

		act(() => source(0).refuse());
		await settle();

		expect(result.current.status).toBe("connecting");
		await passTime(1000);
		expect(Source.all).toHaveLength(2);
	});

	it("does not ask the events URL about a connection that dropped and is being retried", async () => {
		const probe = answerProbesWith(404);
		const { result } = renderHook(() => useCaseEvents({ caseId: "A" }));
		act(() => source(0).open());

		act(() => source(0).drop());
		await settle();

		expect(probe.fetch).not.toHaveBeenCalled();
		expect(result.current.status).toBe("connecting");
		await passTime(1000);
		expect(Source.all).toHaveLength(2);
	});

	it("opens nothing, and ignores the answer, when the last subscriber leaves while the probe is out", async () => {
		const answer = Promise.withResolvers<Response>();
		const signals: AbortSignal[] = [];
		vi.stubGlobal(
			"fetch",
			vi.fn((_url: string, init?: RequestInit) => {
				if (init?.signal) {
					signals.push(init.signal);
				}
				return answer.promise;
			})
		);
		const { unmount, result } = renderHook(() =>
			useCaseEvents({ caseId: "A" })
		);
		act(() => source(0).refuse());
		await settle();

		unmount();
		await passTime(0);
		answer.resolve(new Response(null, { status: 404 }));
		await settle();
		await passTime(120_000);

		expect(signals[0]?.aborted).toBe(true);
		expect(Source.all).toHaveLength(1);
		expect(result.current.status).toBe("connecting");
	});

	it("does not open a second source for a subscriber who joins while the probe is out", async () => {
		const answer = Promise.withResolvers<Response>();
		vi.stubGlobal(
			"fetch",
			vi.fn(() => answer.promise)
		);
		renderHook(() => useCaseEvents({ caseId: "A" }));
		act(() => source(0).refuse());
		await settle();

		const joiner = renderHook(() => useCaseEvents({ caseId: "A" }));
		expect(Source.all).toHaveLength(1);

		answer.resolve(new Response(null, { status: 404 }));
		await settle();
		expect(joiner.result.current.status).toBe("access-removed");
		expect(Source.all).toHaveLength(1);
	});
});
