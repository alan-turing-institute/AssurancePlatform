import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	CASE_ID,
	type CanvasWorld,
	enablePlugins,
	installCanvasWorld,
	NODE_ID,
	registerHealthOnly,
	removeCanvasWorld,
	settle,
} from "@/src/__tests__/utils/live-node-canvas-kit";
import {
	everyResultWithdrawn,
	expiredResult,
	healthStatus,
	judgedWithOtherSettings,
	liveNodeItem,
	noResultYet,
} from "@/src/__tests__/utils/live-node-ui-kit";
import { HealthPanel } from "../health-panel";

vi.mock("@/hooks/use-plugin-enablement", () => ({
	useEnabledPluginIds: vi.fn(),
}));

let world: CanvasWorld;

beforeEach(() => {
	world = installCanvasWorld();
	enablePlugins(["tea.health"]);
	registerHealthOnly();
});

afterEach(() => {
	removeCanvasWorld();
});

async function openTab(elementId = NODE_ID) {
	render(
		<HealthPanel
			canEdit={true}
			caseId={CASE_ID}
			elementId={elementId}
			elementType="evidence"
		/>
	);
	await settle();
}

describe("the Evidence tab of a live evidence node", () => {
	it("names the claim the node reports on and says the node's text never carries a result", async () => {
		world.list = [liveNodeItem({ claim_name: "P7" })];
		await openTab();

		const panel = screen.getByTestId("health-live-node-panel");
		expect(panel).toHaveTextContent("claim P7");
		expect(panel).toHaveTextContent("never the result");
		expect(screen.getByTestId("health-live-node-claim")).toHaveTextContent(
			"P7"
		);
	});

	it.each([
		["a current pass", healthStatus({ verdict: "pass" }), "Passing"],
		["a current fail", healthStatus({ verdict: "fail" }), "Failing"],
		[
			"a result that could not be judged",
			healthStatus({ verdict: "indeterminate" }),
			"Could not judge",
		],
		["no result yet", noResultYet(), "No result yet"],
		[
			"an expired marginal result",
			expiredResult("marginal"),
			"Marginal, out of date",
		],
		["withdrawn results", everyResultWithdrawn(), "No current result"],
		[
			"a result judged with other settings",
			judgedWithOtherSettings(healthStatus({ verdict: "pass" })),
			"Passing, judged with different settings",
		],
	])("words %s as the node's badge does", async (_name, status, words) => {
		world.list = [liveNodeItem({ status })];
		await openTab();

		expect(screen.getByTestId("health-live-node-result")).toHaveTextContent(
			words
		);
	});

	it("says when the claim's result went out of date", async () => {
		world.list = [liveNodeItem({ status: expiredResult("pass") })];
		await openTab();

		expect(screen.getByTestId("health-live-node-panel")).toHaveTextContent(
			"The result went out of date on"
		);
	});

	it("says that no result has arrived yet", async () => {
		world.list = [liveNodeItem({ status: noResultYet() })];
		await openTab();

		expect(screen.getByTestId("health-live-node-panel")).toHaveTextContent(
			"No result has arrived for the claim yet."
		);
	});

	it("asks for the case's list of live nodes and for nothing about the evidence element itself", async () => {
		world.list = [liveNodeItem()];
		await openTab();

		expect(
			world.requests.filter((url) => url.startsWith("/api/elements"))
		).toEqual([]);
		expect(world.requests).toEqual([
			`/api/cases/${CASE_ID}/health/evidence-nodes`,
		]);
	});

	it("shows nothing for evidence that is not a live node", async () => {
		world.list = [liveNodeItem({ id: "another-node" })];
		await openTab();

		expect(screen.queryByTestId("health-live-node-panel")).toBeNull();
		expect(screen.getByText("Not applicable")).toBeVisible();
	});
});
