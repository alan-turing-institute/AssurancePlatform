import { waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HealthCheck } from "@/lib/schemas/health-checks";
import {
	NUMERIC_CHECK_NAME,
	SYSTEM_CHECK_NAME,
} from "@/src/__tests__/fixtures/health-checks";
import { server } from "@/src/__tests__/mocks/server";
import {
	CLAIM_CONTEXT,
	CRITERIA_URL,
	type CriteriaServer,
	emitStateChanged,
	installFakeEventSource,
	serveHealth,
} from "@/src/__tests__/utils/health-criteria-harness";
import { render, screen, within } from "@/src/__tests__/utils/test-utils";
import { HealthPanel } from "../health-panel";
import type {
	HealthCheckListOffer,
	HealthCriteriaResponse,
	HealthCriteriaView,
} from "../health-types";
import {
	checkLists,
	INTEGRATION,
	NO_CRITERIA,
	storedCriteria,
} from "./criteria-test-data";

const LATE_PATTERN_1 =
	/(Accepted by|Suggested by|The previous settings|No evidence settings)/;
const LATE_PATTERN_2 = /^2\. Combine each item's readings over the window/;

const PATTERN_1 = /accept/i;
const PATTERN_2 = /Compare/;
const PATTERN_3 = /The claim passes when this share/;
const PATTERN_4 = /^(Accept|Save) settings$/;
const PATTERN_5 = /changed by someone else/;
const PATTERN_6 = /^The pipeline read these settings at /;
const PATTERN_7 = /^The pipeline read an earlier version at /;
const PATTERN_8 = /\busing\b|\bused by\b/;
const PATTERN_9 = /accept|save|stop using|discard/i;
const PATTERN_10 = /no time limit/;
const PATTERN_11 = /^2\. Combine/;
const PATTERN_12 = /^3\. Combine/;
const PATTERN_13 = /^3\. Combine all items into the claim's result/;

// The suite's stand-ins for selects and radio groups ignore `disabled`, which
// is what these tests check, so the real components are used here.
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
	vi.restoreAllMocks();
});

interface OpenOptions {
	canEdit?: boolean;
	elementText?: string;
	lists?: HealthCheckListOffer[];
	view: HealthCriteriaResponse;
}

async function openSettings({
	canEdit = true,
	elementText,
	lists = checkLists(),
	view,
}: OpenOptions) {
	const served = serveHealth({ lists, view });
	const user = userEvent.setup();
	render(
		<HealthPanel
			{...CLAIM_CONTEXT}
			canEdit={canEdit}
			elementText={elementText}
		/>,
		{ withProviders: false }
	);
	await user.click(await screen.findByRole("tab", { name: "Settings" }));
	const panel = screen.getByRole("tabpanel", { name: "Settings" });
	return { panel, served, user };
}

/** The stored settings with some of their blocks replaced, as another person's save would leave them. */
function changed(
	view: HealthCriteriaResponse,
	patch: Partial<HealthCriteriaView>,
	overrides: Partial<HealthCriteriaResponse> = {}
): HealthCriteriaResponse {
	if (!view.criteria) {
		throw new Error("the view has no settings");
	}
	return { ...view, ...overrides, criteria: { ...view.criteria, ...patch } };
}

async function pickCheck(
	user: ReturnType<typeof userEvent.setup>,
	panel: HTMLElement,
	name: string
) {
	await user.click(
		await within(panel).findByRole("combobox", { name: "Check" })
	);
	await user.click(await screen.findByRole("option", { name }));
}

function field(panel: HTMLElement, label: string): HTMLInputElement {
	return within(panel).getByLabelText(label) as HTMLInputElement;
}

async function typeInto(
	user: ReturnType<typeof userEvent.setup>,
	input: HTMLElement,
	text: string
) {
	await user.clear(input);
	if (text !== "") {
		await user.type(input, text);
	}
}

/** The form section whose heading starts with `title`. */
function stepSection(panel: HTMLElement, title: string): HTMLElement {
	const heading = within(panel).getByText((text, element) => {
		return element?.tagName === "H3" && text.startsWith(title);
	});
	const section = heading.closest("section");
	if (!section) {
		throw new Error(`no section for ${title}`);
	}
	return section;
}

function savedSettings(served: CriteriaServer, index = 0) {
	return served.saves[index]?.settings as Record<string, any>;
}

const ENABLED_CONTROLS =
	"input, textarea, select, button, [role=combobox], [role=switch], [role=checkbox], [role=radio]";

function enabledControls(panel: HTMLElement): HTMLElement[] {
	return [...panel.querySelectorAll<HTMLElement>(ENABLED_CONTROLS)].filter(
		(control) =>
			control.getAttribute("aria-hidden") !== "true" &&
			!control.hasAttribute("disabled") &&
			control.getAttribute("aria-disabled") !== "true" &&
			!control.hasAttribute("data-disabled")
	);
}

