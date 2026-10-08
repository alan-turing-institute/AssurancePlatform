import { act, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetCaseEventStreams, useCaseEvents } from "../use-case-events";

class Src {
	static readonly CONNECTING = 0;
	static readonly OPEN = 1;
	static readonly CLOSED = 2;
	static all: Src[] = [];
	readyState = 0;
	onopen: (() => void) | null = null;
	onerror: (() => void) | null = null;
	closed = false;
	readonly url: string;
	private readonly ls = new Map<string, ((e: MessageEvent) => void)[]>();
	constructor(url: string) {
		this.url = url;
		Src.all.push(this);
	}
	addEventListener(t: string, l: (e: MessageEvent) => void) {
		this.ls.set(t, [...(this.ls.get(t) ?? []), l]);
	}
	close() {
		this.closed = true;
		this.readyState = 2;
	}
	open() {
		this.readyState = 1;
		this.onopen?.();
	}
	fail() {
		this.onerror?.();
	}
	emit(t: string, data: unknown) {
		for (const l of this.ls.get(t) ?? []) {
			l({ data: JSON.stringify(data) } as MessageEvent);
		}
	}
}
const live = () => Src.all.filter((s) => !s.closed);
const src = (i: number): Src => {
	const s = Src.all[i];
	if (!s) {
		throw new Error(`no EventSource at index ${i}`);
	}
	return s;
};
const liveFirst = (): Src => {
	const s = live()[0];
	if (!s) {
		throw new Error("no live EventSource");
	}
	return s;
};
const tick = () => act(() => vi.advanceTimersByTime(0));
const ev = (caseId: string, n = 1) => ({
	type: "comment:created",
	caseId,
	timestamp: "t",
	payload: { n },
});

