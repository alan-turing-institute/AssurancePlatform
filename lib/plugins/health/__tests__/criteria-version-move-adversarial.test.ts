import { describe, expect, it } from "vitest";
import type { HealthCheck } from "@/lib/schemas/health-checks";
import type { HealthCriteriaSettings } from "@/lib/schemas/health-criteria";
import {
	NUMBER_CHECK,
	served,
} from "@/src/__tests__/fixtures/health-criteria-probe-data";
import { analyseDraft } from "../criteria-draft";
import {
	compareBlocks,
	type MoveChoices,
	mergeVersionMove,
} from "../criteria-version-move";

const INTEGRATION_ID = "integration-1";

const LINE_PARAM = {
	key: "line",
	label: "Line name",
	type: "string",
	default: "SOUTH",
} as const;

const ACCEPTED_CHECK: HealthCheck = {
	...NUMBER_CHECK,
	version: "1.0",
	params: [{ key: "line", label: "Line name", type: "string" }],
};

const ACCEPTED: HealthCriteriaSettings = {
	check: {
		name: NUMBER_CHECK.name,
		version: "1.0",
		scope: "widget",
		params: { line: "NORTH" },
	},
	rule: {
		kind: "threshold",
		direction: "maximize",
		params: { pass_values: 8, marginal_values: 5 },
	},
	reduction: { kind: "median", params: { avail_floor: 0.8 } },
	aggregation: {
		kind: "proportion",
		params: { threshold: 0.95, avail_floor: 0.8, use_verdict: true },
	},
	window: "PT1M",
	valid_for: "PT5M",
};

const NEW_RECOMMENDED = {
	rule: {
		kind: "threshold",
		direction: "minimize",
		params: { pass_values: 3, marginal_values: 6 },
	},
	reduction: { kind: "max", params: { avail_floor: 0.9 } },
	aggregation: {
		kind: "proportion",
		params: { threshold: 0.99, avail_floor: 0.9, use_verdict: true },
	},
	window: "PT2M",
	valid_for: "PT10M",
} as const satisfies NonNullable<HealthCheck["recommended"]>;

const NEW_ENTRY: HealthCheck = {
	...NUMBER_CHECK,
	version: "2.0",
	params: [LINE_PARAM],
	recommended: NEW_RECOMMENDED,
};

function deepFreeze<T>(value: T): T {
	if (typeof value === "object" && value !== null) {
		for (const child of Object.values(value)) {
			deepFreeze(child);
		}
		Object.freeze(value);
	}
	return value;
}

function move(
	choices: MoveChoices,
	entry: HealthCheck = NEW_ENTRY,
	accepted: HealthCriteriaSettings = ACCEPTED
) {
	const draft = mergeVersionMove({
		accepted: served(accepted),
		choices,
		entry,
		integrationId: INTEGRATION_ID,
	});
	return analyseDraft(draft, entry);
}

const ON_NEW_VERSION: HealthCriteriaSettings = {
	...ACCEPTED,
	check: { ...ACCEPTED.check, version: "2.0" },
};

