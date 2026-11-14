import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNodeAppearance } from "@/hooks/use-element-appearance";
import type { HealthVerdict } from "@/lib/schemas/health-evidence";
import {
	CASE_ID,
	type CanvasWorld,
	CLAIM_ID,
	emit,
	enablePlugins,
	installCanvasWorld,
	type Look,
	NODE_ID,
	NodeProbe,
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
import { HealthBadge } from "../health-badge";
import type { HealthStatus } from "../health-types";

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

function showNodeWith(status: HealthStatus | null) {
	world.list = [liveNodeItem({ status })];
}

async function drawNode() {
	const view = render(<NodeProbe />);
	await settle();
	return view;
}

const nodeLook = (): Look | null =>
	JSON.parse(screen.getByTestId("node-look").textContent ?? "null");
const edgeLook = (): Look | null =>
	JSON.parse(screen.getByTestId("edge-look").textContent ?? "null");
const badge = () => screen.getByTestId("live-node-badge");
const badgeWords = () => badge().textContent ?? "";
const icons = () => [...badge().querySelectorAll("svg")];

/** The shape of the icon that names the verdict itself, apart from its colour: the badge's second icon, after the "live" icon. */
function verdictIconClass(): string {
	const [, verdict] = icons();
	return (verdict?.getAttribute("class") ?? "")
		.split(" ")
		.filter((name) => name.startsWith("lucide-"))
		.join(" ");
}

describe("a live node's look for each verdict", () => {
	it.each([
		["pass", "Passing", "positive"],
		["marginal", "Marginal", "caution"],
		["fail", "Failing", "negative"],
		["indeterminate", "Could not judge", "neutral"],
	] as const)("a current %s result: the badge says %s, and the node and its line take the %s tone at full strength", async (verdict, word, tone) => {
		showNodeWith(healthStatus({ verdict }));
		await drawNode();

		expect(badgeWords()).toContain(word);
		expect(badgeWords()).not.toContain("Out of date");
		expect(nodeLook()).toEqual({ tone, faded: false });
		expect(edgeLook()).toEqual({ tone, faded: false });
	});

	it("a claim with no result yet: the badge says so, and the node and its line are drawn as plain", async () => {
		showNodeWith(noResultYet());
		await drawNode();

		expect(badgeWords()).toContain("No result yet");
		expect(nodeLook()).toBeNull();
		expect(edgeLook()).toBeNull();
	});

	it("a node whose claim status is not known yet is drawn as plain but still marked as live", async () => {
		showNodeWith(null);
		await drawNode();

		expect(badgeWords()).toContain("No result yet");
		expect(nodeLook()).toBeNull();
		expect(edgeLook()).toBeNull();
	});
});

describe("a live node's look when the result is out of date", () => {
	it.each([
		["pass", "Passing", "positive"],
		["marginal", "Marginal", "caution"],
		["fail", "Failing", "negative"],
		["indeterminate", "Could not judge", "neutral"],
	] as const)("an expired %s result keeps the %s badge, adds the out-of-date words, and fades the %s tone", async (verdict, word, tone) => {
		showNodeWith(expiredResult(verdict));
		await drawNode();

		expect(badgeWords()).toContain(word);
		expect(badgeWords()).toContain("Out of date");
		expect(nodeLook()).toEqual({ tone, faded: true });
		expect(edgeLook()).toEqual({ tone, faded: true });
	});

	it("takes a result as out of date when the server says so, whatever the clock says", async () => {
		showNodeWith(
			healthStatus({
				verdict: "fail",
				stale: true,
				stale_reason: "condition",
				expires_at: new Date(Date.now() + 3_600_000).toISOString(),
			})
		);
		await drawNode();

		expect(badgeWords()).toContain("Out of date");
		expect(nodeLook()).toEqual({ tone: "negative", faded: true });
	});

	it("fades the node and its line at the moment the badge changes to out of date, when the result expires on screen", async () => {
		showNodeWith(
			healthStatus({
				verdict: "pass",
				expires_at: new Date(Date.now() + 900).toISOString(),
			})
		);
		await drawNode();
		expect(badgeWords()).not.toContain("Out of date");
		expect(nodeLook()).toEqual({ tone: "positive", faded: false });
		expect(edgeLook()).toEqual({ tone: "positive", faded: false });

		await waitFor(() => expect(badgeWords()).toContain("Out of date"), {
			timeout: 3000,
		});
		await waitFor(() => {
			expect(nodeLook()).toEqual({ tone: "positive", faded: true });
			expect(edgeLook()).toEqual({ tone: "positive", faded: true });
		});
	});
});

describe("a live node's look when a result expires a long time from now", () => {
	const DAY = 24 * 60 * 60 * 1000;

	afterEach(() => {
		vi.useRealTimers();
	});

	it("stays as it is until the result expires, however long that takes, and then fades", async () => {
		vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
		showNodeWith(
			healthStatus({
				verdict: "pass",
				expires_at: new Date(Date.now() + 40 * DAY).toISOString(),
			})
		);
		render(<NodeProbe />);
		await act(async () => {
			await vi.advanceTimersByTimeAsync(10);
		});
		expect(nodeLook()).toEqual({ tone: "positive", faded: false });

		await act(async () => {
			await vi.advanceTimersByTimeAsync(30 * DAY);
		});
		expect(nodeLook()).toEqual({ tone: "positive", faded: false });
		expect(badgeWords()).not.toContain("Out of date");

		await act(async () => {
			await vi.advanceTimersByTimeAsync(11 * DAY);
		});
		expect(nodeLook()).toEqual({ tone: "positive", faded: true });
		expect(edgeLook()).toEqual({ tone: "positive", faded: true });
		expect(badgeWords()).toContain("Out of date");
	});
});

describe("a live node's look when every result has been withdrawn", () => {
	it("says there is no current result, with a clock, and fades the node and its line", async () => {
		showNodeWith(everyResultWithdrawn());
		await drawNode();

		expect(badgeWords()).toContain("No current result");
		expect(icons()).toHaveLength(2);
		expect(nodeLook()?.faded).toBe(true);
		expect(edgeLook()?.faded).toBe(true);
	});

	it("is drawn differently from a result that could not be judged and has expired", async () => {
		showNodeWith(everyResultWithdrawn());
		const withdrawn = await drawNode();
		const withdrawnLook = { node: nodeLook(), edge: edgeLook() };
		withdrawn.unmount();

		showNodeWith(expiredResult("indeterminate"));
		await drawNode();

		expect({ node: nodeLook(), edge: edgeLook() }).not.toEqual(withdrawnLook);
	});
});

describe("a live node's look when the result was judged with other settings", () => {
	it("adds the not-equal mark to the badge and changes nothing else", async () => {
		showNodeWith(
			judgedWithOtherSettings(healthStatus({ verdict: "marginal" }))
		);
		await drawNode();

		expect(badgeWords()).toContain("≠");
		expect(badgeWords()).toContain("Marginal");
		expect(nodeLook()).toEqual({ tone: "caution", faded: false });
		expect(edgeLook()).toEqual({ tone: "caution", faded: false });
	});

	it("shows the mark for a result that has no accepted settings to be judged against", async () => {
		showNodeWith({ ...healthStatus(), mismatch: { state: "undeclared" } });
		await drawNode();

		expect(badgeWords()).toContain("≠");
	});

	it("shows no mark for a result judged with the accepted settings", async () => {
		showNodeWith(healthStatus());
		await drawNode();

		expect(badgeWords()).not.toContain("≠");
	});
});

describe("colour is never the only cue", () => {
	const WORDS_BY_STATE: [string, () => HealthStatus][] = [
		["no result yet", noResultYet],
		["passing", () => healthStatus({ verdict: "pass" })],
		["marginal", () => healthStatus({ verdict: "marginal" })],
		["failing", () => healthStatus({ verdict: "fail" })],
		["could not judge", () => healthStatus({ verdict: "indeterminate" })],
		["withdrawn", everyResultWithdrawn],
	];

	it("gives every state its own words", async () => {
		const seen = new Map<string, string>();
		for (const [name, make] of WORDS_BY_STATE) {
			showNodeWith(make());
			const view = await drawNode();
			seen.set(name, badgeWords());
			view.unmount();
			removeCanvasWorld();
			world = installCanvasWorld();
			showNodeWith(make());
		}

		expect(new Set(seen.values()).size).toBe(WORDS_BY_STATE.length);
		for (const words of seen.values()) {
			expect(words.trim()).not.toBe("");
		}
	});

	it("gives each verdict an icon of its own beside the words", async () => {
		const classes: string[] = [];
		for (const verdict of [
			"pass",
			"marginal",
			"fail",
			"indeterminate",
		] as HealthVerdict[]) {
			removeCanvasWorld();
			world = installCanvasWorld();
			showNodeWith(healthStatus({ verdict }));
			const view = await drawNode();
			expect(icons()).toHaveLength(2);
			classes.push(verdictIconClass());
			view.unmount();
		}

		expect(new Set(classes).size).toBe(4);
		for (const className of classes) {
			expect(className).not.toBe("");
		}
	});

	it("marks every live node with a small live icon, including before any result arrives", async () => {
		showNodeWith(noResultYet());
		await drawNode();

		expect(icons()).toHaveLength(1);
	});

	it("adds a clock to an out-of-date verdict, so staleness shows without colour", async () => {
		showNodeWith(healthStatus({ verdict: "pass" }));
		const fresh = await drawNode();
		const freshIcons = icons().length;
		fresh.unmount();
		removeCanvasWorld();
		world = installCanvasWorld();

		showNodeWith(expiredResult("pass"));
		await drawNode();

		expect(icons().length).toBe(freshIcons + 1);
	});
});

describe("the spoken label of a live node", () => {
	it.each([
		["pass", "passing"],
		["marginal", "marginal"],
		["fail", "failing"],
		["indeterminate", "indeterminate"],
	] as const)("names the claim it reports on, then says the %s verdict as the claim's own dot does", async (verdict, said) => {
		showNodeWith(healthStatus({ verdict }));
		await drawNode();

		expect(badge()).toHaveAttribute(
			"aria-label",
			`Live results for P1. Health: ${said}`
		);
	});

	it("matches the claim's own dot, word for word, for the same status", async () => {
		const statuses: HealthStatus[] = [
			healthStatus({ verdict: "pass" }),
			expiredResult("marginal"),
			everyResultWithdrawn(),
			judgedWithOtherSettings(healthStatus({ verdict: "fail" })),
			{
				...healthStatus({ verdict: "pass" }),
				mismatch: { state: "undeclared" },
			},
		];
		for (const status of statuses) {
			removeCanvasWorld();
			world = installCanvasWorld();
			world.statuses[CLAIM_ID] = status;
			const dotView = render(
				<HealthBadge
					caseId={CASE_ID}
					elementId={CLAIM_ID}
					elementType="property"
				/>
			);
			const dot = await screen.findByTestId("health-badge-dot");
			const dotLabel = dot.getAttribute("aria-label");
			dotView.unmount();

			showNodeWith(status);
			const nodeView = await drawNode();
			expect(badge().getAttribute("aria-label")).toBe(
				`Live results for P1. ${dotLabel}`
			);
			nodeView.unmount();
		}
	});

	it.each([
		["a claim with no result yet", noResultYet()],
		["a claim whose status is not known yet", null],
	])("says that there is no result yet for %s, and never that results were withdrawn", async (_name, status) => {
		showNodeWith(status);
		await drawNode();

		expect(badge()).toHaveAttribute(
			"aria-label",
			"Live results for P1. Health: no result yet"
		);
	});

	it("says in words that the result is out of date", async () => {
		showNodeWith(expiredResult("pass"));
		await drawNode();

		expect(badge().getAttribute("aria-label")).toContain(
			"Live results for P1. Health: passing, stale since "
		);
	});

	it("says in words that every result was withdrawn, and that the settings differ", async () => {
		showNodeWith(everyResultWithdrawn());
		await drawNode();
		expect(badge().getAttribute("aria-label")).toBe(
			"Live results for P1. Health: all evidence revoked"
		);
	});
});

describe("the node and the claim's dot tell the same story", () => {
	it.each([
		["pass", "bg-success", "positive"],
		["marginal", "bg-warning", "caution"],
		["fail", "bg-destructive", "negative"],
		["indeterminate", "bg-muted-foreground", "neutral"],
	] as const)("a %s result is a %s dot and a %s node", async (verdict, dotClass, tone) => {
		const status = healthStatus({ verdict });
		world.statuses[CLAIM_ID] = status;
		const dotView = render(
			<HealthBadge
				caseId={CASE_ID}
				elementId={CLAIM_ID}
				elementType="property"
			/>
		);
		expect(await screen.findByTestId("health-badge-dot")).toHaveClass(dotClass);
		dotView.unmount();

		showNodeWith(status);
		await drawNode();
		expect(nodeLook()?.tone).toBe(tone);
	});
});

describe("a live node changes on screen after every change to the case or to a status", () => {
	const REFRESHING_EVENTS = [
		"case:updated",
		"comment:created",
		"comment:updated",
		"comment:deleted",
		"element:created",
		"element:updated",
		"element:deleted",
		"element:restored",
		"element:attached",
		"element:detached",
		"element:moved",
		"permission:changed",
		"tea.health/state-changed",
	];

	it.each(
		REFRESHING_EVENTS
	)("after a %s event the badge, the node and its line follow a changed status", async (type) => {
		showNodeWith(healthStatus({ verdict: "pass" }));
		await drawNode();
		expect(nodeLook()?.tone).toBe("positive");

		showNodeWith(healthStatus({ verdict: "fail" }));
		await emit(type);

		expect(badgeWords()).toContain("Failing");
		expect(nodeLook()).toEqual({ tone: "negative", faded: false });
		expect(edgeLook()).toEqual({ tone: "negative", faded: false });
	});

	it.each(
		REFRESHING_EVENTS
	)("after a %s event a node that is no longer live is drawn as plain evidence", async (type) => {
		showNodeWith(healthStatus({ verdict: "pass" }));
		await drawNode();
		expect(screen.queryByTestId("live-node-badge")).not.toBeNull();

		world.list = [];
		await emit(type);

		expect(screen.queryByTestId("live-node-badge")).toBeNull();
		expect(nodeLook()).toBeNull();
		expect(edgeLook()).toBeNull();
	});

	it("brings the look back when the node is live again", async () => {
		showNodeWith(healthStatus({ verdict: "marginal" }));
		await drawNode();
		world.list = [];
		await emit("element:moved");
		expect(nodeLook()).toBeNull();

		showNodeWith(healthStatus({ verdict: "marginal" }));
		await emit("element:restored");

		expect(nodeLook()).toEqual({ tone: "caution", faded: false });
		expect(badgeWords()).toContain("Marginal");
	});
});

function TypedProbe({ type }: { type: "goal" | "property" | "strategy" }) {
	const look = useNodeAppearance(NODE_ID, type);
	return <output data-testid="typed-look">{JSON.stringify(look)}</output>;
}

describe("an element that is not evidence", () => {
	it.each([
		"goal",
		"property",
		"strategy",
	] as const)("is never given the live look, even when a %s has the id of a live node", async (type) => {
		showNodeWith(healthStatus({ verdict: "fail" }));
		render(<TypedProbe type={type} />);
		await settle();

		expect(screen.getByTestId("typed-look").textContent).toBe("null");
	});
});

describe("only the line from the claim a node reports on is coloured", () => {
	it("colours the line from that claim and no other line to the node", async () => {
		showNodeWith(healthStatus({ verdict: "fail" }));
		const views = [
			render(<NodeProbe claimId={CLAIM_ID} />),
			render(<NodeProbe claimId="another-claim" />),
		];
		await settle();

		const looks = screen
			.getAllByTestId("edge-look")
			.map((element) => JSON.parse(element.textContent ?? "null"));
		expect(looks).toEqual([{ tone: "negative", faded: false }, null]);
		for (const view of views) {
			view.unmount();
		}
	});

	it("draws the node itself the same whichever claim's line is asked about", async () => {
		showNodeWith(healthStatus({ verdict: "pass" }));
		render(<NodeProbe claimId="another-claim" />);
		await settle();

		expect(nodeLook()).toEqual({ tone: "positive", faded: false });
		expect(edgeLook()).toBeNull();
	});

	it("does not colour a line that runs the other way, or one with an end missing", async () => {
		showNodeWith(healthStatus({ verdict: "fail" }));
		const reversed = render(<NodeProbe claimId={NODE_ID} nodeId={CLAIM_ID} />);
		await settle();
		expect(edgeLook()).toBeNull();
		reversed.unmount();

		render(<NodeProbe claimId="" />);
		await settle();
		expect(edgeLook()).toBeNull();
	});
});
