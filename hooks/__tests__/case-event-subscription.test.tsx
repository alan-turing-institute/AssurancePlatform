import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	CASE_RELOAD_EVENT_TYPES,
	resetCaseEventStreams,
	subscribeToCaseEvents,
	useCaseEvents,
} from "../use-case-events";

class Source {
	static all: Source[] = [];
	closed = false;
	onerror: (() => void) | null = null;
	onopen: (() => void) | null = null;
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
		this.closed = true;
	}

	hears(type: string) {
		return (this.listeners.get(type) ?? []).length > 0;
	}

	emit(type: string) {
		const body = { type, caseId: "A", payload: { n: 1 }, timestamp: "now" };
		for (const listener of this.listeners.get(type) ?? []) {
			listener({ data: JSON.stringify(body) } as MessageEvent);
		}
	}
}

const open = () => Source.all.filter((source) => !source.closed);
const tick = () => act(() => vi.advanceTimersByTime(0));

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

describe("the events after which the canvas reads the case again", () => {
	it("are the twelve element, case, comment and permission events, and not a health state change", () => {
		expect([...CASE_RELOAD_EVENT_TYPES].sort()).toEqual(
			[
				"case:updated",
				"comment:created",
				"comment:deleted",
				"comment:updated",
				"element:attached",
				"element:created",
				"element:deleted",
				"element:detached",
				"element:moved",
				"element:restored",
				"element:updated",
				"permission:changed",
			].sort()
		);
		expect(CASE_RELOAD_EVENT_TYPES).not.toContain("tea.health/state-changed");
	});
});

describe("listening to a case's events from outside React", () => {
	it("hears every kind of case event, including a health state change", () => {
		const heard: string[] = [];
		subscribeToCaseEvents("A", (event) => heard.push(event.type));
		const source = open()[0];

		for (const type of [
			...CASE_RELOAD_EVENT_TYPES,
			"tea.health/state-changed",
		]) {
			expect(source?.hears(type)).toBe(true);
			act(() => source?.emit(type));
		}

		expect(heard).toEqual([
			...CASE_RELOAD_EVENT_TYPES,
			"tea.health/state-changed",
		]);
	});

	it("shares one stream with the components that use the hook", () => {
		const heard: string[] = [];
		const hook = renderHook(() => useCaseEvents({ caseId: "A" }));
		subscribeToCaseEvents("A", (event) => heard.push(event.type));

		expect(Source.all).toHaveLength(1);
		act(() => open()[0]?.emit("element:moved"));
		expect(heard).toEqual(["element:moved"]);
		expect(hook.result.current.lastEvent?.type).toBe("element:moved");
	});

	it("keeps a stream open for the components that use the hook after a listener from outside leaves", () => {
		const stop = subscribeToCaseEvents("A", () => undefined);
		const hook = renderHook(() => useCaseEvents({ caseId: "A" }));

		stop();
		tick();

		expect(open()).toHaveLength(1);
		hook.unmount();
		tick();
		expect(open()).toHaveLength(0);
	});

	it("keeps a stream open for a listener from outside after every component has left", () => {
		const heard: string[] = [];
		const hook = renderHook(() => useCaseEvents({ caseId: "A" }));
		const stop = subscribeToCaseEvents("A", (event) => heard.push(event.type));

		hook.unmount();
		tick();
		expect(open()).toHaveLength(1);
		act(() => open()[0]?.emit("tea.health/state-changed"));
		expect(heard).toEqual(["tea.health/state-changed"]);

		stop();
		tick();
		expect(open()).toHaveLength(0);
	});

	it("closes the stream when the last listener leaves, and stopping twice is harmless", () => {
		const first = subscribeToCaseEvents("A", () => undefined);
		const second = subscribeToCaseEvents("A", () => undefined);

		first();
		first();
		tick();
		expect(open()).toHaveLength(1);

		second();
		tick();
		expect(open()).toHaveLength(0);
	});

	it("hears nothing after it has stopped", () => {
		const heard: string[] = [];
		const keep = subscribeToCaseEvents("A", () => undefined);
		const stop = subscribeToCaseEvents("A", (event) => heard.push(event.type));
		const source = open()[0];

		stop();
		act(() => source?.emit("element:created"));

		expect(heard).toEqual([]);
		keep();
	});

	it("opens a stream of its own for each case", () => {
		subscribeToCaseEvents("A", () => undefined);
		subscribeToCaseEvents("B", () => undefined);

		expect(Source.all.map((source) => source.url).sort()).toEqual([
			"/api/cases/A/events",
			"/api/cases/B/events",
		]);
	});

	it("opens a new stream when a listener comes back after the last had left", () => {
		const stop = subscribeToCaseEvents("A", () => undefined);
		stop();
		tick();
		expect(open()).toHaveLength(0);

		subscribeToCaseEvents("A", () => undefined);

		expect(open()).toHaveLength(1);
		expect(Source.all).toHaveLength(2);
	});
});
