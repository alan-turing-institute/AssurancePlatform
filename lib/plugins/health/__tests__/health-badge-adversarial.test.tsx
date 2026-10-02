import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/src/__tests__/mocks/server";
import {
	CLAIM_CONTEXT,
	installFakeEventSource,
} from "@/src/__tests__/utils/health-criteria-harness";
import { render, screen } from "@/src/__tests__/utils/test-utils";
import { HealthBadge } from "../health-badge";
import { describeBadge } from "../health-format";
import type { HealthMismatch, HealthStatus } from "../health-types";
import { status } from "./health-test-data";

const STATUS_URL = `/api/elements/${CLAIM_CONTEXT.elementId}/health`;
const MARK = "≠";
const STALE_LABEL =
	/^Health: passing, stale since .+, judged with different settings$/;

const MISMATCH: HealthMismatch = {
	state: "mismatch",
	differences: [{ field: "rule.version", declared: "r2", used: "r1" }],
};
const UNDECLARED: HealthMismatch = { state: "undeclared" };

beforeEach(() => {
	installFakeEventSource();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

function renderBadge(body: HealthStatus | null) {
	server.use(http.get(STATUS_URL, () => HttpResponse.json({ status: body })));
	return render(<HealthBadge {...CLAIM_CONTEXT} />, { withProviders: false });
}

describe("the mismatch mark on the badge", () => {
	it.each([
		["pass", "bg-success", "passing"],
		["marginal", "bg-warning", "marginal"],
		["fail", "bg-destructive", "failing"],
		["indeterminate", "bg-muted-foreground", "indeterminate"],
	] as const)("shows the mark beside a %s dot for each mismatch state, keeping the verdict colour", async (verdict, colour, word) => {
		for (const [mismatch, words] of [
			[MISMATCH, "judged with different settings"],
			[UNDECLARED, "no accepted settings"],
		] as const) {
			const { unmount } = renderBadge(status({ verdict, mismatch }));
			const dot = await screen.findByTestId("health-badge-dot");
			expect(dot).toHaveClass(colour);
			expect(dot).toHaveAttribute("aria-label", `Health: ${word}, ${words}`);
			const mark = screen.getByTestId("health-badge-mismatch-mark");
			expect(mark.textContent).toBe(MARK);
			expect(mark).toHaveAttribute("aria-hidden", "true");
			expect(mark).toHaveClass("text-muted-foreground");
			expect(dot.contains(mark)).toBe(false);
			unmount();
		}
	});

	it("shows the mark alongside the stale ring", async () => {
		renderBadge(
			status({
				verdict: "pass",
				stale: true,
				stale_reason: "expired",
				stale_since: "2026-10-02T09:00:00.000Z",
				mismatch: MISMATCH,
			})
		);
		const dot = await screen.findByTestId("health-badge-dot");
		expect(dot).toHaveClass("bg-success", "ring-2");
		expect(dot.getAttribute("aria-label")).toMatch(STALE_LABEL);
		expect(
			screen.getByTestId("health-badge-mismatch-mark")
		).toBeInTheDocument();
	});

	it("shows the mark beside the unfilled dot when every record is revoked", async () => {
		renderBadge(
			status({
				verdict: null,
				stale: true,
				stale_reason: "all-revoked",
				mismatch: UNDECLARED,
			})
		);
		const dot = await screen.findByTestId("health-badge-dot");
		expect(dot).toHaveAttribute(
			"aria-label",
			"Health: all evidence revoked, no accepted settings"
		);
		expect(dot).toHaveClass("bg-transparent");
		expect(
			screen.getByTestId("health-badge-mismatch-mark")
		).toBeInTheDocument();
	});

	it("shows no mark for a match, whatever the verdict", async () => {
		renderBadge(status({ verdict: "fail", mismatch: null }));
		const dot = await screen.findByTestId("health-badge-dot");
		expect(dot).toHaveAttribute("aria-label", "Health: failing");
		expect(screen.queryByTestId("health-badge-mismatch-mark")).toBeNull();
	});

	it("shows nothing at all for no status, or for a bound claim with no result, even with a mismatch set", async () => {
		const first = renderBadge(null);
		await new Promise((resolve) => setTimeout(resolve, 30));
		expect(screen.queryByTestId("health-badge-dot")).toBeNull();
		expect(screen.queryByTestId("health-badge-mismatch-mark")).toBeNull();
		first.unmount();
		renderBadge(
			status({
				verdict: null,
				record_id: null,
				timestamp: null,
				mismatch: UNDECLARED,
			})
		);
		await new Promise((resolve) => setTimeout(resolve, 30));
		expect(screen.queryByTestId("health-badge-dot")).toBeNull();
		expect(screen.queryByTestId("health-badge-mismatch-mark")).toBeNull();
	});

	it("keeps the mark out of the accessible name of whatever wraps the badge", async () => {
		server.use(
			http.get(STATUS_URL, () =>
				HttpResponse.json({
					status: status({ verdict: "pass", mismatch: MISMATCH }),
				})
			)
		);
		render(
			<button type="button">
				<span>G1</span>
				<HealthBadge {...CLAIM_CONTEXT} />
			</button>,
			{ withProviders: false }
		);
		await screen.findByTestId("health-badge-dot");
		const wrapper = screen.getByRole("button");
		expect(wrapper.textContent).toContain(MARK);
		const name = screen.getByRole("button", {
			name: "G1Health: passing, judged with different settings",
		});
		expect(name).toBe(wrapper);
		expect(screen.queryByRole("button", { name: new RegExp(MARK) })).toBeNull();
	});
});

describe("the badge's words", () => {
	it("adds the mismatch words after the verdict and the staleness", () => {
		expect(
			describeBadge(status({ verdict: "pass", mismatch: MISMATCH }), false)
		).toBe("Health: passing, judged with different settings");
		expect(
			describeBadge(
				status({ verdict: "marginal", mismatch: UNDECLARED }),
				false
			)
		).toBe("Health: marginal, no accepted settings");
		expect(
			describeBadge(
				status({
					verdict: "fail",
					mismatch: MISMATCH,
					stale_since: null,
					expires_at: null,
				}),
				true
			)
		).toBe("Health: failing, stale, judged with different settings");
	});

	it("leaves the words alone when the claim has no mismatch", () => {
		expect(describeBadge(status({ verdict: "pass" }), false)).toBe(
			"Health: passing"
		);
		expect(describeBadge(status({ verdict: null }), true)).toBe(
			"Health: all evidence revoked"
		);
	});
});
