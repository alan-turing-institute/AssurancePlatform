import { renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
	AppearanceSubject,
	ElementSlotContext,
} from "@/lib/plugins/slots";
import { server } from "@/src/__tests__/mocks/server";
import { render, screen } from "@/src/__tests__/utils/test-utils";
import { appearanceOf, useHealthAppearance } from "../health-appearance";
import { HealthBadge } from "../health-badge";
import { liveNodeStateOf } from "../health-format";
import type { HealthLiveEvidenceNode, HealthStatus } from "../health-types";
import { resetLiveNodesForTests } from "../live-evidence-nodes";
import { liveNode, status } from "./health-test-data";

vi.mock("@/hooks/use-case-events", () => ({
	CASE_RELOAD_EVENT_TYPES: [],
	subscribeToCaseEvents: vi.fn(() => () => undefined),
	useCaseEvents: vi.fn(),
}));

const CASE_ID = "case-1";
const NODE_ID = "node-1";
const CLAIM_ID = "claim-42";
const LIST_URL = `/api/cases/${CASE_ID}/health/evidence-nodes`;

const NODE: AppearanceSubject = {
	kind: "node",
	caseId: CASE_ID,
	elementId: NODE_ID,
	elementType: "evidence",
};

const EDGE: AppearanceSubject = {
	kind: "edge",
	caseId: CASE_ID,
	sourceElementId: CLAIM_ID,
	targetElementId: NODE_ID,
};

let listRequests = 0;

function serveNodes(nodes: HealthLiveEvidenceNode[]) {
	server.use(
		http.get(LIST_URL, () => {
			listRequests += 1;
			return HttpResponse.json(nodes);
		})
	);
}

function serveClaimStatus(body: HealthStatus | null) {
	server.use(
		http.get(`/api/elements/${CLAIM_ID}/health`, () =>
			HttpResponse.json({ status: body })
		)
	);
}

beforeEach(() => {
	listRequests = 0;
});

afterEach(() => {
	resetLiveNodesForTests();
	vi.restoreAllMocks();
});

const PAST = () => new Date(Date.now() - 1000).toISOString();

const WITHDRAWN = (): HealthStatus =>
	status({
		verdict: null,
		stale: true,
		stale_reason: "all-revoked",
		stale_since: PAST(),
		expires_at: null,
	});

const NO_RESULT = (): HealthStatus =>
	status({ verdict: null, expires_at: null, record_id: null, timestamp: null });

describe("appearanceOf — the node's and the edge's look for each state", () => {
	it.each([
		["a pass", status({ verdict: "pass" }), { tone: "positive", faded: false }],
		[
			"a marginal",
			status({ verdict: "marginal" }),
			{ tone: "caution", faded: false },
		],
		["a fail", status({ verdict: "fail" }), { tone: "negative", faded: false }],
		[
			"an indeterminate",
			status({ verdict: "indeterminate" }),
			{ tone: "neutral", faded: false },
		],
		[
			"an expired pass, which keeps its tone and fades",
			status({ verdict: "pass", expires_at: PAST() }),
			{ tone: "positive", faded: true },
		],
		[
			"a pass whose condition no longer holds, which fades",
			status({ verdict: "pass", stale: true, stale_reason: "condition" }),
			{ tone: "positive", faded: true },
		],
		[
			"an expired fail, which keeps its tone and fades",
			status({ verdict: "fail", expires_at: PAST() }),
			{ tone: "negative", faded: true },
		],
		[
			"every result withdrawn, which fades and keeps the node's own colours",
			WITHDRAWN(),
			{ tone: null, faded: true },
		],
		["no result yet, which stays plain", NO_RESULT(), null],
		["no status at all, which stays plain", null, null],
	] as const)("gives %s", (_name, given, expected) => {
		expect(appearanceOf(liveNodeStateOf(given, Date.now()))).toEqual(expected);
	});

	it("is the same whether or not the result was judged with other settings", () => {
		const mismatch = status({
			mismatch: { state: "undeclared" },
		});
		expect(appearanceOf(liveNodeStateOf(mismatch, Date.now()))).toEqual({
			tone: "positive",
			faded: false,
		});
	});
});

