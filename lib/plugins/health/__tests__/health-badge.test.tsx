import { waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UseCaseEventsOptions } from "@/hooks/use-case-events";
import { useCaseEvents } from "@/hooks/use-case-events";
import type { ElementSlotContext } from "@/lib/plugins/slots";
import { server } from "@/src/__tests__/mocks/server";
import { render, screen } from "@/src/__tests__/utils/test-utils";
import { HealthBadge } from "../health-badge";
import type { HealthState } from "../health-bands";

vi.mock("@/hooks/use-case-events", () => ({
	useCaseEvents: vi.fn(),
}));

const CLAIM_CONTEXT: ElementSlotContext = {
	caseId: "case-1",
	elementId: "claim-42",
	elementType: "property",
};

const DAY_SECONDS = 24 * 60 * 60;
const HOUR_MS = 60 * 60 * 1000;

/** Relative-to-real-time helpers — avoids combining fake timers with RTL's `waitFor` polling. */
const hoursAgo = (hours: number) =>
	new Date(Date.now() - hours * HOUR_MS).toISOString();

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

function mockHealthResponse(elementId: string, health: HealthState | null) {
	server.use(
		http.get(`/api/elements/${elementId}/health`, () =>
			HttpResponse.json({ health })
		)
	);
}

function mockHealthError(elementId: string) {
	server.use(
		http.get(`/api/elements/${elementId}/health`, () =>
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

describe("HealthBadge — bands", () => {
	it("renders nothing while loading", async () => {
		mockHealthResponse(CLAIM_CONTEXT.elementId, {
			score: 1,
			lastEvaluatedAt: hoursAgo(0),
			validityWindowSeconds: DAY_SECONDS,
		});
		const { container } = render(<HealthBadge {...CLAIM_CONTEXT} />, {
			withProviders: false,
		});
		expect(container).toBeEmptyDOMElement();

		// Let the in-flight fetch settle before the test tears down, so its
		// state update doesn't land outside an act() batch.
		await waitFor(() =>
			expect(screen.getByTestId("health-badge-dot")).toBeInTheDocument()
		);
	});

	it("renders the pass band for a score of 1", async () => {
		mockHealthResponse(CLAIM_CONTEXT.elementId, {
			score: 1,
			lastEvaluatedAt: hoursAgo(0),
			validityWindowSeconds: DAY_SECONDS,
		});
		render(<HealthBadge {...CLAIM_CONTEXT} />, { withProviders: false });

		await waitFor(() =>
			expect(screen.getByTestId("health-badge-dot")).toBeInTheDocument()
		);
		const dot = screen.getByTestId("health-badge-dot");
		expect(dot).toHaveClass("bg-success");
		expect(dot).toHaveAttribute("aria-label", "Health: passing");
	});

	it("renders the degraded band for a score of 0.5", async () => {
		mockHealthResponse(CLAIM_CONTEXT.elementId, {
			score: 0.5,
			lastEvaluatedAt: hoursAgo(0),
			validityWindowSeconds: DAY_SECONDS,
		});
		render(<HealthBadge {...CLAIM_CONTEXT} />, { withProviders: false });

		await waitFor(() =>
			expect(screen.getByTestId("health-badge-dot")).toHaveClass("bg-warning")
		);
		expect(screen.getByTestId("health-badge-dot")).toHaveAttribute(
			"aria-label",
			"Health: degraded"
		);
	});

	it("renders the fail band for a score of 0", async () => {
		mockHealthResponse(CLAIM_CONTEXT.elementId, {
			score: 0,
			lastEvaluatedAt: hoursAgo(0),
			validityWindowSeconds: DAY_SECONDS,
		});
		render(<HealthBadge {...CLAIM_CONTEXT} />, { withProviders: false });

		await waitFor(() =>
			expect(screen.getByTestId("health-badge-dot")).toHaveClass(
				"bg-destructive"
			)
		);
		expect(screen.getByTestId("health-badge-dot")).toHaveAttribute(
			"aria-label",
			"Health: failing"
		);
	});
});

describe("HealthBadge — staleness", () => {
	it("shows the quiet stale treatment when lastEvaluatedAt is outside the validity window", async () => {
		mockHealthResponse(CLAIM_CONTEXT.elementId, {
			score: 1,
			lastEvaluatedAt: hoursAgo(72), // 3 days ago, window is 24h
			validityWindowSeconds: DAY_SECONDS,
		});
		render(<HealthBadge {...CLAIM_CONTEXT} />, { withProviders: false });

		await waitFor(() =>
			expect(screen.getByTestId("health-badge-dot")).toHaveClass(
				"bg-muted-foreground"
			)
		);
		expect(screen.getByTestId("health-badge-dot")).toHaveAttribute(
			"aria-label",
			expect.stringContaining("Health: stale")
		);
	});

	it("does not show stale for a score within the validity window", async () => {
		mockHealthResponse(CLAIM_CONTEXT.elementId, {
			score: 1,
			lastEvaluatedAt: hoursAgo(1),
			validityWindowSeconds: DAY_SECONDS,
		});
		render(<HealthBadge {...CLAIM_CONTEXT} />, { withProviders: false });

		await waitFor(() =>
			expect(screen.getByTestId("health-badge-dot")).toHaveClass("bg-success")
		);
	});
});

describe("HealthBadge — fail-closed rendering", () => {
	it("renders nothing when there is no health data for the element", async () => {
		mockHealthResponse(CLAIM_CONTEXT.elementId, null);
		const { container } = render(<HealthBadge {...CLAIM_CONTEXT} />, {
			withProviders: false,
		});

		await waitFor(() => {
			expect(container).toBeEmptyDOMElement();
		});
	});

	it("renders nothing when the fetch fails", async () => {
		mockHealthError(CLAIM_CONTEXT.elementId);
		const { container } = render(<HealthBadge {...CLAIM_CONTEXT} />, {
			withProviders: false,
		});

		await waitFor(() => {
			expect(container).toBeEmptyDOMElement();
		});
	});

	it("renders nothing for a non-claim element type, without making a request", async () => {
		const goalContext: ElementSlotContext = {
			caseId: "case-1",
			elementId: "goal-1",
			elementType: "goal",
		};
		let requestMade = false;
		server.use(
			http.get(`/api/elements/${goalContext.elementId}/health`, () => {
				requestMade = true;
				return HttpResponse.json({
					health: {
						score: 1,
						lastEvaluatedAt: hoursAgo(0),
						validityWindowSeconds: DAY_SECONDS,
					},
				});
			})
		);

		const { container } = render(<HealthBadge {...goalContext} />, {
			withProviders: false,
		});

		// Give any (unwanted) effect a chance to fire before asserting absence.
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(container).toBeEmptyDOMElement();
		expect(requestMade).toBe(false);
	});
});

describe("HealthBadge — live update over SSE", () => {
	it("refetches when tea.health/state-changed arrives for this element", async () => {
		mockHealthResponse(CLAIM_CONTEXT.elementId, {
			score: 0,
			lastEvaluatedAt: hoursAgo(0),
			validityWindowSeconds: DAY_SECONDS,
		});
		render(<HealthBadge {...CLAIM_CONTEXT} />, { withProviders: false });

		await waitFor(() =>
			expect(screen.getByTestId("health-badge-dot")).toHaveClass(
				"bg-destructive"
			)
		);

		// The score changes server-side; a fresh evidence POST flips it to PASS.
		mockHealthResponse(CLAIM_CONTEXT.elementId, {
			score: 1,
			lastEvaluatedAt: hoursAgo(0),
			validityWindowSeconds: DAY_SECONDS,
		});

		expect(capturedOptions?.onEvent).toBeDefined();
		capturedOptions?.onEvent?.({
			type: "tea.health/state-changed",
			caseId: CLAIM_CONTEXT.caseId,
			timestamp: hoursAgo(0),
			payload: { claimId: CLAIM_CONTEXT.elementId },
		});

		await waitFor(() =>
			expect(screen.getByTestId("health-badge-dot")).toHaveClass("bg-success")
		);
	});

	it("ignores a state-changed event for a different claim", async () => {
		mockHealthResponse(CLAIM_CONTEXT.elementId, {
			score: 0,
			lastEvaluatedAt: hoursAgo(0),
			validityWindowSeconds: DAY_SECONDS,
		});
		render(<HealthBadge {...CLAIM_CONTEXT} />, { withProviders: false });

		await waitFor(() =>
			expect(screen.getByTestId("health-badge-dot")).toHaveClass(
				"bg-destructive"
			)
		);

		mockHealthResponse(CLAIM_CONTEXT.elementId, {
			score: 1,
			lastEvaluatedAt: hoursAgo(0),
			validityWindowSeconds: DAY_SECONDS,
		});
		capturedOptions?.onEvent?.({
			type: "tea.health/state-changed",
			caseId: CLAIM_CONTEXT.caseId,
			timestamp: hoursAgo(0),
			payload: { claimId: "some-other-claim" },
		});

		// Give any (unwanted) refetch a chance to resolve, then assert the
		// badge did NOT move off the original band.
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(screen.getByTestId("health-badge-dot")).toHaveClass(
			"bg-destructive"
		);
	});
});
