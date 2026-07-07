import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SSEEvent } from "@/lib/services/sse-connection-manager";
import { CASE_EVENT_TYPES, useCaseEvents } from "../use-case-events";

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