describe("the Settings view, by state", () => {
	it("offers the check picker, and no summary or buttons, to an editor of a claim with no settings", async () => {
		const { panel, served } = await openSettings({ view: NO_CRITERIA });
		expect(
			await within(panel).findByRole("combobox", { name: "Check" })
		).toBeEnabled();
		expect(within(panel).queryByTestId("health-plain-words")).toBeNull();
		expect(within(panel).queryByRole("button", { name: PATTERN_1 })).toBeNull();
		expect(served.checkListReads).toBeGreaterThan(0);
	});

	it("tells a viewer there are no settings, with no picker and no check-list request", async () => {
		const { panel, served } = await openSettings({
			canEdit: false,
			view: NO_CRITERIA,
		});
		await within(panel).findByText("No evidence settings for this claim.");
		expect(within(panel).queryByRole("combobox")).toBeNull();
		expect(enabledControls(panel)).toEqual([]);
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(served.checkListReads).toBe(0);
	});

	it("does not read the case's check lists before the Settings view is opened", async () => {
		const served = serveHealth({ lists: checkLists(), view: NO_CRITERIA });
		render(<HealthPanel {...CLAIM_CONTEXT} />, { withProviders: false });
		await screen.findByText("No evidence yet");
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(served.checkListReads).toBe(0);
	});

	it("says who stopped inactive settings, when and why, and offers the picker again", async () => {
		const view = storedCriteria({ state: "inactive" });
		const { panel } = await openSettings({
			view: {
				...view,
				last_change: {
					action: "retired",
					by_name: "Bob",
					at: "2026-10-01T10:00:00.000Z",
					reason: "Replaced by a newer plan",
				},
			},
		});
		const line = await within(panel).findByTestId("health-stopped-line");
		expect(line).toHaveTextContent("The previous settings were stopped by Bob");
		expect(line).toHaveTextContent("Reason: Replaced by a newer plan");
		expect(
			within(panel).getByRole("combobox", { name: "Check" })
		).toBeEnabled();
	});

	it("shows a suggestion's banner and the short view with Accept, Save without accepting, Cancel and Discard", async () => {
		const { panel } = await openSettings({
			view: storedCriteria({ state: "suggested" }),
		});
		const banner = await within(panel).findByTestId("health-suggested-banner");
		expect(banner).toHaveTextContent("Suggested by Alice on");
		expect(banner).toHaveTextContent(
			"Nothing is used until these settings are accepted."
		);
		expect(
			within(panel).getByText("The numbers that matter most")
		).toBeVisible();
		for (const name of [
			"Accept settings",
			"Save without accepting",
			"Cancel",
			"Discard suggestion",
			"Show all settings",
		]) {
			expect(within(panel).getByRole("button", { name })).toBeEnabled();
		}
		expect(
			within(panel).queryByRole("button", { name: "Save settings" })
		).toBeNull();
	});

	it("shows accepted settings as the full form with who accepted, and the buttons for accepted settings", async () => {
		const view = storedCriteria();
		const { panel } = await openSettings({
			view: {
				...view,
				accepted_by: { name: "Alice", owns_integration: true },
			},
		});
		const line = await within(panel).findByTestId("health-accepted-line");
		expect(line).toHaveTextContent(
			"Accepted by Alice, the pipeline's owner, on"
		);
		expect(within(panel).getByText("Evidence source")).toBeVisible();
		expect(within(panel).getByText("Timing")).toBeVisible();
		expect(
			within(panel).getByRole("button", { name: "Save settings" })
		).toBeDisabled();
		expect(within(panel).getByRole("button", { name: "Cancel" })).toBeEnabled();
		expect(
			within(panel).getByRole("button", { name: "Stop using these settings" })
		).toBeEnabled();
		expect(
			within(panel).queryByRole("button", { name: "Save without accepting" })
		).toBeNull();
		expect(
			within(panel).queryByRole("button", { name: "Accept settings" })
		).toBeNull();
		expect(
			within(panel).queryByRole("button", { name: "Discard suggestion" })
		).toBeNull();
	});

	it("does not name the pipeline's owner when the person who accepted does not own it", async () => {
		const { panel } = await openSettings({ view: storedCriteria() });
		const line = await within(panel).findByTestId("health-accepted-line");
		expect(line.textContent).not.toContain("owner");
	});

	it("shows the version chips of the saved blocks", async () => {
		const { panel } = await openSettings({ view: storedCriteria() });
		await within(panel).findByTestId("health-accepted-line");
		expect(within(panel).getByText("rule r1")).toBeVisible();
		expect(within(panel).getByText("d1")).toBeVisible();
		expect(within(panel).getByText("a1")).toBeVisible();
		expect(within(panel).getByText("check 0.3")).toBeVisible();
	});

	it("shows the notices for a check the pipeline no longer offers and for a newer version, without a compare button for a viewer", async () => {
		const gone = await openSettings({
			view: { ...storedCriteria(), check_offer: "not-offered" },
		});
		await within(gone.panel).findByText(
			"The pipeline no longer offers this check. Results that still arrive are compared with these settings."
		);
	});

	it("offers the comparison with a newer version to an editor and not to a viewer", async () => {
		const edit = await openSettings({
			view: { ...storedCriteria(), check_offer: "newer-version" },
			lists: checkLists().map((list) => ({
				...list,
				checks: list.checks.map((check) => ({ ...check, version: "9.9" })),
			})),
		});
		await within(edit.panel).findByText(
			"The pipeline now offers a different version of this check."
		);
		expect(
			await within(edit.panel).findByRole("button", {
				name: "Compare with version 9.9",
			})
		).toBeEnabled();
	});

	it("shows a viewer the newer-version notice with no button", async () => {
		const { panel } = await openSettings({
			canEdit: false,
			view: { ...storedCriteria(), check_offer: "newer-version" },
		});
		await within(panel).findByText(
			"The pipeline now offers a different version of this check."
		);
		expect(within(panel).queryByRole("button", { name: PATTERN_2 })).toBeNull();
	});
});

