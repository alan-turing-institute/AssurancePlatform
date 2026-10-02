import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetPluginFetchDedupeForTests } from "@/hooks/use-plugin-enablement";
import type { CaseSlotContext } from "@/lib/plugins/slots";
import { casePanelSlot } from "@/lib/plugins/slots";
import { server } from "@/src/__tests__/mocks/server";
import useStore from "@/store/store";
import ActionButtons from "../action-buttons";

vi.mock("../case-settings-popover", () => ({
	CaseSettingsPopover: () => null,
}));

// A second plugin that the manifest does not list is added here, so that a
// panel from a plugin other than the health plugin can be registered without
// changing core.
vi.mock("@/lib/plugins/manifest", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@/lib/plugins/manifest")>();
	const fake = {
		id: "tea.fake",
		name: "Fake plugin",
		version: "0.0.1",
		description: "A plugin that exists only in this test.",
		surfaces: ["case-panel"],
	} as const;
	return {
		...actual,
		getManifestEntry: (id: string) =>
			id === fake.id ? fake : actual.getManifestEntry(id),
	};
});

let mounted = 0;
let lastContext: CaseSlotContext | null = null;

function HealthLikePanel(context: CaseSlotContext) {
	mounted += 1;
	lastContext = context;
	return <div data-testid="health-like-panel">{`case ${context.caseId}`}</div>;
}

function FakePluginPanel(context: CaseSlotContext) {
	lastContext = context;
	return <div data-testid="fake-plugin-panel">{`fake ${context.caseId}`}</div>;
}

function servePlugins(enabled: Record<string, boolean>) {
	server.use(
		http.get("/api/user/plugins", () =>
			HttpResponse.json({
				plugins: Object.entries(enabled).map(([pluginId, on]) => ({
					pluginId,
					name: pluginId,
					version: "0.1.0",
					description: "Test plugin.",
					surfaces: [],
					available: true,
					enabled: on,
					pinnedAt: on ? null : "USER",
					settings: null,
				})),
			})
		)
	);
}

function setPermission(permissions: string) {
	useStore.setState({
		assuranceCase: {
			id: "case-7",
			name: "Case",
			type: "assurance-case",
			permissions,
			createdDate: new Date().toISOString(),
			comments: [],
		},
	} as never);
}

function toolbar() {
	return render(
		<ActionButtons actions={{ onLayout: vi.fn() }} notifyError={vi.fn()} />
	);
}

function toolbarIds(): string[] {
	return [
		...screen
			.getByTestId("action-buttons")
			.querySelectorAll("[data-testid^='toolbar-']"),
	].map((element) => element.getAttribute("data-testid") ?? "");
}

function tourIds(): string[] {
	return [
		...screen.getByTestId("action-buttons").querySelectorAll("[data-tour]"),
	].map((element) => element.getAttribute("data-tour") ?? "");
}

const HEALTH_BUTTON_ID = "toolbar-case-panel-tea.health";

function registerHealthLike() {
	casePanelSlot.register({
		pluginId: "tea.health",
		panelId: "tea.health",
		label: "Evidence health",
		Component: HealthLikePanel,
	});
}

beforeEach(() => {
	mounted = 0;
	lastContext = null;
	resetPluginFetchDedupeForTests();
	setPermission("manage");
	useStore.setState({ caseDetailsOpen: false });
});

afterEach(() => {
	casePanelSlot.resetForTests();
	vi.restoreAllMocks();
});

async function settle() {
	await new Promise((resolve) => setTimeout(resolve, 40));
}

