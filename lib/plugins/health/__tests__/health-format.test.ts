import { describe, expect, it } from "vitest";
import {
	CAUSE_LABELS,
	describeDuration,
	describeLevels,
	describeLiveNode,
	describeThinnedRun,
	describeUncertainty,
	describeValue,
	formatDateTime,
	isInapplicable,
	isStatusStale,
	isWebAddress,
	LIVE_NODE_WORDS,
	liveNodeStateOf,
	VERDICT_LABELS,
	windowRange,
} from "../health-format";
import type { HealthThinnedRun } from "../health-types";
import { item, status } from "./health-test-data";

type Record1 = ReturnType<typeof item>["record"];
type Rule = Record1["rule"];
type Uncertainty = NonNullable<Record1["uncertainty"]>;

const DOT = "·";
const QUANTILES_START = /^quantiles /;
const ANY_DIGIT = /\d/;
const NAMED_SUBJECT = /^Live results for \S.*\. Health: passing$/;

/** An ISO text for a time built from local parts, so its local reading is known. */
function localIso(day: number, hour: number, minute: number): string {
	return new Date(2026, 9, day, hour, minute).toISOString();
}

function recordWith(overrides: Partial<Record1>): Record1 {
	return item({}, overrides).record;
}

function readingText(rule: Omit<Rule, "version">): string {
	const record = recordWith({
		rule: { ...rule, version: "v1" },
		reduction: undefined,
		aggregation: undefined,
	});
	return describeLevels(record)[0]?.text ?? "";
}

function uncertainty(overrides: Partial<Uncertainty>): Uncertainty {
	return {
		kind: "interval",
		params: { lower: 1, upper: 2 },
		method: "bootstrap",
		nature: "sampling",
		...overrides,
	};
}

function quantiles(q: unknown): string {
	return describeUncertainty(
		uncertainty({ kind: "quantiles", params: { q: q as never } })
	);
}

describe("label tables", () => {
	it.each([
		["verdict labels", VERDICT_LABELS, 4],
		["revocation cause labels", CAUSE_LABELS, 5],
		["live node words", LIVE_NODE_WORDS, 6],
	])("gives every key of the %s its own non-empty label", (_name, table, size) => {
		const labels = Object.values(table);
		expect(labels).toHaveLength(size);
		expect(labels.every((label) => label.length > 0)).toBe(true);
		expect(new Set(labels).size).toBe(size);
	});
});

describe("formatDateTime", () => {
	it("shows the date and the time of day in the viewer's zone", () => {
		const text = formatDateTime(localIso(14, 10, 5));
		expect(text).toContain("14 Oct 2026");
		expect(text).toContain("10:05");
	});

	it("returns text that is not a date unchanged", () => {
		expect(formatDateTime("not a date")).toBe("not a date");
	});
});

describe("describeThinnedRun", () => {
	function run(over: Partial<HealthThinnedRun>): HealthThinnedRun {
		return {
			first_removed_at: localIso(14, 10, 0),
			first_removed_sequence: 1,
			last_removed_at: localIso(14, 11, 0),
			last_removed_sequence: 5,
			removed_count: 1437,
			rule_version: 1,
			thinned_at: localIso(15, 1, 0),
			...over,
		};
	}

	it("gives the count with separators and a span within one day", () => {
		expect(describeThinnedRun(run({}))).toBe(
			"1,437 identical passing results from 10:00 to 11:00 on 14 Oct are not kept."
		);
	});

	it("names a single instant once, and a single result in the singular", () => {
		const text = describeThinnedRun(
			run({ removed_count: 1, last_removed_at: localIso(14, 10, 0) })
		);
		expect(text).toBe(
			"1 identical passing result at 10:00 on 14 Oct is not kept."
		);
	});

	it("names both days when the span crosses midnight", () => {
		const text = describeThinnedRun(
			run({ last_removed_at: localIso(15, 9, 30) })
		);
		expect(text).toBe(
			"1,437 identical passing results from 10:00 on 14 Oct to 09:30 on 15 Oct are not kept."
		);
	});

	it.each([
		["first", { first_removed_at: "garbage" }],
		["last", { last_removed_at: "garbage" }],
		["both", { first_removed_at: "x", last_removed_at: "y" }],
	])("leaves out the span when the %s time is not a date", (_n, over) => {
		expect(describeThinnedRun(run(over))).toBe(
			"1,437 identical passing results are not kept."
		);
	});
});

