import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatRelativeToNow } from "../date";

describe("formatRelativeToNow", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-07-04T12:00:00.000Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("the date branch", () => {
		it("formats a Date object relative to now, with the default 'ago' suffix", () => {
			const threeDaysAgo = new Date("2026-07-01T12:00:00.000Z");
			expect(formatRelativeToNow(threeDaysAgo)).toBe("3 days ago");
		});

		it("formats an ISO string relative to now", () => {
			expect(formatRelativeToNow("2026-07-04T09:00:00.000Z")).toBe(
				"about 3 hours ago"
			);
		});

		it("formats a numeric timestamp relative to now", () => {
			const oneHourAgoMs = new Date("2026-07-04T11:00:00.000Z").getTime();
			expect(formatRelativeToNow(oneHourAgoMs)).toBe("about 1 hour ago");
		});

		it("formats a future date with the 'in' prefix, not 'ago'", () => {
			expect(formatRelativeToNow("2026-07-05T12:00:00.000Z")).toBe("in 1 day");
		});
	});

	describe("the null/undefined fallback branch", () => {
		it("returns the default 'N/A' fallback for undefined", () => {
			expect(formatRelativeToNow(undefined)).toBe("N/A");
		});

		it("returns the default 'N/A' fallback for null", () => {
			expect(formatRelativeToNow(null)).toBe("N/A");
		});

		it("returns a caller-supplied fallback instead of 'N/A' when given one", () => {
			expect(formatRelativeToNow(null, "Never")).toBe("Never");
			expect(formatRelativeToNow(undefined, "Never")).toBe("Never");
		});

		it("does not fall back for a defined date, even one that is falsy-adjacent (epoch 0)", () => {
			// Guards against a `!date` check standing in for the intended
			// `date === undefined || date === null` — epoch (timestamp 0) is a
			// valid date, not a missing one.
			expect(formatRelativeToNow(0)).not.toBe("N/A");
		});
	});
});
