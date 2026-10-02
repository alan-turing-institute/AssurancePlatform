/**
 * A check list for an automated visual-inspection pipeline, with invented,
 * domain-neutral names: one yes-or-no check per item, one numeric check per
 * item, and one whole-system check. Every recommendation passes as evidence
 * settings. The development seed publishes the same list for the
 * `darter-pipeline` integration, so the settings form has checks to offer on
 * a local or staging build.
 */

export const HEALTH_CHECK_PIPELINE = "Inspection pipeline (demo)";

/** The yes-or-no check, judged once per item. */
export const ITEM_CHECK_NAME = "Surface Finish Check";
/** The numeric check, judged once per item. */
export const NUMERIC_CHECK_NAME = "Edge Alignment Measure";
/** The whole-system check, with no subjects to combine. */
export const SYSTEM_CHECK_NAME = "Line Throughput Monitor";

const ITEMS = { one: "item", many: "items" };

export function buildHealthCheckList() {
	return {
		pipeline: HEALTH_CHECK_PIPELINE,
		checks: [
			{
				name: ITEM_CHECK_NAME,
				version: "0.3",
				description: "Is the surface of the item free of visible marks?",
				scope: "item",
				scope_label: ITEMS,
				value: { type: "boolean" },
				params: [
					{
						key: "camera_line",
						label: "Camera line",
						type: "string",
						default: "ALL",
					},
				],
				recommended: {
					rule: { kind: "identity" },
					reduction: {
						kind: "mean",
						params: { avail_floor: 0.8 },
						rule: {
							kind: "threshold",
							direction: "maximize",
							params: { pass_values: 0.8, marginal_values: 0.5 },
						},
					},
					aggregation: {
						kind: "proportion",
						params: { threshold: 0.95, avail_floor: 0.8, use_verdict: true },
					},
					window: "PT1M",
					valid_for: "PT5M",
				},
			},
			{
				name: NUMERIC_CHECK_NAME,
				version: "1.1",
				description:
					"How far the edge of the item sits from its expected position.",
				scope: "item",
				scope_label: ITEMS,
				value: { type: "number", unit: "mm" },
				params: [
					{
						key: "tolerance_profile",
						label: "Tolerance profile",
						type: "enum",
						options: ["standard", "strict"],
						default: "standard",
					},
				],
				recommended: {
					rule: {
						kind: "threshold",
						direction: "minimize",
						params: { pass_values: 0.5, marginal_values: 1 },
					},
					aggregation: {
						kind: "proportion",
						params: { threshold: 0.9, avail_floor: 0.8, use_verdict: true },
					},
					window: "PT5M",
					valid_for: "PT30M",
				},
			},
			{
				name: SYSTEM_CHECK_NAME,
				version: "2.0",
				description: "How many items the line processes each minute.",
				scope: "environment",
				value: { type: "number", unit: "items/min" },
				recommended: {
					rule: {
						kind: "threshold",
						direction: "maximize",
						params: { pass_values: 40, marginal_values: 25 },
					},
					window: "PT10M",
					valid_for: "PT1H",
				},
			},
		],
	};
}
