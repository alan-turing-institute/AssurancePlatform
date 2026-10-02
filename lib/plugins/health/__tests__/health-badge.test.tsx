import { waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UseCaseEventsOptions } from "@/hooks/use-case-events";
import { useCaseEvents } from "@/hooks/use-case-events";
import type { ElementSlotContext } from "@/lib/plugins/slots";
import { server } from "@/src/__tests__/mocks/server";
import { render, screen } from "@/src/__tests__/utils/test-utils";
import { HealthBadge } from "../health-badge";
import type { HealthStatus } from "../health-types";
import { status } from "./health-test-data";

vi.mock("@/hooks/use-case-events", () => ({
	useCaseEvents: vi.fn(),
}));

const CLAIM_CONTEXT: ElementSlotContext = {
	caseId: "case-1",
	elementId: "claim-42",
	elementType: "property",
};

const STALE_PASS_LABEL = /^Health: passing, stale since /;

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

function mockStatus(elementId: string, body: HealthStatus | null) {
	server.use(
		http.get(`/api/elements/${elementId}/health`, () =>
			HttpResponse.json({ status: body })
		)
	);
}

async function renderDot(body: HealthStatus) {
	mockStatus(CLAIM_CONTEXT.elementId, body);
	render(<HealthBadge {...CLAIM_CONTEXT} />, { withProviders: false });
	return await screen.findByTestId("health-badge-dot");
}

beforeEach(() => {
	capturedOptions = undefined;
	mockUseCaseEvents();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("HealthBadge — verdict colours", () => {
	it.each([
		["pass", "bg-success", "Health: passing"],
		["marginal", "bg-warning", "Health: marginal"],
		["fail", "bg-destructive", "Health: failing"],
		["indeterminate", "bg-muted-foreground", "Health: indeterminate"],
	] as const)("colours a %s verdict from the verdict alone", async (verdict, colour, label) => {
		const dot = await renderDot(status({ verdict }));
		expect(dot).toHaveClass(colour);
		expect(dot).not.toHaveClass("ring-2");
		expect(dot).toHaveAttribute("aria-label", label);
	});

	it("renders nothing while loading", async () => {
		mockStatus(CLAIM_CONTEXT.elementId, status());
		const { container } = render(<HealthBadge {...CLAIM_CONTEXT} />, {
			withProviders: false,
		});
		expect(container).toBeEmptyDOMElement();
		await screen.findByTestId("health-badge-dot");
	});
});

describe("HealthBadge — staleness", () => {
	it("keeps a stale pass green and adds the ring and the wording", async () => {
		const dot = await renderDot(
			status({
				stale: true,
				stale_reason: "expired",
				stale_since: "2026-10-02T09:08:00.000Z",
			})
		);
		expect(dot).toHaveClass("bg-success", "ring-2");
		expect(dot.getAttribute("aria-label")).toMatch(STALE_PASS_LABEL);
	});

	it("treats a status as stale once its expiry has passed on the viewer's clock", async () => {
		const dot = await renderDot(
			status({ expires_at: new Date(Date.now() - 1000).toISOString() })
		);
		expect(dot).toHaveClass("bg-success", "ring-2");
		expect(dot.getAttribute("aria-label")).toContain("stale since");
	});

	it("shows an unfilled, ringed dot when every record has been withdrawn", async () => {
		const dot = await renderDot(
			status({
				verdict: null,
				stale: true,
				stale_reason: "all-revoked",
				stale_since: "2026-10-02T09:08:00.000Z",
				expires_at: null,
			})
		);
		expect(dot).toHaveClass("bg-transparent", "ring-2");
		expect(dot).toHaveAttribute("aria-label", "Health: all evidence revoked");
	});
});

describe("HealthBadge — renders nothing", () => {
	it("when there is no status", async () => {
		mockStatus(CLAIM_CONTEXT.elementId, null);
		const { container } = render(<HealthBadge {...CLAIM_CONTEXT} />, {
			withProviders: false,
		});
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(container).toBeEmptyDOMElement();
	});

	it("when the claim is bound to a check but has no record yet", async () => {
		mockStatus(
			CLAIM_CONTEXT.elementId,
			status({
				verdict: null,
				expires_at: null,
				record_id: null,
				timestamp: null,
			})
		);
		const { container } = render(<HealthBadge {...CLAIM_CONTEXT} />, {
			withProviders: false,
		});
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(container).toBeEmptyDOMElement();
	});

	it("when the fetch fails", async () => {
		server.use(
			http.get(`/api/elements/${CLAIM_CONTEXT.elementId}/health`, () =>
				HttpResponse.json({ error: "boom" }, { status: 500 })
			)
		);
		const { container } = render(<HealthBadge {...CLAIM_CONTEXT} />, {
			withProviders: false,
		});
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(container).toBeEmptyDOMElement();
	});

	it("for a non-claim element, without making a request", async () => {
		let requested = false;
		server.use(
			http.get("/api/elements/goal-1/health", () => {
				requested = true;
				return HttpResponse.json({ status: null });
			})
		);
		const { container } = render(
			<HealthBadge {...CLAIM_CONTEXT} elementId="goal-1" elementType="goal" />,
			{ withProviders: false }
		);
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(container).toBeEmptyDOMElement();
		expect(requested).toBe(false);
	});
});

describe("HealthBadge — live update over SSE", () => {
	it("refetches when tea.health/state-changed arrives for this element", async () => {
		mockStatus(CLAIM_CONTEXT.elementId, status({ verdict: "pass" }));
		render(<HealthBadge {...CLAIM_CONTEXT} />, { withProviders: false });
		await waitFor(() =>
			expect(screen.getByTestId("health-badge-dot")).toHaveClass("bg-success")
		);

		mockStatus(CLAIM_CONTEXT.elementId, status({ verdict: "fail" }));
		capturedOptions?.onEvent?.({
			type: "tea.health/state-changed",
			caseId: CLAIM_CONTEXT.caseId,
			timestamp: new Date().toISOString(),
			payload: { claimId: CLAIM_CONTEXT.elementId },
		});

		await waitFor(() =>
			expect(screen.getByTestId("health-badge-dot")).toHaveClass(
				"bg-destructive"
			)
		);
	});
});