describe("the case toolbar and case panels", () => {
	it("is exactly as it is today when nothing is registered, even with the plugin enabled", async () => {
		servePlugins({ "tea.health": true });
		toolbar();
		await settle();
		expect(screen.queryByTestId(HEALTH_BUTTON_ID)).toBeNull();
		expect(
			document.querySelectorAll("[data-testid^='toolbar-case-panel-']")
		).toHaveLength(0);
	});

	it("shows no button for a registration whose plugin is off, and leaves every other button where it was", async () => {
		servePlugins({ "tea.health": true });
		const before = toolbar();
		await settle();
		const idsBefore = toolbarIds();
		const toursBefore = tourIds();
		before.unmount();

		registerHealthLike();
		servePlugins({ "tea.health": false });
		resetPluginFetchDedupeForTests();
		toolbar();
		await settle();
		expect(screen.queryByTestId(HEALTH_BUTTON_ID)).toBeNull();
		expect(toolbarIds()).toEqual(idsBefore);
		expect(tourIds()).toEqual(toursBefore);
	});

	it("shows no button while the list of enabled plugins cannot be read", async () => {
		registerHealthLike();
		server.use(
			http.get("/api/user/plugins", () =>
				HttpResponse.json({ error: "no" }, { status: 500 })
			)
		);
		toolbar();
		await settle();
		expect(screen.queryByTestId(HEALTH_BUTTON_ID)).toBeNull();
	});

	it("adds one named button straight after Notes for an enabled registration, moving nothing else", async () => {
		servePlugins({ "tea.health": true });
		const before = toolbar();
		await settle();
		const idsBefore = toolbarIds();
		const toursBefore = tourIds();
		before.unmount();

		registerHealthLike();
		resetPluginFetchDedupeForTests();
		toolbar();
		const button = await screen.findByTestId(HEALTH_BUTTON_ID);
		expect(button).toBe(
			screen.getByRole("button", { name: "Evidence health" })
		);
		const notes = toolbarIds().indexOf("toolbar-notes");
		expect(notes).toBeGreaterThan(-1);
		expect(toolbarIds()[notes + 1]).toBe(HEALTH_BUTTON_ID);
		expect(toolbarIds().filter((id) => id !== HEALTH_BUTTON_ID)).toEqual(
			idsBefore
		);
		expect(tourIds()).toEqual(toursBefore);
		expect(button.getAttribute("data-tour")).toBeNull();
	});

	it("keeps the existing buttons' test ids and order for a viewer", async () => {
		setPermission("view");
		servePlugins({ "tea.health": true });
		registerHealthLike();
		toolbar();
		await screen.findByTestId(HEALTH_BUTTON_ID);
		const ids = toolbarIds();
		expect(ids.indexOf("toolbar-notes")).toBeLessThan(
			ids.indexOf(HEALTH_BUTTON_ID)
		);
		expect(ids).toContain("toolbar-focus");
		expect(ids).toContain("toolbar-case-information");
		expect(ids).toContain("toolbar-help");
		expect(ids).toContain("toolbar-json");
	});

	it("renders a second plugin's panel with no change to core, and only for the plugins that are enabled", async () => {
		registerHealthLike();
		casePanelSlot.register({
			pluginId: "tea.fake",
			panelId: "fake-panel",
			label: "Fake panel",
			Component: FakePluginPanel,
		});
		servePlugins({ "tea.health": false, "tea.fake": true });
		const user = userEvent.setup();
		toolbar();
		await screen.findByTestId("toolbar-case-panel-fake-panel");
		expect(screen.queryByTestId(HEALTH_BUTTON_ID)).toBeNull();
		await user.click(screen.getByRole("button", { name: "Fake panel" }));
		expect(await screen.findByTestId("fake-plugin-panel")).toHaveTextContent(
			"fake case-7"
		);
	});

	it("shows one button for each enabled registration, in registration order", async () => {
		registerHealthLike();
		casePanelSlot.register({
			pluginId: "tea.fake",
			panelId: "fake-panel",
			label: "Fake panel",
			Component: FakePluginPanel,
		});
		servePlugins({ "tea.health": true, "tea.fake": true });
		toolbar();
		await screen.findByTestId("toolbar-case-panel-fake-panel");
		const ids = toolbarIds();
		const notes = ids.indexOf("toolbar-notes");
		expect(ids.slice(notes + 1, notes + 3)).toEqual([
			HEALTH_BUTTON_ID,
			"toolbar-case-panel-fake-panel",
		]);
	});

	it("mounts the panel only once its button is pressed, titled with its label, and gives it the case", async () => {
		registerHealthLike();
		servePlugins({ "tea.health": true });
		const user = userEvent.setup();
		toolbar();
		await user.click(await screen.findByTestId(HEALTH_BUTTON_ID));
		const dialog = await screen.findByRole("dialog");
		expect(within(dialog).getByTestId("dialog-title")).toHaveTextContent(
			"Evidence health"
		);
		expect(within(dialog).getByTestId("health-like-panel")).toHaveTextContent(
			"case case-7"
		);
		expect(lastContext?.caseId).toBe("case-7");
		expect(mounted).toBeGreaterThan(0);
	});

	it("does not mount a panel before its button is pressed", async () => {
		registerHealthLike();
		servePlugins({ "tea.health": true });
		toolbar();
		await screen.findByTestId(HEALTH_BUTTON_ID);
		expect(mounted).toBe(0);
	});

	it.each([
		["manage", true],
		["edit", true],
		["comment", false],
		["review", false],
		["view", false],
	])("tells the panel canEdit for permission %s is %s", async (permission, canEdit) => {
		setPermission(permission);
		registerHealthLike();
		servePlugins({ "tea.health": true });
		const user = userEvent.setup();
		toolbar();
		await user.click(await screen.findByTestId(HEALTH_BUTTON_ID));
		await screen.findByTestId("health-like-panel");
		expect(lastContext?.canEdit).toBe(canEdit);
	});

	it("closes the panel when Escape is pressed, and leaves the button there", async () => {
		registerHealthLike();
		servePlugins({ "tea.health": true });
		const user = userEvent.setup();
		toolbar();
		await user.click(await screen.findByTestId(HEALTH_BUTTON_ID));
		await screen.findByTestId("health-like-panel");
		await user.keyboard("{Escape}");
		await waitFor(() =>
			expect(screen.queryByTestId("health-like-panel")).toBeNull()
		);
		expect(screen.getByTestId(HEALTH_BUTTON_ID)).toBeVisible();
	});
});