describe("describeDuration", () => {
	it.each([
		["PT1H", "1 hour"],
		["P1DT2H", "1 day 2 hours"],
		["P12W", "12 weeks"],
		["P2W", "2 weeks"],
		["P10D", "10 days"],
		["PT30S", "30 seconds"],
		["PT45S", "45 seconds"],
		["PT15M", "15 minutes"],
		["P1W2DT3H4M5S", "1 week 2 days 3 hours 4 minutes 5 seconds"],
	])("words %s as %s", (text, words) => {
		expect(describeDuration(text)).toBe(words);
	});

	it.each([
		"garbage",
		"xP1D",
		"P1Dxyz",
		"P",
		"PT",
		"P1DT",
	])("returns %s unchanged when it is not a duration", (text) => {
		expect(describeDuration(text)).toBe(text);
	});
});

describe("windowRange", () => {
	const end = "2026-10-14T12:00:00.000Z";

	it("runs from the timestamp minus the window up to the timestamp", () => {
		expect(windowRange(end, "PT1H")).toStrictEqual({
			start: "2026-10-14T11:00:00.000Z",
			end,
		});
		expect(windowRange(end, "P1W")).toStrictEqual({
			start: "2026-10-07T12:00:00.000Z",
			end,
		});
	});

	it.each([
		"garbage",
		"P",
		"PT",
		"P1DT",
		"xP1D",
		"P1Dxyz",
	])("has no range for the window %s", (window) => {
		expect(windowRange(end, window)).toBeNull();
	});

	it("has no range when the timestamp is not a date", () => {
		expect(windowRange("garbage", "PT1H")).toBeNull();
	});

	it("has no range when the window reaches before the earliest date", () => {
		expect(windowRange("-271821-04-20T00:00:00.000Z", "PT1S")).toBeNull();
	});
});

describe("describeValue", () => {
	it("has no text for a record without a value", () => {
		expect(describeValue(recordWith({ value: undefined }))).toBeNull();
	});

	it.each([
		[{ number: 0.97, unit: "ratio" }, "0.97 ratio"],
		[{ number: 3, unit: null }, "3"],
		[{ number: 4 }, "4"],
		["all clear", "all clear"],
		[true, "true"],
		[false, "false"],
	])("shows %j as %s", (value, text) => {
		expect(describeValue(recordWith({ value }))).toBe(text);
	});
});

describe("rule wording on each reading", () => {
	it("says an identity rule passes when true", () => {
		expect(readingText({ kind: "identity" })).toBe(
			`passes when true ${DOT} v1`
		);
	});

	it.each([
		["maximize", 0.8, "at least 0.8"],
		["minimize", 5, "at most 5"],
		["target", "high", "exactly high"],
	] as const)("words a %s threshold with %j", (direction, pass, text) => {
		const words = readingText({
			kind: "threshold",
			direction,
			params: { pass_values: pass },
		});
		expect(words).toBe(`${text} ${DOT} v1`);
	});

	it("adds the marginal limit of a threshold in brackets", () => {
		const words = readingText({
			kind: "threshold",
			direction: "minimize",
			params: { pass_values: 5, marginal_values: 8 },
		});
		expect(words).toBe(`at most 5 (marginal up to 8) ${DOT} v1`);
	});

	it.each([
		[
			"a threshold without a direction",
			{ kind: "threshold", params: { pass_values: 5 } },
		],
		[
			"a threshold without a pass value",
			{ kind: "threshold", direction: "maximize", params: {} },
		],
		["a band without a pass value", { kind: "band", params: {} }],
		[
			"a membership rule without a pass value",
			{ kind: "membership", params: {} },
		],
		[
			"an identity rule that carries a direction",
			{ kind: "identity", direction: "maximize", params: { pass_values: 5 } },
		],
	] as const)("passes when true for %s", (_n, rule) => {
		expect(readingText(rule as Omit<Rule, "version">)).toBe(
			`passes when true ${DOT} v1`
		);
	});

	it("words a band with its two limits and an optional marginal band", () => {
		expect(readingText({ kind: "band", params: { pass_values: [1, 5] } })).toBe(
			`between 1 and 5 ${DOT} v1`
		);
		expect(
			readingText({
				kind: "band",
				params: { pass_values: [1, 5], marginal_values: [0, 6] },
			})
		).toBe(`between 1 and 5 (marginal between 0 and 6) ${DOT} v1`);
	});

	it("words a band that carries a direction as a band", () => {
		expect(
			readingText({
				kind: "band",
				direction: "maximize",
				params: { pass_values: [1, 5] },
			})
		).toBe(`between 1 and 5 ${DOT} v1`);
	});

	it("words a membership rule as a list, with an optional marginal list", () => {
		expect(
			readingText({
				kind: "membership",
				params: { pass_values: ["a", "b"] },
			})
		).toBe(`one of a, b ${DOT} v1`);
		expect(
			readingText({
				kind: "membership",
				params: { pass_values: ["a", "b"], marginal_values: ["c", "d"] },
			})
		).toBe(`one of a, b (marginal: c, d) ${DOT} v1`);
		expect(
			readingText({ kind: "membership", params: { pass_values: "solo" } })
		).toBe(`one of solo ${DOT} v1`);
	});
});

