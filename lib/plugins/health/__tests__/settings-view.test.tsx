import { waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UseCaseEventsOptions } from "@/hooks/use-case-events";
import { useCaseEvents } from "@/hooks/use-case-events";
import type { ElementSlotContext } from "@/lib/plugins/slots";
import {
	ITEM_CHECK_NAME,
	NUMERIC_CHECK_NAME,
	SYSTEM_CHECK_NAME,
} from "@/src/__tests__/fixtures/health-checks";
import { server } from "@/src/__tests__/mocks/server";
import { render, screen } from "@/src/__tests__/utils/test-utils";
import { HealthPanel } from "../health-panel";
import type {
	HealthCheckListOffer,
	HealthCriteriaResponse,
} from "../health-types";
import {
	checkLists,
	INTEGRATION,
	NO_CRITERIA,
	storedCriteria,
} from "./criteria-test-data";
import { item, status } from "./health-test-data";

vi.mock("@/hooks/use-case-events", () => ({
	useCaseEvents: vi.fn(),
}));

const CONTEXT: ElementSlotContext = {
	caseId: "case-1",
	elementId: "claim-42",
	elementType: "property",
	canEdit: true,
};
const CRITERIA_URL = "/api/elements/claim-42/health/criteria";
const RETIREMENT_URL = `${CRITERIA_URL}/retirement`;

let eventHandlers: UseCaseEventsOptions[] = [];

beforeEach(() => {
	eventHandlers = [];
	vi.mocked(useCaseEvents).mockImplementation((options) => {
		eventHandlers.push(options);
		return {
			status: "connected",
			isConnected: true,
			lastEvent: null,
			reconnect: vi.fn(),
			disconnect: vi.fn(),
		};
	});
});

afterEach(() => {
	vi.restoreAllMocks();
});

interface Served {
	criteria: HealthCriteriaResponse;
	puts: Record<string, unknown>[];
	retirements: Record<string, unknown>[];
}

/** Serves the evidence log, status, check lists and the settings routes; `served.criteria` is what the read returns. */
function serve(
	criteria: HealthCriteriaResponse,
	options: {
		onPut?: (body: Record<string, unknown>) => Response | undefined;
		health?: ReturnType<typeof status> | null;
		records?: ReturnType<typeof item>[];
	} = {}
): Served {
	const served: Served = { criteria, puts: [], retirements: [] };
	server.use(
		http.get("/api/machine/health/elements/claim-42/evidence", () =>
			HttpResponse.json({
				evidence: options.records ?? [],
				next_before: null,
			})
		),
		http.get("/api/elements/claim-42/health", () =>
			HttpResponse.json({ status: options.health ?? null })
		),
		http.get("/api/cases/case-1/health/checks", () =>
			HttpResponse.json(checkLists())
		),
		http.get(CRITERIA_URL, () => HttpResponse.json(served.criteria)),
		http.put(CRITERIA_URL, async ({ request }) => {
			const body = (await request.json()) as Record<string, unknown>;
			served.puts.push(body);
			return options.onPut?.(body) ?? HttpResponse.json(served.criteria);
		}),
		http.post(RETIREMENT_URL, async ({ request }) => {
			served.retirements.push(
				(await request.json()) as Record<string, unknown>
			);
			return HttpResponse.json(NO_CRITERIA);
		})
	);
	return served;
}

async function openSettings(canEdit = true) {
	const user = userEvent.setup();
	render(<HealthPanel {...CONTEXT} canEdit={canEdit} />, {
		withProviders: false,
	});
	await user.click(await screen.findByRole("tab", { name: "Settings" }));
	return user;
}

async function pick(user: ReturnType<typeof userEvent.setup>, name: string) {
	await user.click(await screen.findByRole("combobox", { name: "Check" }));
	await user.click(await screen.findByRole("option", { name }));
}

describe("the two views", () => {
	it("shows Results first, and Settings on request", async () => {
		serve(NO_CRITERIA);
		render(<HealthPanel {...CONTEXT} />, { withProviders: false });
		const results = await screen.findByRole("tab", { name: "Results" });
		expect(results).toHaveAttribute("aria-selected", "true");
		expect(screen.getByRole("tab", { name: "Settings" })).toHaveAttribute(
			"aria-selected",
			"false"
		);
		await screen.findByText("No evidence yet");
	});

	it("keeps 'not applicable' for a claim that is not a property claim", () => {
		render(<HealthPanel {...CONTEXT} elementType="goal" />, {
			withProviders: false,
		});
		expect(screen.getByText("Not applicable")).toBeInTheDocument();
		expect(screen.queryByRole("tab", { name: "Settings" })).toBeNull();
	});
});

