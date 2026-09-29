import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { server } from "@/src/__tests__/mocks/server";
import {
	renderWithoutProviders,
	screen,
} from "@/src/__tests__/utils/test-utils";
import { PluginOffConfirmDialog } from "../plugin-off-confirm-dialog";

const CONSEQUENCES_URL = "/api/user/plugins/tea.health/consequences";
const CURRENTLY_WRITE_REGEX = /currently write/;
const EVIDENCE_RECORD_REGEX = /evidence record/;

afterEach(() => {
	vi.restoreAllMocks();
});

function mockConsequences(body: {
	activeIntegrations: Array<{ id: string; name: string }>;
	caseCount: number;
	evidenceRecordCount: number;
}) {
	server.use(http.get(CONSEQUENCES_URL, () => HttpResponse.json(body)));
}

describe("PluginOffConfirmDialog", () => {
	it("renders with live numbers: 2 evidence records, 1 case, 1 active integration", async () => {
		mockConsequences({
			evidenceRecordCount: 2,
			caseCount: 1,
			activeIntegrations: [{ id: "int-1", name: "DARTER pipeline" }],
		});

		renderWithoutProviders(
			<PluginOffConfirmDialog
				onConfirm={vi.fn()}
				onOpenChange={vi.fn()}
				open
				pending={false}
				pluginId="tea.health"
				pluginName="Claim/Evidence Health"
			/>
		);

		const dialog = await screen.findByRole("alertdialog");
		// Title and intro line don't depend on the consequence fetch, so they're
		// already there as soon as the dialog itself is.
		expect(dialog).toHaveTextContent(
			"Turn off Claim/Evidence Health for your account?"
		);
		expect(dialog).toHaveTextContent(
			"Health badges and the Evidence tab will disappear for you."
		);
		// The two variable lines only render once the mocked fetch above has
		// resolved — `findByText` polls rather than asserting synchronously
		// right after the dialog appears, which raced the fetch under load
		// (vincent, review round 2026-09-22: passed alone, failed under the
		// full-suite coverage run).
		await screen.findByText(
			"The 2 evidence records on 1 of your cases stay stored and are never deleted."
		);
		expect(
			screen.getByText(
				"1 integration (DARTER pipeline) currently writes evidence to your cases; it will keep doing so, and you will see what was written when you turn the plugin back on."
			)
		).toBeInTheDocument();
		expect(dialog).toHaveTextContent("Other collaborators are not affected.");
	});

	it("omits the integration line when there are no active integrations", async () => {
		mockConsequences({
			evidenceRecordCount: 5,
			caseCount: 2,
			activeIntegrations: [],
		});

		renderWithoutProviders(
			<PluginOffConfirmDialog
				onConfirm={vi.fn()}
				onOpenChange={vi.fn()}
				open
				pending={false}
				pluginId="tea.health"
				pluginName="Claim/Evidence Health"
			/>
		);

		const dialog = await screen.findByRole("alertdialog");
		// Waits for the fetch to resolve (see the test above) before checking
		// the integration line is absent — otherwise this assertion could pass
		// for the wrong reason, mid-loading, before the real content renders.
		await screen.findByText(
			"The 5 evidence records on 2 of your cases stay stored and are never deleted."
		);
		expect(dialog).not.toHaveTextContent(CURRENTLY_WRITE_REGEX);
	});

	it("still shows the fixed sentences and lets the user confirm when the consequence read fails", async () => {
		server.use(
			http.get(CONSEQUENCES_URL, () =>
				HttpResponse.json({ error: "boom" }, { status: 500 })
			)
		);
		const onConfirm = vi.fn();
		const user = userEvent.setup();

		renderWithoutProviders(
			<PluginOffConfirmDialog
				onConfirm={onConfirm}
				onOpenChange={vi.fn()}
				open
				pending={false}
				pluginId="tea.health"
				pluginName="Claim/Evidence Health"
			/>
		);

		const dialog = await screen.findByRole("alertdialog");
		expect(dialog).toHaveTextContent(
			"Health badges and the Evidence tab will disappear for you."
		);
		expect(dialog).toHaveTextContent("Other collaborators are not affected.");
		expect(dialog).not.toHaveTextContent(EVIDENCE_RECORD_REGEX);

		await user.click(screen.getByRole("button", { name: "Turn off" }));
		expect(onConfirm).toHaveBeenCalledTimes(1);
	});

	it("calls onOpenChange(false), not onConfirm, when Keep on is clicked", async () => {
		mockConsequences({
			evidenceRecordCount: 0,
			caseCount: 0,
			activeIntegrations: [],
		});
		const onConfirm = vi.fn();
		const onOpenChange = vi.fn();
		const user = userEvent.setup();

		renderWithoutProviders(
			<PluginOffConfirmDialog
				onConfirm={onConfirm}
				onOpenChange={onOpenChange}
				open
				pending={false}
				pluginId="tea.health"
				pluginName="Claim/Evidence Health"
			/>
		);

		await screen.findByRole("alertdialog");
		await user.click(screen.getByRole("button", { name: "Keep on" }));

		expect(onConfirm).not.toHaveBeenCalled();
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it("renders nothing when closed", () => {
		renderWithoutProviders(
			<PluginOffConfirmDialog
				onConfirm={vi.fn()}
				onOpenChange={vi.fn()}
				open={false}
				pending={false}
				pluginId="tea.health"
				pluginName="Claim/Evidence Health"
			/>
		);

		expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
	});
});
