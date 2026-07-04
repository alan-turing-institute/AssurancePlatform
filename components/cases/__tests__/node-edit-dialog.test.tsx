import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import type { Node } from "reactflow";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ElementSlotContext } from "@/lib/plugins/slots";
import { elementPanelSlot } from "@/lib/plugins/slots";
import { server } from "@/src/__tests__/mocks/server";
import { render, screen, waitFor } from "@/src/__tests__/utils/test-utils";
import NodeEditDialog from "../node-edit-dialog";

const NODE: Node = {
	id: "1",
	type: "goal",
	position: { x: 0, y: 0 },
	data: {
		id: 1,
		name: "G1",
		description: "System is acceptably safe",
	},
};

function FakePanel({ elementId }: ElementSlotContext) {
	return <div data-testid="fake-panel-content">{`panel for ${elementId}`}</div>;
}

function mockPluginsResponse(enabled: boolean) {
	server.use(
		http.get("/api/user/plugins", () =>
			HttpResponse.json({
				plugins: [
					{
						pluginId: "tea.health",
						name: "Claim/Evidence Health",
						version: "0.1.0",
						available: true,
						enabled,
						pinnedAt: enabled ? null : "USER",
						settings: null,
					},
				],
			})
		)
	);
}

afterEach(() => {
	elementPanelSlot.resetForTests();
	vi.restoreAllMocks();
});

describe("NodeEditDialog — element-panel slot", () => {
	it("renders no tab strip when no plugin has registered a panel (pixel-equivalent to pre-slot dialog)", async () => {
		mockPluginsResponse(true);

		render(
			<NodeEditDialog
				node={NODE}
				nodeType="goal"
				onOpenChange={() => {
					// no-op for this assertion
				}}
				open={true}
			/>,
			{ withProviders: false }
		);

		await waitFor(() =>
			expect(screen.getByLabelText("Description")).toBeInTheDocument()
		);
		expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
	});

	it("adds a Details tab plus the plugin's tab once an enabled plugin registers a panel", async () => {
		const user = userEvent.setup();
		elementPanelSlot.register({
			pluginId: "tea.health",
			tabId: "tea.health",
			label: "Evidence",
			Component: FakePanel,
		});
		mockPluginsResponse(true);

		render(
			<NodeEditDialog
				node={NODE}
				nodeType="goal"
				onOpenChange={() => {
					// no-op for this assertion
				}}
				open={true}
			/>,
			{ withProviders: false }
		);

		await waitFor(() =>
			expect(screen.getByRole("tablist")).toBeInTheDocument()
		);
		expect(screen.getByRole("tab", { name: "Details" })).toBeInTheDocument();
		const evidenceTab = screen.getByRole("tab", { name: "Evidence" });
		expect(evidenceTab).toBeInTheDocument();

		await user.click(evidenceTab);

		await waitFor(() =>
			expect(screen.getByTestId("fake-panel-content")).toHaveTextContent(
				"panel for 1"
			)
		);
	});

	it("falls back to no tab strip when the registering plugin is disabled — off as if never registered", async () => {
		elementPanelSlot.register({
			pluginId: "tea.health",
			tabId: "tea.health",
			label: "Evidence",
			Component: FakePanel,
		});
		mockPluginsResponse(false);

		render(
			<NodeEditDialog
				node={NODE}
				nodeType="goal"
				onOpenChange={() => {
					// no-op for this assertion
				}}
				open={true}
			/>,
			{ withProviders: false }
		);

		await waitFor(() =>
			expect(screen.getByLabelText("Description")).toBeInTheDocument()
		);
		expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
		expect(screen.queryByText("Evidence")).not.toBeInTheDocument();
	});
});
