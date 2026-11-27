import { describe, expect, it } from "vitest";
import type { HealthCheck } from "@/lib/schemas/health-checks";
import {
	buildHealthCheckList,
	ITEM_CHECK_NAME,
	NUMERIC_CHECK_NAME,
	SYSTEM_CHECK_NAME,
} from "@/src/__tests__/fixtures/health-checks";
import { analyseDraft, draftFromStored } from "../criteria-draft";
import {
	compareBlocks,
	type MoveBlock,
	type MoveChoices,
	mergeVersionMove,
} from "../criteria-version-move";
import { INTEGRATION, storedCriteria } from "./criteria-test-data";

const NON_BLANK = /\S/;
const ACCEPTED_VIEW = storedCriteria({ checkName: ITEM_CHECK_NAME });
const ACCEPTED = ACCEPTED_VIEW.criteria;
const OLD_CHECK = ACCEPTED_VIEW.check_description as HealthCheck;

if (!ACCEPTED) {
	throw new Error("the demo settings are missing");
}

/** The item check at a new version with a different recommendation for three blocks. */
function newVersion(overrides: Partial<HealthCheck> = {}): HealthCheck {
	const base = buildHealthCheckList().checks.find(
		(check) => check.name === ITEM_CHECK_NAME
	) as HealthCheck;
	return {
		...base,
		version: "0.4",
		recommended: {
			...base.recommended,
			reduction: {
				kind: "mean",
				params: { avail_floor: 0.8 },
				rule: {
					kind: "threshold",
					direction: "maximize",
					params: { pass_values: 0.9, marginal_values: 0.6 },
				},
			},
			aggregation: {
				kind: "proportion",
				params: { avail_floor: 0.8, use_verdict: true },
				rule: {
					kind: "threshold",
					direction: "maximize",
					params: { pass_values: 0.9 },
				},
			},
			valid_for: "PT10M",
		},
		...overrides,
	};
}

function merge(entry: HealthCheck, choices: MoveChoices) {
	return mergeVersionMove({
		accepted: ACCEPTED as NonNullable<typeof ACCEPTED>,
		choices,
		entry,
		integrationId: INTEGRATION.id,
	});
}

function rows(entry: HealthCheck) {
	return compareBlocks({
		accepted: ACCEPTED as NonNullable<typeof ACCEPTED>,
		acceptedCheck: OLD_CHECK,
		entry,
		integrationId: INTEGRATION.id,
	});
}

type Accepted = NonNullable<typeof ACCEPTED>;
type ParamSpec = NonNullable<HealthCheck["params"]>[number];

function withParams(params: Record<string, unknown>): Accepted {
	const accepted = ACCEPTED as Accepted;
	return { ...accepted, check: { ...accepted.check, params } };
}

function mergeParams(params: Record<string, unknown>, specs: ParamSpec[]) {
	return mergeVersionMove({
		accepted: withParams(params),
		choices: {},
		entry: newVersion({ params: specs }),
		integrationId: INTEGRATION.id,
	});
}

function rowsFor(accepted: Accepted, entry: HealthCheck) {
	return compareBlocks({
		accepted,
		acceptedCheck: OLD_CHECK,
		entry,
		integrationId: INTEGRATION.id,
	});
}

function rowOf(entry: HealthCheck, block: MoveBlock) {
	return rows(entry).find((row) => row.block === block);
}

function kindOf(entry: HealthCheck, block: MoveBlock) {
	return rows(entry).find((row) => row.block === block)?.kind;
}

