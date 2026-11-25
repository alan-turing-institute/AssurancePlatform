import { describe, expect, it } from "vitest";
import { parseHealthEvidenceThinningQuery } from "../health-evidence-thinning";

const parse = (query: string) =>
	parseHealthEvidenceThinningQuery(new URLSearchParams(query));

describe("parseHealthEvidenceThinningQuery", () => {
	it("accepts no parameters and does the work", () => {
		const result = parse("");
		expect(result.success && result.data).toEqual({ dryRun: false });
	});

	it("reads dryRun the way the other cron routes do", () => {
		const result = parse("dryRun=true");
		expect(result.success && result.data.dryRun).toBe(true);
	});

	it("turns now into a date", () => {
		const result = parse("now=2026-01-01T00:00:00Z");
		expect(result.success && result.data.now).toEqual(
			new Date("2026-01-01T00:00:00.000Z")
		);
	});

	it("accepts a now with a time zone offset", () => {
		const result = parse("now=2026-01-01T01:00:00%2B01:00");
		expect(result.success && result.data.now?.toISOString()).toBe(
			"2026-01-01T00:00:00.000Z"
		);
	});

	it("refuses a now that is not a date-time, saying so", () => {
		const result = parse("now=yesterday");
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0]?.path).toEqual(["now"]);
			expect(result.error.issues[0]?.message).toBe(
				"must be an ISO 8601 date-time"
			);
		}
	});

	it.each([
		["a parameter it does not name", "other=1"],
		["a repeated now", "now=2026-01-01T00:00:00Z&now=2026-01-02T00:00:00Z"],
		["a misspelt dryRun", "dryrun=true"],
	])("refuses %s", (_label, query) => {
		expect(parse(query).success).toBe(false);
	});
});
