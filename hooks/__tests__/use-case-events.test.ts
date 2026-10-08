import { act, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SSEEvent } from "@/lib/services/sse-connection-manager";
import {
	CASE_EVENT_TYPES,
	resetCaseEventStreams,
	useCaseEvents,
} from "../use-case-events";

/**
 * A fake `EventSource` — jsdom does not implement the real thing, and the
 * component-level tests (`health-badge.test.tsx`, `health-panel.test.tsx`)
 * mock `useCaseEvents` itself rather than exercising its SSE wiring. This is
 * the one test that actually drives `connect()`'s `addEventListener` calls,
 * so a regression here (a dropped event type, a broken JSON.parse) is the
 * only thing that would ever catch it (n-F1).
 */
class FakeEventSource {
	static readonly CONNECTING = 0;
	static readonly OPEN = 1;
	static readonly CLOSED = 2;
	static instances: FakeEventSource[] = [];

	readonly url: string;
	readyState = FakeEventSource.CONNECTING;
	onopen: (() => void) | null = null;
	onerror: (() => void) | null = null;
	closed = false;
	private readonly listeners = new Map<
		string,
		Set<(e: MessageEvent) => void>
	>();

	constructor(url: string) {
		this.url = url;
		FakeEventSource.instances.push(this);
	}

	addEventListener(type: string, listener: (e: MessageEvent) => void): void {
		if (!this.listeners.has(type)) {
			this.listeners.set(type, new Set());
		}
		this.listeners.get(type)?.add(listener);
	}

	removeEventListener(type: string, listener: (e: MessageEvent) => void): void {
		this.listeners.get(type)?.delete(listener);
	}

	close(): void {
		this.readyState = FakeEventSource.CLOSED;
		this.closed = true;
	}

	/** Test helper: fires every listener registered for `type` with `data` JSON-serialised, as the real EventSource would. */
	dispatch(type: string, data: unknown): void {
		const event = { data: JSON.stringify(data) } as MessageEvent;
		for (const listener of this.listeners.get(type) ?? []) {
			listener(event);
		}
	}

	hasListenerFor(type: string): boolean {
		return (this.listeners.get(type)?.size ?? 0) > 0;
	}
}

function stateChangedEvent(overrides: Partial<SSEEvent> = {}): SSEEvent {
	return {
		type: "tea.health/state-changed",
		caseId: "case-1",
		timestamp: new Date().toISOString(),
		payload: { claimId: "claim-1" },
		...overrides,
	} as SSEEvent;
}

let originalEventSource: typeof EventSource;

beforeEach(() => {
	resetCaseEventStreams();
	FakeEventSource.instances = [];
	originalEventSource = global.EventSource;
	global.EventSource = FakeEventSource as unknown as typeof EventSource;
});

afterEach(() => {
	global.EventSource = originalEventSource;
	vi.restoreAllMocks();
});

describe("useCaseEvents — SSE listener registration", () => {
	it("registers an addEventListener for every entry in CASE_EVENT_TYPES", () => {
		renderHook(() => useCaseEvents({ caseId: "case-1" }));

		const instance = FakeEventSource.instances.at(-1);
		expect(instance).toBeDefined();
		for (const eventType of CASE_EVENT_TYPES) {
			expect(instance?.hasListenerFor(eventType)).toBe(true);
		}
	});

	it("registers a listener for the health plugin's namespaced event type specifically", () => {
		renderHook(() => useCaseEvents({ caseId: "case-1" }));

		const instance = FakeEventSource.instances.at(-1);
		expect(instance?.hasListenerFor("tea.health/state-changed")).toBe(true);
	});
});