describe("reduction and aggregation wording", () => {
	const rule = {
		kind: "identity",
		version: "v1",
	} as const;

	function levelsFor(overrides: Partial<Record1>): string[] {
		return describeLevels(recordWith(overrides)).map((level) => level.text);
	}

	it.each([
		["percentile", { percentile: 90 }, "percentile 90"],
		["percentile", { p: 75 }, "percentile 75"],
		["percentile", {}, "percentile"],
		["mean", { p: 95 }, "mean"],
		["max", { percentile: 90 }, "max"],
	])("words a %s reduction with %j as %s", (kind, params, text) => {
		const [, reduction] = levelsFor({
			reduction: { kind, params, rule, version: "d1" },
			aggregation: undefined,
		} as Partial<Record1>);
		expect(reduction).toBe(`${text}, passes when true ${DOT} d1`);
	});

	it("words a reduction without its own rule as judged by the reading rule", () => {
		const [, reduction] = levelsFor({
			reduction: { kind: "last", params: {}, version: "d1" },
			aggregation: undefined,
		} as Partial<Record1>);
		expect(reduction).toBe(`last, judged by the reading rule ${DOT} d1`);
	});

	it.each([
		[
			"percentile",
			{ percentile: 95 },
			"the 95th percentile, judged by the rule above",
		],
		["worst-of", {}, "the worst value, judged by the rule above"],
	])("words a %s aggregation", (kind, params, text) => {
		const [, aggregation] = levelsFor({
			reduction: undefined,
			aggregation: { kind, params, version: "a1" },
		} as Partial<Record1>);
		expect(aggregation).toBe(`${text} ${DOT} a1`);
	});

	it("names the scope in the level labels", () => {
		const labels = describeLevels(recordWith({})).map((level) => level.label);
		expect(labels).toStrictEqual([
			"Each reading",
			"Each sensor over the window",
			"Across all sensor subjects",
		]);
	});
});

describe("describeUncertainty", () => {
	const notes = "(method bootstrap, sampling uncertainty)";

	it("words an interval with its level, method, nature and validation", () => {
		expect(
			describeUncertainty(uncertainty({ level: 0.95, validated: true }))
		).toBe(
			"interval 1 to 2 (95% level, method bootstrap, sampling uncertainty, validated)"
		);
		expect(
			describeUncertainty(uncertainty({ level: 0.025, validated: false }))
		).toBe(
			"interval 1 to 2 (2.5% level, method bootstrap, sampling uncertainty, not validated)"
		);
	});

	it("leaves out the level and validation when absent", () => {
		expect(describeUncertainty(uncertainty({}))).toBe(
			`interval 1 to 2 ${notes}`
		);
	});

	it("words a standard deviation", () => {
		expect(
			describeUncertainty(uncertainty({ kind: "std", params: { std: 0.5 } }))
		).toBe(`± 0.5 (standard deviation) ${notes}`);
	});

	it("words a probability", () => {
		expect(
			describeUncertainty(
				uncertainty({ kind: "probability", params: { p: 0.9 } })
			)
		).toBe(`probability 0.9 ${notes}`);
	});

	it("writes a value that is not text as JSON", () => {
		expect(
			describeUncertainty(
				uncertainty({ kind: "probability", params: { p: { a: 1 } } })
			)
		).toBe(`probability {"a":1} ${notes}`);
	});

	it.each([
		[{ "0.05": 1 }, "quantiles 5%: 1"],
		[{ "0.025": 1 }, "quantiles 2.5%: 1"],
		[{ "1": 5 }, "quantiles 100%: 5"],
		[{ "2": 5 }, "quantiles 2: 5"],
		[{ median: 3 }, "quantiles median: 3"],
		[{ "-Infinity": 3 }, "quantiles -Infinity: 3"],
		[{ "0.05": 1, "0.95": 2 }, "quantiles 5%: 1, 95%: 2"],
	])("words the quantiles %j", (q, text) => {
		expect(quantiles(q)).toBe(`${text} ${notes}`);
	});

	it.each([
		["a list", [10, 20]],
		["null", null],
		["text", "10"],
		["missing", undefined],
	])("shows no quantile entries when q is %s", (_n, q) => {
		const text = quantiles(q);
		expect(text).toMatch(QUANTILES_START);
		expect(text).not.toMatch(ANY_DIGIT);
		expect(text.split(" (")[0]?.trim()).toBe("quantiles");
	});
});

