import type { HealthCheck } from "@/lib/schemas/health-checks";
import { servedSettings } from "@/lib/schemas/health-criteria";
import {
	buildHealthCheckList,
	HEALTH_CHECK_PIPELINE,
	ITEM_CHECK_NAME,
} from "@/src/__tests__/fixtures/health-checks";
import { analyseDraft, draftFromCheck } from "../criteria-draft";
import type {
	HealthCheckListOffer,
	HealthCriteriaResponse,
	HealthCriteriaState,
} from "../health-types";

export const INTEGRATION = { id: "integration-1", name: "Demo integration" };

export const CHECKS = buildHealthCheckList().checks as HealthCheck[];

export function demoCheck(name: string): HealthCheck {
	const found = CHECKS.find((check) => check.name === name);
	if (!found) {
		throw new Error(`no demo check ${name}`);
	}
	return found;
}

export function checkLists(): HealthCheckListOffer[] {
	return [
		{
			integration: INTEGRATION,
			pipeline: HEALTH_CHECK_PIPELINE,
			published_at: "2026-10-02T08:00:00.000Z",
			checks: CHECKS,
		},
	];
}

export const NO_CRITERIA: HealthCriteriaResponse = {
	criteria: null,
	check_description: null,
	integration: null,
	accepted_by: null,
	last_change: null,
	pipeline_read: null,
	check_offer: null,
	latest_result: null,
};

interface StoredOptions {
	checkName?: string;
	overrides?: Partial<HealthCriteriaResponse>;
	revision?: number;
	state?: HealthCriteriaState;
}

/** A stored settings read for one of the demo checks, built from its recommendation. */
export function storedCriteria({
	checkName = ITEM_CHECK_NAME,
	overrides = {},
	revision = 1,
	state = "accepted",
}: StoredOptions = {}): HealthCriteriaResponse {
	const check = demoCheck(checkName);
	const { complete } = analyseDraft(
		draftFromCheck(check, INTEGRATION.id),
		check
	);
	if (!complete) {
		throw new Error("the demo recommendation is not complete");
	}
	const accepted = state === "accepted";
	return {
		criteria: {
			...servedSettings(complete, {
				rule: 1,
				reduction: complete.reduction ? 1 : 0,
				aggregation: complete.aggregation ? 1 : 0,
			}),
			state,
			revision,
			source: {
				kind: "recommended",
				rule: "recommended",
				timing: "recommended",
				check_version: check.version,
			},
			accepted_at: accepted ? "2026-10-02T09:00:00.000Z" : null,
			updated_at: "2026-10-02T09:00:00.000Z",
		},
		check_description: check,
		integration: INTEGRATION,
		accepted_by: accepted ? { name: "Alice", owns_integration: false } : null,
		last_change: {
			action: accepted ? "accepted" : "suggested",
			by_name: "Alice",
			at: "2026-10-02T09:00:00.000Z",
			reason: null,
		},
		pipeline_read: null,
		check_offer: "current",
		latest_result: null,
		...overrides,
	};
}
