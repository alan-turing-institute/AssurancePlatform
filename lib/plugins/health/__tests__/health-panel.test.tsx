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
import type { HealthEvidenceLogItem } from "../use-health-evidence";

vi.mock("@/hooks/use-case-events", () => ({
	useCaseEvents: vi.fn(),
}));

const CLAIM_CONTEXT: ElementSlotContext = {
	caseId: "case-1",
	elementId: "claim-42",
	elementType: "property",
};

const RUN_ID_PROVENANCE_PATTERN = /"runId": "run-42"/;

let capturedOptions: UseCaseEventsOptions | undefined;

function mockUseCaseEvents() {
	vi.mocked(useCaseEvents).mockImplementation((options) => {
		capturedOptions = options;
		return {
			status: "connected",
			isConnected: true,
			lastEvent: null,
			reconnect: vi.fn(),
			disconnect: vi.fn(),
		};
	});
}

/** A fixture `satisfies` the real machine-endpoint response item shape (the contract-drift rule). */
function evidenceItem(
	overrides: Partial<HealthEvidenceLogItem> = {}
): HealthEvidenceLogItem {
	return {
		id: "evidence-1",
		claimId: CLAIM_CONTEXT.elementId,
		metricName: "in-distribution-rate",
		value: 0.98,
		threshold: 0.95,
		verdict: "PASS",
		oddDimensions: ["traffic-density"],
		sourceSystem: "darter-pipeline",
		provenance: { check: "ood-monitor/kl-divergence", runId: "run-1" },
		evaluatedAt: "2026-07-01T09:00:00.000Z",
		formatVersion: "0.1",
		recordHash: "hash-1",
		previousRecordHash: null,
		chainSequence: 1,
		createdAt: "2026-07-01T09:00:01.000Z",
		createdById: "system-user-1",
		...overrides,
	} satisfies HealthEvidenceLogItem;
}

function mockEvidenceResponse(
	claimId: string,
	evidence: HealthEvidenceLogItem[]
) {
	server.use(
		http.get(`/api/machine/health/elements/${claimId}/evidence`, () =>
			HttpResponse.json({ evidence })
		)
	);
}

function mockEvidenceError(claimId: string) {
	server.use(
		http.get(`/api/machine/health/elements/${claimId}/evidence`, () =>
			HttpResponse.json({ error: "boom" }, { status: 500 })
		)
	);
}

