import { waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCaseEvents } from "@/hooks/use-case-events";
import type { ElementSlotContext } from "@/lib/plugins/slots";
import type { HealthCheck } from "@/lib/schemas/health-checks";
import { server } from "@/src/__tests__/mocks/server";
import { render, screen } from "@/src/__tests__/utils/test-utils";
import { HealthPanel } from "../health-panel";
import type { HealthCheckListOffer } from "../health-types";
import { INTEGRATION, NO_CRITERIA } from "./criteria-test-data";

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
const CHECK_NAME = "Panel Flatness Check";
const PASS_MARK_PATH_LINE = /aggregation\.rule\.params\.pass_values:/;
const PERCENTILE_PATH_LINE = /reduction\.params\.percentile:/;

// What a check published with a plain settings object is served as.
const PLAIN_CHECK = {
	name: CHECK_NAME,
	version: "2.1",
	scope: "panel",
	scope_label: { one: "panel", many: "panels" },
	value: { type: "number", unit: "mm" },
	params: [
		{ key: "max_gap", label: "Max gap", type: "duration", default: "PT12S" },
		{ key: "sample_count", label: "Sample count", type: "number", default: 5 },
		{ key: "strict", label: "Strict", type: "boolean", default: false },
		{ key: "mode", label: "Mode", type: "string", default: "fast" },
	],
	recommended: {
		rule: {
			kind: "threshold",
			direction: "minimize",
			params: { pass_values: 0.5 },
		},
		reduction: {
			kind: "percentile",
			params: { percentile: 90, avail_floor: 0.8 },
			rule: {
				kind: "threshold",
				direction: "maximize",
				params: { pass_values: 0.8 },
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
		window: "PT5M",
		valid_for: "PT30M",
	},
} as unknown as HealthCheck;

const LISTS: HealthCheckListOffer[] = [
	{
		integration: INTEGRATION,
		pipeline: "Plain pipeline",
		published_at: "2026-10-14T08:00:00.000Z",
		checks: [PLAIN_CHECK],
	},
];

beforeEach(() => {
	vi.mocked(useCaseEvents).mockImplementation(() => ({
		status: "connected",
		isConnected: true,
		lastEvent: null,
		reconnect: vi.fn(),
		disconnect: vi.fn(),
	}));
});

function serve(
	onPut?: (body: Record<string, unknown>) => Response | undefined
) {
	const puts: Record<string, any>[] = [];
	server.use(
		http.get("/api/machine/health/elements/claim-42/evidence", () =>
			HttpResponse.json({ evidence: [], next_before: null })
		),
		http.get("/api/elements/claim-42/health", () =>
			HttpResponse.json({ status: null })
		),
		http.get("/api/cases/case-1/health/checks", () => HttpResponse.json(LISTS)),
		http.get(CRITERIA_URL, () => HttpResponse.json(NO_CRITERIA)),
		http.put(CRITERIA_URL, async ({ request }) => {
			const body = (await request.json()) as Record<string, any>;
			puts.push(body);
			return (
				onPut?.(body) ?? HttpResponse.json({ error: "stored" }, { status: 500 })
			);
		})
	);
	return puts;
}

async function openAndPick() {
	const user = userEvent.setup();
	render(<HealthPanel {...CONTEXT} />, { withProviders: false });
	await user.click(await screen.findByRole("tab", { name: "Settings" }));
	await user.click(await screen.findByRole("combobox", { name: "Check" }));
	await user.click(await screen.findByRole("option", { name: CHECK_NAME }));
	return user;
}

describe("the settings form for a check published with plain settings", () => {
	it("shows each setting by its type and sends the values back unchanged on accept", async () => {
		const puts = serve();
		const user = await openAndPick();
		await user.click(
			await screen.findByRole("button", { name: "Show all settings" })
		);
		expect(await screen.findByLabelText("Max gap")).toHaveValue("12");
		expect(screen.getByText("seconds")).toBeInTheDocument();
		expect(screen.getByLabelText("Sample count")).toHaveValue("5");
		expect(screen.getByLabelText("Mode")).toHaveValue("fast");
		expect(screen.getByText("Strict")).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Accept settings" }));
		await waitFor(() => expect(puts).toHaveLength(1));
		const { settings } = puts[0] ?? {};
		expect(settings.check.params).toEqual({
			max_gap: "PT12S",
			sample_count: 5,
			strict: false,
			mode: "fast",
		});
		expect(settings.aggregation).toEqual({
			kind: "proportion",
			params: { avail_floor: 0.8, use_verdict: true },
			rule: {
				kind: "threshold",
				direction: "maximize",
				params: { pass_values: 0.95 },
			},
		});
		expect(settings.reduction.params).toEqual({
			percentile: 90,
			avail_floor: 0.8,
		});
		expect(JSON.stringify(settings)).not.toContain('"p":');
		expect(JSON.stringify(settings)).not.toContain('"threshold":0');
		expect(JSON.stringify(settings.aggregation)).not.toContain("version");
		expect(JSON.stringify(settings.reduction)).not.toContain("version");
	});

	it("sends the pass mark for a share of 0 as a rule and not as a missing value", async () => {
		const puts = serve();
		const user = await openAndPick();
		await user.click(
			await screen.findByRole("button", { name: "Show all settings" })
		);
		const pass = await screen.findByLabelText("Claim passes at");
		await user.clear(pass);
		await user.type(pass, "0");
		await user.click(screen.getByRole("button", { name: "Accept settings" }));
		await waitFor(() => expect(puts).toHaveLength(1));
		expect(puts[0]?.settings.aggregation.rule.params).toEqual({
			pass_values: 0,
		});
	});

	it("sends a pass mark of 100 as 1", async () => {
		const puts = serve();
		const user = await openAndPick();
		await user.click(
			await screen.findByRole("button", { name: "Show all settings" })
		);
		const pass = await screen.findByLabelText("Claim passes at");
		await user.clear(pass);
		await user.type(pass, "100");
		await user.click(screen.getByRole("button", { name: "Accept settings" }));
		await waitFor(() => expect(puts).toHaveLength(1));
		expect(puts[0]?.settings.aggregation.rule.params).toEqual({
			pass_values: 1,
		});
	});

	it("places a refused pass mark beside its field", async () => {
		const puts = serve(() =>
			HttpResponse.json(
				{
					error: "The server refused the settings",
					fieldErrors: {
						"settings.aggregation.rule.params.pass_values":
							"is refused by the server",
					},
				},
				{ status: 400 }
			)
		);
		const user = await openAndPick();
		await user.click(
			await screen.findByRole("button", { name: "Show all settings" })
		);
		await user.click(screen.getByRole("button", { name: "Accept settings" }));
		await waitFor(() => expect(puts).toHaveLength(1));
		const message = await screen.findByText("is refused by the server");
		expect(message).toBeVisible();
		// Placed beside the field: not listed under its dotted path in a general alert.
		expect(screen.queryByText(PASS_MARK_PATH_LINE)).toBeNull();
		const field = screen.getByLabelText("Claim passes at");
		const container = message.closest("div");
		expect(container).not.toBeNull();
		expect(
			within(container as HTMLElement).getByLabelText("Claim passes at")
		).toBe(field);
	});

	it("places a refused percentile beside its field", async () => {
		const puts = serve(() =>
			HttpResponse.json(
				{
					error: "The server refused the settings",
					fieldErrors: {
						"settings.reduction.params.percentile": "is refused by the server",
					},
				},
				{ status: 400 }
			)
		);
		const user = await openAndPick();
		await user.click(
			await screen.findByRole("button", { name: "Show all settings" })
		);
		await user.click(screen.getByRole("button", { name: "Accept settings" }));
		await waitFor(() => expect(puts).toHaveLength(1));
		expect(await screen.findByText("is refused by the server")).toBeVisible();
		expect(screen.queryByText(PERCENTILE_PATH_LINE)).toBeNull();
	});

	it("shows the pass mark and the percentile that the recommendation gives", async () => {
		serve();
		const user = await openAndPick();
		await user.click(
			await screen.findByRole("button", { name: "Show all settings" })
		);
		expect(await screen.findByLabelText("Claim passes at")).toHaveValue("95");
		expect(screen.getByLabelText("Percentile (0 to 100)")).toHaveValue("90");
	});
});

const SHORT_VIEW_LABEL = "The claim passes when this share of panels pass";

describe("the short view for a check published with plain settings", () => {
	it("shows the recommended pass mark and sends an edited one as a rule", async () => {
		const puts = serve();
		const user = await openAndPick();
		const pass = await screen.findByLabelText(SHORT_VIEW_LABEL);
		expect(pass).toHaveValue("95");
		await user.clear(pass);
		await user.type(pass, "90");
		await user.click(screen.getByRole("button", { name: "Accept settings" }));
		await waitFor(() => expect(puts).toHaveLength(1));
		const { aggregation } = puts[0]?.settings ?? {};
		expect(aggregation.rule.params).toEqual({ pass_values: 0.9 });
		expect(aggregation.params).toEqual({ avail_floor: 0.8, use_verdict: true });
	});

	it("places a refused pass mark beside the short view's field", async () => {
		const puts = serve(() =>
			HttpResponse.json(
				{
					error: "The server refused the settings",
					fieldErrors: {
						"settings.aggregation.rule.params.pass_values":
							"is refused by the server",
					},
				},
				{ status: 400 }
			)
		);
		const user = await openAndPick();
		await screen.findByLabelText(SHORT_VIEW_LABEL);
		await user.click(screen.getByRole("button", { name: "Accept settings" }));
		await waitFor(() => expect(puts).toHaveLength(1));
		const message = await screen.findByText("is refused by the server");
		expect(screen.queryByText(PASS_MARK_PATH_LINE)).toBeNull();
		const container = message.closest("div");
		expect(
			within(container as HTMLElement).getByLabelText(SHORT_VIEW_LABEL)
		).toBeInTheDocument();
	});

	it("refuses a blank pass mark on its own field before anything is sent", async () => {
		const puts = serve();
		const user = await openAndPick();
		const pass = await screen.findByLabelText(SHORT_VIEW_LABEL);
		await user.clear(pass);
		expect(
			screen.getByRole("button", { name: "Accept settings" })
		).toBeDisabled();
		expect(puts).toHaveLength(0);
	});
});