describe("isInapplicable", () => {
	function indeterminate(comment: string | undefined): boolean {
		return isInapplicable(recordWith({ verdict: "indeterminate", comment }));
	}

	it.each([
		["Inapplicable: no data", true],
		["   inapplicable", true],
		["INAPPLICABLE", true],
		["not inapplicable", false],
		["xinapplicable", false],
		["fine", false],
		[undefined, false],
	])("reads the indeterminate comment %j as %s", (comment, expected) => {
		expect(indeterminate(comment)).toBe(expected);
	});

	it("is false for a verdict that is not indeterminate", () => {
		expect(
			isInapplicable(recordWith({ verdict: "pass", comment: "inapplicable" }))
		).toBe(false);
	});
});

describe("isWebAddress", () => {
	it.each([
		["http://example.org", true],
		["https://example.org", true],
		["ftp://example.org", false],
		["see http://example.org", false],
		["example.org/http://", false],
		["", false],
	])("reads %j as %s", (text, expected) => {
		expect(isWebAddress(text)).toBe(expected);
	});
});

describe("isStatusStale", () => {
	const now = Date.parse("2026-10-14T12:00:00.000Z");

	it.each([
		["the server says stale", { stale: true, expires_at: null }, true],
		["there is no expiry", { stale: false, expires_at: null }, false],
		[
			"the expiry is ahead",
			{ stale: false, expires_at: "2026-10-14T12:00:00.001Z" },
			false,
		],
		[
			"the expiry is this moment",
			{ stale: false, expires_at: "2026-10-14T12:00:00.000Z" },
			true,
		],
		[
			"the expiry has passed",
			{ stale: false, expires_at: "2026-10-14T11:59:59.999Z" },
			true,
		],
	])("is judged for the case where %s", (_n, over, expected) => {
		expect(isStatusStale(status(over), now)).toBe(expected);
	});
});

describe("liveNodeStateOf", () => {
	const now = Date.parse("2026-10-14T12:00:00.000Z");

	it("is none and not stale without a status", () => {
		expect(liveNodeStateOf(null, now)).toStrictEqual({
			kind: "none",
			stale: false,
		});
	});

	it("is withdrawn and stale when every result was withdrawn", () => {
		const state = liveNodeStateOf(
			status({ verdict: null, stale: true, stale_reason: "all-revoked" }),
			now
		);
		expect(state).toStrictEqual({ kind: "withdrawn", stale: true });
	});

	it("is none and not stale when there is no verdict and no withdrawal", () => {
		const state = liveNodeStateOf(
			status({ verdict: null, stale: true, stale_reason: "expired" }),
			now
		);
		expect(state).toStrictEqual({ kind: "none", stale: false });
	});

	it("carries the verdict and judges staleness at the given time", () => {
		const over = {
			verdict: "fail",
			expires_at: "2026-10-14T12:30:00.000Z",
		} as const;
		expect(liveNodeStateOf(status(over), now)).toStrictEqual({
			kind: "fail",
			stale: false,
		});
		expect(liveNodeStateOf(status(over), now + 3_600_000)).toStrictEqual({
			kind: "fail",
			stale: true,
		});
	});
});

describe("describeLiveNode", () => {
	const passing = status({ verdict: "pass" });
	const state = { kind: "pass", stale: false } as const;

	it("names the claim and then its health", () => {
		expect(describeLiveNode(passing, state, "P1")).toBe(
			"Live results for P1. Health: passing"
		);
	});

	it.each([
		null,
		"",
	])("still names a subject when the claim name is %j", (name) => {
		expect(describeLiveNode(passing, state, name)).toMatch(NAMED_SUBJECT);
	});

	it("says there is no result yet for a node without one", () => {
		const none = { kind: "none", stale: false } as const;
		expect(describeLiveNode(null, none, "P1")).toBe(
			"Live results for P1. Health: no result yet"
		);
		expect(describeLiveNode(passing, none, "P1")).toBe(
			"Live results for P1. Health: no result yet"
		);
	});
});