describe("picking a check", () => {
	it("shows the short view filled from the recommendation, with the notice that it is only a recommendation", async () => {
		const { panel, user } = await openSettings({ view: NO_CRITERIA });
		await pickCheck(user, panel, "Surface Finish Check");
		expect(
			await within(panel).findByTestId("health-fresh-pick-notice")
		).toHaveTextContent(
			"These are the settings the check recommends. Nothing is used until you accept them. Change any number first if it does not fit this claim."
		);
		expect(
			within(panel).getByText("The numbers that matter most")
		).toBeVisible();
		expect(
			field(panel, "The claim passes when this share of items pass").value
		).toBe("95");
		expect(field(panel, "Window length").value).toBe("1");
		expect(field(panel, "Each result counts for").value).toBe("5");
		expect(within(panel).getByTestId("health-plain-words")).toBeVisible();
		for (const name of [
			"Accept settings",
			"Save without accepting",
			"Cancel",
		]) {
			expect(within(panel).getByRole("button", { name })).toBeEnabled();
		}
	});

	it("has no claim threshold in the short view for a whole-system check", async () => {
		const { panel, user } = await openSettings({ view: NO_CRITERIA });
		await pickCheck(user, panel, SYSTEM_CHECK_NAME);
		await within(panel).findByText("The numbers that matter most");
		expect(within(panel).queryByLabelText(PATTERN_3)).toBeNull();
		expect(field(panel, "Window length").value).toBe("10");
	});

	it("shows the full form with the no-recommendation notice for a check that recommends nothing, and nothing can be sent", async () => {
		const bare: HealthCheck = {
			name: "Bare Check",
			version: "1",
			scope: "item",
			scope_label: { one: "item", many: "items" },
			value: { type: "number", unit: "mm" },
		};
		const { panel, user, served } = await openSettings({
			view: NO_CRITERIA,
			lists: [
				{
					integration: INTEGRATION,
					pipeline: "Bare pipeline",
					published_at: "2026-10-02T08:00:00.000Z",
					checks: [bare],
				},
			],
		});
		await pickCheck(user, panel, "Bare Check");
		expect(
			await within(panel).findByTestId("health-fresh-pick-notice")
		).toHaveTextContent(
			"This check recommends no settings. Nothing is used until you accept the ones you enter."
		);
		expect(
			within(panel).queryByText("The numbers that matter most")
		).toBeNull();
		expect(within(panel).getByText("1. Judge each reading")).toBeVisible();
		expect(
			within(panel).getByRole("button", { name: "Accept settings" })
		).toBeDisabled();
		expect(
			within(panel).getByRole("button", { name: "Save without accepting" })
		).toBeDisabled();
		expect(served.saves).toEqual([]);
	});

	it("shows the full form with the failing field marked for a recommendation that does not pass the checks", async () => {
		const wrong: HealthCheck = {
			name: "Wrong Way Check",
			version: "1",
			scope: "item",
			scope_label: { one: "item", many: "items" },
			value: { type: "number", unit: "mm" },
			recommended: {
				rule: {
					kind: "threshold",
					direction: "maximize",
					params: { pass_values: 5, marginal_values: 9 },
				},
				aggregation: {
					kind: "proportion",
					params: { threshold: 0.9, use_verdict: true },
				},
				window: "PT5M",
				valid_for: "PT5M",
			},
		};
		const { panel, user } = await openSettings({
			view: NO_CRITERIA,
			lists: [
				{
					integration: INTEGRATION,
					pipeline: "Odd pipeline",
					published_at: "2026-10-02T08:00:00.000Z",
					checks: [wrong],
				},
			],
		});
		await pickCheck(user, panel, "Wrong Way Check");
		await within(panel).findByText("1. Judge each reading");
		expect(
			within(panel).queryByText("The numbers that matter most")
		).toBeNull();
		const marginal = field(panel, "Marginal from");
		expect(marginal).toHaveAttribute("aria-invalid", "true");
		expect(
			within(panel).getByRole("button", { name: "Accept settings" })
		).toBeDisabled();
	});

	it("sends the recommendation as it stands, with no version labels, when it is accepted unchanged", async () => {
		const { panel, user, served } = await openSettings({ view: NO_CRITERIA });
		served.saveAnswer = () => HttpResponse.json(storedCriteria());
		await pickCheck(user, panel, "Surface Finish Check");
		await user.click(
			await within(panel).findByRole("button", { name: "Accept settings" })
		);
		await waitFor(() => expect(served.saves).toHaveLength(1));
		const body = served.saves[0] as Record<string, any>;
		expect(body.accept).toBe(true);
		expect(body.integration_id).toBe(INTEGRATION.id);
		expect(body.settings).toEqual({
			check: {
				name: "Surface Finish Check",
				version: "0.3",
				scope: "item",
				params: { camera_line: "ALL" },
			},
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
		});
		expect(JSON.stringify(body.settings)).not.toContain('"version":"r');
		await within(panel).findByTestId("health-accepted-line");
		expect(
			within(panel).getByRole("button", { name: "Save settings" })
		).toBeVisible();
	});

	it("changes a number in the short view and sends it as an exact fraction", async () => {
		const { panel, user, served } = await openSettings({ view: NO_CRITERIA });
		served.saveAnswer = () => HttpResponse.json(storedCriteria());
		await pickCheck(user, panel, "Surface Finish Check");
		await typeInto(
			user,
			field(panel, "The claim passes when this share of items pass"),
			" 28.5 "
		);
		await user.click(
			within(panel).getByRole("button", { name: "Accept settings" })
		);
		await waitFor(() => expect(served.saves).toHaveLength(1));
		expect(savedSettings(served).aggregation.params.threshold).toBe(0.285);
	});

	it("keeps what was typed when Show all settings opens the full form", async () => {
		const { panel, user } = await openSettings({ view: NO_CRITERIA });
		await pickCheck(user, panel, "Surface Finish Check");
		await typeInto(
			user,
			field(panel, "The claim passes when this share of items pass"),
			"80"
		);
		await user.click(
			within(panel).getByRole("button", { name: "Show all settings" })
		);
		expect(field(panel, "Claim passes at").value).toBe("80");
		expect(
			within(panel).getByText("2. Combine each item's readings over the window")
		).toBeVisible();
		expect(within(panel).getByTestId("health-plain-words")).toBeVisible();
	});

	it("saves a suggestion with accept false, and then shows the banner for what the server returned", async () => {
		const { panel, user, served } = await openSettings({ view: NO_CRITERIA });
		served.saveAnswer = () =>
			HttpResponse.json(storedCriteria({ state: "suggested" }));
		await pickCheck(user, panel, "Surface Finish Check");
		await user.click(
			await within(panel).findByRole("button", {
				name: "Save without accepting",
			})
		);
		await waitFor(() => expect(served.saves).toHaveLength(1));
		expect(served.saves[0]?.accept).toBe(false);
		await within(panel).findByTestId("health-suggested-banner");
	});

	it("leaves the picker when Cancel is pressed, and sends nothing", async () => {
		const { panel, user, served } = await openSettings({ view: NO_CRITERIA });
		await pickCheck(user, panel, "Surface Finish Check");
		await user.click(
			await within(panel).findByRole("button", { name: "Cancel" })
		);
		await within(panel).findByRole("combobox", { name: "Check" });
		expect(within(panel).queryByTestId("health-plain-words")).toBeNull();
		expect(served.saves).toEqual([]);
	});

	it("lists the checks of two pipelines under the pipelines' names", async () => {
		const first = checkLists()[0] as HealthCheckListOffer;
		const { panel, user } = await openSettings({
			view: NO_CRITERIA,
			lists: [
				first,
				{
					integration: { id: "integration-2", name: "Second integration" },
					pipeline: "Second pipeline",
					published_at: "2026-10-02T08:00:00.000Z",
					checks: first.checks.filter(
						(check) => check.name === NUMERIC_CHECK_NAME
					),
				},
			],
		});
		await user.click(
			await within(panel).findByRole("combobox", { name: "Check" })
		);
		expect(await screen.findByText(first.pipeline)).toBeVisible();
		expect(screen.getByText("Second pipeline")).toBeVisible();
	});
});

