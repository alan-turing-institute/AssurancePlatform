import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ElementSlotContext } from "@/lib/plugins/slots";
import { server } from "@/src/__tests__/mocks/server";
import { render, screen } from "@/src/__tests__/utils/test-utils";
import { HealthPanel } from "../health-panel";
import type { HealthLiveEvidenceNode } from "../health-types";
import { resetLiveNodesForTests } from "../live-evidence-nodes";
import { liveNode, status } from "./health-test-data";

vi.mock("@/hooks/use-case-events", () => ({
	CASE_RELOAD_EVENT_TYPES: [],
	subscribeToCaseEvents: vi.fn(() => () => undefined),
	useCaseEvents: vi.fn(),
}));

const NODE_CONTEXT: ElementSlotContext = {
	caseId: "case-1",
	elementId: "node-1",
	elementType: "evidence",
	canEdit: true,
};

function serveNodes(nodes: HealthLiveEvidenceNode[]) {
	server.use(
		http.get("/api/cases/case-1/health/evidence-nodes", () =>
			HttpResponse.json(nodes)
		)
	);
}

afterEach(() => {
	resetLiveNodesForTests();
});

describe("the Evidence tab of an evidence element", () => {
	it("names the claim a live node reports on and the claim's current result", async () => {
		serveNodes([liveNode({ status: status({ verdict: "marginal" }) })]);

		render(<HealthPanel {...NODE_CONTEXT} />, { withProviders: false });

		expect(
			await screen.findByTestId("health-live-node-claim")
		).toHaveTextContent("P1");
		expect(screen.getByTestId("health-live-node-result")).toHaveTextContent(
			"Marginal"
		);
		expect(screen.queryByRole("tab", { name: "Settings" })).toBeNull();
	});

	it("says when the result is out of date", async () => {
		serveNodes([
			liveNode({
				status: status({
					verdict: "pass",
					expires_at: new Date(Date.now() - 1000).toISOString(),
				}),
			}),
		]);

		render(<HealthPanel {...NODE_CONTEXT} />, { withProviders: false });

		expect(
			await screen.findByTestId("health-live-node-result")
		).toHaveTextContent("Passing, out of date");
	});

	it("has nothing to show for evidence that is not a live node", async () => {
		serveNodes([liveNode({ id: "another-node" })]);

		render(<HealthPanel {...NODE_CONTEXT} />, { withProviders: false });

		expect(await screen.findByText("Not applicable")).toBeInTheDocument();
		expect(screen.queryByTestId("health-live-node-panel")).toBeNull();
	});
});