describe("mergeVersionMove", () => {
	it("keeps every block as accepted when nothing is taken", () => {
		const entry = newVersion();
		expect(merge(entry, {})).toEqual(
			draftFromStored(
				ACCEPTED as NonNullable<typeof ACCEPTED>,
				entry,
				INTEGRATION.id
			)
		);
	});

	it("takes the aggregation and leaves the rest", () => {
		const draft = merge(newVersion(), { aggregation: "take" });
		expect(draft.aggregation.threshold).toBe("90");
		expect(draft.validFor.amount).toBe("5");
		expect(draft.reduction.rule.pass).toBe("80");
	});

	it("takes the reduction block, with its own rule", () => {
		const draft = merge(newVersion(), { reduction: "take" });
		expect(draft.reduction.rule.pass).toBe("90");
		expect(draft.aggregation.threshold).toBe("95");
	});

	it("takes the timing the new version recommends and keeps the window it does not", () => {
		const entry = newVersion();
		const draft = merge(entry, { timing: "take" });
		expect(draft.validFor).toEqual({ amount: "10", unit: "minutes" });
		expect(draft.window).toEqual({ amount: "1", unit: "minutes" });
	});

	it("keeps a block when asked to keep it, even beside a block that is taken", () => {
		const draft = merge(newVersion(), {
			aggregation: "take",
			reduction: "keep",
		});
		expect(draft.aggregation.threshold).toBe("90");
		expect(draft.reduction.rule.pass).toBe("80");
	});

	it("keeps a block the new version recommends nothing for, even when told to take it", () => {
		const base = newVersion();
		const entry = newVersion({
			recommended: { ...base.recommended, reduction: undefined },
		});
		const draft = merge(entry, { reduction: "take" });
		expect(draft.reductionOn).toBe(true);
		expect(draft.reduction.rule.pass).toBe("80");
	});

	it("carries the new version into the settings it produces", () => {
		const entry = newVersion();
		const draft = merge(entry, { aggregation: "take" });
		expect(analyseDraft(draft, entry).complete?.check.version).toBe("0.4");
	});

	it("keeps a setting the new version no longer describes, so the shared checks report it", () => {
		const entry = newVersion({ params: [] });
		const draft = merge(entry, {});
		expect(draft.unlistedParams).toEqual({ camera_line: "ALL" });
		expect(analyseDraft(draft, entry).errors["check.params.camera_line"]).toBe(
			"is not a setting this check describes"
		);
	});

	it("carries a kept setting through as it is when the new version gives it another type, and shows its row", () => {
		const entry = newVersion({
			params: [{ key: "camera_line", label: "Camera line", type: "number" }],
		});
		const draft = merge(entry, {});
		expect(draft.unlistedParams).toEqual({ camera_line: "ALL" });
		expect(draft.params.camera_line?.text).toBe("");
		const analysis = analyseDraft(draft, entry);
		expect(analysis.settings.check?.params).toEqual({ camera_line: "ALL" });
		expect(analysis.errors["check.params.camera_line"]).toBeDefined();
		expect(rows(entry).map((row) => row.block)).toContain("check");
	});

	it("keeps a setting whose type is unchanged as an ordinary field", () => {
		const draft = merge(newVersion(), {});
		expect(draft.unlistedParams).toBeUndefined();
		expect(draft.params.camera_line?.text).toBe("ALL");
	});

	it("holds the combining steps for a check that became whole-system, and reports both", () => {
		const entry = newVersion({ scope: "environment", scope_label: undefined });
		const draft = merge(entry, {});
		expect(draft.reductionOn).toBe(true);
		const analysis = analyseDraft(draft, entry);
		expect(analysis.settings.reduction).toBeDefined();
		expect(analysis.settings.aggregation).toBeDefined();
		expect(analysis.errors.reduction).toContain("is not used by");
		expect(analysis.errors.aggregation).toContain("is not used by");
		expect(analysis.complete).toBeNull();
	});

	it("holds the reduction for a check that now returns text, and reports it", () => {
		const entry = newVersion({ value: { type: "string" } });
		const analysis = analyseDraft(merge(entry, {}), entry);
		expect(analysis.settings.reduction).toBeDefined();
		expect(analysis.errors.reduction).toContain("returns text");
	});

	it("reports a kept rule the new version cannot judge", () => {
		const entry = newVersion({ value: { type: "number", unit: "mm" } });
		const draft = merge(entry, {});
		expect(analyseDraft(draft, entry).errors["rule.kind"]).toBeDefined();
	});
});