describe("Results: settings lines", () => {
	it("says when the claim has no accepted settings and when a result was judged with others", async () => {
		serve(NO_CRITERIA, {
			health: status({ mismatch: { state: "undeclared" } }),
			records: [item({ echo_state: "undeclared" })],
		});
		render(<HealthPanel {...CONTEXT} />, { withProviders: false });
		expect(
			await screen.findByTestId("health-mismatch-lines")
		).toHaveTextContent(
			"This claim has no accepted settings. Results are shown, but nobody has accepted how they are judged."
		);
		expect(screen.getByTestId("health-evidence-echo")).toHaveTextContent(
			"No accepted settings when this result arrived."
		);
	});

	it("words each difference on the header and, in the past, on the record", async () => {
		const differences = [{ field: "rule.version", declared: "r2", used: "r1" }];
		serve(storedCriteria(), {
			health: status({ mismatch: { state: "mismatch", differences } }),
			records: [
				item({ echo_state: "mismatch", echo_differences: differences }),
			],
		});
		render(<HealthPanel {...CONTEXT} />, { withProviders: false });
		expect(
			await screen.findByTestId("health-mismatch-lines")
		).toHaveTextContent("The pipeline used rule r1; the settings say r2.");
		expect(screen.getByTestId("health-evidence-echo")).toHaveTextContent(
			"The pipeline used rule r1; the settings said r2."
		);
	});

	it("shows nothing for a matching record, and 'Set in Settings' in place of Change once settings are accepted", async () => {
		serve(storedCriteria(), {
			health: status(),
			records: [item({ echo_state: "match" })],
		});
		const user = userEvent.setup();
		render(<HealthPanel {...CONTEXT} />, { withProviders: false });
		await screen.findByTestId("health-panel-header");
		expect(screen.queryByTestId("health-evidence-echo")).toBeNull();
		expect(screen.queryByTestId("health-mismatch-lines")).toBeNull();
		await user.click(
			await screen.findByRole("button", { name: "Set in Settings" })
		);
		expect(screen.getByRole("tab", { name: "Settings" })).toHaveAttribute(
			"aria-selected",
			"true"
		);
		expect(screen.queryByRole("button", { name: "Change" })).toBeNull();
	});

	it("keeps Change while the claim has no accepted settings", async () => {
		serve(NO_CRITERIA, { health: status() });
		render(<HealthPanel {...CONTEXT} />, { withProviders: false });
		expect(await screen.findByRole("button", { name: "Change" })).toBeVisible();
	});
});

describe("Settings: picking a check and accepting", () => {
	it("pre-fills the short view from the recommendation, takes a changed number and accepts", async () => {
		const served = serve(NO_CRITERIA);
		const user = await openSettings();
		await pick(user, ITEM_CHECK_NAME);

		const threshold = await screen.findByLabelText(
			"The claim passes when this share of items pass"
		);
		expect(threshold).toHaveValue("95");
		expect(screen.getByLabelText("Window length")).toHaveValue("1");
		expect(screen.getByText("The numbers that matter most")).toBeVisible();
		expect(screen.getByTestId("health-plain-words")).toHaveTextContent(
			"The claim passes when at least 95% of the items pass"
		);

		await user.clear(threshold);
		await user.type(threshold, "90");
		expect(screen.getByTestId("health-plain-words")).toHaveTextContent(
			"at least 90% of the items pass"
		);

		served.criteria = storedCriteria();
		await user.click(screen.getByRole("button", { name: "Accept settings" }));
		await waitFor(() => expect(served.puts).toHaveLength(1));
		expect(served.puts[0]).toMatchObject({
			integration_id: INTEGRATION.id,
			accept: true,
			settings: {
				check: { name: ITEM_CHECK_NAME, version: "0.3" },
				aggregation: { params: { threshold: 0.9, use_verdict: true } },
				window: "PT1M",
				valid_for: "PT5M",
			},
		});
		await screen.findByText("1. Judge each reading");
		expect(screen.getByTestId("health-accepted-line")).toHaveTextContent(
			"Accepted by Alice on"
		);
		expect(screen.getByText("rule r1")).toBeVisible();
	});

	it("saves a suggestion without accepting", async () => {
		const served = serve(NO_CRITERIA);
		const user = await openSettings();
		await pick(user, ITEM_CHECK_NAME);
		served.criteria = storedCriteria({ state: "suggested" });
		await user.click(
			await screen.findByRole("button", { name: "Save without accepting" })
		);
		await waitFor(() =>
			expect(served.puts[0]).toMatchObject({ accept: false })
		);
		expect(
			await screen.findByTestId("health-suggested-banner")
		).toHaveTextContent("Suggested by Alice on");
	});

	it("opens the full form with the same values from 'Show all settings'", async () => {
		serve(NO_CRITERIA);
		const user = await openSettings();
		await pick(user, ITEM_CHECK_NAME);
		await user.click(
			await screen.findByRole("button", { name: "Show all settings" })
		);
		expect(await screen.findByText("1. Judge each reading")).toBeVisible();
		expect(screen.getByLabelText("Claim passes at")).toHaveValue("95");
		expect(
			screen.getByRole("button", { name: "Accept settings" })
		).toBeVisible();
	});

	it("shows the full form, not the short view, for a check whose recommendation does not pass", async () => {
		serve(NO_CRITERIA);
		server.use(
			http.get("/api/cases/case-1/health/checks", () => {
				const [list] = checkLists();
				return HttpResponse.json([
					{
						...list,
						checks: list?.checks.map((check) =>
							check.name === NUMERIC_CHECK_NAME
								? {
										...check,
										recommended: {
											...check.recommended,
											rule: { kind: "threshold", direction: "minimize" },
										},
									}
								: check
						),
					},
				]);
			})
		);
		const user = await openSettings();
		await pick(user, NUMERIC_CHECK_NAME);
		expect(await screen.findByText("1. Judge each reading")).toBeVisible();
		expect(screen.getByLabelText("Pass at")).toHaveValue("");
		expect(await screen.findByText("must be a number")).toBeVisible();
		expect(
			screen.getByRole("button", { name: "Accept settings" })
		).toBeDisabled();
	});
});

