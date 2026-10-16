import { describe, expect, it, vi } from "vitest";
import type { HealthCheck } from "@/lib/schemas/health-checks";
import {
	HEALTH_CHECK_PIPELINE,
	ITEM_CHECK_NAME,
} from "@/src/__tests__/fixtures/health-checks";
import { render, screen } from "@/src/__tests__/utils/test-utils";
import { draftFromCheck } from "../criteria-draft";
import { CriteriaForm, type FormState } from "../criteria-form";
import type { HealthCriteriaResponse } from "../health-types";
import { checkLists, INTEGRATION, storedCriteria } from "./criteria-test-data";

const NOT_OFFERED_LINE = /no longer offers this check/;

function itemCheck(): HealthCheck {
	const found = checkLists()[0]?.checks.find(
		(check) => check.name === ITEM_CHECK_NAME
	);
	if (!found) {
		throw new Error("no demo check");
	}
	return found;
}

const CHECK = itemCheck();
const CHOICE = {
	check: CHECK,
	integrationId: INTEGRATION.id,
	key: JSON.stringify([INTEGRATION.id, CHECK.name]),
	pipeline: HEALTH_CHECK_PIPELINE,
};

function drawForm(state: FormState, view: HealthCriteriaResponse) {
	return render(
		<CriteriaForm
			canEdit
			choices={[CHOICE]}
			claimId="claim-42"
			initialCheck={CHECK}
			initialChoiceKey={CHOICE.key}
			initialDraft={draftFromCheck(CHECK, INTEGRATION.id)}
			onCancelNew={vi.fn()}
			onChanged={vi.fn()}
			onRefresh={vi.fn()}
			onReplace={vi.fn()}
			revision={state === "new" ? null : 1}
			state={state}
			view={view}
		/>,
		{ withProviders: false }
	);
}

/** Settings someone else accepted while a fresh pick was open, read with the check no longer offered. */
const STORED = storedCriteria({
	overrides: {
		check_offer: "not-offered",
		pipeline_read: { at: "2026-10-02T10:00:00.000Z", revision: 1 },
	},
});

describe("a fresh pick drawn beside a read of stored settings", () => {
	it("shows none of the stored settings' lines, and still offers the node", () => {
		drawForm("new", STORED);

		expect(screen.queryByTestId("health-accepted-line")).toBeNull();
		expect(screen.queryByTestId("health-settings-footer")).toBeNull();
		expect(screen.queryByText(NOT_OFFERED_LINE)).toBeNull();
		expect(screen.getByTestId("health-fresh-pick-notice")).toBeVisible();
		expect(screen.getByTestId("health-node-options")).toBeVisible();
	});

	it("shows those lines for the stored settings themselves", () => {
		drawForm("accepted", STORED);

		expect(screen.getByTestId("health-accepted-line")).toBeVisible();
		expect(screen.getByTestId("health-settings-footer")).toBeVisible();
		expect(screen.getByText(NOT_OFFERED_LINE)).toBeVisible();
	});
});
