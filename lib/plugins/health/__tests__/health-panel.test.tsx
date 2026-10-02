import { waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UseCaseEventsOptions } from "@/hooks/use-case-events";
import { useCaseEvents } from "@/hooks/use-case-events";
import type { ElementSlotContext } from "@/lib/plugins/slots";
import { server } from "@/src/__tests__/mocks/server";
import { render, screen, within } from "@/src/__tests__/utils/test-utils";
import { HealthPanel } from "../health-panel";
import type { HealthEvidenceLogItem, HealthStatus } from "../health-types";
import { item, status } from "./health-test-data";

vi.mock("@/hooks/use-case-events", () => ({
	useCaseEvents: vi.fn(),
}));

const CLAIM_CONTEXT: ElementSlotContext = {
	caseId: "case-1",
	elementId: "claim-42",
	elementType: "property",
};
const EVIDENCE_URL = `/api/machine/health/elements/${CLAIM_CONTEXT.elementId}/evidence`;
const STATUS_URL = `/api/elements/${CLAIM_CONTEXT.elementId}/health`;

// Both hooks (log and status) subscribe, so each registers its own handler.
let capturedOptions: UseCaseEventsOptions[] = [];

function mockUseCaseEvents() {
	vi.mocked(useCaseEvents).mockImplementation((options) => {
		capturedOptions.push(options);
		return {
			status: "connected",
			isConnected: true,
			lastEvent: null,
			reconnect: vi.fn(),
			disconnect: vi.fn(),
		};
	});
}

function mockLog(
	evidence: HealthEvidenceLogItem[],
	health: HealthStatus | null = status(),
	nextBefore: number | null = null
) {
	server.use(
		http.get(EVIDENCE_URL, () =>
			HttpResponse.json({ evidence, next_before: nextBefore })
		),
		http.get(STATUS_URL, () => HttpResponse.json({ status: health }))
	);
}

