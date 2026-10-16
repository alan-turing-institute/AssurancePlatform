import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNodeTopRightActions } from "@/hooks/use-node-top-right-actions";
import { convertAssuranceCase } from "@/lib/case/convert-case";
import { toggleHiddenForChildren } from "@/lib/case/tree-utils";
import type { AssuranceCaseResponse } from "@/lib/services/case-response-types";
import {
	type CanvasWorld,
	emit,
	enablePlugins,
	installCanvasWorld,
	registerHealthOnly,
	removeCanvasWorld,
	settle,
} from "@/src/__tests__/utils/live-node-canvas-kit";
import {
	healthStatus,
	liveNodeItem,
} from "@/src/__tests__/utils/live-node-ui-kit";
import useStore from "@/store/store";

vi.mock("@/hooks/use-plugin-enablement", () => ({
	useEnabledPluginIds: vi.fn(),
}));

/** A goal G1 with claim P1, which holds evidence E1 and, for some tests, a sub-claim P2. */
function caseWith(options: { subClaim: boolean; evidence?: boolean }) {
	return {
		id: "case-1",
		goals: [
			{
				id: "g1",
				name: "G1",
				type: "TopLevelNormativeGoal",
				propertyClaims: [
					{
						id: "p1",
						name: "P1",
						type: "PropertyClaim",
						evidence:
							options.evidence === false
								? []
								: [{ id: "e1", name: "E1", type: "Evidence" }],
						propertyClaims: options.subClaim
							? [
									{
										id: "p2",
										name: "P2",
										type: "PropertyClaim",
										evidence: [],
										propertyClaims: [],
									},
								]
							: [],
					},
				],
			},
		],
	} as unknown as AssuranceCaseResponse;
}

/** Puts the case on the canvas as the editor does after a collapse: from the case JSON's hidden flags. */
function showCase(assuranceCase: AssuranceCaseResponse) {
	const { caseNodes } = convertAssuranceCase({
		...assuranceCase,
		goals: assuranceCase.goals ?? [],
	});
	useStore.setState({ nodes: caseNodes });
}

/** What the claim node draws in its top-right corner, exactly as the canvas builds it. */
function ClaimCorner({ id, elementId }: { elementId: string; id: string }) {
	const corner = useNodeTopRightActions({ id: elementId }, "property", id);
	return <div data-testid={`corner-${elementId}`}>{corner}</div>;
}

let world: CanvasWorld;

beforeEach(() => {
	world = installCanvasWorld();
	enablePlugins(["tea.health"]);
	registerHealthOnly();
	world.statuses.p1 = healthStatus({ verdict: "pass" });
	world.statuses.p2 = healthStatus({ verdict: "fail" });
});

afterEach(() => {
	removeCanvasWorld();
});

function withLiveNodeOn(claimId: string) {
	world.list = [
		liveNodeItem({ id: "e1", claim_id: claimId, claim_name: "P1" }),
	];
}

async function drawClaim(elementId = "p1", nodeId = "property-p1") {
	render(<ClaimCorner elementId={elementId} id={nodeId} />);
	await settle();
}

const dot = () => screen.queryByTestId("health-badge-dot");

