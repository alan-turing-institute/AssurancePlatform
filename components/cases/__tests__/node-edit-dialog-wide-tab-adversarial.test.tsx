import { waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import type { Node } from "reactflow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetPluginFetchDedupeForTests } from "@/hooks/use-plugin-enablement";
import type { ElementSlotContext } from "@/lib/plugins/slots";
import { elementPanelSlot } from "@/lib/plugins/slots";
import { server } from "@/src/__tests__/mocks/server";
import { render, screen } from "@/src/__tests__/utils/test-utils";
import useStore from "@/store/store";
import NodeEditDialog from "../node-edit-dialog";

vi.mock("@/lib/services/history-service", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@/lib/services/history-service")>();
	return { ...actual, recordUpdate: vi.fn() };
});

const NODE: Node = {
	id: "1",
	type: "property",
	position: { x: 0, y: 0 },
	data: { id: 1, name: "P1", description: "The line keeps its seals intact" },
};

const NARROW = "sm:max-w-lg";
const WIDE = "sm:max-w-2xl";

let lastContext: ElementSlotContext | null = null;

function WidePanel(context: ElementSlotContext) {
	lastContext = context;
	return <div data-testid="wide-panel">{context.elementText ?? "(none)"}</div>;
}

function servePluginOn() {
	server.use(
		http.get("/api/user/plugins", () =>
			HttpResponse.json({
				plugins: [
					{
						pluginId: "tea.health",
						name: "Claim/Evidence Health",
						version: "0.1.0",
						description: "Test plugin.",
						surfaces: [],
						available: true,
						enabled: true,
						pinnedAt: null,
						settings: null,
					},
				],
			})
		)
	);
}

function register(wide: boolean | undefined) {
	elementPanelSlot.register({
		pluginId: "tea.health",
		tabId: "tea.health",
		label: "Evidence",
		...(wide === undefined ? {} : { wide }),
		Component: WidePanel,
	});
}

function renderDialog(node: Node = NODE, open = true) {
	return render(
		<NodeEditDialog
			node={node}
			nodeType="property"
			onOpenChange={() => {
				// no-op
			}}
			open={open}
		/>,
		{ withProviders: false }
	);
}

beforeEach(() => {
	lastContext = null;
	resetPluginFetchDedupeForTests();
	useStore.setState({
		assuranceCase: {
			id: "case-1",
			name: "Case",
			type: "assurance-case",
			permissions: "manage",
			createdDate: new Date().toISOString(),
			comments: [],
		},
	} as never);
	servePluginOn();
});

afterEach(() => {
	elementPanelSlot.resetForTests();
	vi.restoreAllMocks();
});

const content = () => screen.getByTestId("dialog-content");

describe("the element dialog's width", () => {
	it("is narrow on Details, wide while a tab registered as wide is showing, and narrow again on Details", async () => {
		register(true);
		const user = userEvent.setup();
		renderDialog();
		await screen.findByRole("tab", { name: "Evidence" });
		expect(content()).toHaveClass(NARROW);
		expect(content()).not.toHaveClass(WIDE);
		await user.click(screen.getByRole("tab", { name: "Evidence" }));
		expect(content()).toHaveClass(WIDE);
		expect(content()).not.toHaveClass(NARROW);
		await user.click(screen.getByRole("tab", { name: "Details" }));
		expect(content()).toHaveClass(NARROW);
		expect(content()).not.toHaveClass(WIDE);
	});

	it("stays narrow on a tab that is not registered as wide, whether wide is false or absent", async () => {
		for (const wide of [false, undefined]) {
			elementPanelSlot.resetForTests();
			register(wide);
			resetPluginFetchDedupeForTests();
			const user = userEvent.setup();
			const { unmount } = renderDialog();
			await user.click(await screen.findByRole("tab", { name: "Evidence" }));
			await screen.findByTestId("wide-panel");
			expect(content()).toHaveClass(NARROW);
			expect(content()).not.toHaveClass(WIDE);
			unmount();
		}
	});

	it("is narrow without any tab strip when nothing is registered", async () => {
		renderDialog();
		await screen.findByLabelText("Description");
		expect(screen.queryByRole("tablist")).toBeNull();
		expect(content()).toHaveClass(NARROW);
	});

	it("goes back to Details and narrow when the dialog is closed and opened again", async () => {
		register(true);
		const user = userEvent.setup();
		const view = renderDialog();
		await user.click(await screen.findByRole("tab", { name: "Evidence" }));
		expect(content()).toHaveClass(WIDE);
		view.rerender(
			<NodeEditDialog
				node={NODE}
				nodeType="property"
				onOpenChange={() => {
					// no-op
				}}
				open={false}
			/>
		);
		expect(screen.queryByTestId("dialog-content")).toBeNull();
		view.rerender(
			<NodeEditDialog
				node={NODE}
				nodeType="property"
				onOpenChange={() => {
					// no-op
				}}
				open={true}
			/>
		);
		await screen.findByRole("tab", { name: "Evidence" });
		expect(screen.getByRole("tab", { name: "Details" })).toHaveAttribute(
			"aria-selected",
			"true"
		);
		expect(content()).toHaveClass(NARROW);
		expect(content()).not.toHaveClass(WIDE);
	});
});

describe("the claim's text handed to the panel", () => {
	it("is the description the Details form holds", async () => {
		register(true);
		const user = userEvent.setup();
		renderDialog();
		await user.click(await screen.findByRole("tab", { name: "Evidence" }));
		expect(await screen.findByTestId("wide-panel")).toHaveTextContent(
			"The line keeps its seals intact"
		);
		expect(lastContext?.elementId).toBe("1");
		expect(lastContext?.elementType).toBe("property");
		expect(lastContext?.caseId).toBe("case-1");
		expect(lastContext?.canEdit).toBe(true);
	});

	it("follows what is typed in the description before the person switches tabs", async () => {
		register(true);
		const user = userEvent.setup();
		renderDialog();
		await screen.findByRole("tab", { name: "Evidence" });
		const description = await screen.findByLabelText("Description");
		await user.clear(description);
		await user.type(description, "A new wording");
		await user.click(screen.getByRole("tab", { name: "Evidence" }));
		expect(await screen.findByTestId("wide-panel")).toHaveTextContent(
			"A new wording"
		);
	});

	it("is empty, not a placeholder, for a claim with no description", async () => {
		register(true);
		const user = userEvent.setup();
		renderDialog({ ...NODE, data: { ...NODE.data, description: "" } });
		await user.click(await screen.findByRole("tab", { name: "Evidence" }));
		await waitFor(() => expect(lastContext).not.toBeNull());
		expect(lastContext?.elementText ?? "").toBe("");
	});

	it("tells the panel the person cannot edit when the case is view-only", async () => {
		useStore.setState({
			assuranceCase: {
				id: "case-1",
				name: "Case",
				type: "assurance-case",
				permissions: "view",
				createdDate: new Date().toISOString(),
				comments: [],
			},
		} as never);
		register(true);
		const user = userEvent.setup();
		renderDialog();
		await user.click(await screen.findByRole("tab", { name: "Evidence" }));
		await screen.findByTestId("wide-panel");
		expect(lastContext?.canEdit).toBe(false);
	});
});
