import type { HealthCheck } from "@/lib/schemas/health-checks";
import {
	type HealthCriteriaSettings,
	type ServedSettings,
	servedSettings,
} from "@/lib/schemas/health-criteria";

/**
 * Check entries and settings for the adversarial settings-interface tests.
 * Names are invented and domain-neutral.
 */

const ITEMS = { one: "widget", many: "widgets" };

/** A yes-or-no check judged once per widget, with one check setting of each type. */
export const BOOLEAN_CHECK: HealthCheck = {
	name: "Seal Present Check",
	version: "3",
	description: "Is a seal present on the widget?",
	scope: "widget",
	scope_label: ITEMS,
	value: { type: "boolean" },
	params: [
		{ key: "line", label: "Line name", type: "string", default: "ALL" },
		{ key: "retries", label: "Retries", type: "number", unit: "tries" },
		{ key: "strict", label: "Strict mode", type: "boolean" },
		{ key: "settle", label: "Settle time", type: "duration" },
		{
			key: "profile",
			label: "Profile",
			type: "enum",
			options: ["fast", "careful"],
		},
	],
};

export const NUMBER_CHECK: HealthCheck = {
	name: "Gap Width Measure",
	version: "1.0",
	description: "The width of the gap on the widget.",
	scope: "widget",
	scope_label: ITEMS,
	value: { type: "number", unit: "mm" },
};

export const TEXT_CHECK: HealthCheck = {
	name: "Grade Label Reader",
	version: "2",
	description: "The grade printed on the widget.",
	scope: "widget",
	scope_label: ITEMS,
	value: { type: "string" },
};

export const SYSTEM_CHECK: HealthCheck = {
	name: "Line Rate Monitor",
	version: "1",
	description: "Widgets leaving the line each minute.",
	scope: "environment",
	value: { type: "number", unit: "widgets/min" },
};

const COUNTERS = { rule: 2, reduction: 3, aggregation: 4 };

/** Stored settings as the server serves them, with version labels. */
export function served(settings: HealthCriteriaSettings): ServedSettings {
	return servedSettings(settings, {
		rule: COUNTERS.rule,
		reduction: settings.reduction ? COUNTERS.reduction : 0,
		aggregation: settings.aggregation ? COUNTERS.aggregation : 0,
	});
}