beforeEach(() => {
	capturedOptions = [];
	mockUseCaseEvents();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("HealthPanel — states", () => {
	it("shows 'not applicable' for a goal, without making a request", async () => {
		let requested = false;
		server.use(
			http.get("/api/machine/health/elements/goal-1/evidence", () => {
				requested = true;
				return HttpResponse.json({ evidence: [], next_before: null });
			})
		);
		render(
			<HealthPanel {...CLAIM_CONTEXT} elementId="goal-1" elementType="goal" />,
			{ withProviders: false }
		);
		expect(screen.getByText("Not applicable")).toBeInTheDocument();
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(requested).toBe(false);
	});

	it("shows a skeleton, then an error state when the fetch fails", async () => {
		server.use(
			http.get(EVIDENCE_URL, () =>
				HttpResponse.json({ error: "boom" }, { status: 500 })
			),
			http.get(STATUS_URL, () => HttpResponse.json({ status: null }))
		);
		render(<HealthPanel {...CLAIM_CONTEXT} />, { withProviders: false });
		expect(screen.getByTestId("health-panel-loading")).toBeInTheDocument();
		await screen.findByText("Evidence unavailable");
	});

	it("shows 'No evidence yet' alone when there is no status", async () => {
		mockLog([], null);
		render(<HealthPanel {...CLAIM_CONTEXT} />, { withProviders: false });
		await screen.findByText("No evidence yet");
		expect(screen.queryByTestId("health-panel-header")).not.toBeInTheDocument();
	});

	it("shows the bound check above 'No evidence yet' for a bound claim with no record", async () => {
		mockLog([], status({ verdict: null, record_id: null, timestamp: null }));
		render(<HealthPanel {...CLAIM_CONTEXT} />, { withProviders: false });
		await screen.findByText("No evidence yet");
		expect(screen.getByTestId("health-panel-header")).toHaveTextContent(
			"Sensor Range Checker"
		);
	});

	it("says how many results were refused since the last accepted one", async () => {
		mockLog([item()], status({ rejected_since_last_accept: 3 }));
		render(<HealthPanel {...CLAIM_CONTEXT} />, { withProviders: false });
		await screen.findByText(
			"3 results were refused since the last accepted one. They named a different check."
		);
	});
});

describe("HealthPanel — a record", () => {
	it("shows the value, rule direction, method, window, validity, members and failed subjects", async () => {
		mockLog([item()]);
		render(<HealthPanel {...CLAIM_CONTEXT} />, { withProviders: false });
		const entry = await screen.findByTestId("health-evidence-entry");
		const text = entry.textContent ?? "";
		expect(text).toContain("Pass");
		expect(text).toContain("0.97 ratio");
		expect(text).toContain("at least 0.8");
		expect(text).toContain("Sensor Range Checker 1.2, scope sensor");
		expect(text).toContain("proportion");
		expect(text).toContain("Window: ");
		expect(text).toContain("for 1 hour, until ");
		expect(text).toContain("Members: 1");
		expect(text).toContain("sensor S-204");
		expect(text).toContain("PASS: 206, MARGINAL: 3, FAIL: 3");
	});

	it("shows judged and uncertainty with method, level, nature and validation", async () => {
		mockLog([
			item(
				{},
				{
					aggregation: undefined,
					judged: { statistic: "mean", method: "bootstrap", value: 0.9 },
					uncertainty: {
						kind: "interval",
						params: { lower: 0.85, upper: 0.95 },
						level: 0.95,
						method: "bootstrap",
						validated: false,
						nature: "sampling",
					},
				}
			),
		]);
		render(<HealthPanel {...CLAIM_CONTEXT} />, { withProviders: false });
		const entry = await screen.findByTestId("health-evidence-entry");
		expect(entry).toHaveTextContent("interval 0.85 to 0.95");
		expect(entry).toHaveTextContent(
			"95% level, method bootstrap, sampling uncertainty, not validated"
		);
		expect(entry).toHaveTextContent("mean 0.9 (bootstrap)");
	});

	it("words each rule direction", async () => {
		const rule = (direction: "minimize" | "target") => ({
			kind: "threshold" as const,
			direction,
			params: { pass_values: 2 },
			version: "r1",
		});
		mockLog([
			item(
				{ id: "a" },
				{ rule: rule("minimize"), reduction: undefined, aggregation: undefined }
			),
			item(
				{ id: "b" },
				{ rule: rule("target"), reduction: undefined, aggregation: undefined }
			),
		]);
		render(<HealthPanel {...CLAIM_CONTEXT} />, { withProviders: false });
		const entries = await screen.findAllByTestId("health-evidence-entry");
		expect(entries[0]).toHaveTextContent("at most 2");
		expect(entries[1]).toHaveTextContent("exactly 2");
	});

	it("labels an indeterminate record whose comment begins 'inapplicable' as Inapplicable", async () => {
		mockLog([
			item(
				{},
				{
					verdict: "indeterminate",
					value: undefined,
					comment: "INAPPLICABLE: no sensors in range",
				}
			),
		]);
		render(<HealthPanel {...CLAIM_CONTEXT} />, { withProviders: false });
		const entry = await screen.findByTestId("health-evidence-entry");
		expect(within(entry).getByText("Inapplicable")).toBeInTheDocument();
		expect(entry).not.toHaveTextContent("Indeterminate");
	});

	it("links provenance.run only when it starts http:// or https://", async () => {
		const withRun = (run: string, id: string) =>
			item(
				{ id },
				{
					provenance: { session: "S", pipeline_version: "1", run },
					aggregation: undefined,
				}
			);
		mockLog([
			withRun("https://example.org/run/1", "a"),
			withRun("javascript:alert(1)", "b"),
		]);
		render(<HealthPanel {...CLAIM_CONTEXT} />, { withProviders: false });
		await screen.findAllByTestId("health-evidence-entry");
		const link = screen.getByRole("link", {
			name: "https://example.org/run/1",
		});
		expect(link).toHaveAttribute("href", "https://example.org/run/1");
		expect(screen.getAllByRole("link")).toHaveLength(1);
		expect(screen.getByText("javascript:alert(1)")).toBeInTheDocument();
	});

	it("shows a revoked record with its cause, reason, who and when", async () => {
		mockLog([
			item({
				revocation: {
					cause: "evidence-defect",
					reason: "Wrong run",
					revoked_at: "2026-10-02T08:18:13.821Z",
					revoked_by_name: "alice",
				},
			}),
		]);
		render(<HealthPanel {...CLAIM_CONTEXT} />, { withProviders: false });
		const revoked = await screen.findByTestId("health-evidence-revoked");
		expect(revoked).toHaveTextContent("Revoked (Evidence defect): Wrong run");
		expect(revoked).toHaveTextContent("By alice");
	});

	it("keeps raw provenance and payload behind a closed disclosure, as text", async () => {
		mockLog([item({}, { payload: { note: "<b>bold</b>" } })]);
		render(<HealthPanel {...CLAIM_CONTEXT} />, { withProviders: false });
		const details = await screen.findByTestId("health-evidence-provenance");
		expect(details).not.toHaveAttribute("open");
		expect(details).toHaveTextContent("<b>bold</b>");
		expect(details.querySelector("b")).toBeNull();
	});
});

describe("HealthPanel — paging", () => {
	it("loads the next older page with 'Load older' until there is none", async () => {
		const requested: string[] = [];
		server.use(
			http.get(STATUS_URL, () => HttpResponse.json({ status: status() })),
			http.get(EVIDENCE_URL, ({ request }) => {
				const before = new URL(request.url).searchParams.get("before");
				requested.push(before ?? "none");
				return before
					? HttpResponse.json({
							evidence: [
								item(
									{ id: "old", chain_sequence: 1 },
									{ comment: "older one" }
								),
							],
							next_before: null,
						})
					: HttpResponse.json({
							evidence: [
								item(
									{ id: "new", chain_sequence: 2 },
									{ comment: "newer one" }
								),
							],
							next_before: 2,
						});
			})
		);
		const user = userEvent.setup();
		render(<HealthPanel {...CLAIM_CONTEXT} />, { withProviders: false });
		await screen.findByText("newer one");
		await user.click(screen.getByRole("button", { name: "Load older" }));
		await screen.findByText("older one");
		expect(requested).toEqual(["none", "2"]);
		expect(screen.queryByRole("button", { name: "Load older" })).toBeNull();
	});
});

describe("HealthPanel — controls", () => {
	it("shows no Revoke, Reinstate or Change control without canEdit", async () => {
		mockLog([item()]);
		render(<HealthPanel {...CLAIM_CONTEXT} />, { withProviders: false });
		await screen.findByTestId("health-evidence-entry");
		expect(screen.queryByRole("button", { name: "Revoke" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Change" })).toBeNull();
	});

	it("revokes a record with a cause and a reason, then refetches", async () => {
		let body: unknown;
		let url = "";
		mockLog([item()]);
		server.use(
			http.post(
				"/api/elements/claim-42/health/records/:recordId/revocation",
				async ({ request }) => {
					url = new URL(request.url).pathname;
					body = await request.json();
					return HttpResponse.json(
						{ revocation: {}, status: null },
						{ status: 201 }
					);
				}
			)
		);
		const user = userEvent.setup();
		render(<HealthPanel {...CLAIM_CONTEXT} canEdit />, {
			withProviders: false,
		});
		await user.click(await screen.findByRole("button", { name: "Revoke" }));

		const dialog = await screen.findByRole("dialog");
		const submit = within(dialog).getByRole("button", { name: "Revoke" });
		expect(submit).toBeDisabled();
		await user.click(within(dialog).getByLabelText("Duplicate"));
		await user.type(within(dialog).getByLabelText("Reason"), "Posted twice");
		await user.click(submit);

		await waitFor(() =>
			expect(body).toEqual({ cause: "duplicate", reason: "Posted twice" })
		);
		expect(url).toBe(
			"/api/elements/claim-42/health/records/e0bbe873-0000-4000-8000-000000000001/revocation"
		);
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
	});

	it("offers Reinstate on a revoked record and sends the reason", async () => {
		let body: unknown;
		mockLog([
			item({
				revocation: {
					cause: "other",
					reason: "x",
					revoked_at: "2026-10-02T08:18:13.821Z",
					revoked_by_name: "alice",
				},
			}),
		]);
		server.use(
			http.post(
				"/api/elements/claim-42/health/records/:recordId/reinstatement",
				async ({ request }) => {
					body = await request.json();
					return HttpResponse.json({ status: null });
				}
			)
		);
		const user = userEvent.setup();
		render(<HealthPanel {...CLAIM_CONTEXT} canEdit />, {
			withProviders: false,
		});
		await user.click(await screen.findByRole("button", { name: "Reinstate" }));
		const dialog = await screen.findByRole("dialog");
		await user.type(
			within(dialog).getByLabelText("Reason"),
			"Revoked in error"
		);
		await user.click(within(dialog).getByRole("button", { name: "Reinstate" }));
		await waitFor(() => expect(body).toEqual({ reason: "Revoked in error" }));
	});

	it("changes the accepted check from the header", async () => {
		let body: unknown;
		mockLog([item()]);
		server.use(
			http.put(
				"/api/elements/claim-42/health/bound-check",
				async ({ request }) => {
					body = await request.json();
					return HttpResponse.json({ status: null });
				}
			)
		);
		const user = userEvent.setup();
		render(<HealthPanel {...CLAIM_CONTEXT} canEdit />, {
			withProviders: false,
		});
		await user.click(await screen.findByRole("button", { name: "Change" }));
		const dialog = await screen.findByRole("dialog");
		await user.type(
			within(dialog).getByLabelText("New check name"),
			"Range v2"
		);
		await user.type(
			within(dialog).getByLabelText("Reason"),
			"Renamed upstream"
		);
		await user.click(
			within(dialog).getByRole("button", { name: "Change check" })
		);
		await waitFor(() =>
			expect(body).toEqual({ name: "Range v2", reason: "Renamed upstream" })
		);
	});

	it("keeps the dialog open when the server refuses", async () => {
		mockLog([item()]);
		server.use(
			http.post(
				"/api/elements/claim-42/health/records/:recordId/revocation",
				() =>
					HttpResponse.json(
						{ error: "Record already revoked" },
						{ status: 409 }
					)
			)
		);
		const user = userEvent.setup();
		render(<HealthPanel {...CLAIM_CONTEXT} canEdit />, {
			withProviders: false,
		});
		await user.click(await screen.findByRole("button", { name: "Revoke" }));
		const dialog = await screen.findByRole("dialog");
		await user.click(within(dialog).getByLabelText("Other"));
		await user.type(within(dialog).getByLabelText("Reason"), "x");
		await user.click(within(dialog).getByRole("button", { name: "Revoke" }));
		await waitFor(() =>
			expect(
				within(dialog).getByRole("button", { name: "Revoke" })
			).toBeEnabled()
		);
		expect(screen.getByRole("dialog")).toBeInTheDocument();
	});
});

describe("HealthPanel — live update over SSE", () => {
	it("refetches when tea.health/state-changed arrives for this claim", async () => {
		mockLog([item({}, { comment: "first" })]);
		render(<HealthPanel {...CLAIM_CONTEXT} />, { withProviders: false });
		await screen.findByText("first");
		mockLog([item({}, { comment: "second" })]);
		for (const options of capturedOptions) {
			options.onEvent?.({
				type: "tea.health/state-changed",
				caseId: CLAIM_CONTEXT.caseId,
				timestamp: new Date().toISOString(),
				payload: { claimId: CLAIM_CONTEXT.elementId },
			});
		}
		await screen.findByText("second");
	});
});
