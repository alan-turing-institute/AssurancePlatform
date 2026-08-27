import { waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import type { Node } from "reactflow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ElementSlotContext } from "@/lib/plugins/slots";
import { elementPanelSlot } from "@/lib/plugins/slots";
import type { PluginSettingsListItem } from "@/lib/schemas/plugin";
import { recordUpdate } from "@/lib/services/history-service";
import { toast } from "@/lib/toast";
import { server } from "@/src/__tests__/mocks/server";
import { render, screen } from "@/src/__tests__/utils/test-utils";
import useStore from "@/store/store";
import NodeEditDialog from "../node-edit-dialog";

// NodeEditDialog derives its read-only state from the case permission held
// in the store, so every test in this file needs a permission that renders
// it editable unless the test is specifically exercising read-only mode.
function resetStoreToEditable(): void {
	useStore.setState({
		assuranceCase: {
			id: "case-1",
			name: "Test Case",
			type: "assurance-case",
			permissions: "manage",
			createdDate: new Date().toISOString(),
			comments: [],
		},
	});
}

vi.mock("@/lib/services/history-service", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@/lib/services/history-service")>();
	return { ...actual, recordUpdate: vi.fn() };
});

vi.mock("@/lib/toast", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/toast")>();
	return { ...actual, toast: vi.fn() };
});

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
				] satisfies PluginSettingsListItem[],
			})
		)
	);
}

beforeEach(() => {
	resetStoreToEditable();
});

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