describe("Settings: the full form", () => {
	it("shows the version chips, who accepted, and the footer line", async () => {
		serve(
			storedCriteria({
				overrides: {
					accepted_by: { name: "Alice", owns_integration: true },
					pipeline_read: { at: "2026-10-02T10:00:00.000Z", revision: 1 },
				},
			})
		);
		const user = await openSettings();
		await screen.findByText("1. Judge each reading");
		expect(screen.getByTestId("health-accepted-line")).toHaveTextContent(
			"Accepted by Alice, the pipeline's owner, on"
		);
		for (const chip of ["check 0.3", "rule r1", "d1", "a1"]) {
			expect(screen.getByText(chip)).toBeVisible();
		}
		expect(screen.getByTestId("health-settings-footer")).toHaveTextContent(
			"The pipeline read these settings at"
		);
		expect(user).toBeDefined();
	});

	it.each([
		[null, "The pipeline has not read these settings yet."],
		[
			{ at: "2026-10-02T10:00:00.000Z", revision: 1 },
			"The pipeline read an earlier version at",
		],
	])("footer for pipeline_read %j", async (read, text) => {
		serve(
			storedCriteria({
				revision: read ? 2 : 1,
				overrides: { pipeline_read: read },
			})
		);
		await openSettings();
		expect(
			await screen.findByTestId("health-settings-footer")
		).toHaveTextContent(text);
	});

	it("adds the differences of the latest result to the footer", async () => {
		serve(
			storedCriteria({
				overrides: {
					latest_result: {
						record_id: "r",
						differences: [
							{ field: "valid_for", declared: "PT5M", used: "indefinite" },
						],
					},
				},
			})
		);
		await openSettings();
		expect(
			await screen.findByTestId("health-settings-footer")
		).toHaveTextContent(
			"The pipeline let the result count for no time limit; the settings say 5 minutes."
		);
	});

	it("shows the notices for a check that is no longer offered, or offered in a newer version", async () => {
		serve(storedCriteria({ overrides: { check_offer: "not-offered" } }));
		await openSettings();
		expect(
			await screen.findByText(
				"The pipeline no longer offers this check. Results that still arrive are compared with these settings."
			)
		).toBeVisible();
	});

	it("replaces steps 2 and 3 with a note for a whole-system check, and keeps the window", async () => {
		serve(storedCriteria({ checkName: SYSTEM_CHECK_NAME }));
		await openSettings();
		expect(
			await screen.findByText("Combining readings: not used")
		).toBeVisible();
		expect(screen.queryByText("3. Combine all", { exact: false })).toBeNull();
		expect(screen.getByLabelText("Window length")).toHaveValue("10");
	});

	it("shows a typed problem beside its field, sends nothing, and blocks saving", async () => {
		const served = serve(storedCriteria({ checkName: NUMERIC_CHECK_NAME }));
		const user = await openSettings();
		const pass = await screen.findByLabelText("Pass at");
		await user.clear(pass);
		await user.type(pass, "x");
		expect(await screen.findByText("must be a number")).toBeVisible();
		expect(pass).toHaveAttribute("aria-invalid", "true");
		expect(
			screen.getByRole("button", { name: "Save settings" })
		).toBeDisabled();
		expect(served.puts).toHaveLength(0);
	});

	it("shows each field error the server returns beside its field", async () => {
		const served = serve(storedCriteria({ checkName: NUMERIC_CHECK_NAME }), {
			onPut: () =>
				HttpResponse.json(
					{
						error: "settings.valid_for: refused",
						fieldErrors: { "settings.valid_for": "is refused by the server" },
					},
					{ status: 400 }
				),
		});
		const user = await openSettings();
		const pass = await screen.findByLabelText("Pass at");
		await user.clear(pass);
		await user.type(pass, "0.4");
		await user.click(screen.getByRole("button", { name: "Save settings" }));
		await waitFor(() => expect(served.puts).toHaveLength(1));
		expect(await screen.findByText("is refused by the server")).toBeVisible();
	});

	it("asks for a reason before stopping the use of settings", async () => {
		const served = serve(storedCriteria());
		const user = await openSettings();
		await user.click(
			await screen.findByRole("button", { name: "Stop using these settings" })
		);
		const submit = screen
			.getAllByRole("button", { name: "Stop using these settings" })
			.at(-1);
		expect(submit).toBeDisabled();
		await user.type(screen.getByLabelText("Reason"), "Check replaced");
		served.criteria = {
			...NO_CRITERIA,
			criteria: { ...storedCriteria().criteria, state: "inactive" } as never,
			last_change: {
				action: "retired",
				by_name: "Alice",
				at: "2026-10-02T11:00:00.000Z",
				reason: "Check replaced",
			},
		};
		await user.click(submit as HTMLElement);
		await waitFor(() =>
			expect(served.retirements).toEqual([{ reason: "Check replaced" }])
		);
		expect(await screen.findByTestId("health-stopped-line")).toHaveTextContent(
			"The previous settings were stopped by Alice on"
		);
		expect(screen.getByTestId("health-stopped-line")).toHaveTextContent(
			"Reason: Check replaced"
		);
	});
});

