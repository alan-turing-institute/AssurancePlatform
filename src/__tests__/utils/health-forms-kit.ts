import prisma from "@/lib/prisma";
import { mockAuth } from "./auth-helpers";
import { setupCriteriaCase } from "./health-criteria-kit";

/**
 * Fixtures for the pipeline's own forms of a check list and of settings, and
 * for rows stored in the form TEA used before it accepted them. Names are
 * invented and domain-neutral.
 */

export const FORMS_CHECK = "Panel Flatness Check";
export const FORMS_VERSION = "2.1";
export const FORMS_SCOPE = "panel";

export const STORED_COUNTERS = { rule: 4, reduction: 2, aggregation: 3 };

type Json = Record<string, any>;

/** The check's recommended settings in the pipeline's own form, version labels included. */
export function pipelineRecommended(): Json {
	return {
		rule: {
			kind: "threshold",
			direction: "minimize",
			params: { pass_values: 0.5, marginal_values: 1 },
			version: "r1",
		},
		reduction: {
			kind: "percentile",
			params: { percentile: 90, avail_floor: 0.8 },
			version: "d1",
			rule: {
				kind: "threshold",
				direction: "maximize",
				params: { pass_values: 0.8 },
				version: "d1",
			},
		},
		aggregation: {
			kind: "proportion",
			params: { avail_floor: 0.8, use_verdict: true },
			version: "a1",
			rule: {
				kind: "threshold",
				direction: "maximize",
				params: { pass_values: 0.95 },
				version: "a1",
			},
		},
		window: "PT5M",
		valid_for: "PT30M",
	};
}

/** The same recommendation as it was written before the pipeline's form was accepted. */
export function olderRecommended(): Json {
	const recommended = pipelineRecommended();
	return {
		rule: withoutLabels(recommended.rule),
		reduction: {
			...withoutLabels(recommended.reduction),
			params: { p: 90, avail_floor: 0.8 },
		},
		aggregation: {
			kind: "proportion",
			params: { threshold: 0.95, avail_floor: 0.8, use_verdict: true },
		},
		window: recommended.window,
		valid_for: recommended.valid_for,
	};
}

/** A block without its version label, and without the label on its own rule. */
function withoutLabels(block: Json): Json {
	const { version: _version, rule, ...rest } = block;
	return rule ? { ...rest, rule: withoutLabels(rule) } : rest;
}

/** A check entry as a pipeline publishes it in its own form: plain settings, scalar, labelled recommendation. */
export function plainCheckEntry(overrides: Json = {}): Json {
	return {
		name: FORMS_CHECK,
		version: FORMS_VERSION,
		description: "How flat the surface of a panel is.",
		scope: FORMS_SCOPE,
		scope_label: { one: "panel", many: "panels" },
		value: { type: "scalar", unit: "mm" },
		params: { max_gap: "PT12S", sample_count: 5, strict: false, mode: "fast" },
		recommended: pipelineRecommended(),
		...overrides,
	};
}

export const PLAIN_PARAMS_AS_STORED = [
	{ key: "max_gap", label: "Max gap", type: "duration", default: "PT12S" },
	{ key: "sample_count", label: "Sample count", type: "number", default: 5 },
	{ key: "strict", label: "Strict", type: "boolean", default: false },
	{ key: "mode", label: "Mode", type: "string", default: "fast" },
];

/** The check entry as TEA stored it before: settings as a list, recommendation in the older form. */
export function olderCheckEntry(overrides: Json = {}): Json {
	return {
		name: FORMS_CHECK,
		version: FORMS_VERSION,
		description: "How flat the surface of a panel is.",
		scope: FORMS_SCOPE,
		scope_label: { one: "panel", many: "panels" },
		value: { type: "number", unit: "mm" },
		params: PLAIN_PARAMS_AS_STORED,
		recommended: olderRecommended(),
		...overrides,
	};
}

/** Complete accepted-able settings in the new form, from the plain check's recommendation. */
export function newFormSettings(overrides: Json = {}): Json {
	const recommended = pipelineRecommended();
	return {
		check: {
			name: FORMS_CHECK,
			version: FORMS_VERSION,
			scope: FORMS_SCOPE,
			params: {
				max_gap: "PT12S",
				sample_count: 5,
				strict: false,
				mode: "fast",
			},
		},
		rule: withoutLabels(recommended.rule),
		reduction: withoutLabels(recommended.reduction),
		aggregation: withoutLabels(recommended.aggregation),
		window: recommended.window,
		valid_for: recommended.valid_for,
		...overrides,
	};
}

/** The same settings as TEA stored them before: the pass mark in params.threshold, the percentile as p. */
export function olderSettings(): Json {
	const settings = newFormSettings();
	settings.reduction.params = { p: 90, avail_floor: 0.8 };
	settings.aggregation = {
		kind: "proportion",
		params: { threshold: 0.95, avail_floor: 0.8, use_verdict: true },
	};
	return settings;
}

/** The body of a settings save from a served `criteria` item: the blocks without any version label. */
export function saveFromServed(served: Json): Json {
	return {
		check: served.check,
		rule: withoutLabels(served.rule),
		...(served.reduction && { reduction: withoutLabels(served.reduction) }),
		...(served.aggregation && {
			aggregation: withoutLabels(served.aggregation),
		}),
		window: served.window,
		valid_for: served.valid_for,
	};
}

/** Stores a check list exactly as given, as a list published before the change would be stored. */
export async function storeCheckListAsGiven(
	integrationId: string,
	checks: Json[],
	pipeline = "Earlier pipeline"
) {
	await prisma.pluginHealthCheckCatalogue.upsert({
		where: { integrationId },
		create: { integrationId, pipeline, checks, publishedAt: new Date() },
		update: { pipeline, checks, publishedAt: new Date() },
	});
}

interface LegacyRowOptions {
	claimId: string;
	counters?: typeof STORED_COUNTERS;
	description?: Json;
	integrationId: string;
	settings?: Json;
	source?: Json;
	state?: "ACCEPTED" | "SUGGESTED";
	userId: string;
}

/** Writes a settings row as TEA stored it before the pipeline's form was accepted. */
export async function insertOlderRow(options: LegacyRowOptions) {
	const counters = options.counters ?? STORED_COUNTERS;
	const state = options.state ?? "ACCEPTED";
	const now = new Date();
	return await prisma.pluginHealthCriteria.create({
		data: {
			claimId: options.claimId,
			integrationId: options.integrationId,
			state,
			checkName: FORMS_CHECK,
			settings: options.settings ?? olderSettings(),
			ruleVersion: counters.rule,
			reductionVersion: counters.reduction,
			aggregationVersion: counters.aggregation,
			source: options.source ?? {
				kind: "recommended",
				check_version: FORMS_VERSION,
				check_params: "recommended",
				rule: "recommended",
				reduction: "recommended",
				aggregation: "recommended",
				timing: "recommended",
			},
			checkDescription: options.description ?? olderCheckEntry(),
			revision: 5,
			updatedById: options.userId,
			updatedAt: now,
			...(state === "ACCEPTED" && {
				acceptedById: options.userId,
				acceptedAt: now,
				acceptedByOwnsIntegration: true,
			}),
		},
	});
}

/** A case with a claim and a pipeline with no list published, the owner signed in. */
export async function setupFormsCase() {
	const context = await setupCriteriaCase({ publish: false });
	await mockAuth(context.owner.id, context.owner.username, context.owner.email);
	return context;
}