describe("merging a move to a new version", () => {
	it("keeps every block when nothing is chosen, on the new version", () => {
		const analysis = move({});
		expect(analysis.errors).toEqual({});
		expect(analysis.complete).toEqual(ON_NEW_VERSION);
	});

	it("keeps every block when each is explicitly kept", () => {
		const analysis = move({
			check: "keep",
			rule: "keep",
			reduction: "keep",
			aggregation: "keep",
			timing: "keep",
		});
		expect(analysis.complete).toEqual(ON_NEW_VERSION);
	});

	it.each<[string, MoveChoices, Partial<HealthCriteriaSettings>]>([
		[
			"the check's own settings",
			{ check: "take" },
			{ check: { ...ON_NEW_VERSION.check, params: { line: "SOUTH" } } },
		],
		["the rule", { rule: "take" }, { rule: NEW_RECOMMENDED.rule }],
		[
			"the combining step",
			{ reduction: "take" },
			{ reduction: NEW_RECOMMENDED.reduction },
		],
		[
			"the claim-level step",
			{ aggregation: "take" },
			{ aggregation: NEW_RECOMMENDED.aggregation },
		],
		["the timing", { timing: "take" }, { window: "PT2M", valid_for: "PT10M" }],
	])("takes only %s when only that is chosen", (_name, choices, replaced) => {
		const analysis = move(choices);
		expect(analysis.errors).toEqual({});
		expect(analysis.complete).toEqual({ ...ON_NEW_VERSION, ...replaced });
	});

	it("takes every block when every block is chosen", () => {
		const analysis = move({
			check: "take",
			rule: "take",
			reduction: "take",
			aggregation: "take",
			timing: "take",
		});
		expect(analysis.errors).toEqual({});
		expect(analysis.complete).toEqual({
			...ON_NEW_VERSION,
			check: { ...ON_NEW_VERSION.check, params: { line: "SOUTH" } },
			...NEW_RECOMMENDED,
		});
	});

	it("always carries the new version's name, version and scope in the result", () => {
		for (const choices of [
			{},
			{ rule: "take" },
			{ timing: "take" },
		] as MoveChoices[]) {
			const settings = move(choices).settings;
			expect(settings.check?.version).toBe("2.0");
			expect(settings.check?.name).toBe(NUMBER_CHECK.name);
			expect(settings.check?.scope).toBe("widget");
		}
	});

	it("does not change its inputs", () => {
		const accepted = served(ACCEPTED);
		const entry = NEW_ENTRY;
		const choices: MoveChoices = { rule: "take", timing: "take" };
		deepFreeze(accepted);
		deepFreeze(structuredClone(entry));
		Object.freeze(choices);
		const before = JSON.stringify([accepted, entry, choices]);
		mergeVersionMove({
			accepted,
			choices,
			entry: deepFreeze(structuredClone(entry)),
			integrationId: INTEGRATION_ID,
		});
		expect(JSON.stringify([accepted, entry, choices])).toBe(before);
	});
});

describe("a block absent on one side", () => {
	it("keeps the combining step when the new version recommends none, even if it is taken", () => {
		const { reduction: _dropped, ...withoutReduction } = NEW_RECOMMENDED;
		const entry: HealthCheck = { ...NEW_ENTRY, recommended: withoutReduction };
		const analysis = move({ reduction: "take" }, entry);
		expect(analysis.errors).toEqual({});
		expect(analysis.complete?.reduction).toEqual(ACCEPTED.reduction);
	});

	it("adds the new version's combining step when the accepted settings have none and it is taken", () => {
		const { reduction: _dropped, ...withoutReduction } = ACCEPTED;
		const taken = move({ reduction: "take" }, NEW_ENTRY, withoutReduction);
		expect(taken.complete?.reduction).toEqual(NEW_RECOMMENDED.reduction);
		const kept = move({}, NEW_ENTRY, withoutReduction);
		expect(kept.complete).not.toHaveProperty("reduction");
	});

	it("takes only the window when the new version gives only a window", () => {
		const entry: HealthCheck = {
			...NEW_ENTRY,
			recommended: { window: "PT2M" },
		};
		const analysis = move({ timing: "take" }, entry);
		expect(analysis.complete?.window).toBe("PT2M");
		expect(analysis.complete?.valid_for).toBe("PT5M");
	});

	it("takes only how long a result counts when the new version gives only that, including no time limit", () => {
		const entry: HealthCheck = {
			...NEW_ENTRY,
			recommended: { valid_for: "indefinite" },
		};
		const analysis = move({ timing: "take" }, entry);
		expect(analysis.complete?.valid_for).toBe("indefinite");
		expect(analysis.complete?.window).toBe("PT1M");
	});

	it("changes nothing when the new version recommends nothing, whatever is chosen", () => {
		const entry: HealthCheck = {
			...NEW_ENTRY,
			recommended: undefined,
			params: [{ key: "line", label: "Line name", type: "string" }],
		};
		const analysis = move(
			{
				check: "take",
				rule: "take",
				reduction: "take",
				aggregation: "take",
				timing: "take",
			},
			entry
		);
		expect(analysis.errors).toEqual({});
		expect(analysis.complete).toEqual(ON_NEW_VERSION);
	});

	it("keeps a setting the new version no longer describes and reports it beside its field", () => {
		const entry: HealthCheck = { ...NEW_ENTRY, params: undefined };
		const draft = mergeVersionMove({
			accepted: served(ACCEPTED),
			choices: { check: "take" },
			entry,
			integrationId: INTEGRATION_ID,
		});
		expect(draft.unlistedParams).toEqual({ line: "NORTH" });
		const analysis = analyseDraft(draft, entry);
		expect(analysis.complete).toBeNull();
		expect(analysis.errors["check.params.line"]).toBeTruthy();
		expect(analysis.settings.check?.params).toEqual({ line: "NORTH" });
	});
});