describe("compareBlocks", () => {
	it("offers no choice for a block that is the same on both sides", () => {
		const entry = newVersion();
		expect(kindOf(entry, "rule")).toBe("same");
		expect(kindOf(entry, "check")).toBe("same");
	});

	it("offers a choice for each block that differs", () => {
		const entry = newVersion();
		expect(kindOf(entry, "reduction")).toBe("pick");
		expect(kindOf(entry, "aggregation")).toBe("pick");
		expect(kindOf(entry, "timing")).toBe("pick");
	});

	it("offers no choice when the new version recommends nothing for a block", () => {
		const base = newVersion();
		const entry = newVersion({
			recommended: { ...base.recommended, aggregation: undefined },
		});
		const row = rows(entry).find(
			(candidate) => candidate.block === "aggregation"
		);
		expect(row?.kind).toBe("none");
		expect(row?.recommended).toEqual([
			"The new version recommends nothing for this.",
		]);
	});

	it("leaves out a block neither side has", () => {
		const accepted = ACCEPTED as NonNullable<typeof ACCEPTED>;
		const entry = newVersion({
			params: [{ key: "camera_line", label: "Camera line", type: "string" }],
		});
		const blocks = compareBlocks({
			accepted: { ...accepted, check: { ...accepted.check, params: {} } },
			acceptedCheck: OLD_CHECK,
			entry,
			integrationId: INTEGRATION.id,
		}).map((row) => row.block);
		expect(blocks).not.toContain("check");
		expect(rows(entry).map((row) => row.block)).toContain("check");
	});

	it("words the combining rows in the check's own names for what a reading is about", () => {
		const labels = Object.fromEntries(
			rows(newVersion()).map((row) => [row.block, row.label])
		);
		expect(labels.reduction).toBe("Step 2: combining one item's readings");
		expect(labels.aggregation).toBe("Step 3: combining items");
	});

	it("describes each side of a block in plain words, for that block alone", () => {
		const aggregation = rows(newVersion()).find(
			(row) => row.block === "aggregation"
		);
		expect(aggregation?.yours).toEqual([
			"The claim passes when at least 95% of the items pass, and fails otherwise.",
			"If fewer than 80% of the items have an answer, the claim has no result.",
		]);
		expect(aggregation?.recommended[0]).toBe(
			"The claim passes when at least 90% of the items pass, and fails otherwise."
		);
	});

	it("gives every block its own non-empty heading", () => {
		const labels = rows(newVersion()).map((row) => row.label);
		expect(labels).toHaveLength(5);
		expect(new Set(labels).size).toBe(5);
		expect(labels.every((label) => label.trim() !== "")).toBe(true);
	});

	it("describes the check settings, the rule and the timing on each side", () => {
		const entry = newVersion();
		expect(rowOf(entry, "check")?.yours).toEqual([
			"The check runs with Camera line set to ALL.",
		]);
		expect(rowOf(entry, "check")?.recommended).toEqual([
			"The check runs with Camera line set to ALL.",
		]);
		expect(rowOf(entry, "rule")?.yours).toEqual([
			"A reading passes when the answer is yes and fails when the answer is no.",
		]);
		expect(rowOf(entry, "rule")?.recommended).toEqual(
			rowOf(entry, "rule")?.yours
		);
		expect(rowOf(entry, "timing")?.yours).toEqual([
			"Each result uses the readings in a 1-minute window.",
			"A result counts for 5 minutes.",
		]);
		expect(rowOf(entry, "timing")?.recommended).toEqual([
			"Each result uses the readings in a 1-minute window.",
			"A result counts for 10 minutes.",
		]);
	});

	it("describes the combining step with its rule and its readings needed on each side", () => {
		const reduction = rowOf(newVersion(), "reduction");
		expect(reduction?.yours).toHaveLength(2);
		expect(reduction?.yours[0]).toContain("at least 80%");
		expect(reduction?.yours[0]).toContain("1-minute window");
		expect(reduction?.yours[1]).toBe(
			"If fewer than 80% of an item's readings have an answer, that item has no answer."
		);
		expect(reduction?.recommended).toHaveLength(2);
		expect(reduction?.recommended[0]).toContain("at least 90%");
		expect(reduction?.recommended[0]).toContain("at least 60%");
		expect(reduction?.recommended[0]).toContain("1-minute window");
	});

	it("shows a stand-in line for the claim-level step of a whole-system check, which has none", () => {
		const system = buildHealthCheckList().checks.find(
			(check) => check.name === SYSTEM_CHECK_NAME
		) as HealthCheck;
		const stored = storedCriteria({ checkName: SYSTEM_CHECK_NAME });
		const row = compareBlocks({
			accepted: stored.criteria as Accepted,
			acceptedCheck: system,
			entry: system,
			integrationId: INTEGRATION.id,
		}).find((candidate) => candidate.block === "aggregation");
		expect(row?.kind).toBe("none");
		expect(row?.yours).toHaveLength(1);
		expect(row?.yours[0]).toMatch(NON_BLANK);
		expect(row?.yours).not.toStrictEqual(row?.recommended);
	});

	it("words a combining step that has no rule of its own with the check's rule, on each side", () => {
		const numeric = buildHealthCheckList().checks.find(
			(check) => check.name === NUMERIC_CHECK_NAME
		) as HealthCheck;
		const entry: HealthCheck = {
			...numeric,
			recommended: {
				...numeric.recommended,
				reduction: { kind: "mean", params: { avail_floor: 0.8 } },
			},
		};
		const stored = storedCriteria({ checkName: NUMERIC_CHECK_NAME });
		const accepted = {
			...(stored.criteria as Accepted),
			reduction: {
				kind: "mean" as const,
				params: { avail_floor: 0.8 },
				version: "d1",
			},
		};
		const reduction = compareBlocks({
			accepted,
			acceptedCheck: entry,
			entry,
			integrationId: INTEGRATION.id,
		}).find((row) => row.block === "reduction");
		expect(reduction?.yours[0]).toContain("at most 0.5 mm");
		expect(reduction?.recommended[0]).toContain("at most 0.5 mm");
	});

	it("offers no choice on the rule when the new version recommends no rule, though it recommends other blocks", () => {
		const base = newVersion();
		const entry = newVersion({
			recommended: { ...base.recommended, rule: undefined },
		});
		expect(rowOf(entry, "rule")?.kind).toBe("none");
		expect(rowOf(entry, "reduction")?.kind).toBe("pick");
	});

	it("shows a stand-in line for each block the accepted settings lack", () => {
		const { reduction: _r, aggregation: _a, ...rest } = withParams({});
		const entry = newVersion();
		const result = rowsFor(rest, entry);
		for (const block of ["check", "reduction", "aggregation"] as const) {
			const row = result.find((candidate) => candidate.block === block);
			expect(row?.yours).toHaveLength(1);
			expect(row?.yours[0]).toMatch(NON_BLANK);
			expect(row?.recommended).not.toContain(row?.yours[0]);
			expect(row?.kind).toBe("pick");
		}
	});

	it("still offers the check settings as a choice when the accepted ones include a setting the new version no longer lists", () => {
		const entry = newVersion({
			params: [
				{
					key: "camera_line",
					label: "Camera line",
					type: "string",
					default: "ALL",
				},
			],
		});
		const accepted = withParams({ camera_line: "ALL", retired: "x" });
		const row = rowsFor(accepted, entry).find(
			(candidate) => candidate.block === "check"
		);
		expect(row?.kind).toBe("pick");
	});

	it.each<[string, ParamSpec, unknown]>([
		["text", { key: "a", label: "A", type: "string" }, "x"],
		["a number", { key: "a", label: "A", type: "number" }, 3],
		["a duration", { key: "a", label: "A", type: "duration" }, "PT5M"],
		["a flag set to false", { key: "a", label: "A", type: "boolean" }, false],
		["a flag set to true", { key: "a", label: "A", type: "boolean" }, true],
	])("lists the check block when only %s is set among several settings", (_name, spec, value) => {
		const entry = newVersion({
			params: [spec, { key: "b", label: "B", type: "string" }],
		});
		const row = rowsFor(withParams({ a: value }), entry).find(
			(candidate) => candidate.block === "check"
		);
		expect(row?.kind).toBe("none");
	});

	it("leaves the check block out when none of several settings is set", () => {
		const entry = newVersion({
			params: [
				{ key: "a", label: "A", type: "string" },
				{ key: "b", label: "B", type: "number" },
				{ key: "c", label: "C", type: "boolean" },
			],
		});
		const blocks = rowsFor(withParams({}), entry).map((row) => row.block);
		expect(blocks).not.toContain("check");
	});
});