describe("useHealthAppearance", () => {
	it("answers for a live node and for the edge from the claim it reports on", async () => {
		serveNodes([liveNode({ status: status({ verdict: "fail" }) })]);

		const node = renderHook(() => useHealthAppearance(NODE, true));
		const edge = renderHook(() => useHealthAppearance(EDGE, true));

		await waitFor(() =>
			expect(node.result.current).toEqual({ tone: "negative", faded: false })
		);
		expect(edge.result.current).toEqual({ tone: "negative", faded: false });
		expect(listRequests).toBe(1);
	});

	it("draws plain the edge from any other element, even into the same node", async () => {
		serveNodes([liveNode()]);

		const fromOtherClaim = renderHook(() =>
			useHealthAppearance({ ...EDGE, sourceElementId: "another-claim" }, true)
		);
		const own = renderHook(() => useHealthAppearance(EDGE, true));

		await waitFor(() => expect(own.result.current).not.toBeNull());
		expect(fromOtherClaim.result.current).toBeNull();
	});

	it("answers nothing for an element that is not a live node, with no request of its own", async () => {
		serveNodes([liveNode()]);

		const other = renderHook(() =>
			useHealthAppearance({ ...NODE, elementId: "plain-evidence" }, true)
		);
		const claim = renderHook(() =>
			useHealthAppearance(
				{ ...NODE, elementId: NODE_ID, elementType: "property" },
				true
			)
		);
		const live = renderHook(() => useHealthAppearance(NODE, true));

		await waitFor(() => expect(live.result.current).not.toBeNull());
		expect(other.result.current).toBeNull();
		expect(claim.result.current).toBeNull();
		expect(listRequests).toBe(1);
	});

	it("answers nothing, and asks for nothing, while the plugin is off", async () => {
		serveNodes([liveNode()]);

		const { result } = renderHook(() => useHealthAppearance(NODE, false));

		await new Promise((resolve) => setTimeout(resolve, 30));
		expect(result.current).toBeNull();
		expect(listRequests).toBe(0);
	});

	it("fades a result at the moment it expires, without waiting for a push", async () => {
		serveNodes([
			liveNode({
				status: status({
					verdict: "pass",
					expires_at: new Date(Date.now() + 300).toISOString(),
				}),
			}),
		]);

		const { result } = renderHook(() => useHealthAppearance(NODE, true));

		await waitFor(() =>
			expect(result.current).toEqual({ tone: "positive", faded: false })
		);
		await waitFor(() =>
			expect(result.current).toEqual({ tone: "positive", faded: true })
		);
	});
});

const NODE_CONTEXT: ElementSlotContext = {
	caseId: CASE_ID,
	elementId: NODE_ID,
	elementType: "evidence",
};

const CLAIM_CONTEXT: ElementSlotContext = {
	caseId: CASE_ID,
	elementId: CLAIM_ID,
	elementType: "property",
};

