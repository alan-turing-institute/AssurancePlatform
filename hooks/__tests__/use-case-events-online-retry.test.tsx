import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STREAM_CLOSED_EVENT } from "@/lib/sse-stream-closed";
import { resetCaseEventStreams, useCaseEvents } from "../use-case-events";

/** An EventSource whose open, error and closing event can be fired by hand. */
class Source {
	static all: Source[] = [];
	closeCalls = 0;
	onopen: (() => void) | null = null;
	onerror: (() => void) | null = null;
	readyState = 0;
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

const ATTEMPTS = 2;
const DELAY = 10;
const settings = (caseId: string) => ({
	caseId,
	maxReconnectAttempts: ATTEMPTS,
	reconnectDelay: DELAY,
});

/** Fails the current source until the hook gives up, leaving status "error". */
function failUntilGivenUp() {
	for (let i = 0; i <= ATTEMPTS; i++) {
		act(() => Source.all.at(-1)?.fail());
		act(() => vi.advanceTimersByTime(60_000));
	}
}

const goOnline = () => act(() => window.dispatchEvent(new Event("online")));

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

describe("the browser coming back online after live updates gave up", () => {
	it("opens exactly one new source, reports connecting, then connected", () => {
		const hook = renderHook(() => useCaseEvents(settings("A")));
		failUntilGivenUp();
		expect(hook.result.current.status).toBe("error");
		const before = Source.all.length;

		goOnline();

		expect(Source.all).toHaveLength(before + 1);
		expect(hook.result.current.status).toBe("connecting");
		act(() => Source.all.at(-1)?.open());
		expect(hook.result.current.status).toBe("connected");
	});

	it("opens nothing while connected", () => {
		renderHook(() => useCaseEvents(settings("A")));
		act(() => Source.all[0]?.open());

		goOnline();

		expect(Source.all).toHaveLength(1);
	});

	it("opens nothing while connecting or waiting on a backoff timer", () => {
		const hook = renderHook(() => useCaseEvents(settings("A")));
		goOnline();
		expect(Source.all).toHaveLength(1);

		act(() => Source.all[0]?.fail());
		expect(hook.result.current.status).toBe("connecting");
		goOnline();
		expect(Source.all).toHaveLength(1);
	});

	it("opens nothing once access was removed or the session ended", () => {
		for (const reason of ["access-removed", "signed-out"]) {
			resetCaseEventStreams();
			Source.all = [];
			const hook = renderHook(() => useCaseEvents(settings("A")));
			act(() => Source.all[0]?.emit(STREAM_CLOSED_EVENT, { reason }));
			expect(hook.result.current.status).toBe(reason);

			goOnline();

			expect(Source.all).toHaveLength(1);
			hook.unmount();
		}
	});

	it("reopens each case that gave up, once", () => {
		renderHook(() => useCaseEvents(settings("A")));
		renderHook(() => useCaseEvents(settings("B")));
		for (let i = 0; i <= ATTEMPTS; i++) {
			for (const source of Source.all.filter((s) => s.closeCalls === 0)) {
				act(() => source.fail());
			}
			act(() => vi.advanceTimersByTime(60_000));
		}
		const before = Source.all.length;

		goOnline();

		const added = Source.all.slice(before);
		expect(added.map((s) => s.url).sort()).toEqual([
			"/api/cases/A/events",
			"/api/cases/B/events",
		]);
	});

	it("opens nothing after the last subscriber has left", () => {
		const hook = renderHook(() => useCaseEvents(settings("A")));
		failUntilGivenUp();
		const before = Source.all.length;
		hook.unmount();
		act(() => vi.advanceTimersByTime(0));

		goOnline();

		expect(Source.all).toHaveLength(before);
	});
});
