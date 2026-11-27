import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { calculateDaysRemaining } from "@/lib/constants";

const NOW = new Date("2026-06-30T12:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

function deletedMsAgo(ms: number): Date {
	return new Date(NOW.getTime() - ms);
}

describe("calculateDaysRemaining", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it.each([
		["deleted just now", 0, 30],
		["one millisecond before a full day has passed", DAY_MS - 1, 30],
		["exactly one full day", DAY_MS, 29],
		["one day and a half", DAY_MS * 1.5, 29],
		["exactly two days", 2 * DAY_MS, 28],
		["one millisecond short of 29 days", 29 * DAY_MS - 1, 2],
		["exactly 29 days", 29 * DAY_MS, 1],
		["one millisecond before the retention period ends", 30 * DAY_MS - 1, 1],
		["the moment the retention period ends", 30 * DAY_MS, 0],
		["one millisecond after the retention period ends", 30 * DAY_MS + 1, 0],
		["one day after the retention period ends", 31 * DAY_MS, 0],
		["long after the retention period ends", 400 * DAY_MS, 0],
	])("%s", (_label, elapsedMs, expected) => {
		expect(calculateDaysRemaining(deletedMsAgo(elapsedMs))).toBe(expected);
	});

	it("counts days from the current clock, not from a fixed moment", () => {
		vi.setSystemTime(new Date(NOW.getTime() + 10 * DAY_MS));
		expect(calculateDaysRemaining(NOW)).toBe(20);
	});
});
