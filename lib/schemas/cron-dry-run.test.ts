import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
	cronDryRunQuerySchema,
	describeQueryIssue,
	parseCronDryRunQuery,
	queryInputFromSearchParams,
} from "./cron-dry-run";

const params = (query: string) => new URLSearchParams(query);

describe("cronDryRunQuerySchema", () => {
	it("reads 1 and true as a trial run and 0, false and a missing value as a real run", () => {
		for (const [query, expected] of [
			["dryRun=1", true],
			["dryRun=true", true],
			["dryRun=0", false],
			["dryRun=false", false],
			["", false],
		] as const) {
			const parsed = parseCronDryRunQuery(params(query));
			expect(parsed.success, query).toBe(true);
			expect(parsed.data, query).toEqual({ dryRun: expected });
		}
	});

	it("refuses every other value, a repeated parameter and any other parameter", () => {
		for (const query of [
			"dryRun=yes",
			"dryRun=",
			"dryRun=TRUE",
			"dryRun=True",
			"dryRun=2",
			"dryRun=1&dryRun=1",
			"dryRun=0&dryRun=0",
			"now=2026-01-01T00:00:00Z",
			"dryRun=1&other=1",
			"other=1",
		]) {
			expect(parseCronDryRunQuery(params(query)).success, query).toBe(false);
		}
	});

	it("stays strict when a route extends it with a parameter of its own", () => {
		const extended = cronDryRunQuerySchema.extend({
			limit: z.string().optional(),
		});

		expect(extended.safeParse({ dryRun: "1", limit: "5" }).success).toBe(true);
		expect(extended.safeParse({ limit: "5" }).data).toEqual({
			dryRun: false,
			limit: "5",
		});
		expect(extended.safeParse({ dryRun: "1", stray: "x" }).success).toBe(false);
		expect(extended.safeParse({ dryRun: "yes", limit: "5" }).success).toBe(
			false
		);
	});

	it("does not take a trial run from a differently cased or spelt name", () => {
		for (const query of ["DryRun=1", "dryrun=1", "dry_run=1", "dryRun[]=1"]) {
			expect(parseCronDryRunQuery(params(query)).success, query).toBe(false);
		}
	});
});

describe("queryInputFromSearchParams", () => {
	it("gives a single value as text and a repeated one as a list in order", () => {
		expect(queryInputFromSearchParams(params("a=1&b=2&b=3&c=&b=4"))).toEqual({
			a: "1",
			b: ["2", "3", "4"],
			c: "",
		});
	});

	it("gives nothing for an empty query", () => {
		expect(queryInputFromSearchParams(params(""))).toEqual({});
	});
});

describe("describeQueryIssue", () => {
	it("names the parameter when the issue concerns one", () => {
		const parsed = parseCronDryRunQuery(params("dryRun=yes"));
		expect(parsed.success).toBe(false);
		if (parsed.success) {
			return;
		}
		expect(describeQueryIssue(parsed.error)).toBe(
			"dryRun must be one of 1, true, 0 or false"
		);
	});

	it("gives the issue's own message when it concerns the whole query", () => {
		const parsed = parseCronDryRunQuery(params("stray=1"));
		expect(parsed.success).toBe(false);
		if (parsed.success) {
			return;
		}
		expect(describeQueryIssue(parsed.error)).toBe('Unrecognized key: "stray"');
	});

	it("reports the first issue when there are several", () => {
		const parsed = parseCronDryRunQuery(params("dryRun=yes&stray=1"));
		expect(parsed.success).toBe(false);
		if (parsed.success) {
			return;
		}
		expect(describeQueryIssue(parsed.error)).toBe(
			"dryRun must be one of 1, true, 0 or false"
		);
	});
});
