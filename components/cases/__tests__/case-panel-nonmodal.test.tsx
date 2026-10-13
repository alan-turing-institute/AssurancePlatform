import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetPluginFetchDedupeForTests } from "@/hooks/use-plugin-enablement";
import type { CaseSlotContext } from "@/lib/plugins/slots/index";
import { casePanelSlot } from "@/lib/plugins/slots/index";
import { server } from "@/src/__tests__/mocks/server";
import useStore from "@/store/store";
import ActionButtons from "../action-buttons";

// The shared setup swaps Radix Dialog for a stub; dismissal behaviour needs the real one.
vi.mock("@radix-ui/react-dialog", () =>
	vi.importActual("@radix-ui/react-dialog")
);

vi.mock("../case-settings-popover", () => ({
	CaseSettingsPopover: () => null,
}));

let lastContext: CaseSlotContext | null = null;

function Panel(context: CaseSlotContext) {
	lastContext = context;
	return (
		<div data-testid="probe-panel">
			<button data-testid="inside-button" type="button">
				inside
			</button>
		</div>
	);
}

const BUTTON_ID = "toolbar-case-panel-tea.health";

function register(modal?: false) {
	casePanelSlot.register({
		pluginId: "tea.health",
		panelId: "tea.health",
		label: "Probe panel",
		Component: Panel,
		...(modal === false ? { modal: false } : {}),
	});
}

function node(id: number, name: string, selected: boolean) {
	return {
		id: `n${id}`,
		position: { x: 0, y: 0 },
		selected,
		data: { id, name },
	};
}

beforeEach(() => {
	lastContext = null;
	resetPluginFetchDedupeForTests();
	server.use(
		http.get("/api/user/plugins", () =>
			HttpResponse.json({
				plugins: [
					{
						pluginId: "tea.health",
						name: "h",
						version: "0.1.0",
						description: "d",
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
	useStore.setState({
		assuranceCase: {
			id: "case-7",
			name: "Case",
			type: "assurance-case",
			permissions: "manage",
			createdDate: new Date().toISOString(),
			comments: [],
		},
		nodes: [],
		caseDetailsOpen: false,
	} as never);
});

afterEach(() => {
	casePanelSlot.resetForTests();
	useStore.setState({ nodes: [] } as never);
});

describe("case panel context carries the canvas selection", () => {
	it("passes the selected node's element id and name, and none when nothing is selected", async () => {
		register();
		useStore.setState({
			nodes: [node(11, "G1", false), node(22, "P2", true)],
		} as never);
		render(
			<ActionButtons actions={{ onLayout: vi.fn() }} notifyError={vi.fn()} />
		);
		await userEvent.click(await screen.findByTestId(BUTTON_ID));
		await screen.findByTestId("probe-panel");
		expect(lastContext?.selectedElementId).toBe("22");
		expect(lastContext?.selectedElementLabel).toBe("P2");
	});

	it("leaves the selection undefined when no node is selected", async () => {
		register();
		useStore.setState({ nodes: [node(11, "G1", false)] } as never);
		render(
			<ActionButtons actions={{ onLayout: vi.fn() }} notifyError={vi.fn()} />
		);
		await userEvent.click(await screen.findByTestId(BUTTON_ID));
		await screen.findByTestId("probe-panel");
		expect(lastContext?.selectedElementId).toBeUndefined();
	});

	it("follows the selection while the panel stays open", async () => {
		register();
		useStore.setState({ nodes: [node(11, "G1", true)] } as never);
		render(
			<ActionButtons actions={{ onLayout: vi.fn() }} notifyError={vi.fn()} />
		);
		await userEvent.click(await screen.findByTestId(BUTTON_ID));
		await screen.findByTestId("probe-panel");
		expect(lastContext?.selectedElementId).toBe("11");
		useStore.setState({
			nodes: [node(11, "G1", false), node(22, "P2", true)],
		} as never);
		await vi.waitFor(() => expect(lastContext?.selectedElementId).toBe("22"));
	});
});

describe("a panel registered with modal: false", () => {
	it("renders no overlay and stays open when the user presses outside it", async () => {
		register(false);
		render(
			<div>
				<button data-testid="canvas" type="button">
					canvas
				</button>
				<ActionButtons actions={{ onLayout: vi.fn() }} notifyError={vi.fn()} />
			</div>
		);
		await userEvent.click(await screen.findByTestId(BUTTON_ID));
		await screen.findByTestId("probe-panel");
		expect(
			document.querySelector("[data-state='open'].fixed.inset-0")
		).toBeNull();

		await userEvent
			.setup({ pointerEventsCheck: 0 })
			.click(screen.getByTestId("canvas"));
		expect(screen.queryByTestId("probe-panel")).not.toBeNull();
	});

	it("leaves the page beneath usable: not inert, not hidden from assistive technology", async () => {
		register(false);
		render(
			<div>
				<button data-testid="canvas" type="button">
					canvas
				</button>
				<ActionButtons actions={{ onLayout: vi.fn() }} notifyError={vi.fn()} />
			</div>
		);
		await userEvent.click(await screen.findByTestId(BUTTON_ID));
		await screen.findByTestId("probe-panel");
		expect(document.body.style.pointerEvents).not.toBe("none");
		expect(screen.getByRole("button", { name: "canvas" })).toBeTruthy();
	});

	it("still closes with Escape", async () => {
		register(false);
		render(
			<ActionButtons actions={{ onLayout: vi.fn() }} notifyError={vi.fn()} />
		);
		await userEvent.click(await screen.findByTestId(BUTTON_ID));
		await screen.findByTestId("probe-panel");
		await userEvent.keyboard("{Escape}");
		await vi.waitFor(() =>
			expect(screen.queryByTestId("probe-panel")).toBeNull()
		);
	});
});

describe("a default (modal) panel", () => {
	it("keeps its overlay and closes when the user presses outside it", async () => {
		register();
		render(
			<div>
				<button data-testid="canvas" type="button">
					canvas
				</button>
				<ActionButtons actions={{ onLayout: vi.fn() }} notifyError={vi.fn()} />
			</div>
		);
		await userEvent.click(await screen.findByTestId(BUTTON_ID));
		await screen.findByTestId("probe-panel");
		expect(
			document.querySelector("[data-state='open'].fixed.inset-0")
		).not.toBeNull();

		await userEvent
			.setup({ pointerEventsCheck: 0 })
			.click(screen.getByTestId("canvas"));
		await vi.waitFor(() =>
			expect(screen.queryByTestId("probe-panel")).toBeNull()
		);
	});
});
