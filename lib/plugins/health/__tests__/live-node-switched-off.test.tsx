import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEnabledPluginIds } from "@/hooks/use-plugin-enablement";
import { elementAppearanceSlot } from "@/lib/plugins/slots";
import {
	type CanvasWorld,
	enablePlugins,
	FakeEventSource,
	installCanvasWorld,
	listRequests,
	NodeProbe,
	registerHealthOnly,
	removeCanvasWorld,
	settle,
} from "@/src/__tests__/utils/live-node-canvas-kit";
import {
	healthStatus,
	liveNodeItem,
} from "@/src/__tests__/utils/live-node-ui-kit";
import useStore from "@/store/store";

vi.mock("@/hooks/use-plugin-enablement", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@/hooks/use-plugin-enablement")>();
	return { ...actual, useEnabledPluginIds: vi.fn() };
});

let world: CanvasWorld;

beforeEach(() => {
	world = installCanvasWorld();
	world.list = [liveNodeItem({ status: healthStatus({ verdict: "fail" }) })];
	registerHealthOnly();
});

afterEach(() => {
	removeCanvasWorld();
});

const looks = () => ({
	node: screen.getByTestId("node-look").textContent,
	edge: screen.getByTestId("edge-look").textContent,
});

/** What shows and what was asked for once the canvas has settled. */
async function whatHappened() {
	await settle();
	return {
		...looks(),
		badge: screen.queryByTestId("live-node-badge") !== null,
		listRequests: listRequests(world),
		listeners: FakeEventSource.all.length,
	};
}

const NOTHING = {
	node: "null",
	edge: "null",
	badge: false,
	listRequests: [],
	listeners: 0,
};

describe("with the plugin off", () => {
	it("fetches nothing and draws a node and its line as plain when the plugin is not on", async () => {
		enablePlugins([]);

		render(<NodeProbe />);

		expect(await whatHappened()).toEqual(NOTHING);
	});

	it("fetches nothing while the list of enabled plugins is still loading", async () => {
		enablePlugins(["tea.health"], true);

		render(<NodeProbe />);

		expect(await whatHappened()).toEqual(NOTHING);
	});

	it("fetches nothing when only other plugins are on", async () => {
		enablePlugins(["tea.assistant"]);

		render(<NodeProbe />);

		expect(await whatHappened()).toEqual(NOTHING);
	});

	it("stops drawing the look, and stops listening, when the plugin is turned off while the case is open", async () => {
		enablePlugins(["tea.health"]);
		const view = render(<NodeProbe />);
		await settle();
		expect(screen.queryByTestId("live-node-badge")).not.toBeNull();
		expect(FakeEventSource.all.filter((source) => !source.closed)).toHaveLength(
			1
		);

		enablePlugins([]);
		view.rerender(<NodeProbe />);
		await settle();

		expect(looks()).toEqual({ node: "null", edge: "null" });
		expect(screen.queryByTestId("live-node-badge")).toBeNull();
		expect(FakeEventSource.all.filter((source) => !source.closed)).toHaveLength(
			0
		);
	});
});

describe("on the read-only canvas of the documentation", () => {
	it("fetches nothing, not even the list of enabled plugins, and draws every node as plain", async () => {
		const actual = await vi.importActual<
			typeof import("@/hooks/use-plugin-enablement")
		>("@/hooks/use-plugin-enablement");
		vi.mocked(useEnabledPluginIds).mockImplementation(
			actual.useEnabledPluginIds
		);
		useStore.setState({
			assuranceCase: { id: "docs-case" } as never,
			readOnlyCanvas: true,
		});

		render(<NodeProbe />);
		await settle();

		expect(looks()).toEqual({ node: "null", edge: "null" });
		expect(screen.queryByTestId("live-node-badge")).toBeNull();
		expect(world.requests).toEqual([]);
		expect(FakeEventSource.all).toHaveLength(0);
	});
});

describe("with no plugin registered for the appearance slot", () => {
	it("draws a node and its line as plain, even with the plugin on", async () => {
		enablePlugins(["tea.health"]);
		elementAppearanceSlot.resetForTests();

		render(<NodeProbe />);
		await settle();

		expect(looks()).toEqual({ node: "null", edge: "null" });
	});
});

describe("with the plugin on", () => {
	it("draws the look and asks for the list once", async () => {
		enablePlugins(["tea.health"]);

		render(<NodeProbe />);
		await settle();

		expect(looks()).toEqual({
			node: JSON.stringify({ tone: "negative", faded: false }),
			edge: JSON.stringify({ tone: "negative", faded: false }),
		});
		expect(listRequests(world)).toHaveLength(1);
	});
});
