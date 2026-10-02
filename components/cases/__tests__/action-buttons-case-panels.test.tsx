import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CaseSlotContext } from "@/lib/plugins/slots";
import { casePanelSlot } from "@/lib/plugins/slots";
import type { PluginSettingsListItem } from "@/lib/schemas/plugin";
import { server } from "@/src/__tests__/mocks/server";
import useStore from "@/store/store";
import ActionButtons from "../action-buttons";

vi.mock("../case-settings-popover", () => ({
	CaseSettingsPopover: () => null,
}));

function FakePanel({ canEdit, caseId }: CaseSlotContext) {
	return (
		<p>
			fake panel for {caseId}, {canEdit ? "can edit" : "view only"}
		</p>
	);
}

function servePlugins(enabled: boolean) {
	server.use(
		http.get("/api/user/plugins", () =>
			HttpResponse.json({
				plugins: [
					{
						pluginId: "tea.health",
						name: "Claim/Evidence Health",
						version: "0.1.0",
						description: "Test plugin description.",
						docsPath: "/docs/technical-guide/architecture/plugin-ecosystem",
						surfaces: [],
						available: true,
						enabled,
						pinnedAt: null,
						settings: null,
					},
				] satisfies PluginSettingsListItem[],
			})
		)
	);
}

function setCase(permissions: string) {
	useStore.setState({
		assuranceCase: {
			id: "case-1",
			name: "Test Case",
			type: "assurance-case",
			permissions,
			createdDate: new Date().toISOString(),
			comments: [],
		} as never,
	});
}

function renderToolbar() {
	return render(
		<ActionButtons actions={{ onLayout: vi.fn() }} notifyError={vi.fn()} />
	);
}

describe("ActionButtons toolbar — case panels", () => {
	beforeEach(() => {
		setCase("edit");
		casePanelSlot.register({
			pluginId: "tea.health",
			panelId: "tea.health",
			label: "Evidence health",
			Component: FakePanel,
		});
	});

	afterEach(() => {
		casePanelSlot.resetForTests();
	});

	it("shows a button after Notes when the registering plugin is enabled", async () => {
		servePlugins(true);
		renderToolbar();

		const button = await screen.findByTestId("toolbar-case-panel-tea.health");
		expect(button).toHaveAccessibleName("Evidence health");
		const buttons = screen.getAllByRole("button");
		expect(buttons.indexOf(button)).toBe(
			buttons.indexOf(screen.getByTestId("toolbar-notes")) + 1
		);
	});

	it("shows no button when the plugin is off, and leaves the other buttons alone", async () => {
		servePlugins(false);
		renderToolbar();

		await screen.findByTestId("toolbar-notes");
		await vi.waitFor(() =>
			expect(
				screen.queryByTestId("toolbar-case-panel-tea.health")
			).not.toBeInTheDocument()
		);
		for (const id of ["toolbar-focus", "toolbar-json", "toolbar-notes"]) {
			expect(screen.getByTestId(id)).toBeInTheDocument();
		}
	});

	it("opens the panel with the case id and the person's edit right", async () => {
		servePlugins(true);
		const user = userEvent.setup();
		renderToolbar();

		await user.click(
			await screen.findByTestId("toolbar-case-panel-tea.health")
		);

		expect(
			await screen.findByText("fake panel for case-1, can edit")
		).toBeInTheDocument();
	});

	it("passes view-only to the panel for a person who may not edit", async () => {
		setCase("view");
		servePlugins(true);
		const user = userEvent.setup();
		renderToolbar();

		await user.click(
			await screen.findByTestId("toolbar-case-panel-tea.health")
		);

		expect(
			await screen.findByText("fake panel for case-1, view only")
		).toBeInTheDocument();
	});
});
