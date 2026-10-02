import { waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HealthCheck } from "@/lib/schemas/health-checks";
import { ITEM_CHECK_NAME } from "@/src/__tests__/fixtures/health-checks";
import {
	CLAIM_CONTEXT,
	installFakeEventSource,
	serveHealth,
} from "@/src/__tests__/utils/health-criteria-harness";
import { render, screen, within } from "@/src/__tests__/utils/test-utils";
import { HealthPanel } from "../health-panel";
import type { HealthCheckListOffer } from "../health-types";
import { checkLists, storedCriteria } from "./criteria-test-data";

vi.mock("@radix-ui/react-select", async () => {
	return await vi.importActual("@radix-ui/react-select");
});
vi.mock("@radix-ui/react-radio-group", async () => {
	return await vi.importActual("@radix-ui/react-radio-group");
});

beforeEach(() => {
	installFakeEventSource();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

const OLD_ENTRY = checkLists()[0]?.checks.find(
	(check) => check.name === ITEM_CHECK_NAME
) as HealthCheck;

/** Version 0.4: a different window, validity and claim threshold, and the same rule and combining step. */
const NEW_ENTRY: HealthCheck = {
	...OLD_ENTRY,
	version: "0.4",
	recommended: {
		...OLD_ENTRY.recommended,
		aggregation: {
			kind: "proportion",
			params: { threshold: 0.99, avail_floor: 0.8, use_verdict: true },
		},
		window: "PT2M",
		valid_for: "PT10M",
	},
};

function listsWith(entry: HealthCheck): HealthCheckListOffer[] {
	const [first] = checkLists();
	return [
		{
			...(first as HealthCheckListOffer),
			checks: [entry],
		},
	];
}

async function openMove(
	entry: HealthCheck = NEW_ENTRY,
	lists: HealthCheckListOffer[] = listsWith(entry)
) {
	const served = serveHealth({
		lists,
		view: { ...storedCriteria(), check_offer: "newer-version" },
	});
	served.saveAnswer = () => HttpResponse.json(served.view);
	const user = userEvent.setup();
	render(<HealthPanel {...CLAIM_CONTEXT} canEdit />, { withProviders: false });
	await user.click(await screen.findByRole("tab", { name: "Settings" }));
	const panel = screen.getByRole("tabpanel", { name: "Settings" });
	await user.click(
		await within(panel).findByRole("button", {
			name: "Compare with version 0.4",
		})
	);
	const compare = await within(panel).findByTestId("health-version-compare");
	return { compare, panel, served, user };
}

const field = (panel: HTMLElement, label: string) =>
	within(panel).getByLabelText(label) as HTMLInputElement;

describe("moving accepted settings to another version of the check", () => {
	it("shows one row for each block, with Keep yours chosen and nothing pre-selected to take", async () => {
		const { compare } = await openMove();
		for (const block of [
			"check",
			"rule",
			"reduction",
			"aggregation",
			"timing",
		]) {
			expect(
				within(compare).getByTestId(`health-compare-${block}`)
			).toBeVisible();
		}
		const rows = ["aggregation", "timing"].map((block) =>
			within(within(compare).getByTestId(`health-compare-${block}`))
		);
		for (const row of rows) {
			expect(row.getByRole("radio", { name: "Keep yours" })).toBeChecked();
			expect(
				row.getByRole("radio", { name: "Take the recommendation" })
			).not.toBeChecked();
			expect(row.getByText("Your accepted settings")).toBeVisible();
			expect(row.getByText("Recommended for version 0.4")).toBeVisible();
		}
	});

	it("offers no choice for blocks the new version leaves as they are", async () => {
		const { compare } = await openMove();
		const rule = within(within(compare).getByTestId("health-compare-rule"));
		expect(rule.queryByRole("radio")).toBeNull();
		expect(
			rule.getByText(
				"The recommendation is the same as your settings. Nothing to choose."
			)
		).toBeVisible();
	});

	it("says in plain words what each side holds for the timing and the claim threshold", async () => {
		const { compare } = await openMove();
		const timing = within(compare).getByTestId("health-compare-timing");
		expect(timing.textContent).toContain("1-minute window");
		expect(timing.textContent).toContain("5 minutes");
		expect(timing.textContent).toContain("2-minute window");
		expect(timing.textContent).toContain("10 minutes");
		const aggregation = within(compare).getByTestId(
			"health-compare-aggregation"
		);
		expect(aggregation.textContent).toContain("at least 95% of the items");
		expect(aggregation.textContent).toContain("at least 99% of the items");
	});

	it("continues to the form with the accepted settings and the new version, unsaved, when nothing is taken", async () => {
		const { panel, served, user } = await openMove();
		await user.click(within(panel).getByRole("button", { name: "Continue" }));
		expect(within(panel).queryByTestId("health-version-compare")).toBeNull();
		expect(
			await within(panel).findByTestId("health-move-notice")
		).toHaveTextContent(
			"These settings are for version 0.4 of the check. Nothing is saved until you press Save settings."
		);
		expect(within(panel).getByText("check 0.4")).toBeVisible();
		expect(field(panel, "Window length").value).toBe("1");
		expect(field(panel, "Claim passes at").value).toBe("95");
		expect(
			within(panel).getByRole("button", { name: "Save settings" })
		).toBeEnabled();
		await new Promise((resolve) => setTimeout(resolve, 30));
		expect(served.saves).toEqual([]);
	});

	it("saves the moved settings only when Save settings is pressed, with the new version and only the chosen blocks taken", async () => {
		const { compare, panel, served, user } = await openMove();
		await user.click(
			within(within(compare).getByTestId("health-compare-timing")).getByRole(
				"radio",
				{
					name: "Take the recommendation",
				}
			)
		);
		await user.click(within(panel).getByRole("button", { name: "Continue" }));
		expect(field(panel, "Window length").value).toBe("2");
		expect(field(panel, "Each result counts for").value).toBe("10");
		expect(field(panel, "Claim passes at").value).toBe("95");
		expect(served.saves).toEqual([]);
		await user.click(
			within(panel).getByRole("button", { name: "Save settings" })
		);
		await waitFor(() => expect(served.saves).toHaveLength(1));
		const body = served.saves[0] as Record<string, any>;
		expect(body.accept).toBe(true);
		expect(body.settings.check.version).toBe("0.4");
		expect(body.settings.window).toBe("PT2M");
		expect(body.settings.valid_for).toBe("PT10M");
		expect(body.settings.aggregation.params.threshold).toBe(0.95);
		expect(body.settings.rule).toEqual({ kind: "identity" });
	});

	it("takes the claim threshold when it is chosen and leaves the timing alone", async () => {
		const { compare, panel, served, user } = await openMove();
		await user.click(
			within(
				within(compare).getByTestId("health-compare-aggregation")
			).getByRole("radio", { name: "Take the recommendation" })
		);
		await user.click(within(panel).getByRole("button", { name: "Continue" }));
		expect(field(panel, "Claim passes at").value).toBe("99");
		expect(field(panel, "Window length").value).toBe("1");
		await user.click(
			within(panel).getByRole("button", { name: "Save settings" })
		);
		await waitFor(() => expect(served.saves).toHaveLength(1));
		const body = served.saves[0] as Record<string, any>;
		expect(body.settings.aggregation.params.threshold).toBe(0.99);
		expect(body.settings.window).toBe("PT1M");
	});

	it("returns to the form unchanged when Cancel is pressed, with the compare button back and nothing sent", async () => {
		const { panel, served, user } = await openMove();
		await user.click(within(panel).getByRole("button", { name: "Cancel" }));
		expect(within(panel).queryByTestId("health-version-compare")).toBeNull();
		expect(
			await within(panel).findByRole("button", {
				name: "Compare with version 0.4",
			})
		).toBeVisible();
		expect(within(panel).queryByTestId("health-move-notice")).toBeNull();
		expect(within(panel).getByText("check 0.3")).toBeVisible();
		expect(
			within(panel).getByRole("button", { name: "Save settings" })
		).toBeDisabled();
		expect(served.saves).toEqual([]);
	});

	it("starts again from the stored settings when the moved form is cancelled", async () => {
		const { compare, panel, served, user } = await openMove();
		await user.click(
			within(within(compare).getByTestId("health-compare-timing")).getByRole(
				"radio",
				{
					name: "Take the recommendation",
				}
			)
		);
		await user.click(within(panel).getByRole("button", { name: "Continue" }));
		await user.click(within(panel).getByRole("button", { name: "Cancel" }));
		expect(field(panel, "Window length").value).toBe("1");
		expect(within(panel).getByText("check 0.3")).toBeVisible();
		expect(served.saves).toEqual([]);
	});

	it("shows beside its field a kept setting that the new version no longer describes, and refuses saving until it is removed", async () => {
		const { params: _params, ...withoutParams } = NEW_ENTRY;
		const { panel, served, user } = await openMove(
			withoutParams as HealthCheck
		);
		await user.click(within(panel).getByRole("button", { name: "Continue" }));
		const remove = await within(panel).findByRole("button", {
			name: "Remove camera_line",
		});
		expect(
			within(panel).getByTestId("health-unlisted-params")
		).toHaveTextContent("is not a setting this check describes");
		expect(
			within(panel).getByRole("button", { name: "Save settings" })
		).toBeDisabled();
		await user.click(remove);
		await waitFor(() =>
			expect(
				within(panel).getByRole("button", { name: "Save settings" })
			).toBeEnabled()
		);
		await user.click(
			within(panel).getByRole("button", { name: "Save settings" })
		);
		await waitFor(() => expect(served.saves).toHaveLength(1));
		expect(
			(served.saves[0] as Record<string, any>).settings.check.params
		).toBeUndefined();
	});

	it("offers no comparison when the newer version is listed only by another pipeline", async () => {
		const [own] = listsWith({ ...OLD_ENTRY });
		const other: HealthCheckListOffer = {
			integration: { id: "integration-2", name: "Other integration" },
			pipeline: "Other pipeline",
			published_at: "2026-10-02T08:00:00.000Z",
			checks: [NEW_ENTRY],
		};
		serveHealth({
			lists: [own as HealthCheckListOffer, other],
			view: { ...storedCriteria(), check_offer: "newer-version" },
		});
		const user = userEvent.setup();
		render(<HealthPanel {...CLAIM_CONTEXT} canEdit />, {
			withProviders: false,
		});
		await user.click(await screen.findByRole("tab", { name: "Settings" }));
		const panel = screen.getByRole("tabpanel", { name: "Settings" });
		await within(panel).findByText(
			"The pipeline now offers a different version of this check."
		);
		await new Promise((resolve) => setTimeout(resolve, 40));
		expect(
			within(panel)
				.queryAllByRole("button")
				.filter((button) =>
					button.textContent?.startsWith("Compare with version")
				)
		).toEqual([]);
	});

	it("shows the pipeline's text in the comparison as text", async () => {
		const hostile: HealthCheck = {
			...NEW_ENTRY,
			description: "<img src=x onerror=alert(1)> javascript:alert(2)",
			scope_label: { one: "<script>x</script>item", many: "items" },
		};
		const { compare } = await openMove(hostile);
		expect(compare.querySelectorAll("img, script, a, iframe")).toHaveLength(0);
		expect(compare.textContent).toContain("<script>x</script>item");
	});
});
