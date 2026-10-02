import { describe, expect, it } from "vitest";
import type { HealthCheck } from "@/lib/schemas/health-checks";
import {
	buildHealthCheckList,
	ITEM_CHECK_NAME,
} from "@/src/__tests__/fixtures/health-checks";
import { analyseDraft, draftFromStored } from "../criteria-draft";
import {
	compareBlocks,
	type MoveBlock,
	type MoveChoices,
	mergeVersionMove,
} from "../criteria-version-move";
import { INTEGRATION, storedCriteria } from "./criteria-test-data";

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
				params: { threshold: 0.9, avail_floor: 0.8, use_verdict: true },
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
});