beforeEach(() => {
	vi.useFakeTimers();
	resetCaseEventStreams();
	Src.all = [];
	vi.stubGlobal("EventSource", Src);
});
afterEach(() => {
	resetCaseEventStreams();
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe("useCaseEvents sharing", () => {
	it("five subscribers for one case open exactly one stream", () => {
		for (let i = 0; i < 5; i++) {
			renderHook(() => useCaseEvents({ caseId: "A" }));
		}
		expect(Src.all).toHaveLength(1);
	});

	it("closes the stream only after the last subscriber unmounts", () => {
		const a = renderHook(() => useCaseEvents({ caseId: "A" }));
		const b = renderHook(() => useCaseEvents({ caseId: "A" }));
		a.unmount();
		tick();
		expect(live()).toHaveLength(1);
		b.unmount();
		tick();
		expect(live()).toHaveLength(0);
	});

	it("enabled:false opens no stream and releases one when switched off", () => {
		const off = renderHook(() =>
			useCaseEvents({ caseId: "A", enabled: false })
		);
		expect(Src.all).toHaveLength(0);
		expect(off.result.current.status).toBe("disconnected");
		const on = renderHook(
			({ enabled }) => useCaseEvents({ caseId: "A", enabled }),
			{ initialProps: { enabled: true } }
		);
		expect(live()).toHaveLength(1);
		on.rerender({ enabled: false });
		tick();
		expect(live()).toHaveLength(0);
	});

	it("delivers each event exactly once to every subscriber of its case, and none from another case", () => {
		const h1 = vi.fn();
		const h2 = vi.fn();
		const hB = vi.fn();
		renderHook(() => useCaseEvents({ caseId: "A", onEvent: h1 }));
		renderHook(() => useCaseEvents({ caseId: "A", onEvent: h2 }));
		renderHook(() => useCaseEvents({ caseId: "B", onEvent: hB }));
		expect(Src.all).toHaveLength(2);
		const srcA = Src.all.find((s) => s.url.includes("/A/"));
		expect(srcA).toBeDefined();
		act(() => srcA?.emit("comment:created", ev("A")));
		expect(h1).toHaveBeenCalledTimes(1);
		expect(h2).toHaveBeenCalledTimes(1);
		expect(hB).not.toHaveBeenCalled();
	});

	it("keeps the same source when a subscriber leaves and another joins in the same tick", () => {
		const a = renderHook(() => useCaseEvents({ caseId: "A" }));
		const first = src(0);
		a.unmount();
		renderHook(() => useCaseEvents({ caseId: "A" }));
		tick();
		expect(Src.all).toHaveLength(1);
		expect(first.closed).toBe(false);
	});

	it("a pending close does not fire after a new subscriber arrives later in the tick", () => {
		const a = renderHook(() => useCaseEvents({ caseId: "A" }));
		a.unmount();
		const b = renderHook(() => useCaseEvents({ caseId: "A" }));
		tick();
		tick();
		expect(live()).toHaveLength(1);
		b.unmount();
		tick();
		expect(live()).toHaveLength(0);
	});

	it("StrictMode double mount opens one live stream", () => {
		renderHook(() => useCaseEvents({ caseId: "A" }), { wrapper: StrictMode });
		tick();
		expect(live()).toHaveLength(1);
	});

	it("moves to the new case's stream when caseId changes and closes the old one if last", () => {
		const h = renderHook(({ id }) => useCaseEvents({ caseId: id }), {
			initialProps: { id: "A" },
		});
		h.rerender({ id: "B" });
		tick();
		expect(live()).toHaveLength(1);
		expect(liveFirst().url).toContain("/B/");
	});

	it("leaves a shared old stream open when only one of its subscribers changes case", () => {
		renderHook(() => useCaseEvents({ caseId: "A" }));
		const h = renderHook(({ id }) => useCaseEvents({ caseId: id }), {
			initialProps: { id: "A" },
		});
		h.rerender({ id: "B" });
		tick();
		expect(live()).toHaveLength(2);
	});

	it("reports the current status to a late subscriber", () => {
		renderHook(() => useCaseEvents({ caseId: "A" }));
		act(() => src(0).open());
		const late = vi.fn();
		const l = renderHook(() =>
			useCaseEvents({ caseId: "A", onStatusChange: late })
		);
		expect(late).toHaveBeenCalledWith("connected");
		expect(l.result.current.status).toBe("connected");
		expect(Src.all).toHaveLength(1);
	});

	it("a subscriber unmounting while connecting leaves the others connected", () => {
		const a = renderHook(() => useCaseEvents({ caseId: "A" }));
		const b = renderHook(() => useCaseEvents({ caseId: "A" }));
		a.unmount();
		tick();
		act(() => src(0).open());
		expect(b.result.current.status).toBe("connected");
	});

	it("reconnects once per case, not once per subscriber, and stops at the cap", () => {
		for (let i = 0; i < 3; i++) {
			renderHook(() =>
				useCaseEvents({
					caseId: "A",
					maxReconnectAttempts: 2,
					reconnectDelay: 10,
				})
			);
		}
		act(() => src(0).fail());
		act(() => vi.advanceTimersByTime(10));
		expect(Src.all).toHaveLength(2);
		act(() => src(1).fail());
		act(() => vi.advanceTimersByTime(20));
		expect(Src.all).toHaveLength(3);
		act(() => src(2).fail());
		act(() => vi.advanceTimersByTime(10_000));
		expect(Src.all).toHaveLength(3);
	});

	it("reports error to every subscriber once attempts are exhausted", () => {
		const r = [1, 2].map(() =>
			renderHook(() => useCaseEvents({ caseId: "A", maxReconnectAttempts: 0 }))
		);
		act(() => src(0).fail());
		for (const h of r) {
			expect(h.result.current.status).toBe("error");
		}
	});

	it("an error in the same tick as the last unmount opens nothing new", () => {
		const a = renderHook(() =>
			useCaseEvents({ caseId: "A", reconnectDelay: 10 })
		);
		const srcA0 = src(0);
		a.unmount();
		act(() => srcA0.fail());
		act(() => vi.advanceTimersByTime(10_000));
		expect(live()).toHaveLength(0);
	});

	it("an error on a source that was already closed and removed opens nothing new", () => {
		const a = renderHook(() =>
			useCaseEvents({ caseId: "A", reconnectDelay: 10 })
		);
		const old = src(0);
		a.unmount();
		tick();
		expect(live()).toHaveLength(0);
		act(() => old.fail());
		act(() => vi.advanceTimersByTime(10_000));
		expect(Src.all).toHaveLength(1);
	});

	it("a successful open restores the full reconnect allowance", () => {
		renderHook(() =>
			useCaseEvents({
				caseId: "A",
				maxReconnectAttempts: 1,
				reconnectDelay: 10,
			})
		);
		act(() => src(0).fail());
		act(() => vi.advanceTimersByTime(10));
		act(() => src(1).open());
		act(() => src(1).fail());
		act(() => vi.advanceTimersByTime(10));
		expect(Src.all).toHaveLength(3);
	});

	it("disconnect from one subscriber closes the shared stream for all", () => {
		const a = renderHook(() => useCaseEvents({ caseId: "A" }));
		const b = renderHook(() => useCaseEvents({ caseId: "A" }));
		act(() => a.result.current.disconnect());
		expect(live()).toHaveLength(0);
		expect(b.result.current.status).toBe("disconnected");
	});

	it("after reconnect from one subscriber every subscriber still receives events", () => {
		const h1 = vi.fn();
		const h2 = vi.fn();
		const a = renderHook(() => useCaseEvents({ caseId: "A", onEvent: h1 }));
		renderHook(() => useCaseEvents({ caseId: "A", onEvent: h2 }));
		act(() => a.result.current.reconnect());
		expect(live()).toHaveLength(1);
		act(() => liveFirst().emit("comment:created", ev("A")));
		expect(h1).toHaveBeenCalledTimes(1);
		expect(h2).toHaveBeenCalledTimes(1);
	});
});
