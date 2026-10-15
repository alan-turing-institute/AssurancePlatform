import { describe, expect, it } from "vitest";
import type { HealthCheck } from "@/lib/schemas/health-checks";
import { normaliseRecommendation } from "@/lib/schemas/health-checks";
import { servedFromStored } from "@/lib/schemas/health-criteria";
import { compareBlocks } from "../criteria-version-move";

const INTEGRATION_ID = "integration-1";

const entry = (
	version: string,
	recommended: Record<string, unknown>
): HealthCheck =>
	({
		name: "Panel Flatness Check",
		version,
		scope: "panel",
		scope_label: { one: "panel", many: "panels" },
		value: { type: "number", unit: "mm" },
		recommended,
	}) as unknown as HealthCheck;

const reading = {
	kind: "threshold",
	direction: "minimize",
	params: { pass_values: 0.5 },
};

const newFormRecommendation = (passValues: number) => ({
	rule: reading,
	reduction: {
		kind: "percentile",
		params: { percentile: 90 },
		rule: {
			kind: "threshold",
			direction: "maximize",
			params: { pass_values: 0.8 },
		},
	},
	aggregation: {
		kind: "proportion",
		params: { use_verdict: true },
		rule: {
			kind: "threshold",
			direction: "maximize",
			params: { pass_values: passValues },
		},
	},
	window: "PT5M",
	valid_for: "PT30M",
});

const olderRecommendation = () => ({
	rule: reading,
	reduction: {
		kind: "percentile",
		params: { p: 90 },
		rule: {
			kind: "threshold",
			direction: "maximize",
			params: { pass_values: 0.8 },
		},
	},
	aggregation: {
		kind: "proportion",
		params: { threshold: 0.95, use_verdict: true },
	},
	window: "PT5M",
	valid_for: "PT30M",
});

/** An accepted row as it was stored before the combining steps changed form. */
const storedOlderRow = () =>
	servedFromStored({
		settings: {
			check: { name: "Panel Flatness Check", version: "2.1", scope: "panel" },
			...olderRecommendation(),
		},
		ruleVersion: 4,
		reductionVersion: 2,
		aggregationVersion: 3,
		revision: 5,
		state: "ACCEPTED",
	});

const rowFor = (rows: ReturnType<typeof compareBlocks>, block: string) =>
	rows.find((row) => row.block === block);

describe("comparing a row stored in the older form with a newer version of its check", () => {
	const acceptedCheck = normaliseRecommendation(
		entry("2.1", olderRecommendation())
	);

	it("finds nothing to choose where the newer version recommends the same share and percentile", () => {
		const rows = compareBlocks({
			accepted: storedOlderRow(),
			acceptedCheck,
			entry: entry("2.2", newFormRecommendation(0.95)),
			integrationId: INTEGRATION_ID,
		});
		expect(rowFor(rows, "aggregation")?.kind).toBe("same");
		expect(rowFor(rows, "reduction")?.kind).toBe("same");
	});

	it("offers a choice, in plain words, where the newer version recommends another pass mark", () => {
		const rows = compareBlocks({
			accepted: storedOlderRow(),
			acceptedCheck,
			entry: entry("2.2", newFormRecommendation(0.9)),
			integrationId: INTEGRATION_ID,
		});
		const aggregation = rowFor(rows, "aggregation");
		expect(aggregation?.kind).toBe("pick");
		expect(aggregation?.yours.join(" ")).toContain("95%");
		expect(aggregation?.recommended.join(" ")).toContain("90%");
		expect(rowFor(rows, "reduction")?.kind).toBe("same");
	});

	it("finds nothing to choose where the newer version is itself still in the older form once converted", () => {
		const rows = compareBlocks({
			accepted: storedOlderRow(),
			acceptedCheck,
			entry: normaliseRecommendation(entry("2.2", olderRecommendation())),
			integrationId: INTEGRATION_ID,
		});
		expect(rowFor(rows, "aggregation")?.kind).toBe("same");
		expect(rowFor(rows, "reduction")?.kind).toBe("same");
	});
});