beforeEach(() => {
	capturedOptions = undefined;
	mockUseCaseEvents();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("HealthPanel — not applicable to non-claim elements", () => {
	it("renders a distinct 'not applicable' state for a goal, without making a request", async () => {
		const goalContext: ElementSlotContext = {
			caseId: "case-1",
			elementId: "goal-1",
			elementType: "goal",
		};
		let requestMade = false;
		server.use(
			http.get(
				`/api/machine/health/elements/${goalContext.elementId}/evidence`,
				() => {
					requestMade = true;
					return HttpResponse.json({ evidence: [] });
				}
			)
		);

		render(<HealthPanel {...goalContext} />, { withProviders: false });

		expect(screen.getByText("Not applicable")).toBeInTheDocument();
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(requestMade).toBe(false);
	});
});

describe("HealthPanel — loading and error states", () => {
	it("shows a loading skeleton before the log resolves", async () => {
		mockEvidenceResponse(CLAIM_CONTEXT.elementId, [evidenceItem()]);
		render(<HealthPanel {...CLAIM_CONTEXT} />, { withProviders: false });

		expect(screen.getByTestId("health-panel-loading")).toBeInTheDocument();

		// Let the in-flight fetch settle before the test tears down, so its
		// state update doesn't land outside an act() batch.
		await waitFor(() =>
			expect(screen.getByTestId("health-evidence-log")).toBeInTheDocument()
		);
	});

	it("shows an empty state when the log fetch fails", async () => {
		mockEvidenceError(CLAIM_CONTEXT.elementId);
		render(<HealthPanel {...CLAIM_CONTEXT} />, { withProviders: false });

		await waitFor(() =>
			expect(screen.getByText("Evidence unavailable")).toBeInTheDocument()
		);
	});

	it("shows an empty state when the claim has no evidence yet", async () => {
		mockEvidenceResponse(CLAIM_CONTEXT.elementId, []);
		render(<HealthPanel {...CLAIM_CONTEXT} />, { withProviders: false });

		await waitFor(() =>
			expect(screen.getByText("No evidence yet")).toBeInTheDocument()
		);
	});
});

describe("HealthPanel — renders the log", () => {
	it("renders entries newest-first with verdict, metric, value/threshold, source, and timestamp", async () => {
		mockEvidenceResponse(CLAIM_CONTEXT.elementId, [
			evidenceItem({
				id: "evidence-1",
				chainSequence: 1,
				verdict: "PASS",
				metricName: "in-distribution-rate",
			}),
			evidenceItem({
				id: "evidence-2",
				chainSequence: 2,
				verdict: "FAIL",
				metricName: "ood-divergence",
				value: 0.2,
				threshold: 0.1,
				sourceSystem: "darter-monitor",
			}),
		]);
		render(<HealthPanel {...CLAIM_CONTEXT} />, { withProviders: false });

		await waitFor(() =>
			expect(screen.getByTestId("health-evidence-log")).toBeInTheDocument()
		);

		const entries = screen.getAllByTestId("health-evidence-entry");
		expect(entries).toHaveLength(2);
		const [newest, oldest] = entries as [HTMLElement, HTMLElement];
		// Newest first: chainSequence 2 (FAIL/ood-divergence) before 1 (PASS).
		expect(within(newest).getByText("Fail")).toBeInTheDocument();
		expect(within(newest).getByText("ood-divergence")).toBeInTheDocument();
		expect(
			within(newest).getByText("Value: 0.2 — Threshold: 0.1")
		).toBeInTheDocument();
		expect(
			within(newest).getByText("Source: darter-monitor")
		).toBeInTheDocument();
		expect(within(oldest).getByText("Pass")).toBeInTheDocument();
		expect(
			within(oldest).getByText("in-distribution-rate")
		).toBeInTheDocument();
	});

	it("keeps provenance behind a closed-by-default disclosure", async () => {
		const user = userEvent.setup();
		mockEvidenceResponse(CLAIM_CONTEXT.elementId, [
			evidenceItem({
				provenance: { check: "ood-monitor/kl-divergence", runId: "run-42" },
			}),
		]);
		render(<HealthPanel {...CLAIM_CONTEXT} />, { withProviders: false });

		await waitFor(() =>
			expect(screen.getByTestId("health-evidence-log")).toBeInTheDocument()
		);

		// jsdom has no layout engine, so it never applies the UA stylesheet
		// that visually hides a closed <details>'s children — the content is
		// present in the DOM tree either way. The `open` attribute is the
		// actual, testable signal that the disclosure starts closed.
		const disclosure = screen.getByTestId("health-evidence-provenance");
		expect(disclosure).not.toHaveAttribute("open");
		expect(screen.getByText(RUN_ID_PROVENANCE_PATTERN)).toBeInTheDocument();

		await user.click(screen.getByText("Provenance"));

		expect(disclosure).toHaveAttribute("open");
	});
});

describe("HealthPanel — live update over SSE", () => {
	it("refetches the log when tea.health/state-changed arrives for this claim", async () => {
		mockEvidenceResponse(CLAIM_CONTEXT.elementId, [evidenceItem()]);
		render(<HealthPanel {...CLAIM_CONTEXT} />, { withProviders: false });

		await waitFor(() =>
			expect(screen.getAllByTestId("health-evidence-entry")).toHaveLength(1)
		);

		mockEvidenceResponse(CLAIM_CONTEXT.elementId, [
			evidenceItem({ id: "evidence-1", chainSequence: 1 }),
			evidenceItem({ id: "evidence-2", chainSequence: 2 }),
		]);
		expect(capturedOptions?.onEvent).toBeDefined();
		capturedOptions?.onEvent?.({
			type: "tea.health/state-changed",
			caseId: CLAIM_CONTEXT.caseId,
			timestamp: new Date().toISOString(),
			payload: { claimId: CLAIM_CONTEXT.elementId },
		});

		await waitFor(() =>
			expect(screen.getAllByTestId("health-evidence-entry")).toHaveLength(2)
		);
	});
});