describe("suggestions", () => {
	it("accepts a suggestion with accept true and shows what the server returned", async () => {
		const { panel, user, served } = await openSettings({
			view: storedCriteria({ state: "suggested" }),
		});
		served.saveAnswer = () =>
			HttpResponse.json(storedCriteria({ revision: 2 }));
		await user.click(
			await within(panel).findByRole("button", { name: "Accept settings" })
		);
		await waitFor(() => expect(served.saves).toHaveLength(1));
		expect(served.saves[0]?.accept).toBe(true);
		await within(panel).findByTestId("health-accepted-line");
	});

	it("saves a suggestion again with accept false, as a suggestion", async () => {
		const { panel, user, served } = await openSettings({
			view: storedCriteria({ state: "suggested" }),
		});
		served.saveAnswer = () =>
			HttpResponse.json(storedCriteria({ state: "suggested", revision: 2 }));
		await user.click(
			await within(panel).findByRole("button", {
				name: "Save without accepting",
			})
		);
		await waitFor(() => expect(served.saves).toHaveLength(1));
		expect(served.saves[0]?.accept).toBe(false);
	});

	it("discards a suggestion without sending a reason, and then shows who discarded it", async () => {
		const { panel, user, served } = await openSettings({
			view: storedCriteria({ state: "suggested" }),
		});
		served.retireAnswer = () =>
			HttpResponse.json({
				...storedCriteria({ state: "inactive" }),
				last_change: {
					action: "discarded",
					by_name: "Bob",
					at: "2026-10-02T11:00:00.000Z",
					reason: null,
				},
			});
		await user.click(
			await within(panel).findByRole("button", { name: "Discard suggestion" })
		);
		await waitFor(() => expect(served.retirements).toHaveLength(1));
		expect(served.retirements[0]).toEqual({});
		expect(
			await within(panel).findByTestId("health-stopped-line")
		).toHaveTextContent("A suggestion was discarded by Bob");
	});
});

describe("stopping the use of accepted settings", () => {
	async function openStopDialog() {
		const opened = await openSettings({ view: storedCriteria() });
		await opened.user.click(
			await within(opened.panel).findByRole("button", {
				name: "Stop using these settings",
			})
		);
		const dialog = await screen.findByRole("dialog");
		return { ...opened, dialog };
	}

	it("needs a reason: the button stays off for nothing or for spaces, and nothing is sent", async () => {
		const { dialog, user, served } = await openStopDialog();
		const confirm = within(dialog).getByRole("button", {
			name: "Stop using these settings",
		});
		expect(confirm).toBeDisabled();
		await user.type(within(dialog).getByLabelText("Reason"), "   ");
		expect(confirm).toBeDisabled();
		await user.click(confirm);
		expect(served.retirements).toEqual([]);
	});

	it("sends the trimmed reason and then shows who stopped the settings and why", async () => {
		const { dialog, panel, user, served } = await openStopDialog();
		served.retireAnswer = () => {
			served.view = {
				...storedCriteria({ state: "inactive" }),
				last_change: {
					action: "retired",
					by_name: "Alice",
					at: "2026-10-02T12:00:00.000Z",
					reason: "Replaced by new plan",
				},
			};
			return HttpResponse.json(served.view);
		};
		await user.type(
			within(dialog).getByLabelText("Reason"),
			"  Replaced by new plan  "
		);
		await user.click(
			within(dialog).getByRole("button", { name: "Stop using these settings" })
		);
		await waitFor(() => expect(served.retirements).toHaveLength(1));
		expect(served.retirements[0]).toEqual({ reason: "Replaced by new plan" });
		const line = await within(panel).findByTestId("health-stopped-line");
		expect(line).toHaveTextContent(
			"The previous settings were stopped by Alice"
		);
		expect(line).toHaveTextContent("Reason: Replaced by new plan");
	});

	it("keeps the settings in view when the server refuses", async () => {
		const { dialog, panel, user, served } = await openStopDialog();
		served.retireAnswer = () =>
			HttpResponse.json({ error: "Not allowed" }, { status: 403 });
		await user.type(within(dialog).getByLabelText("Reason"), "Because");
		await user.click(
			within(dialog).getByRole("button", { name: "Stop using these settings" })
		);
		await waitFor(() => expect(served.retirements).toHaveLength(1));
		expect(within(panel).getByTestId("health-accepted-line")).toBeVisible();
	});
});