describe("Settings: suggestions", () => {
	it("shows the banner and the short view to another person, who can accept or discard it", async () => {
		const served = serve(storedCriteria({ state: "suggested" }));
		const user = await openSettings();
		expect(
			await screen.findByTestId("health-suggested-banner")
		).toHaveTextContent("Suggested by Alice on");
		expect(screen.getByText("The numbers that matter most")).toBeVisible();
		await user.click(
			screen.getByRole("button", { name: "Discard suggestion" })
		);
		await waitFor(() => expect(served.retirements).toEqual([{}]));
		expect(
			await screen.findByRole("combobox", { name: "Check" })
		).toBeVisible();
	});

	it("accepts the stored suggestion as it stands", async () => {
		const served = serve(storedCriteria({ state: "suggested" }));
		const user = await openSettings();
		served.criteria = storedCriteria({ revision: 2 });
		await user.click(
			await screen.findByRole("button", { name: "Accept settings" })
		);
		await waitFor(() => expect(served.puts[0]).toMatchObject({ accept: true }));
		await screen.findByText("1. Judge each reading");
	});
});

describe("Settings: a person who cannot edit", () => {
	it("sees the settings with every control off and no buttons", async () => {
		serve(storedCriteria());
		await openSettings(false);
		const pass = await screen.findByLabelText("Claim passes at");
		expect(pass).toBeDisabled();
		expect(screen.getByLabelText("Window length")).toBeDisabled();
		expect(screen.queryByRole("button", { name: "Save settings" })).toBeNull();
		expect(
			screen.queryByRole("button", { name: "Stop using these settings" })
		).toBeNull();
		expect(screen.getByTestId("health-plain-words")).toBeVisible();
	});

	it("says there are no settings, without a picker", async () => {
		serve(NO_CRITERIA);
		await openSettings(false);
		expect(
			await screen.findByText("No evidence settings for this claim.")
		).toBeVisible();
		expect(screen.queryByRole("combobox", { name: "Check" })).toBeNull();
	});
});

describe("Settings: refetches", () => {
	it("keeps what was typed when a change event arrives, and says when someone else changed the settings", async () => {
		const served = serve(storedCriteria({ checkName: NUMERIC_CHECK_NAME }));
		const user = await openSettings();
		const pass = await screen.findByLabelText("Pass at");
		await user.clear(pass);
		await user.type(pass, "0.4");

		served.criteria = storedCriteria({
			checkName: NUMERIC_CHECK_NAME,
			revision: 2,
		});
		for (const handler of eventHandlers) {
			handler.onEvent?.({
				type: "tea.health/state-changed",
				payload: { claimId: "claim-42" },
			} as never);
		}
		expect(
			await screen.findByText(
				"These settings were changed by someone else. Reload to see them."
			)
		).toBeVisible();
		expect(screen.getByLabelText("Pass at")).toHaveValue("0.4");
		expect(
			screen.getByRole("button", { name: "Save settings" })
		).toBeDisabled();

		await user.click(screen.getByRole("button", { name: "Reload" }));
		expect(screen.getByLabelText("Pass at")).toHaveValue("0.5");
	});

	it("shows a change made elsewhere at once when nothing has been typed", async () => {
		const served = serve(storedCriteria({ checkName: NUMERIC_CHECK_NAME }));
		await openSettings();
		expect(await screen.findByLabelText("Pass at")).toHaveValue("0.5");
		const next = storedCriteria({ checkName: NUMERIC_CHECK_NAME, revision: 2 });
		if (next.criteria?.rule.params) {
			next.criteria.rule.params.pass_values = 0.7;
		}
		served.criteria = next;
		for (const handler of eventHandlers) {
			handler.onEvent?.({
				type: "tea.health/state-changed",
				payload: { claimId: "claim-42" },
			} as never);
		}
		await waitFor(() =>
			expect(screen.getByLabelText("Pass at")).toHaveValue("0.7")
		);
	});
});

function emitChange() {
	for (const handler of eventHandlers) {
		handler.onEvent?.({
			type: "tea.health/state-changed",
			payload: { claimId: "claim-42" },
		} as never);
	}
}

const CHANGED_NOTICE =
	"These settings were changed by someone else. Reload to see them.";
const PICKER_INTRO =
	"Choose the check a pipeline runs for this claim. You can then set how its results are judged.";
const NO_PIPELINE_LINE =
	"The pipeline these settings were set up for no longer exists. Choose the check again from a current list to keep using them, or stop using these settings.";