describe("mergeVersionMove with settings the new version describes differently", () => {
	const SPECS: Record<string, ParamSpec> = {
		boolean: { key: "k", label: "K", type: "boolean" },
		number: { key: "k", label: "K", type: "number" },
		duration: { key: "k", label: "K", type: "duration" },
		string: { key: "k", label: "K", type: "string" },
		enum: { key: "k", label: "K", type: "enum", options: ["standard"] },
	};

	it.each<[string, unknown]>([
		["boolean", true],
		["boolean", false],
		["number", 3],
		["duration", "PT5M"],
		["string", "x"],
		["enum", "standard"],
	])("keeps a %s setting holding %j as an ordinary field", (type, value) => {
		const draft = mergeParams({ k: value }, [SPECS[type] as ParamSpec]);
		expect(draft.unlistedParams).toBeUndefined();
	});

	it.each<[string, string | number | boolean]>([
		["boolean", "yes"],
		["boolean", 1],
		["number", "3"],
		["number", true],
		["duration", "banana"],
		["duration", 5],
		["duration", true],
		["string", 3],
		["string", false],
		["enum", true],
		["enum", 4],
	])("carries a %s setting holding %j through as it is", (type, value) => {
		const draft = mergeParams({ k: value }, [SPECS[type] as ParamSpec]);
		expect(draft.unlistedParams).toStrictEqual({ k: value });
	});

	it.each<[string, string | number | boolean]>([
		["text", "x"],
		["a number", 3],
		["a flag", true],
		["a false flag", false],
	])("carries %s through when the new version lists no such setting", (_name, value) => {
		const draft = mergeParams({ k: value }, []);
		expect(draft.unlistedParams).toStrictEqual({ k: value });
	});

	it.each<[string, unknown]>([
		["null", null],
		["a list", [1]],
		["an object", { a: 1 }],
	])("does not carry %s through as an unlisted setting", (_name, value) => {
		const draft = mergeParams({ k: value }, [SPECS.string as ParamSpec]);
		expect(draft.unlistedParams).toBeUndefined();
	});

	it("keeps the settings the new version still describes beside the ones it does not", () => {
		const draft = mergeParams({ camera_line: "ALL", gone: "x" }, [
			{ key: "camera_line", label: "Camera line", type: "string" },
		]);
		expect(draft.unlistedParams).toStrictEqual({ gone: "x" });
		expect(draft.params.camera_line?.text).toBe("ALL");
		expect(draft.params.gone).toBeUndefined();
		expect(draft.rule).toEqual(merge(newVersion(), {}).rule);
	});

	it("keeps the accepted check's name and version when it carries a setting the new version does not list", () => {
		const entry = newVersion({ params: [] });
		const draft = merge(entry, {});
		const settings = analyseDraft(draft, entry).settings;
		expect(settings.check?.name).toBe(ITEM_CHECK_NAME);
		expect(settings.check?.scope).toBe("item");
	});

	it("keeps the rule when told to take a rule the new version does not recommend", () => {
		const base = newVersion();
		const entry = newVersion({
			recommended: { ...base.recommended, rule: undefined },
		});
		expect(merge(entry, { rule: "take" }).rule).toEqual(merge(entry, {}).rule);
	});

	it("drops settings the new version no longer lists when the check block is taken", () => {
		const entry = newVersion({
			params: [
				{
					key: "camera_line",
					label: "Camera line",
					type: "string",
					default: "NEW",
				},
			],
		});
		const draft = mergeVersionMove({
			accepted: withParams({ camera_line: "ALL", gone: "x" }),
			choices: { check: "take" },
			entry,
			integrationId: INTEGRATION.id,
		});
		expect(draft.unlistedParams).toBeUndefined();
		expect(draft.params.camera_line?.text).toBe("NEW");
	});
});