describe("saving accepted settings", () => {
	it("shows the percentages and durations as stored and sends the same fractions and lengths", async () => {
		const view = storedCriteria();
		const criteria = view.criteria as HealthCriteriaView;
		const { panel, user, served } = await openSettings({
			view: changed(view, {
				aggregation: {
					kind: "proportion",
					params: { threshold: 0.285, avail_floor: 0.07, use_verdict: true },
					version: "a1",
				},
				reduction: {
					...(criteria.reduction as NonNullable<typeof criteria.reduction>),
					params: { avail_floor: 0.58 },
				},
				window: "PT1H30M",
				valid_for: "P1D",
			}),
		});
		served.saveAnswer = () => HttpResponse.json(served.view);
		await within(panel).findByTestId("health-accepted-line");
		expect(field(panel, "Claim passes at").value).toBe("28.5");
		expect(field(panel, "Answers needed").value).toBe("7");
		expect(field(panel, "Readings needed").value).toBe("58");
		expect(field(panel, "Window length").value).toBe("90");
		expect(field(panel, "Each result counts for").value).toBe("1");
		await typeInto(user, field(panel, "Claim passes at"), "28.5");
		await typeInto(user, field(panel, "Window length"), "91");
		await user.click(
			within(panel).getByRole("button", { name: "Save settings" })
		);
		await waitFor(() => expect(served.saves).toHaveLength(1));
		const settings = savedSettings(served);
		expect(settings.aggregation.params).toEqual({
			threshold: 0.285,
			avail_floor: 0.07,
			use_verdict: true,
		});
		expect(settings.reduction.params.avail_floor).toBe(0.58);
		expect(settings.window).toBe("PT91M");
		expect(settings.valid_for).toBe("P1D");
	});

	it("sends no time limit as indefinite and switches the length field off", async () => {
		const { panel, user, served } = await openSettings({
			view: storedCriteria(),
		});
		served.saveAnswer = () => HttpResponse.json(served.view);
		await within(panel).findByTestId("health-accepted-line");
		await user.click(
			within(panel).getByRole("checkbox", {
				name: "A result counts until someone withdraws it (no time limit)",
			})
		);
		expect(field(panel, "Each result counts for")).toBeDisabled();
		await user.click(
			within(panel).getByRole("button", { name: "Save settings" })
		);
		await waitFor(() => expect(served.saves).toHaveLength(1));
		expect(savedSettings(served).valid_for).toBe("indefinite");
	});

	it("sends the unit chosen beside a length", async () => {
		const { panel, user, served } = await openSettings({
			view: storedCriteria(),
		});
		served.saveAnswer = () => HttpResponse.json(served.view);
		await within(panel).findByTestId("health-accepted-line");
		const units = within(panel).getAllByRole("combobox", { name: "Unit" });
		await user.click(units[0] as HTMLElement);
		await user.click(await screen.findByRole("option", { name: "hours" }));
		await typeInto(user, field(panel, "Window length"), "2");
		await user.click(
			within(panel).getByRole("button", { name: "Save settings" })
		);
		await waitFor(() => expect(served.saves).toHaveLength(1));
		expect(savedSettings(served).window).toBe("PT2H");
	});

	it("shows what the server returned after a save, not what was typed", async () => {
		const stored = storedCriteria();
		const { panel, user, served } = await openSettings({ view: stored });
		const returned = changed(
			stored,
			{
				revision: 2,
				aggregation: {
					kind: "proportion",
					params: { threshold: 0.85, avail_floor: 0.8, use_verdict: true },
					version: "a2",
				},
			},
			{ accepted_by: { name: "Bob", owns_integration: false } }
		);
		served.saveAnswer = () => HttpResponse.json(returned);
		await within(panel).findByTestId("health-accepted-line");
		await typeInto(user, field(panel, "Claim passes at"), "90");
		await user.click(
			within(panel).getByRole("button", { name: "Save settings" })
		);
		await waitFor(() =>
			expect(
				within(panel).getByTestId("health-accepted-line")
			).toHaveTextContent("Accepted by Bob")
		);
		expect(field(panel, "Claim passes at").value).toBe("85");
		expect(within(panel).getByText("a2")).toBeVisible();
		expect(within(panel).queryByText("a1")).toBeNull();
		expect(within(panel).getByText("rule r1")).toBeVisible();
		expect(
			within(panel).getByRole("button", { name: "Save settings" })
		).toBeDisabled();
	});

	it("sends once when Save settings is pressed twice quickly", async () => {
		const { panel, user, served } = await openSettings({
			view: storedCriteria(),
		});
		served.saveAnswer = async () => {
			await new Promise((resolve) => setTimeout(resolve, 50));
			return HttpResponse.json(served.view);
		};
		await within(panel).findByTestId("health-accepted-line");
		await typeInto(user, field(panel, "Claim passes at"), "90");
		const save = within(panel).getByRole("button", { name: "Save settings" });
		await user.dblClick(save);
		await new Promise((resolve) => setTimeout(resolve, 120));
		expect(served.saves).toHaveLength(1);
	});

	it("sends nothing while a field has a known problem, and shows the problem beside its field", async () => {
		const { panel, user, served } = await openSettings({
			view: storedCriteria(),
		});
		await within(panel).findByTestId("health-accepted-line");
		await typeInto(user, field(panel, "Window length"), "abc");
		const input = field(panel, "Window length");
		expect(input).toHaveAttribute("aria-invalid", "true");
		const describedBy = input.getAttribute("aria-describedby") ?? "";
		expect(describedBy).not.toBe("");
		expect(
			document.getElementById(describedBy.split(" ")[0] ?? "")
		).toHaveTextContent("must be a whole number greater than zero");
		const save = within(panel).getByRole("button", { name: "Save settings" });
		expect(save).toBeDisabled();
		await user.click(save);
		expect(served.saves).toEqual([]);
		expect(
			within(panel).getByText("Fix the problems marked above before saving.")
		).toBeVisible();
	});

	it("sends nothing from the short view while the claim threshold is not a number", async () => {
		const { panel, user, served } = await openSettings({
			view: storedCriteria({ state: "suggested" }),
		});
		await within(panel).findByTestId("health-suggested-banner");
		await typeInto(
			user,
			field(panel, "The claim passes when this share of items pass"),
			"abc"
		);
		for (const name of ["Accept settings", "Save without accepting"]) {
			const button = within(panel).getByRole("button", { name });
			expect(button).toBeDisabled();
			await user.click(button);
		}
		expect(served.saves).toEqual([]);
	});

	it("never shows a button that saves or accepts without the plain-words summary beside it", async () => {
		const states: [string, HealthCriteriaResponse][] = [
			["accepted", storedCriteria()],
			["suggested", storedCriteria({ state: "suggested" })],
		];
		for (const [, view] of states) {
			const { panel, user } = await openSettings({ view });
			await within(panel).findByRole("button", {
				name: PATTERN_4,
			});
			expect(within(panel).getByTestId("health-plain-words")).toBeVisible();
			const show = within(panel).queryByRole("button", {
				name: "Show all settings",
			});
			if (show) {
				await user.click(show);
				expect(within(panel).getByTestId("health-plain-words")).toBeVisible();
			}
			document.body.innerHTML = "";
		}
	});
});