describe("a claim's own dot while its claim has a live node", () => {
	it("is hidden while the claim is expanded", async () => {
		const assuranceCase = caseWith({ subClaim: false });
		showCase(assuranceCase);
		withLiveNodeOn("p1");

		await drawClaim();

		expect(dot()).toBeNull();
	});

	it("is hidden for a claim whose children are only evidence", async () => {
		showCase(caseWith({ subClaim: false }));
		withLiveNodeOn("p1");

		await drawClaim();

		expect(dot()).toBeNull();
	});

	it("is hidden for a claim that also has a sub-claim", async () => {
		showCase(caseWith({ subClaim: true }));
		withLiveNodeOn("p1");

		await drawClaim();

		expect(dot()).toBeNull();
	});

	it("shows when the claim is collapsed, and hides again when it is expanded", async () => {
		const expanded = caseWith({ subClaim: false });
		showCase(expanded);
		withLiveNodeOn("p1");
		const view = render(<ClaimCorner elementId="p1" id="property-p1" />);
		await settle();
		expect(dot()).toBeNull();

		const collapsed = toggleHiddenForChildren(expanded, "p1");
		showCase(collapsed);
		await settle();
		expect(dot()).not.toBeNull();

		showCase(toggleHiddenForChildren(collapsed, "p1"));
		await settle();
		expect(dot()).toBeNull();
		view.unmount();
	});

	it("shows when a claim with a sub-claim and evidence is collapsed", async () => {
		const expanded = caseWith({ subClaim: true });
		withLiveNodeOn("p1");
		showCase(toggleHiddenForChildren(expanded, "p1"));

		await drawClaim();

		expect(dot()).not.toBeNull();
	});

	it("shows again, without a reload, once the node is no longer live", async () => {
		showCase(caseWith({ subClaim: false }));
		withLiveNodeOn("p1");
		await drawClaim();
		expect(dot()).toBeNull();

		world.list = [];
		await emit("element:moved");

		expect(dot()).not.toBeNull();
	});

	it("hides when the node becomes live while the claim is on screen", async () => {
		showCase(caseWith({ subClaim: false }));
		await drawClaim();
		expect(dot()).not.toBeNull();

		withLiveNodeOn("p1");
		await emit("tea.health/state-changed");

		expect(dot()).toBeNull();
	});
});

describe("a claim's own dot while the list of live nodes is still being read", () => {
	it("is not drawn and then removed when the claim turns out to have a live node", async () => {
		showCase(caseWith({ subClaim: false }));
		withLiveNodeOn("p1");
		let release: () => void = () => undefined;
		world.listGate = new Promise<void>((resolve) => {
			release = resolve;
		});
		let appeared = false;
		const observer = new MutationObserver(() => {
			appeared = appeared || dot() !== null;
		});
		observer.observe(document.body, { childList: true, subtree: true });

		await drawClaim();
		expect(dot()).toBeNull();
		release();
		await settle();
		observer.disconnect();

		expect(dot()).toBeNull();
		expect(appeared).toBe(false);
	});
});

describe("a claim's own dot when the claim has no live node", () => {
	it("shows as it does today for a claim with settings accepted but no node", async () => {
		showCase(caseWith({ subClaim: false }));
		world.list = [];

		await drawClaim();

		expect(dot()).toHaveAttribute("aria-label", "Health: passing");
	});

	it("shows for a claim bound only by results, with no node and no accepted settings", async () => {
		showCase(caseWith({ subClaim: false, evidence: false }));
		world.list = [];
		world.statuses.p1 = healthStatus({
			verdict: "marginal",
			mismatch: { state: "undeclared" },
		});

		await drawClaim();

		expect(dot()).toHaveAttribute(
			"aria-label",
			"Health: marginal, no accepted settings"
		);
	});

	it("shows when another claim has the live node", async () => {
		showCase(caseWith({ subClaim: true }));
		withLiveNodeOn("p2");

		await drawClaim("p1", "property-p1");

		expect(dot()).not.toBeNull();
	});

	it("shows when the list of live nodes cannot be read", async () => {
		showCase(caseWith({ subClaim: false }));
		world.listFails = true;

		await drawClaim();

		expect(dot()).not.toBeNull();
	});

	it("shows when the whole list is empty even though the claim is collapsed", async () => {
		showCase(toggleHiddenForChildren(caseWith({ subClaim: false }), "p1"));
		world.list = [];

		await drawClaim();

		expect(dot()).not.toBeNull();
	});
});

describe("elements other than property claims", () => {
	it("draws no dot and no live badge on a goal, even when its id appears in the list", async () => {
		showCase(caseWith({ subClaim: false }));
		world.list = [liveNodeItem({ id: "g1", claim_id: "g1" })];
		world.statuses.g1 = healthStatus({ verdict: "fail" });

		function GoalCorner() {
			const corner = useNodeTopRightActions({ id: "g1" }, "goal", "goal-g1");
			return <div data-testid="goal-corner">{corner}</div>;
		}
		render(<GoalCorner />);
		await settle();

		expect(dot()).toBeNull();
		expect(screen.queryByTestId("live-node-badge")).toBeNull();
	});
});
