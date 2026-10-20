import { describe, expect, it } from "vitest";
import type { HealthCheck } from "@/lib/schemas/health-checks";
import { analyseDraft, draftFromCheck } from "../criteria-draft";

const checkWithRuleParams = (
	readingParams: Record<string, unknown>,
	combiningParams: Record<string, unknown>
): HealthCheck =>
	({
		name: "Panel Flatness Check",
		version: "2.1",
		scope: "panel",
		scope_label: { one: "panel", many: "panels" },
		value: { type: "number", unit: "mm" },
		recommended: {
			rule: {
				kind: "threshold",
				direction: "minimize",
				params: readingParams,
			},
			aggregation: {
				kind: "proportion",
				params: { avail_floor: 0.8, use_verdict: true },
				rule: {
					kind: "threshold",
					direction: "maximize",
					params: combiningParams,
				},
			},
			window: "PT5M",
			valid_for: "PT30M",
		},
	}) as unknown as HealthCheck;

describe("an unrelated parameter on a recommended rule", () => {
	const check = checkWithRuleParams(
		{ pass_values: 0.5, tolerance: 0.02 },
		{ pass_values: 0.95, tolerance: 0.01 }
	);
	const { complete } = analyseDraft(
		draftFromCheck(check, "integration-1"),
		check
	);

	it("is kept on the reading rule when the recommendation is accepted as it stands", () => {
		expect(complete?.rule.params).toEqual({
			pass_values: 0.5,
			tolerance: 0.02,
		});
	});

	it("is kept on the combining step's rule when the recommendation is accepted as it stands", () => {
		expect(complete?.aggregation?.rule?.params).toEqual({
			pass_values: 0.95,
			tolerance: 0.01,
		});
	});

	it("leaves the combining step equal to the recommended one", () => {
		expect(complete?.aggregation).toEqual(check.recommended?.aggregation);
	});
});