describe("what the server refuses", () => {
	it("shows each field error beside its field, reading the message under error", async () => {
		const { panel, user, served } = await openSettings({
			view: storedCriteria(),
		});
		served.saveAnswer = () =>
			HttpResponse.json(
				{
					error: "Invalid evidence settings",
					fieldErrors: {
						"settings.window": "the window is wrong for this pipeline",
						"settings.aggregation.params.threshold": "the threshold is too low",
						"settings.check.name": "Check not offered for this case",
					},
				},
				{ status: 400 }
			);
		await within(panel).findByTestId("health-accepted-line");
		await typeInto(user, field(panel, "Window length"), "7");
		await user.click(
			within(panel).getByRole("button", { name: "Save settings" })
		);
		const window = field(panel, "Window length");
		await waitFor(() => expect(window).toHaveAttribute("aria-invalid", "true"));
		const describedById = (input: HTMLElement) =>
			(input.getAttribute("aria-describedby") ?? "").split(" ")[0] ?? "";
		expect(document.getElementById(describedById(window))).toHaveTextContent(
			"the window is wrong for this pipeline"
		);
		const threshold = field(panel, "Claim passes at");
		expect(threshold).toHaveAttribute("aria-invalid", "true");
		expect(document.getElementById(describedById(threshold))).toHaveTextContent(
			"the threshold is too low"
		);
		expect(
			within(panel).getByText("check.name: Check not offered for this case")
		).toBeVisible();
	});

	it("shows the server's own message when it names no field, and a generic one when it sends no body", async () => {
		const { panel, user, served } = await openSettings({
			view: storedCriteria(),
		});
		served.saveAnswer = () =>
			HttpResponse.json(
				{ error: "Somebody else holds the lock" },
				{ status: 409 }
			);
		await within(panel).findByTestId("health-accepted-line");
		await typeInto(user, field(panel, "Window length"), "7");
		await user.click(
			within(panel).getByRole("button", { name: "Save settings" })
		);
		await within(panel).findByText("Somebody else holds the lock");
		served.saveAnswer = () => new HttpResponse("not json", { status: 502 });
		await user.click(
			within(panel).getByRole("button", { name: "Save settings" })
		);
		await within(panel).findByText("The server refused the change (502).");
	});

	it("clears the server's field errors once the person edits again, and keeps the typed values", async () => {
		const { panel, user, served } = await openSettings({
			view: storedCriteria(),
		});
		served.saveAnswer = () =>
			HttpResponse.json(
				{ error: "Invalid", fieldErrors: { "settings.window": "refused" } },
				{ status: 400 }
			);
		await within(panel).findByTestId("health-accepted-line");
		await typeInto(user, field(panel, "Window length"), "7");
		await user.click(
			within(panel).getByRole("button", { name: "Save settings" })
		);
		await within(panel).findByText("refused");
		await typeInto(user, field(panel, "Window length"), "8");
		expect(within(panel).queryByText("refused")).toBeNull();
		expect(field(panel, "Window length").value).toBe("8");
	});

	it("shows a message and keeps the edits when the request cannot be sent", async () => {
		const { panel, user, served } = await openSettings({
			view: storedCriteria(),
		});
		served.saveAnswer = () => HttpResponse.error();
		await within(panel).findByTestId("health-accepted-line");
		await typeInto(user, field(panel, "Window length"), "7");
		await user.click(
			within(panel).getByRole("button", { name: "Save settings" })
		);
		await within(panel).findByText(
			"The request could not be sent. Check your connection."
		);
		expect(field(panel, "Window length").value).toBe("7");
	});
});