describe("HealthBadge on a live evidence node", () => {
	async function renderBadge(given: HealthStatus | null) {
		serveNodes([liveNode({ status: given })]);
		render(<HealthBadge {...NODE_CONTEXT} />, { withProviders: false });
		return await screen.findByTestId("live-node-badge");
	}

	it.each([
		["pass", "Passing"],
		["marginal", "Marginal"],
		["fail", "Failing"],
		["indeterminate", "Could not judge"],
	] as const)("says %s in words, with the live icon", async (verdict, word) => {
		const badge = await renderBadge(status({ verdict }));

		expect(badge).toHaveTextContent(word);
		expect(badge).toHaveAttribute("data-kind", verdict);
		expect(screen.getByTestId("live-node-icon")).toBeInTheDocument();
		expect(badge.querySelector("svg:not([data-testid])")).not.toBeNull();
		expect(badge).not.toHaveTextContent("Out of date");
	});

	it("shows the live icon and 'No result yet' before any result", async () => {
		const badge = await renderBadge(NO_RESULT());

		expect(badge).toHaveTextContent("No result yet");
		expect(screen.getByTestId("live-node-icon")).toBeInTheDocument();
	});

	it("adds a clock and 'Out of date' to the verdict once the result has expired", async () => {
		const badge = await renderBadge(
			status({ verdict: "pass", expires_at: PAST() })
		);

		expect(badge).toHaveTextContent("Passing");
		expect(badge).toHaveTextContent("Out of date");
		expect(badge).toHaveAttribute("data-stale", "");
	});

	it("shows a clock and 'No current result' when every result is withdrawn", async () => {
		const badge = await renderBadge(WITHDRAWN());

		expect(badge).toHaveTextContent("No current result");
		expect(badge).not.toHaveTextContent("Out of date");
		expect(badge.querySelector("svg:not([data-testid])")).not.toBeNull();
	});

	it("adds the unequal mark when the result was judged with other settings", async () => {
		const badge = await renderBadge(
			status({ mismatch: { state: "mismatch", differences: [] } })
		);

		expect(screen.getByTestId("live-node-mismatch-mark")).toHaveTextContent(
			"≠"
		);
		expect(badge).toHaveTextContent("Passing");
	});

	it("is labelled with the claim it reports on, then the claim badge's own label", async () => {
		const badge = await renderBadge(status({ verdict: "fail" }));

		expect(badge).toHaveAttribute(
			"aria-label",
			"Live results for P1. Health: failing"
		);
	});

	it("is labelled 'no result yet' for a claim with no result", async () => {
		const badge = await renderBadge(NO_RESULT());

		expect(badge).toHaveAttribute(
			"aria-label",
			"Live results for P1. Health: no result yet"
		);
	});

	it("shows nothing on evidence that is not a live node", async () => {
		serveNodes([liveNode({ id: "some-other-node" })]);
		const { container } = render(<HealthBadge {...NODE_CONTEXT} />, {
			withProviders: false,
		});

		await waitFor(() => expect(listRequests).toBe(1));
		await new Promise((resolve) => setTimeout(resolve, 30));
		expect(container).toBeEmptyDOMElement();
	});
});

describe("HealthBadge on a claim with a live node", () => {
	it("leaves out the dot while the claim's children are drawn", async () => {
		serveNodes([liveNode()]);
		serveClaimStatus(status());

		const { container } = render(
			<HealthBadge {...CLAIM_CONTEXT} childrenHidden={false} />,
			{ withProviders: false }
		);

		await waitFor(() => expect(listRequests).toBe(1));
		await new Promise((resolve) => setTimeout(resolve, 50));
		expect(container).toBeEmptyDOMElement();
	});

	it("shows the dot when the claim is collapsed", async () => {
		serveNodes([liveNode()]);
		serveClaimStatus(status());

		render(<HealthBadge {...CLAIM_CONTEXT} childrenHidden />, {
			withProviders: false,
		});

		expect(await screen.findByTestId("health-badge-dot")).toBeInTheDocument();
	});

	it("shows the dot of a claim that has no live node", async () => {
		serveNodes([liveNode({ claim_id: "another-claim" })]);
		serveClaimStatus(status());

		render(<HealthBadge {...CLAIM_CONTEXT} childrenHidden={false} />, {
			withProviders: false,
		});

		expect(await screen.findByTestId("health-badge-dot")).toBeInTheDocument();
	});

	it("brings the dot back when the claim is collapsed and hides it again on expanding", async () => {
		serveNodes([liveNode()]);
		serveClaimStatus(status());

		const view = render(
			<HealthBadge {...CLAIM_CONTEXT} childrenHidden={false} />,
			{ withProviders: false }
		);
		await waitFor(() => expect(listRequests).toBe(1));
		await new Promise((resolve) => setTimeout(resolve, 50));
		expect(screen.queryByTestId("health-badge-dot")).not.toBeInTheDocument();

		view.rerender(<HealthBadge {...CLAIM_CONTEXT} childrenHidden />);
		expect(await screen.findByTestId("health-badge-dot")).toBeInTheDocument();

		view.rerender(<HealthBadge {...CLAIM_CONTEXT} childrenHidden={false} />);
		await waitFor(() =>
			expect(screen.queryByTestId("health-badge-dot")).not.toBeInTheDocument()
		);
	});
});
