import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatFullDate, formatRelativeToNow, formatShortDate } from "../date";

const NO_DATE_FORMATTERS = [
	["formatShortDate", formatShortDate],
	["formatFullDate", formatFullDate],
	["formatRelativeToNow", formatRelativeToNow],
] as const;

describe.each(NO_DATE_FORMATTERS)("%s with no date", (_name, formatter) => {
	it("returns N/A for undefined and for null", () => {
		expect(formatter(undefined)).toBe("N/A");
		expect(formatter(null)).toBe("N/A");
	});

	it("returns the caller's fallback, which may be an empty string", () => {
		expect(formatter(undefined, "Never")).toBe("Never");
		expect(formatter(null, "Never")).toBe("Never");
		expect(formatter(null, "")).toBe("");
	});

	it("treats the epoch (timestamp 0) as a date, not as missing", () => {
		expect(formatter(0, "Never")).not.toBe("Never");
	});
});

describe("formatShortDate", () => {
	it("formats as day/month/year with two-digit day and month", () => {
		expect(formatShortDate(new Date(2026, 6, 4, 9, 30))).toBe("04/07/2026");
	});

	it.each([
		["just before midnight", "2026-03-14T23:59:59", "14/03/2026"],
		["midnight", "2026-03-15T00:00:00", "15/03/2026"],
		["the last day of a month", "2026-02-28T23:59:59", "28/02/2026"],
		["the first day of the next month", "2026-03-01T00:00:00", "01/03/2026"],
		["the last moment of a year", "2026-12-31T23:59:59", "31/12/2026"],
		["the first moment of the next year", "2027-01-01T00:00:00", "01/01/2027"],
	])("reads a local-time string at %s", (_label, input, expected) => {
		expect(formatShortDate(input)).toBe(expected);
	});

	it("reads a date-only string as a local date", () => {
		expect(formatShortDate("2026-12-31")).toBe("31/12/2026");
	});

	it("reads compact ISO text without separators", () => {
		expect(formatShortDate("20260314T120000")).toBe("14/03/2026");
	});

	it("accepts a Date built from local parts", () => {
		expect(formatShortDate(new Date(2026, 11, 31, 23, 30))).toBe("31/12/2026");
		expect(formatShortDate(new Date(2027, 0, 1, 0, 30))).toBe("01/01/2027");
	});

	it("accepts a numeric timestamp", () => {
		expect(formatShortDate(new Date(2026, 11, 31, 23, 59, 59).getTime())).toBe(
			"31/12/2026"
		);
		expect(formatShortDate(new Date(2027, 0, 1, 0, 0, 0).getTime())).toBe(
			"01/01/2027"
		);
	});
});

describe("formatFullDate", () => {
	it.each([
		[
			"the last minute of a year",
			"2026-12-31T23:59:00",
			"Thursday, 31 December 2026 at 11:59 PM",
		],
		[
			"midnight at the turn of a year",
			"2027-01-01T00:00:00",
			"Friday, 1 January 2027 at 12:00 AM",
		],
		["noon", "2026-07-04T12:00:00", "Saturday, 4 July 2026 at 12:00 PM"],
		[
			"the last minute before noon",
			"2026-07-04T11:59:00",
			"Saturday, 4 July 2026 at 11:59 AM",
		],
		[
			"the last day of February",
			"2026-02-28T23:59:00",
			"Saturday, 28 February 2026 at 11:59 PM",
		],
		[
			"the first day of March",
			"2026-03-01T00:00:00",
			"Sunday, 1 March 2026 at 12:00 AM",
		],
	])("writes the day, date and 12-hour time at %s", (_label, input, expected) => {
		expect(formatFullDate(input)).toBe(expected);
	});

	it("accepts a Date and a numeric timestamp", () => {
		const moment = new Date(2026, 6, 4, 14, 30);
		expect(formatFullDate(moment)).toBe("Saturday, 4 July 2026 at 2:30 PM");
		expect(formatFullDate(moment.getTime())).toBe(
			"Saturday, 4 July 2026 at 2:30 PM"
		);
	});

	it("reads compact ISO text without separators", () => {
		expect(formatFullDate("20260314T120000")).toBe(
			"Saturday, 14 March 2026 at 12:00 PM"
		);
	});

	it("reads a date-only string as a local date", () => {
		expect(formatFullDate("2026-12-31")).toBe(
			"Thursday, 31 December 2026 at 12:00 AM"
		);
	});
});

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

		it("reads compact ISO text without separators", () => {
			expect(formatRelativeToNow("20260704T090000Z")).toBe("about 3 hours ago");
		});

		it("formats a numeric timestamp relative to now", () => {
			const oneHourAgoMs = new Date("2026-07-04T11:00:00.000Z").getTime();
			expect(formatRelativeToNow(oneHourAgoMs)).toBe("about 1 hour ago");
		});

		it("formats a future date with the 'in' prefix, not 'ago'", () => {
			expect(formatRelativeToNow("2026-07-05T12:00:00.000Z")).toBe("in 1 day");
		});
	});

	describe("the string branch and the wording edges", () => {
		it("reads a date-only string as a local date", () => {
			// Local midnight on 3 July is 54 hours before the local clock below.
			vi.setSystemTime(new Date(2026, 6, 5, 6, 0));
			expect(formatRelativeToNow("2026-07-03")).toBe("2 days ago");
		});

		it.each([
			["29 seconds ago", "2026-07-04T11:59:31.000Z", "less than a minute ago"],
			["30 seconds ago", "2026-07-04T11:59:30.000Z", "1 minute ago"],
			["89 seconds ago", "2026-07-04T11:58:31.000Z", "1 minute ago"],
			["90 seconds ago", "2026-07-04T11:58:30.000Z", "2 minutes ago"],
			["44 minutes ago", "2026-07-04T11:16:00.000Z", "44 minutes ago"],
			["45 minutes ago", "2026-07-04T11:15:00.000Z", "about 1 hour ago"],
			["23 hours ago", "2026-07-03T13:00:00.000Z", "about 23 hours ago"],
			["24 hours ago", "2026-07-03T12:00:00.000Z", "1 day ago"],
		])("words %s", (_label, input, expected) => {
			expect(formatRelativeToNow(input)).toBe(expected);
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