describe("NodeEditDialog — form reset on node changes while open", () => {
	it("keeps unsaved edits when the host re-renders with a new `node` object for the same element", async () => {
		const user = userEvent.setup();
		mockPluginsResponse(true);

		const { rerender } = render(
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

		const description = await screen.findByLabelText("Description");
		await user.clear(description);
		await user.type(description, "Draft edit not yet saved");
		expect(description).toHaveValue("Draft edit not yet saved");

		// Same element (same `node.data.id`), but a brand-new object — as
		// every host node component builds inline on each render.
		const churnedNode: Node = {
			...NODE,
			data: { ...NODE.data },
		};
		expect(churnedNode).not.toBe(NODE);

		rerender(
			<NodeEditDialog
				node={churnedNode}
				nodeType="goal"
				onOpenChange={() => {
					// no-op for this assertion
				}}
				open={true}
			/>
		);

		expect(screen.getByLabelText("Description")).toHaveValue(
			"Draft edit not yet saved"
		);
	});

	it("reloads the form when a genuinely different element is passed in while open", async () => {
		mockPluginsResponse(true);

		const { rerender } = render(
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

		await screen.findByLabelText("Description");
		expect(screen.getByLabelText("Description")).toHaveValue(
			"System is acceptably safe"
		);

		const otherNode: Node = {
			id: "2",
			type: "goal",
			position: { x: 0, y: 0 },
			data: {
				id: 2,
				name: "G2",
				description: "System is appropriately monitored",
			},
		};

		rerender(
			<NodeEditDialog
				node={otherNode}
				nodeType="goal"
				onOpenChange={() => {
					// no-op for this assertion
				}}
				open={true}
			/>
		);

		await waitFor(() =>
			expect(screen.getByLabelText("Description")).toHaveValue(
				"System is appropriately monitored"
			)
		);
	});

	it("discards an unsaved draft on a parent-driven close/reopen cycle (reopen is never told apart from staying open by Radix's onOpenChange, which only fires for internally-driven changes)", async () => {
		const user = userEvent.setup();
		mockPluginsResponse(true);

		const { rerender } = render(
			<NodeEditDialog
				node={NODE}
				nodeType="goal"
				onOpenChange={() => {
					// no-op — this test drives `open` directly, as the parent
					// would, rather than routing through Radix's callback.
				}}
				open={true}
			/>,
			{ withProviders: false }
		);

		const description = await screen.findByLabelText("Description");
		await user.clear(description);
		await user.type(description, "Draft edit not yet saved");
		expect(description).toHaveValue("Draft edit not yet saved");

		// Parent-driven close: flips the controlled `open` prop directly,
		// the way a parent would in response to state elsewhere in the
		// app — never via the dialog's own onOpenChange.
		rerender(
			<NodeEditDialog
				node={NODE}
				nodeType="goal"
				onOpenChange={() => {
					// no-op for this assertion
				}}
				open={false}
			/>
		);

		// Parent-driven reopen of the same element.
		rerender(
			<NodeEditDialog
				node={NODE}
				nodeType="goal"
				onOpenChange={() => {
					// no-op for this assertion
				}}
				open={true}
			/>
		);

		await waitFor(() =>
			expect(screen.getByLabelText("Description")).toHaveValue(
				"System is acceptably safe"
			)
		);
		expect(
			screen.queryByDisplayValue("Draft edit not yet saved")
		).not.toBeInTheDocument();
	});

	it("reloads over an unsaved draft when a different element's data.id arrives while the dialog stays open", async () => {
		const user = userEvent.setup();
		mockPluginsResponse(true);

		const { rerender } = render(
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

		const description = await screen.findByLabelText("Description");
		await user.clear(description);
		await user.type(description, "Draft edit not yet saved");
		expect(description).toHaveValue("Draft edit not yet saved");

		const otherNode: Node = {
			id: "2",
			type: "goal",
			position: { x: 0, y: 0 },
			data: {
				id: 2,
				name: "G2",
				description: "System is appropriately monitored",
			},
		};

		rerender(
			<NodeEditDialog
				node={otherNode}
				nodeType="goal"
				onOpenChange={() => {
					// no-op for this assertion
				}}
				open={true}
			/>
		);

		await waitFor(() =>
			expect(screen.getByLabelText("Description")).toHaveValue(
				"System is appropriately monitored"
			)
		);
		expect(
			screen.queryByDisplayValue("Draft edit not yet saved")
		).not.toBeInTheDocument();
	});
});

describe("NodeEditDialog — save failure handling", () => {
	beforeEach(() => {
		vi.mocked(toast).mockClear();
		vi.mocked(recordUpdate).mockClear();
	});

	it("surfaces the server error, keeps the dialog open, and records no undo entry on failure", async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		mockPluginsResponse(true);
		server.use(
			http.put("/api/elements/1", () =>
				HttpResponse.json({ error: "Description is required" }, { status: 400 })
			)
		);

		render(
			<NodeEditDialog
				node={NODE}
				nodeType="goal"
				onOpenChange={onOpenChange}
				open={true}
			/>,
			{ withProviders: false }
		);

		await screen.findByLabelText("Description");
		await user.click(screen.getByRole("button", { name: "Update Goal" }));

		await waitFor(() =>
			expect(toast).toHaveBeenCalledWith(
				expect.objectContaining({
					variant: "destructive",
					description: "Description is required",
				})
			)
		);
		expect(onOpenChange).not.toHaveBeenCalledWith(false);
		expect(recordUpdate).not.toHaveBeenCalled();
	});

	it("records the undo entry and closes the dialog on a successful save", async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		mockPluginsResponse(true);
		server.use(
			http.put("/api/elements/1", () => HttpResponse.json({}, { status: 200 }))
		);

		render(
			<NodeEditDialog
				node={NODE}
				nodeType="goal"
				onOpenChange={onOpenChange}
				open={true}
			/>,
			{ withProviders: false }
		);

		await screen.findByLabelText("Description");
		await user.click(screen.getByRole("button", { name: "Update Goal" }));

		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
		expect(recordUpdate).toHaveBeenCalledTimes(1);
		expect(toast).not.toHaveBeenCalled();
	});
});

describe("NodeEditDialog — evidence URL removal", () => {
	const EVIDENCE_NODE: Node = {
		id: "3",
		type: "evidence",
		position: { x: 0, y: 0 },
		data: {
			id: 3,
			name: "E1",
			description: "Test results for the acceptance suite",
			urls: ["https://example.com/evidence"],
		},
	};

	it("shows the remove button on the last remaining URL row", async () => {
		mockPluginsResponse(true);

		render(
			<NodeEditDialog
				node={EVIDENCE_NODE}
				nodeType="evidence"
				onOpenChange={() => {
					// no-op for this assertion
				}}
				open={true}
			/>,
			{ withProviders: false }
		);

		await screen.findByDisplayValue("https://example.com/evidence");
		expect(
			screen.getByRole("button", { name: "Remove URL" })
		).toBeInTheDocument();
	});

	it("removing the last URL then saving clears urls server-side", async () => {
		const user = userEvent.setup();
		const onOpenChange = vi.fn();
		mockPluginsResponse(true);

		let capturedBody: Record<string, unknown> | undefined;
		server.use(
			http.put("/api/elements/3", async ({ request }) => {
				capturedBody = (await request.json()) as Record<string, unknown>;
				return HttpResponse.json({}, { status: 200 });
			})
		);

		render(
			<NodeEditDialog
				node={EVIDENCE_NODE}
				nodeType="evidence"
				onOpenChange={onOpenChange}
				open={true}
			/>,
			{ withProviders: false }
		);

		await screen.findByDisplayValue("https://example.com/evidence");
		await user.click(screen.getByRole("button", { name: "Remove URL" }));

		expect(
			screen.queryByDisplayValue("https://example.com/evidence")
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Remove URL" })
		).not.toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Update Evidence" }));

		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
		expect(capturedBody).toEqual(
			expect.objectContaining({ urls: [], URL: "" })
		);
	});

	it("re-adding a URL after removing the last row works via the Add URL button", async () => {
		const user = userEvent.setup();
		mockPluginsResponse(true);

		render(
			<NodeEditDialog
				node={EVIDENCE_NODE}
				nodeType="evidence"
				onOpenChange={() => {
					// no-op for this assertion
				}}
				open={true}
			/>,
			{ withProviders: false }
		);

		await screen.findByDisplayValue("https://example.com/evidence");
		await user.click(screen.getByRole("button", { name: "Remove URL" }));
		expect(
			screen.queryByPlaceholderText("https://example.com/evidence")
		).not.toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Add URL" }));
		expect(
			screen.getByPlaceholderText("https://example.com/evidence")
		).toHaveValue("");
	});
});

describe("NodeEditDialog — read-only mode by case permission", () => {
	function setPermissions(permissions: string): void {
		useStore.setState({
			assuranceCase: {
				id: "case-1",
				name: "Test Case",
				type: "assurance-case",
				permissions,
				createdDate: new Date().toISOString(),
				comments: [],
			},
		});
	}

	function setNoAssuranceCase(): void {
		useStore.setState({ assuranceCase: null });
	}

	it.each([
		"edit",
		"manage",
	])('permissions "%s" renders editable: Save button present, fields enabled, title starts "Editing"', async (permissions) => {
		setPermissions(permissions);
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

		const description = await screen.findByLabelText("Description");
		expect(description).not.toHaveAttribute("readonly");
		expect(
			screen.getByRole("button", { name: "Update Goal" })
		).toBeInTheDocument();
		expect(screen.getByText("Editing G1")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
	});

	it.each([
		"view",
		"comment",
	])('permissions "%s" renders read-only: no Save button, fields disabled, title starts "Viewing", footer button reads "Close"', async (permissions) => {
		setPermissions(permissions);
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

		const description = await screen.findByLabelText("Description");
		expect(description).toHaveAttribute("readonly");
		expect(
			screen.queryByRole("button", { name: "Update Goal" })
		).not.toBeInTheDocument();
		expect(screen.getByText("Viewing G1")).toBeInTheDocument();
		// Two "Close"-named buttons: Radix's own dialog-corner close control
		// (always present, sr-only-labelled "Close") plus the footer button,
		// which reads "Close" instead of "Cancel" only in read-only mode.
		expect(screen.getAllByRole("button", { name: "Close" })).toHaveLength(2);
		expect(
			screen.queryByRole("button", { name: "Cancel" })
		).not.toBeInTheDocument();
	});

	it('no assurance case loaded (permissions undefined) renders read-only: no Save button, fields disabled, title starts "Viewing", footer button reads "Close"', async () => {
		setNoAssuranceCase();
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

		const description = await screen.findByLabelText("Description");
		expect(description).toHaveAttribute("readonly");
		expect(
			screen.queryByRole("button", { name: "Update Goal" })
		).not.toBeInTheDocument();
		expect(screen.getByText("Viewing G1")).toBeInTheDocument();
		// Two "Close"-named buttons: Radix's own dialog-corner close control
		// (always present, sr-only-labelled "Close") plus the footer button,
		// which reads "Close" instead of "Cancel" only in read-only mode.
		expect(screen.getAllByRole("button", { name: "Close" })).toHaveLength(2);
	});
});
