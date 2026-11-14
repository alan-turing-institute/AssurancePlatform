import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	resetCaseEventStreams,
	subscribeToCaseEvents,
	useCaseEvents,
} from "../use-case-events";

/**
 * An EventSource whose error can be fired at any moment, including after
 * `close()`: a late error from a source that has been replaced is exactly
 * what some of these tests check is ignored.
 */
class Source {
	static all: Source[] = [];
	closeCalls = 0;
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
		this.closeCalls += 1;
	}

	get closed() {
		return this.closeCalls > 0;
	}

	open() {
		this.onopen?.();
	}

	fail() {
		this.onerror?.();
	}

	emit(type: string, data: unknown) {
		for (const listener of this.listeners.get(type) ?? []) {
			listener({ data: JSON.stringify(data) } as MessageEvent);
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
const event = (caseId: string, n = 1) => ({
	type: "comment:created",
	caseId,
	timestamp: "t",
	payload: { n },
});

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

describe("a fatal error while the last subscriber's close is pending", () => {
	it("closes the dead source and, when a subscriber rejoins in the same tick, opens a fresh one and reports it as connecting", () => {
		const statuses = vi.fn();
		const first = renderHook(() => useCaseEvents({ caseId: "A" }));
		const dead = source(0);
		act(() => dead.open());
		expect(first.result.current.status).toBe("connected");

		first.unmount();
		act(() => dead.fail());
		expect(dead.closeCalls).toBe(1);

		const rejoined = renderHook(() =>
			useCaseEvents({ caseId: "A", onStatusChange: statuses })
		);
		tick();

		expect(Source.all).toHaveLength(2);
		expect(live()).toEqual([source(1)]);
		expect(rejoined.result.current.status).toBe("connecting");
		expect(rejoined.result.current.isConnected).toBe(false);
		expect(statuses).toHaveBeenLastCalledWith("connecting");

		act(() => source(1).open());
		expect(rejoined.result.current.status).toBe("connected");
		expect(rejoined.result.current.isConnected).toBe(true);
		expect(statuses).toHaveBeenLastCalledWith("connected");
	});

	it("delivers events from the fresh source to the rejoined subscriber once, and none from the dead one", () => {
		const onEvent = vi.fn();
		const first = renderHook(() => useCaseEvents({ caseId: "A" }));
		const dead = source(0);
		first.unmount();
		act(() => dead.fail());
		renderHook(() => useCaseEvents({ caseId: "A", onEvent }));
		tick();

		act(() => source(1).emit("comment:created", event("A", 7)));

		expect(onEvent).toHaveBeenCalledTimes(1);
		expect(onEvent).toHaveBeenCalledWith(event("A", 7));
	});

	it("does the same for a listener registered outside React", () => {
		const earlier = vi.fn();
		const later = vi.fn();
		const stop = subscribeToCaseEvents("A", earlier);
		const dead = source(0);
		act(() => dead.open());
		stop();
		act(() => dead.fail());
		expect(dead.closed).toBe(true);

		const stopLater = subscribeToCaseEvents("A", later);

		expect(Source.all).toHaveLength(2);
		act(() => source(1).emit("comment:created", event("A")));
		expect(later).toHaveBeenCalledTimes(1);
		expect(earlier).not.toHaveBeenCalled();
		stopLater();
		tick();
		expect(live()).toHaveLength(0);
	});

	it("opens nothing, now or later, when nobody rejoins", () => {
		const only = renderHook(() =>
			useCaseEvents({ caseId: "A", reconnectDelay: 10 })
		);
		const dead = source(0);
		only.unmount();
		act(() => dead.fail());
		expect(dead.closeCalls).toBe(1);

		tick();
		act(() => vi.advanceTimersByTime(60_000));

		expect(Source.all).toHaveLength(1);
		expect(live()).toHaveLength(0);
	});

	it("leaves the stream free for a later subscriber, who opens a fresh source", () => {
		const only = renderHook(() => useCaseEvents({ caseId: "A" }));
		const dead = source(0);
		only.unmount();
		act(() => dead.fail());
		tick();

		const later = renderHook(() => useCaseEvents({ caseId: "A" }));

		expect(Source.all).toHaveLength(2);
		expect(live()).toEqual([source(1)]);
		act(() => source(1).open());
		expect(later.result.current.status).toBe("connected");
	});

	it("gives the rejoined subscriber the full reconnect allowance", () => {
		const first = renderHook(() =>
			useCaseEvents({
				caseId: "A",
				maxReconnectAttempts: 1,
				reconnectDelay: 10,
			})
		);
		const dead = source(0);
		first.unmount();
		act(() => dead.fail());
		const rejoined = renderHook(() =>
			useCaseEvents({
				caseId: "A",
				maxReconnectAttempts: 1,
				reconnectDelay: 10,
			})
		);
		tick();
		expect(Source.all).toHaveLength(2);

		act(() => source(1).fail());
		expect(rejoined.result.current.status).toBe("connecting");
		act(() => vi.advanceTimersByTime(10));
		expect(Source.all).toHaveLength(3);

		act(() => source(2).fail());
		expect(rejoined.result.current.status).toBe("error");
		act(() => vi.advanceTimersByTime(60_000));
		expect(Source.all).toHaveLength(3);
	});

	it("does not touch another case's open stream", () => {
		const a = renderHook(() => useCaseEvents({ caseId: "A" }));
		const b = renderHook(() => useCaseEvents({ caseId: "B" }));
		const sourceA = source(0);
		const sourceB = source(1);
		act(() => sourceB.open());

		a.unmount();
		act(() => sourceA.fail());
		tick();

		expect(sourceA.closeCalls).toBe(1);
		expect(sourceB.closed).toBe(false);
		expect(b.result.current.status).toBe("connected");
		expect(Source.all).toHaveLength(2);
	});

	it("closes the dead source once however many times it reports the error", () => {
		const only = renderHook(() => useCaseEvents({ caseId: "A" }));
		const dead = source(0);
		only.unmount();

		act(() => dead.fail());
		act(() => dead.fail());
		act(() => dead.fail());
		tick();

		expect(dead.closeCalls).toBe(1);
		expect(Source.all).toHaveLength(1);
	});

	it("still ignores a repeat of the error once the subscriber has rejoined on the fresh source", () => {
		const first = renderHook(() => useCaseEvents({ caseId: "A" }));
		const dead = source(0);
		first.unmount();
		act(() => dead.fail());
		const rejoined = renderHook(() =>
			useCaseEvents({ caseId: "A", reconnectDelay: 10 })
		);
		tick();
		act(() => source(1).open());

		act(() => dead.fail());
		act(() => vi.advanceTimersByTime(10_000));

		expect(source(1).closeCalls).toBe(0);
		expect(Source.all).toHaveLength(2);
		expect(rejoined.result.current.status).toBe("connected");
	});
});

describe("a fatal error with subscribers still present", () => {
	it("still closes the source and reconnects after the backoff delay", () => {
		const only = renderHook(() =>
			useCaseEvents({ caseId: "A", reconnectDelay: 10 })
		);
		act(() => source(0).open());

		act(() => source(0).fail());
		expect(source(0).closeCalls).toBe(1);
		expect(only.result.current.status).toBe("connecting");
		expect(Source.all).toHaveLength(1);

		act(() => vi.advanceTimersByTime(9));
		expect(Source.all).toHaveLength(1);
		act(() => vi.advanceTimersByTime(1));
		expect(Source.all).toHaveLength(2);
		act(() => source(1).open());
		expect(only.result.current.status).toBe("connected");
	});
});

describe("an error from a source that has been replaced", () => {
	it("is ignored after a manual reconnect: the new source stays open and nothing is scheduled", () => {
		const only = renderHook(() =>
			useCaseEvents({ caseId: "A", reconnectDelay: 10 })
		);
		const old = source(0);
		act(() => only.result.current.reconnect());
		const current = source(1);
		act(() => current.open());

		act(() => old.fail());
		act(() => vi.advanceTimersByTime(10_000));

		expect(current.closeCalls).toBe(0);
		expect(Source.all).toHaveLength(2);
		expect(only.result.current.status).toBe("connected");
	});

	it("is ignored after a backoff reconnect: no second timer is scheduled", () => {
		const only = renderHook(() =>
			useCaseEvents({ caseId: "A", reconnectDelay: 10 })
		);
		const old = source(0);
		act(() => old.fail());
		act(() => vi.advanceTimersByTime(10));
		const current = source(1);
		act(() => current.open());

		act(() => old.fail());
		act(() => vi.advanceTimersByTime(10_000));

		expect(current.closeCalls).toBe(0);
		expect(Source.all).toHaveLength(2);
		expect(only.result.current.status).toBe("connected");
	});

	it("is ignored after a disconnect", () => {
		const only = renderHook(() =>
			useCaseEvents({ caseId: "A", reconnectDelay: 10 })
		);
		const old = source(0);
		act(() => only.result.current.disconnect());

		act(() => old.fail());
		act(() => vi.advanceTimersByTime(10_000));

		expect(Source.all).toHaveLength(1);
		expect(only.result.current.status).toBe("disconnected");
	});

	it("is ignored when its stream was closed and a new stream for the case opened", () => {
		const first = renderHook(() =>
			useCaseEvents({ caseId: "A", reconnectDelay: 10 })
		);
		const old = source(0);
		first.unmount();
		tick();
		expect(old.closeCalls).toBe(1);

		const second = renderHook(() =>
			useCaseEvents({ caseId: "A", reconnectDelay: 10 })
		);
		const current = source(1);
		act(() => current.open());

		act(() => old.fail());
		act(() => vi.advanceTimersByTime(10_000));

		expect(current.closeCalls).toBe(0);
		expect(Source.all).toHaveLength(2);
		expect(second.result.current.status).toBe("connected");
	});
});

describe("a pending reconnect when the last subscriber leaves", () => {
	it("is cancelled when the stream closes: no new EventSource opens after the delay", () => {
		const only = renderHook(() =>
			useCaseEvents({ caseId: "A", reconnectDelay: 10 })
		);
		act(() => source(0).fail());
		expect(Source.all).toHaveLength(1);

		only.unmount();
		tick();
		act(() => vi.advanceTimersByTime(60_000));

		expect(Source.all).toHaveLength(1);
		expect(live()).toHaveLength(0);
	});

	it("is cancelled for every delay in the backoff, not only the first", () => {
		const only = renderHook(() =>
			useCaseEvents({ caseId: "A", reconnectDelay: 10 })
		);
		act(() => source(0).fail());
		act(() => vi.advanceTimersByTime(10));
		expect(Source.all).toHaveLength(2);
		act(() => source(1).fail());
		expect(Source.all).toHaveLength(2);

		only.unmount();
		tick();
		act(() => vi.advanceTimersByTime(60_000));

		expect(Source.all).toHaveLength(2);
		expect(live()).toHaveLength(0);
	});

	it("is cancelled by a disconnect, and a subscriber who joins afterwards opens a fresh source", () => {
		const first = renderHook(() =>
			useCaseEvents({ caseId: "A", reconnectDelay: 10 })
		);
		act(() => source(0).fail());
		act(() => first.result.current.disconnect());
		expect(first.result.current.status).toBe("disconnected");
		act(() => vi.advanceTimersByTime(60_000));
		expect(Source.all).toHaveLength(1);

		const later = renderHook(() =>
			useCaseEvents({ caseId: "A", reconnectDelay: 10 })
		);

		expect(Source.all).toHaveLength(2);
		act(() => source(1).open());
		expect(later.result.current.status).toBe("connected");
		expect(first.result.current.status).toBe("connected");
	});

	it("is cancelled by a disconnect, and a reconnect afterwards opens exactly one fresh source", () => {
		const only = renderHook(() =>
			useCaseEvents({ caseId: "A", reconnectDelay: 10 })
		);
		act(() => source(0).fail());
		act(() => only.result.current.disconnect());

		act(() => only.result.current.reconnect());
		act(() => vi.advanceTimersByTime(60_000));

		expect(Source.all).toHaveLength(2);
		expect(live()).toEqual([source(1)]);
	});

	it("survives a rejoin in the same tick: exactly one new source opens, after the delay", () => {
		const first = renderHook(() =>
			useCaseEvents({ caseId: "A", reconnectDelay: 10 })
		);
		act(() => source(0).fail());
		first.unmount();

		const rejoined = renderHook(() =>
			useCaseEvents({ caseId: "A", reconnectDelay: 10 })
		);
		tick();
		expect(Source.all).toHaveLength(1);

		act(() => vi.advanceTimersByTime(10));
		expect(Source.all).toHaveLength(2);
		act(() => source(1).open());
		act(() => vi.advanceTimersByTime(60_000));

		expect(Source.all).toHaveLength(2);
		expect(rejoined.result.current.status).toBe("connected");
	});

	it("does not open a source for a late subscriber when the earlier stream was cancelled", () => {
		const first = renderHook(() =>
			useCaseEvents({ caseId: "A", reconnectDelay: 10 })
		);
		act(() => source(0).fail());
		first.unmount();
		tick();

		const later = renderHook(() =>
			useCaseEvents({ caseId: "A", reconnectDelay: 10 })
		);

		expect(Source.all).toHaveLength(2);
		act(() => vi.advanceTimersByTime(60_000));
		expect(Source.all).toHaveLength(2);
		act(() => source(1).open());
		expect(later.result.current.status).toBe("connected");
	});
});