describe("rows of the comparison", () => {
	const rowsFor = (entry: HealthCheck, accepted = ACCEPTED) =>
		compareBlocks({
			accepted: served(accepted),
			acceptedCheck: ACCEPTED_CHECK,
			entry,
			integrationId: INTEGRATION_ID,
		});
	const kinds = (rows: ReturnType<typeof rowsFor>) =>
		Object.fromEntries(rows.map((row) => [row.block, row.kind]));

	it("offers a choice for every block that differs, in the order of the form", () => {
		const rows = rowsFor(NEW_ENTRY);
		expect(rows.map((row) => row.block)).toEqual([
			"check",
			"rule",
			"reduction",
			"aggregation",
			"timing",
		]);
		expect(kinds(rows)).toEqual({
			check: "pick",
			rule: "pick",
			reduction: "pick",
			aggregation: "pick",
			timing: "pick",
		});
	});

	it("says in plain words what each side holds, with the direction of each limit", () => {
		const rule = rowsFor(NEW_ENTRY).find((row) => row.block === "rule");
		expect(rule?.yours.join(" ")).toContain("at least 8 mm");
		expect(rule?.recommended.join(" ")).toContain("at most 3 mm");
		expect(rule?.recommended.join(" ")).not.toContain("at least");
	});

	it("offers no choice for a block where the recommendation is the same as the accepted settings", () => {
		const entry: HealthCheck = {
			...NEW_ENTRY,
			recommended: {
				...NEW_RECOMMENDED,
				rule: ACCEPTED.rule,
				aggregation: ACCEPTED.aggregation,
				window: ACCEPTED.window,
				valid_for: ACCEPTED.valid_for,
			},
			params: [{ ...LINE_PARAM, default: "NORTH" }],
		};
		const result = kinds(rowsFor(entry));
		expect(result.rule).toBe("same");
		expect(result.aggregation).toBe("same");
		expect(result.timing).toBe("same");
		expect(result.check).toBe("same");
		expect(result.reduction).toBe("pick");
	});

	it("offers no choice for a block the new version recommends nothing for, and omits a block neither side has", () => {
		const { reduction: _r, ...withoutReduction } = NEW_RECOMMENDED;
		const { reduction: _a, ...acceptedWithout } = ACCEPTED;
		const entry: HealthCheck = { ...NEW_ENTRY, recommended: withoutReduction };
		expect(kinds(rowsFor(entry)).reduction).toBe("none");
		const rows = rowsFor(entry, acceptedWithout);
		expect(rows.map((row) => row.block)).not.toContain("reduction");
	});

	it("offers no choice anywhere when the new version recommends nothing", () => {
		const rows = rowsFor({
			...NEW_ENTRY,
			recommended: undefined,
			params: undefined,
		});
		for (const row of rows) {
			expect(row.kind).toBe("none");
		}
	});
});