describe("Settings: a fresh pick when someone else changes the settings", () => {
	it("sends the revision the pick was opened on, null when nothing was stored", async () => {
		const served = serve(NO_CRITERIA);
		const user = await openSettings();
		await pick(user, ITEM_CHECK_NAME);
		await user.click(
			await screen.findByRole("button", { name: "Accept settings" })
		);
		await waitFor(() => expect(served.puts).toHaveLength(1));
		expect(served.puts[0]).toMatchObject({ expected_revision: null });
	});

	it("shows the notice and refuses saving once the stored settings change under the pick", async () => {
		const served = serve(NO_CRITERIA);
		const user = await openSettings();
		await pick(user, ITEM_CHECK_NAME);
		await screen.findByRole("button", { name: "Accept settings" });
		served.criteria = storedCriteria({ revision: 1 });
		emitChange();
		expect(await screen.findByText(CHANGED_NOTICE)).toBeVisible();
		expect(
			screen.getByRole("button", { name: "Accept settings" })
		).toBeDisabled();
		expect(
			screen.getByRole("button", { name: "Save without accepting" })
		).toBeDisabled();
		await user.click(screen.getByRole("button", { name: "Reload" }));
		expect(await screen.findByLabelText("Claim passes at")).toBeInTheDocument();
		expect(served.puts).toEqual([]);
	});

	it("shows the same notice when the server refuses the save because the settings changed", async () => {
		const served = serve(NO_CRITERIA, {
			onPut: () =>
				HttpResponse.json(
					{ error: "These settings were changed by someone else" },
					{ status: 409 }
				),
		});
		const user = await openSettings();
		await pick(user, ITEM_CHECK_NAME);
		await user.click(
			await screen.findByRole("button", { name: "Accept settings" })
		);
		expect(await screen.findByText(CHANGED_NOTICE)).toBeVisible();
		expect(
			screen.getByRole("button", { name: "Accept settings" })
		).toBeDisabled();
		served.criteria = storedCriteria({ revision: 1 });
		await user.click(screen.getByRole("button", { name: "Reload" }));
		expect(await screen.findByLabelText("Claim passes at")).toBeInTheDocument();
	});

	it("sends the stored revision when accepted settings are saved", async () => {
		const served = serve(storedCriteria({ revision: 3 }));
		const user = await openSettings();
		const window = await screen.findByLabelText("Window length");
		await user.clear(window);
		await user.type(window, "7");
		await user.click(screen.getByRole("button", { name: "Save settings" }));
		await waitFor(() => expect(served.puts).toHaveLength(1));
		expect(served.puts[0]).toMatchObject({ expected_revision: 3 });
	});
});

describe("Settings: edits that someone else's change or a failed read must not lose", () => {
	it("keeps the form, with the notice and saving off, when someone else stops the settings", async () => {
		const served = serve(storedCriteria());
		const user = await openSettings();
		const window = await screen.findByLabelText("Window length");
		await user.clear(window);
		await user.type(window, "7");
		served.criteria = storedCriteria({ revision: 2, state: "inactive" });
		emitChange();
		expect(await screen.findByText(CHANGED_NOTICE)).toBeVisible();
		expect(screen.getByLabelText("Window length")).toHaveValue("7");
		expect(
			screen.getByRole("button", { name: "Save settings" })
		).toBeDisabled();
		expect(screen.queryByText(PICKER_INTRO)).toBeNull();
		await user.click(screen.getByRole("button", { name: "Reload" }));
		expect(await screen.findByText(PICKER_INTRO)).toBeVisible();
	});

	it("keeps the form when someone else discards the suggestion under unsaved edits", async () => {
		const served = serve(storedCriteria({ state: "suggested" }));
		const user = await openSettings();
		await user.click(
			await screen.findByRole("button", { name: "Show all settings" })
		);
		const window = await screen.findByLabelText("Window length");
		await user.clear(window);
		await user.type(window, "9");
		served.criteria = NO_CRITERIA;
		emitChange();
		expect(await screen.findByText(CHANGED_NOTICE)).toBeVisible();
		expect(screen.getByLabelText("Window length")).toHaveValue("9");
		expect(
			screen.getByRole("button", { name: "Accept settings" })
		).toBeDisabled();
	});

	it("does not keep the form after the person's own stop, even with edits", async () => {
		const served = serve(storedCriteria());
		const user = await openSettings();
		const window = await screen.findByLabelText("Window length");
		await user.clear(window);
		await user.type(window, "7");
		await user.click(
			screen.getByRole("button", { name: "Stop using these settings" })
		);
		await user.type(await screen.findByLabelText("Reason"), "no longer needed");
		served.criteria = NO_CRITERIA;
		await user.click(
			screen
				.getAllByRole("button", { name: "Stop using these settings" })
				.at(-1) as HTMLElement
		);
		expect(
			await screen.findByRole("combobox", { name: "Check" })
		).toBeVisible();
		expect(screen.queryByText(CHANGED_NOTICE)).toBeNull();
	});

	it("keeps the form and its edits, with a line, when the read after a change fails", async () => {
		serve(storedCriteria());
		const user = await openSettings();
		const window = await screen.findByLabelText("Window length");
		await user.clear(window);
		await user.type(window, "7");
		server.use(
			http.get(CRITERIA_URL, () =>
				HttpResponse.json({ error: "down" }, { status: 500 })
			)
		);
		emitChange();
		expect(
			await screen.findByText("The settings could not be refreshed.")
		).toBeVisible();
		expect(screen.getByLabelText("Window length")).toHaveValue("7");
		expect(screen.queryByText("Settings unavailable")).toBeNull();
	});

	it("still says the settings are unavailable when the read fails with nothing unsaved", async () => {
		serve(storedCriteria());
		await openSettings();
		await screen.findByLabelText("Window length");
		server.use(
			http.get(CRITERIA_URL, () =>
				HttpResponse.json({ error: "down" }, { status: 500 })
			)
		);
		emitChange();
		expect(await screen.findByText("Settings unavailable")).toBeVisible();
	});
});

