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
						params: { avail_floor: 0.8, use_verdict: true },
						rule: {
							kind: "threshold",
							direction: "maximize",
							params: { pass_values: 0.95 },
						},
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
						params: { avail_floor: 0.8, use_verdict: true },
						rule: {
							kind: "threshold",
							direction: "maximize",
							params: { pass_values: 0.9 },
						},
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

/** The numeric check as a pipeline writes it for itself. */
export const PIPELINE_FORM_CHECK_NAME = "Weld Seam Gauge";
/** A check whose recommended aggregation cannot be used as it stands. */
export const WORST_OF_CHECK_NAME = "Joint Fit Check";

/**
 * A check list written the way a pipeline writes its own case file rather than
 * TEA's fuller form: settings as a plain object of name to default, `scalar`
 * for a number-valued check, version labels inside the recommendations, and
 * combining steps that carry a rule. Two of its recommendations need
 * attention when it is published: a combining step with no rule, and one that
 * takes the worst item of a yes-or-no check.
 */
export function buildPipelineFormCheckList() {
	return {
		pipeline: HEALTH_CHECK_PIPELINE,
		checks: [
			{
				name: ITEM_CHECK_NAME,
				version: "0.3",
				description: "Is the surface of the item free of visible marks?",
				scope: "item",
				value: { type: "boolean" },
				params: { camera_line: "ALL" },
				recommended: {
					rule: { kind: "identity", version: "0.0" },
					aggregation: {
						kind: "proportion",
						params: { avail_floor: 0.05, use_verdict: true },
						rule: {
							kind: "threshold",
							direction: "maximize",
							params: { pass_values: 0.8 },
							version: "0.0",
						},
						version: "0.0",
					},
					window: "PT1M",
					valid_for: "PT5M",
				},
			},
			{
				name: PIPELINE_FORM_CHECK_NAME,
				version: "0.3",
				description: "How far apart the two sides of a seam are.",
				scope: "item",
				value: { type: "scalar" },
				params: {
					reference_gap: "mean_gap",
					max_dt: "PT12S",
					strict: false,
					tolerance: 0.5,
				},
				recommended: {
					rule: {
						kind: "threshold",
						direction: "minimize",
						params: { pass_values: 5, marginal_values: 10 },
						version: "0.0",
					},
					aggregation: {
						kind: "proportion",
						params: { avail_floor: 0.8, use_verdict: true },
						version: "0.0",
					},
					window: "PT1M",
					valid_for: "PT5M",
				},
			},
			{
				name: WORST_OF_CHECK_NAME,
				version: "0.3",
				description: "Does the joint fit?",
				scope: "item",
				value: { type: "boolean" },
				recommended: {
					rule: { kind: "identity", version: "0.0" },
					aggregation: {
						kind: "worst-of",
						params: { avail_floor: 0, use_verdict: true },
						rule: {
							kind: "threshold",
							direction: "minimize",
							params: { pass_values: 1 },
							version: "0.0",
						},
						version: "0.0",
					},
					window: "PT1M",
					valid_for: "PT5M",
				},
			},
		],
	};
}
