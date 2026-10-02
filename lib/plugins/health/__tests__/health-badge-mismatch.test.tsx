import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ElementSlotContext } from "@/lib/plugins/slots";
import { server } from "@/src/__tests__/mocks/server";
import { render, screen } from "@/src/__tests__/utils/test-utils";
import { HealthBadge } from "../health-badge";
import { describeBadge } from "../health-format";
import type { HealthStatus } from "../health-types";
import { status } from "./health-test-data";

vi.mock("@/hooks/use-case-events", () => ({
	useCaseEvents: vi.fn(() => ({
		status: "connected",
		isConnected: true,
		lastEvent: null,
		reconnect: vi.fn(),
		disconnect: vi.fn(),
	})),
}));

const CONTEXT: ElementSlotContext = {
	caseId: "case-1",
	elementId: "claim-42",
	elementType: "property",
};

const STALE_MISMATCH_LABEL =
	/^Health: failing, stale since .*, judged with different settings$/;

const MISMATCH: HealthStatus["mismatch"] = {
	state: "mismatch",
	differences: [{ field: "rule.version", declared: "r2", used: "r1" }],
};

async function renderBadge(body: HealthStatus) {
	server.use(
		http.get("/api/elements/claim-42/health", () =>
			HttpResponse.json({ status: body })
		)
	);
	render(<HealthBadge {...CONTEXT} />, { withProviders: false });
	return await screen.findByTestId("health-badge-dot");
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("the mismatch mark on the health dot", () => {
	it("appears for a result judged with different settings, hidden from assistive technology", async () => {
		const dot = await renderBadge(status({ mismatch: MISMATCH }));
		const mark = screen.getByTestId("health-badge-mismatch-mark");
		expect(mark).toHaveTextContent("≠");
		expect(mark).toHaveAttribute("aria-hidden", "true");
		expect(dot).toHaveAttribute(
			"aria-label",
			"Health: passing, judged with different settings"
		);
	});

	it("appears when there are no accepted settings, and says so", async () => {
		const dot = await renderBadge(
			status({ mismatch: { state: "undeclared" } })
		);
		expect(screen.getByTestId("health-badge-mismatch-mark")).toBeVisible();
		expect(dot).toHaveAttribute(
			"aria-label",
			"Health: passing, no accepted settings"
		);
	});

	it("sits beside the stale ring and the verdict colour", async () => {
		const dot = await renderBadge(
			status({
				verdict: "fail",
				stale: true,
				stale_reason: "expired",
				stale_since: "2026-10-02T08:00:00.000Z",
				mismatch: MISMATCH,
			})
		);
		expect(screen.getByTestId("health-badge-mismatch-mark")).toBeVisible();
		expect(dot.className).toContain("bg-destructive");
		expect(dot.className).toContain("ring-2");
		expect(dot.getAttribute("aria-label")).toMatch(STALE_MISMATCH_LABEL);
	});

	it("is absent for a matching result", async () => {
		const dot = await renderBadge(status({ mismatch: null }));
		expect(screen.queryByTestId("health-badge-mismatch-mark")).toBeNull();
		expect(dot).toHaveAttribute("aria-label", "Health: passing");
	});
});

describe("describeBadge", () => {
	it("adds the settings words after the verdict and staleness", () => {
		expect(describeBadge(status({ mismatch: MISMATCH }), false)).toBe(
			"Health: passing, judged with different settings"
		);
		expect(
			describeBadge(status({ mismatch: { state: "undeclared" } }), false)
		).toBe("Health: passing, no accepted settings");
	});
});