describe("Settings: when the check lists cannot be read", () => {
	it("says so in place of the picker", async () => {
		serve(NO_CRITERIA);
		server.use(
			http.get("/api/cases/case-1/health/checks", () =>
				HttpResponse.json({ error: "down" }, { status: 500 })
			)
		);
		await openSettings();
		expect(
			await screen.findByText(
				"Could not load the checks your pipelines offer. Try reopening this element."
			)
		).toBeVisible();
		expect(screen.queryByRole("combobox", { name: "Check" })).toBeNull();
	});
});

describe("Settings: views and fields", () => {
	it("shows a viewer of suggested settings the full form, with no short view to open", async () => {
		serve(storedCriteria({ state: "suggested" }));
		await openSettings(false);
		expect(await screen.findByText("1. Judge each reading")).toBeVisible();
		expect(
			screen.queryByRole("button", { name: "Show all settings" })
		).toBeNull();
		expect(screen.getByLabelText("Window length")).toBeDisabled();
	});

	it("says why saving is off when the pipeline the settings were set up for no longer exists", async () => {
		serve(storedCriteria({ overrides: { integration: null } }));
		const user = await openSettings();
		expect(await screen.findByText(NO_PIPELINE_LINE)).toBeVisible();
		expect(
			screen.getByRole("button", { name: "Save settings" })
		).toBeDisabled();
		expect(
			screen.getByRole("button", { name: "Stop using these settings" })
		).toBeEnabled();
		await user.click(
			screen.getByRole("button", { name: "Stop using these settings" })
		);
		expect(await screen.findByLabelText("Reason")).toBeVisible();
	});

	it("does not show that line while the pipeline exists", async () => {
		serve(storedCriteria());
		await openSettings();
		await screen.findByLabelText("Window length");
		expect(screen.queryByText(NO_PIPELINE_LINE)).toBeNull();
	});

	function listsWithFlag(): HealthCheckListOffer[] {
		const [list] = checkLists();
		return [
			{
				...(list as HealthCheckListOffer),
				checks: (list as HealthCheckListOffer).checks.map((check) =>
					check.name === ITEM_CHECK_NAME
						? {
								...check,
								params: [
									...(check.params ?? []),
									{ key: "strict", label: "Strict mode", type: "boolean" },
								],
							}
						: check
				),
			},
		];
	}

	it("offers Not set, Yes and No for a yes-or-no check setting, and sends what is shown", async () => {
		const served = serve(NO_CRITERIA);
		server.use(
			http.get("/api/cases/case-1/health/checks", () =>
				HttpResponse.json(listsWithFlag())
			)
		);
		const user = await openSettings();
		await pick(user, ITEM_CHECK_NAME);
		await user.click(
			await screen.findByRole("button", { name: "Show all settings" })
		);
		const flag = await screen.findByRole("combobox", { name: "Strict mode" });
		// The suite's select stand-in knows an option's label only once its list has been opened.
		await user.click(flag);
		expect(screen.getByRole("option", { name: "Not set" })).toBeVisible();
		expect(screen.getByRole("option", { name: "Yes" })).toBeVisible();
		await user.click(screen.getByRole("option", { name: "No" }));
		expect(
			screen.getByRole("combobox", { name: "Strict mode" })
		).toHaveTextContent("No");
		await user.click(screen.getByRole("button", { name: "Accept settings" }));
		await waitFor(() => expect(served.puts).toHaveLength(1));
		const body = served.puts[0] as { settings: { check: { params: unknown } } };
		expect(body.settings.check.params).toMatchObject({ strict: false });
	});

	it("sends nothing for a yes-or-no check setting that is left at Not set", async () => {
		const served = serve(NO_CRITERIA);
		server.use(
			http.get("/api/cases/case-1/health/checks", () =>
				HttpResponse.json(listsWithFlag())
			)
		);
		const user = await openSettings();
		await pick(user, ITEM_CHECK_NAME);
		await user.click(
			await screen.findByRole("button", { name: "Accept settings" })
		);
		await waitFor(() => expect(served.puts).toHaveLength(1));
		const body = served.puts[0] as {
			settings: { check: { params: Record<string, unknown> } };
		};
		expect(body.settings.check.params).not.toHaveProperty("strict");
	});

	it("follows the check currently chosen for the recommendation notice", async () => {
		serve(NO_CRITERIA);
		const [list] = checkLists();
		server.use(
			http.get("/api/cases/case-1/health/checks", () =>
				HttpResponse.json([
					{
						...list,
						checks: list?.checks.map((check) =>
							check.name === NUMERIC_CHECK_NAME
								? { ...check, recommended: undefined }
								: check
						),
					},
				])
			)
		);
		const user = await openSettings();
		await pick(user, ITEM_CHECK_NAME);
		await user.click(
			await screen.findByRole("button", { name: "Show all settings" })
		);
		expect(
			await screen.findByTestId("health-fresh-pick-notice")
		).toHaveTextContent("These are the settings the check recommends.");
		await pick(user, NUMERIC_CHECK_NAME);
		await waitFor(() =>
			expect(screen.getByTestId("health-fresh-pick-notice")).toHaveTextContent(
				"This check recommends no settings."
			)
		);
	});
});