describe("edits and refetches", () => {
	it("keeps unsaved edits when the claim's state changes and the stored settings are the same", async () => {
		const { panel, user } = await openSettings({ view: storedCriteria() });
		await within(panel).findByTestId("health-accepted-line");
		await typeInto(user, field(panel, "Window length"), "7");
		emitStateChanged();
		await new Promise((resolve) => setTimeout(resolve, 50));
		expect(field(panel, "Window length").value).toBe("7");
		expect(within(panel).queryByText(PATTERN_5)).toBeNull();
	});

	it("shows the reload notice and refuses saving when the stored settings move under unsaved edits, and Reload shows the new ones", async () => {
		const stored = storedCriteria();
		const { panel, user, served } = await openSettings({ view: stored });
		await within(panel).findByTestId("health-accepted-line");
		await typeInto(user, field(panel, "Window length"), "7");
		served.view = changed(stored, { revision: 2, window: "PT3H" });
		emitStateChanged();
		await within(panel).findByText(
			"These settings were changed by someone else. Reload to see them."
		);
		expect(field(panel, "Window length").value).toBe("7");
		expect(
			within(panel).getByRole("button", { name: "Save settings" })
		).toBeDisabled();
		expect(
			within(panel).getByRole("button", { name: "Stop using these settings" })
		).toBeDisabled();
		await user.click(within(panel).getByRole("button", { name: "Reload" }));
		expect(field(panel, "Window length").value).toBe("3");
		expect(within(panel).queryByText(PATTERN_5)).toBeNull();
		expect(served.saves).toEqual([]);
	});

	it("keeps unsaved edits in view when the read that follows a change of state fails", async () => {
		const { panel, user } = await openSettings({ view: storedCriteria() });
		await within(panel).findByTestId("health-accepted-line");
		await typeInto(user, field(panel, "Window length"), "7");
		server.use(
			http.get(CRITERIA_URL, () =>
				HttpResponse.json({ error: "down" }, { status: 500 })
			)
		);
		emitStateChanged();
		await new Promise((resolve) => setTimeout(resolve, 80));
		expect(field(panel, "Window length").value).toBe("7");
	});

	it("shows another person's save at once, with no notice, when there are no unsaved edits", async () => {
		const stored = storedCriteria();
		const { panel, served } = await openSettings({ view: stored });
		await within(panel).findByTestId("health-accepted-line");
		served.view = changed(stored, { revision: 2, window: "PT3H" });
		emitStateChanged();
		await waitFor(() => expect(field(panel, "Window length").value).toBe("3"));
		expect(within(panel).queryByText(PATTERN_5)).toBeNull();
	});

	it("puts the stored values back when Cancel is pressed on edited accepted settings", async () => {
		const { panel, user } = await openSettings({ view: storedCriteria() });
		await within(panel).findByTestId("health-accepted-line");
		await typeInto(user, field(panel, "Window length"), "7");
		await user.click(within(panel).getByRole("button", { name: "Cancel" }));
		expect(field(panel, "Window length").value).toBe("1");
		expect(
			within(panel).getByRole("button", { name: "Save settings" })
		).toBeDisabled();
	});
});

describe("the claim's own text and the footer", () => {
	it("shows the claim's text above the summary as text, and nothing when it is empty or spaces", async () => {
		const first = await openSettings({
			view: storedCriteria(),
			elementText: "The line keeps its seals <b>intact</b>",
		});
		const block = await within(first.panel).findByTestId("health-claim-text");
		expect(block).toHaveTextContent("Claim");
		expect(block).toHaveTextContent("The line keeps its seals <b>intact</b>");
		expect(block.querySelector("b")).toBeNull();
		const summary = within(first.panel).getByTestId("health-plain-words");
		expect(block.compareDocumentPosition(summary)).toBe(
			Node.DOCUMENT_POSITION_FOLLOWING
		);
		document.body.innerHTML = "";
		const second = await openSettings({
			view: storedCriteria(),
			elementText: "   ",
		});
		await within(second.panel).findByTestId("health-plain-words");
		expect(within(second.panel).queryByTestId("health-claim-text")).toBeNull();
	});

	it.each([
		[
			"the pipeline has not read the settings",
			null,
			"The pipeline has not read these settings yet.",
		],
		[
			"the pipeline read the current revision",
			{ at: "2026-10-02T10:00:00.000Z", revision: 3 },
			PATTERN_6,
		],
		[
			"the pipeline read an earlier revision",
			{ at: "2026-10-02T10:00:00.000Z", revision: 2 },
			PATTERN_7,
		],
		[
			"the pipeline read with no revision recorded",
			{ at: "2026-10-02T10:00:00.000Z", revision: null },
			PATTERN_7,
		],
	])("words the footer when %s", async (_name, read, expected) => {
		const { panel } = await openSettings({
			view: storedCriteria({ revision: 3, overrides: { pipeline_read: read } }),
		});
		const footer = await within(panel).findByTestId("health-settings-footer");
		const line = footer.querySelector("p")?.textContent ?? "";
		if (typeof expected === "string") {
			expect(line).toBe(expected);
		} else {
			expect(line).toMatch(expected);
		}
		expect(footer.textContent).not.toMatch(PATTERN_8);
	});

	it("adds a line for each difference in the latest result, in the present tense, and none otherwise", async () => {
		const { panel } = await openSettings({
			view: storedCriteria({
				overrides: {
					latest_result: {
						record_id: "r1",
						differences: [
							{ field: "window", declared: "PT1M", used: "PT5M" },
							{ field: "rule.version", declared: "r1", used: "r0" },
						],
					},
				},
			}),
		});
		const footer = await within(panel).findByTestId("health-settings-footer");
		expect(footer).toHaveTextContent(
			"The pipeline used a window of 5 minutes; the settings say 1 minute."
		);
		expect(footer).toHaveTextContent(
			"The pipeline used rule r0; the settings say r1."
		);
		expect(footer.querySelectorAll("p")).toHaveLength(3);
	});

	it("shows no footer for settings that are not accepted", async () => {
		const { panel } = await openSettings({
			view: storedCriteria({ state: "suggested" }),
		});
		await within(panel).findByTestId("health-suggested-banner");
		expect(within(panel).queryByTestId("health-settings-footer")).toBeNull();
	});

	it("survives a read time that is not a date", async () => {
		const { panel } = await openSettings({
			view: storedCriteria({
				overrides: { pipeline_read: { at: "not a date", revision: 1 } },
			}),
		});
		const footer = await within(panel).findByTestId("health-settings-footer");
		expect(footer).toHaveTextContent("not a date");
	});
});

