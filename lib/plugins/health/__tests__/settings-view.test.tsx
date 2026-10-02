import { waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
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
import type { HealthCriteriaResponse } from "../health-types";
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