describe("Settings: the claim's own text", () => {
	it("shows the claim's text, as text, above the plain-words summary", async () => {
		serve(storedCriteria());
		const user = userEvent.setup();
		render(
			<HealthPanel {...CONTEXT} elementText="<b>Items are free of marks</b>" />,
			{ withProviders: false }
		);
		await user.click(await screen.findByRole("tab", { name: "Settings" }));

		const block = await screen.findByTestId("health-claim-text");
		expect(block).toHaveTextContent("Claim");
		expect(block).toHaveTextContent("<b>Items are free of marks</b>");
		expect(block.querySelector("b")).toBeNull();
		expect(
			block.compareDocumentPosition(screen.getByTestId("health-plain-words"))
		).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
	});

	it("shows no block for a claim without text", async () => {
		serve(NO_CRITERIA);
		const user = userEvent.setup();
		render(<HealthPanel {...CONTEXT} elementText="  " />, {
			withProviders: false,
		});
		await user.click(await screen.findByRole("tab", { name: "Settings" }));
		await screen.findByRole("combobox", { name: "Check" });

		expect(screen.queryByTestId("health-claim-text")).toBeNull();
	});
});

describe("Settings: one live-update subscription", () => {
	it("opens one subscription for the whole tab and refetches the settings from it", async () => {
		let open = 0;
		let mostOpen = 0;
		vi.mocked(useCaseEvents).mockImplementation((options) => {
			eventHandlers.push(options);
			useEffect(() => {
				if (!options.enabled) {
					return;
				}
				open += 1;
				mostOpen = Math.max(mostOpen, open);
				return () => {
					open -= 1;
				};
			}, [options.enabled]);
			return {
				status: "connected",
				isConnected: true,
				lastEvent: null,
				reconnect: vi.fn(),
				disconnect: vi.fn(),
			};
		});
		const served = serve(storedCriteria());
		let reads = 0;
		server.use(
			http.get(CRITERIA_URL, () => {
				reads += 1;
				return HttpResponse.json(served.criteria);
			})
		);
		const user = await openSettings();
		await screen.findByLabelText("Claim passes at");

		expect(open).toBe(1);
		expect(mostOpen).toBe(1);

		const before = reads;
		await user.click(screen.getByRole("tab", { name: "Results" }));
		for (const handler of eventHandlers.filter((entry) => entry.enabled)) {
			handler.onEvent?.({
				type: "tea.health/state-changed",
				payload: { claimId: "claim-42" },
			} as never);
		}
		await waitFor(() => expect(reads).toBeGreaterThan(before));
	});
});

describe("Settings: where a fresh pick's numbers come from", () => {
	it("says the numbers are the check's recommendation and count for nothing until accepted", async () => {
		serve(NO_CRITERIA);
		const user = await openSettings();
		await pick(user, ITEM_CHECK_NAME);

		const notice = await screen.findByTestId("health-fresh-pick-notice");
		expect(notice).toHaveTextContent(
			"These are the settings the check recommends. Nothing is used until you accept them. Change any number first if it does not fit this claim."
		);
		expect(
			notice.compareDocumentPosition(screen.getByTestId("health-plain-words"))
		).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
	});

	it("says so when the check recommends nothing", async () => {
		const served = serve(NO_CRITERIA);
		const [list] = checkLists();
		server.use(
			http.get("/api/cases/case-1/health/checks", () =>
				HttpResponse.json([
					{
						...list,
						checks: list?.checks.map((check) => ({
							...check,
							recommended: undefined,
						})),
					},
				])
			)
		);
		expect(served.puts).toEqual([]);
		const user = await openSettings();
		await pick(user, ITEM_CHECK_NAME);

		expect(
			await screen.findByTestId("health-fresh-pick-notice")
		).toHaveTextContent(
			"This check recommends no settings. Nothing is used until you accept the ones you enter."
		);
	});

	it("does not show the notice for settings that are already stored", async () => {
		serve(storedCriteria());
		await openSettings();
		await screen.findByLabelText("Claim passes at");

		expect(screen.queryByTestId("health-fresh-pick-notice")).toBeNull();
	});
});

describe("Settings: after the use of settings is stopped", () => {
	it("puts focus on the check picker, inside the view", async () => {
		const served = serve(storedCriteria());
		const user = await openSettings();
		await user.click(
			await screen.findByRole("button", { name: "Stop using these settings" })
		);
		await user.type(screen.getByLabelText("Reason"), "Check replaced");
		served.criteria = {
			...NO_CRITERIA,
			criteria: { ...storedCriteria().criteria, state: "inactive" } as never,
			last_change: {
				action: "retired",
				by_name: "Alice",
				at: "2026-10-02T11:00:00.000Z",
				reason: "Check replaced",
			},
		};
		await user.click(
			screen
				.getAllByRole("button", { name: "Stop using these settings" })
				.at(-1) as HTMLElement
		);

		const picker = await screen.findByRole("combobox", { name: "Check" });
		await waitFor(() => expect(picker).toHaveFocus());
	});
});