describe("useCaseEvents — event delivery", () => {
	it("delivers a dispatched tea.health/state-changed message to onEvent", () => {
		const onEvent = vi.fn();
		renderHook(() => useCaseEvents({ caseId: "case-1", onEvent }));
		const instance = FakeEventSource.instances.at(-1);
		const event = stateChangedEvent();

		act(() => {
			instance?.dispatch("tea.health/state-changed", event);
		});

		expect(onEvent).toHaveBeenCalledTimes(1);
		expect(onEvent).toHaveBeenCalledWith(event);
	});

	it("exposes the same event as lastEvent", () => {
		const { result } = renderHook(() => useCaseEvents({ caseId: "case-1" }));
		const instance = FakeEventSource.instances.at(-1);
		const event = stateChangedEvent({ payload: { claimId: "claim-42" } });

		act(() => {
			instance?.dispatch("tea.health/state-changed", event);
		});

		expect(result.current.lastEvent).toEqual(event);
	});
});

describe("useCaseEvents — one shared stream per case", () => {
	// The registry closes an unused stream on the next tick.
	const streamAt = (index: number): FakeEventSource => {
		const found = FakeEventSource.instances[index];
		if (!found) {
			throw new Error(`no EventSource at ${index}`);
		}
		return found;
	};
	const nextTick = () => act(() => new Promise((r) => setTimeout(r, 0)));

	it("opens exactly one EventSource for three hooks on one case", () => {
		for (let i = 0; i < 3; i++) {
			renderHook(() => useCaseEvents({ caseId: "shared-a" }));
		}
		expect(FakeEventSource.instances).toHaveLength(1);
	});

	it("keeps the stream open until the last subscriber unmounts", async () => {
		const [first, second, third] = [0, 1, 2].map(() =>
			renderHook(() => useCaseEvents({ caseId: "shared-b" }))
		);
		const instance = streamAt(0);

		first?.unmount();
		second?.unmount();
		await nextTick();
		expect(instance.closed).toBe(false);

		third?.unmount();
		await nextTick();
		expect(instance.closed).toBe(true);
	});

	it("opens one stream per case", () => {
		renderHook(() => useCaseEvents({ caseId: "shared-c" }));
		renderHook(() => useCaseEvents({ caseId: "shared-d" }));
		expect(FakeEventSource.instances.map((i) => i.url)).toEqual([
			"/api/cases/shared-c/events",
			"/api/cases/shared-d/events",
		]);
	});

	it("opens nothing when enabled is false", () => {
		const { result } = renderHook(() =>
			useCaseEvents({ caseId: "shared-e", enabled: false })
		);
		expect(FakeEventSource.instances).toHaveLength(0);
		expect(result.current.status).toBe("disconnected");
	});

	it("does not hold the stream open for a disabled subscriber", async () => {
		const active = renderHook(() => useCaseEvents({ caseId: "shared-f" }));
		renderHook(() => useCaseEvents({ caseId: "shared-f", enabled: false }));
		active.unmount();
		await nextTick();
		expect(streamAt(0).closed).toBe(true);
	});

	it("opens one stream under a StrictMode double mount", async () => {
		renderHook(() => useCaseEvents({ caseId: "shared-g" }), {
			wrapper: StrictMode,
		});
		await nextTick();
		expect(FakeEventSource.instances).toHaveLength(1);
		expect(streamAt(0).closed).toBe(false);
	});

	it("delivers one event to every subscriber", () => {
		const first = vi.fn();
		const second = vi.fn();
		renderHook(() => useCaseEvents({ caseId: "shared-h", onEvent: first }));
		renderHook(() => useCaseEvents({ caseId: "shared-h", onEvent: second }));
		const event = stateChangedEvent();
		act(() => {
			streamAt(0).dispatch("tea.health/state-changed", event);
		});
		expect(first).toHaveBeenCalledWith(event);
		expect(second).toHaveBeenCalledWith(event);
	});

	it("moves a subscriber to the new case's stream when caseId changes", async () => {
		const { rerender } = renderHook(({ caseId }) => useCaseEvents({ caseId }), {
			initialProps: { caseId: "shared-i" },
		});
		rerender({ caseId: "shared-j" });
		await nextTick();
		expect(FakeEventSource.instances).toHaveLength(2);
		expect(streamAt(0).closed).toBe(true);
		expect(streamAt(1).closed).toBe(false);
	});
});
