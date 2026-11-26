import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRerenderAtExpiry } from "../use-rerender-at-expiry";

const NOW = new Date(2026, 9, 14, 10, 0, 0);
const MAX_TIMER_MS = 2_147_483_647;
const GRACE_MS = 50;

let renders: number;

function render(expiresAt: string | null) {
	return renderHook(
		({ at }: { at: string | null }) => {
			renders += 1;
			useRerenderAtExpiry(at);
		},
		{ initialProps: { at: expiresAt } }
	);
}

function inMs(ms: number): string {
	return new Date(NOW.getTime() + ms).toISOString();
}

async function advance(ms: number) {
	await act(async () => {
		await vi.advanceTimersByTimeAsync(ms);
	});
}

beforeEach(() => {
	renders = 0;
	vi.useFakeTimers();
	vi.setSystemTime(NOW);
});

afterEach(() => {
	vi.useRealTimers();
});

describe("re-rendering at expiry", () => {
	it("re-renders once the expiry has passed, a moment after it, and not before", async () => {
		render(inMs(10_000));
		const first = renders;

		await advance(10_000 + GRACE_MS - 1);
		expect(renders).toBe(first);

		await advance(1);
		expect(renders).toBe(first + 1);
		expect(vi.getTimerCount()).toBe(0);
	});

	it.each([
		["is null", null],
		["is already past", inMs(-1000)],
		["is this very moment", inMs(0)],
		["is not a date", "soon"],
	])("sets no timer when the expiry %s", async (_name, expiresAt) => {
		render(expiresAt);
		const first = renders;

		expect(vi.getTimerCount()).toBe(0);
		await advance(60_000);
		expect(renders).toBe(first);
	});

	it("clears its timer when the caller goes away", () => {
		const { unmount } = render(inMs(10_000));
		expect(vi.getTimerCount()).toBe(1);

		unmount();

		expect(vi.getTimerCount()).toBe(0);
	});

	it("waits for a new expiry, not the old one, when the expiry changes", async () => {
		const { rerender } = render(inMs(10_000));
		rerender({ at: inMs(60_000) });
		const first = renders;

		await advance(20_000);
		expect(renders).toBe(first);
		expect(vi.getTimerCount()).toBe(1);

		await advance(40_000 + GRACE_MS);
		expect(renders).toBeGreaterThan(first);
	});

	it("waits in steps when the expiry is further off than a timer can wait", async () => {
		const wait = MAX_TIMER_MS + 5000;
		render(inMs(wait));
		const first = renders;

		await advance(MAX_TIMER_MS);
		expect(renders).toBe(first + 1);
		expect(vi.getTimerCount()).toBe(1);

		await advance(5000 + GRACE_MS);
		expect(renders).toBe(first + 2);
		expect(vi.getTimerCount()).toBe(0);
	});
});