describe("Settings: moving to a newer version of the check", () => {
	function newerLists(): HealthCheckListOffer[] {
		const [list] = checkLists();
		return [
			{
				...(list as HealthCheckListOffer),
				checks: (list as HealthCheckListOffer).checks.map((check) =>
					check.name === ITEM_CHECK_NAME
						? {
								...check,
								version: "0.4",
								recommended: {
									...check.recommended,
									aggregation: {
										kind: "proportion" as const,
										params: {
											threshold: 0.9,
											avail_floor: 0.8,
											use_verdict: true,
										},
									},
									valid_for: "PT10M",
								},
							}
						: check
				),
			},
		];
	}

	function serveNewer(): Served {
		const served = serve(
			storedCriteria({ overrides: { check_offer: "newer-version" } })
		);
		server.use(
			http.get("/api/cases/case-1/health/checks", () =>
				HttpResponse.json(newerLists())
			)
		);
		return served;
	}

	it("offers the comparison to a person who can edit, and not to one who cannot", async () => {
		serveNewer();
		await openSettings(false);
		await screen.findByLabelText("Claim passes at");
		expect(
			screen.getByText(
				"The pipeline now offers a different version of this check."
			)
		).toBeVisible();
		expect(
			screen.queryByRole("button", { name: "Compare with version 0.4" })
		).toBeNull();
	});

	it("compares block by block, keeps what is kept, takes what is taken and saves only on Save", async () => {
		const served = serveNewer();
		const user = await openSettings();
		await user.click(
			await screen.findByRole("button", { name: "Compare with version 0.4" })
		);

		const aggregation = await screen.findByTestId("health-compare-aggregation");
		expect(aggregation).toHaveTextContent("Your accepted settings");
		expect(aggregation).toHaveTextContent("Recommended for version 0.4");
		expect(aggregation).toHaveTextContent("at least 95% of the items pass");
		expect(aggregation).toHaveTextContent("at least 90% of the items pass");
		const keep = within(aggregation).getByRole("radio", { name: "Keep yours" });
		expect(keep).toBeChecked();
		expect(screen.getByTestId("health-compare-rule")).not.toHaveTextContent(
			"Take the recommendation"
		);

		await user.click(
			within(aggregation).getByRole("radio", {
				name: "Take the recommendation",
			})
		);
		await user.click(screen.getByRole("button", { name: "Continue" }));

		expect(await screen.findByLabelText("Claim passes at")).toHaveValue("90");
		expect(screen.getByLabelText("Each result counts for")).toHaveValue("5");
		expect(screen.getByTestId("health-move-notice")).toHaveTextContent(
			"version 0.4"
		);
		expect(served.puts).toEqual([]);

		served.criteria = storedCriteria({ revision: 2 });
		await user.click(screen.getByRole("button", { name: "Save settings" }));
		await waitFor(() => expect(served.puts).toHaveLength(1));
		expect(served.puts[0]).toMatchObject({
			accept: true,
			settings: {
				check: { name: ITEM_CHECK_NAME, version: "0.4" },
				aggregation: { params: { threshold: 0.9 } },
				valid_for: "PT5M",
			},
		});
	});

	it("saves the new version even when every block is kept", async () => {
		const served = serveNewer();
		const user = await openSettings();
		await user.click(
			await screen.findByRole("button", { name: "Compare with version 0.4" })
		);
		await user.click(await screen.findByRole("button", { name: "Continue" }));

		await user.click(
			await screen.findByRole("button", { name: "Save settings" })
		);
		await waitFor(() => expect(served.puts).toHaveLength(1));
		expect(served.puts[0]).toMatchObject({
			settings: {
				check: { version: "0.4" },
				aggregation: { params: { threshold: 0.95 } },
			},
		});
	});

	it("returns to the form unchanged on Cancel", async () => {
		const served = serveNewer();
		const user = await openSettings();
		await user.click(
			await screen.findByRole("button", { name: "Compare with version 0.4" })
		);
		await user.click(await screen.findByRole("button", { name: "Cancel" }));

		expect(await screen.findByLabelText("Claim passes at")).toHaveValue("95");
		expect(screen.queryByTestId("health-version-compare")).toBeNull();
		expect(screen.queryByTestId("health-move-notice")).toBeNull();
		expect(served.puts).toEqual([]);
	});

	it("moves focus into the comparison, back to its button on Cancel, and to the notice on Continue", async () => {
		serveNewer();
		const user = await openSettings();
		const open = await screen.findByRole("button", {
			name: "Compare with version 0.4",
		});
		await user.click(open);

		const heading = await screen.findByRole("heading", {
			name: "Compare with version 0.4",
		});
		await waitFor(() => expect(heading).toHaveFocus());

		await user.click(screen.getByRole("button", { name: "Cancel" }));
		await waitFor(() =>
			expect(
				screen.getByRole("button", { name: "Compare with version 0.4" })
			).toHaveFocus()
		);

		await user.click(
			screen.getByRole("button", { name: "Compare with version 0.4" })
		);
		await user.click(await screen.findByRole("button", { name: "Continue" }));
		await waitFor(() =>
			expect(screen.getByTestId("health-move-notice")).toHaveFocus()
		);
	});
});