describe("a viewer", () => {
	it.each([
		["accepted", storedCriteria()],
		["suggested", storedCriteria({ state: "suggested" })],
		["inactive", storedCriteria({ state: "inactive" })],
	])("has no enabled control and no button for %s settings", async (_name, view) => {
		const { panel } = await openSettings({ canEdit: false, view });
		await waitFor(() => expect(panel.textContent).toMatch(LATE_PATTERN_1));
		expect(
			enabledControls(panel).map((control) => control.textContent)
		).toEqual([]);
		expect(
			within(panel).queryByRole("button", {
				name: PATTERN_9,
			})
		).toBeNull();
	});

	it("still sees the plain-words summary of settings that are not accepted", async () => {
		const { panel } = await openSettings({
			canEdit: false,
			view: storedCriteria({ state: "suggested" }),
		});
		expect(
			await within(panel).findByTestId("health-plain-words")
		).toBeVisible();
	});

	it("has no way to change the check, the rule or the timing in the full form of accepted settings", async () => {
		const { panel } = await openSettings({
			canEdit: false,
			view: storedCriteria(),
		});
		await within(panel).findByTestId("health-accepted-line");
		for (const input of panel.querySelectorAll("input, textarea")) {
			expect(input).toBeDisabled();
		}
		expect(
			within(panel).getByRole("checkbox", { name: PATTERN_10 })
		).toBeDisabled();
	});
});

describe("what the full form shows for each kind of check", () => {
	it("replaces steps 2 and 3 with the not-used block for a whole-system check, and still shows the window", async () => {
		const { panel } = await openSettings({
			view: storedCriteria({ checkName: SYSTEM_CHECK_NAME }),
		});
		await within(panel).findByTestId("health-accepted-line");
		expect(
			within(panel).getByText("Combining readings: not used")
		).toBeVisible();
		expect(within(panel).queryByText(PATTERN_11)).toBeNull();
		expect(within(panel).queryByText(PATTERN_12)).toBeNull();
		expect(within(panel).getByText("The whole system")).toBeVisible();
		expect(field(panel, "Window length").value).toBe("10");
	});

	it("keeps step 3 and gives step 2 its switch for a numeric check, with the unit on its limits", async () => {
		const { panel } = await openSettings({
			view: storedCriteria({ checkName: NUMERIC_CHECK_NAME }),
		});
		await within(panel).findByTestId("health-accepted-line");
		expect(within(panel).getByText(PATTERN_13)).toBeVisible();
		expect(within(panel).getByText(LATE_PATTERN_2)).toBeVisible();
		expect(within(panel).getByText("Number, in mm")).toBeVisible();
		expect(
			within(panel).getByRole("button", { name: "At most" })
		).toHaveAttribute("aria-pressed", "true");
		expect(
			within(panel).getByRole("button", { name: "Yes or no" })
		).toBeDisabled();
		expect(
			within(panel).getByRole("button", { name: "At least" })
		).toBeEnabled();
		expect(within(panel).getByRole("button", { name: "One of" })).toBeEnabled();
	});

	it("disables every shape but Yes or no for a yes-or-no check, with the reason", async () => {
		const { panel } = await openSettings({ view: storedCriteria() });
		await within(panel).findByTestId("health-accepted-line");
		const stepOne = within(stepSection(panel, "1. Judge each reading"));
		expect(stepOne.getByRole("button", { name: "Yes or no" })).toBeEnabled();
		for (const name of ["At least", "At most", "Between", "One of"]) {
			expect(stepOne.getByRole("button", { name })).toBeDisabled();
		}
		expect(
			within(panel).getByText(
				"Readings are yes or no, so only “Yes or no” can judge them."
			)
		).toBeVisible();
	});

	it("forces a rule of its own for an average of yes-or-no readings", async () => {
		const { panel } = await openSettings({ view: storedCriteria() });
		await within(panel).findByTestId("health-accepted-line");
		expect(
			within(panel).getByRole("radio", { name: "The rule in step 1" })
		).toBeDisabled();
		expect(
			within(panel).getByRole("radio", { name: "Its own rule" })
		).toBeChecked();
	});

	it("shows the limits of the rule judging an average of yes-or-no readings as percentages", async () => {
		const { panel } = await openSettings({ view: storedCriteria() });
		await within(panel).findByTestId("health-accepted-line");
		const passAt = within(panel).getAllByLabelText(
			"Pass at"
		) as HTMLInputElement[];
		expect(passAt.map((input) => input.value)).toEqual(["80"]);
	});
});

describe("changing a choice in the accepted form", () => {
	it("shows and sends the combined value's limits as plain numbers once they stop being shares, never as 80 for 0.8", async () => {
		const { panel, user, served } = await openSettings({
			view: storedCriteria(),
		});
		served.saveAnswer = () => HttpResponse.json(served.view);
		await within(panel).findByTestId("health-accepted-line");
		await user.click(
			within(panel).getByRole("combobox", { name: "Combine by" })
		);
		await user.click(await screen.findByRole("option", { name: "Highest" }));
		const passAt = within(panel).getAllByLabelText(
			"Pass at"
		) as HTMLInputElement[];
		expect(passAt.map((input) => input.value)).toEqual(["0.8"]);
		await user.click(
			within(panel).getByRole("button", { name: "Save settings" })
		);
		await waitFor(() => expect(served.saves).toHaveLength(1));
		const reduction = savedSettings(served).reduction;
		expect(reduction.kind).toBe("max");
		expect(reduction.rule.params).toEqual({
			pass_values: 0.8,
			marginal_values: 0.5,
		});
	});

	it("sends the settings of a different check, with none of the old check's blocks, when another check is chosen", async () => {
		const { panel, user, served } = await openSettings({
			view: storedCriteria(),
		});
		served.saveAnswer = () => HttpResponse.json(served.view);
		await within(panel).findByTestId("health-accepted-line");
		await pickCheck(user, panel, SYSTEM_CHECK_NAME);
		expect(
			await within(panel).findByText("Combining readings: not used")
		).toBeVisible();
		await user.click(
			within(panel).getByRole("button", { name: "Save settings" })
		);
		await waitFor(() => expect(served.saves).toHaveLength(1));
		const settings = savedSettings(served);
		expect(settings.check).toEqual({
			name: SYSTEM_CHECK_NAME,
			version: "2.0",
			scope: "environment",
		});
		expect(settings.reduction).toBeUndefined();
		expect(settings.aggregation).toBeUndefined();
		expect(settings.window).toBe("PT10M");
		expect(settings.valid_for).toBe("PT1H");
	});
});
