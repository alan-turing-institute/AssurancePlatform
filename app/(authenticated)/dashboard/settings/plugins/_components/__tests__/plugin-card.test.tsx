import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PluginSettingsListItem } from "@/hooks/use-plugin-settings";
import { settingsSectionSlot } from "@/lib/plugins/slots";
import { server } from "@/src/__tests__/mocks/server";
import {
	renderWithoutProviders,
	screen,
} from "@/src/__tests__/utils/test-utils";
import { PluginCard } from "../plugin-card";

const CONSEQUENCES_URL = "/api/user/plugins/tea.health/consequences";
const EMPTY_CONSEQUENCES = {
	evidenceRecordCount: 0,
	caseCount: 0,
	activeIntegrations: [],
};

function FakeSettings({ pluginId }: { pluginId: string }) {
	return <div data-testid="fake-settings">{`settings for ${pluginId}`}</div>;
}

function makePlugin(
	overrides: Partial<PluginSettingsListItem> = {}
): PluginSettingsListItem {
	return {
		pluginId: "tea.health",
		name: "Claim/Evidence Health",
		version: "0.1.0",
		description:
			"Shows whether the evidence behind each property claim is still holding.",
		docsPath: "/docs/technical-guide/architecture/plugin-ecosystem",
		surfaces: ["element-badge", "element-panel", "settings-section"],
		available: true,
		enabled: true,
		pinnedAt: null,
		settings: null,
		...overrides,
	};
}

afterEach(() => {
	vi.restoreAllMocks();
	settingsSectionSlot.resetForTests();
});

describe("PluginCard", () => {
	it("renders the plugin's description", () => {
		renderWithoutProviders(
			<PluginCard onToggle={vi.fn()} plugin={makePlugin()} />
		);

		expect(
			screen.getByText(
				"Shows whether the evidence behind each property claim is still holding."
			)
		).toBeInTheDocument();
	});

	it("renders a 'What it adds' list derived from the manifest surfaces", () => {
		renderWithoutProviders(
			<PluginCard
				onToggle={vi.fn()}
				plugin={makePlugin({ surfaces: ["element-badge", "events"] })}
			/>
		);

		expect(screen.getByText("What it adds")).toBeInTheDocument();
		expect(
			screen.getByText("A health badge on property claims on the canvas")
		).toBeInTheDocument();
		expect(
			screen.getByText("Live updates when new evidence arrives")
		).toBeInTheDocument();
	});

	it("renders no 'What it adds' section when every surface is storage/settings plumbing", () => {
		renderWithoutProviders(
			<PluginCard
				onToggle={vi.fn()}
				plugin={makePlugin({ surfaces: ["extension-data", "plugin-tables"] })}
			/>
		);

		expect(screen.queryByText("What it adds")).not.toBeInTheDocument();
	});

	it("links 'Learn more' to the plugin's docsPath when set", () => {
		renderWithoutProviders(
			<PluginCard
				onToggle={vi.fn()}
				plugin={makePlugin({ docsPath: "/docs/some-page" })}
			/>
		);

		expect(screen.getByRole("link", { name: "Learn more" })).toHaveAttribute(
			"href",
			"/docs/some-page"
		);
	});

	it("renders no 'Learn more' link when the plugin has no docsPath", () => {
		renderWithoutProviders(
			<PluginCard
				onToggle={vi.fn()}
				plugin={makePlugin({ docsPath: undefined })}
			/>
		);

		expect(
			screen.queryByRole("link", { name: "Learn more" })
		).not.toBeInTheDocument();
	});

	it("shows 'This plugin has no settings.' when nothing is registered into the settings-section slot", () => {
		renderWithoutProviders(
			<PluginCard onToggle={vi.fn()} plugin={makePlugin({ enabled: true })} />
		);

		expect(
			screen.getByText("This plugin has no settings.")
		).toBeInTheDocument();
	});

	it("renders the registered settings component instead of the sentence when one exists", () => {
		settingsSectionSlot.register({
			pluginId: "tea.health",
			Component: FakeSettings,
		});

		renderWithoutProviders(
			<PluginCard onToggle={vi.fn()} plugin={makePlugin({ enabled: true })} />
		);

		expect(screen.getByTestId("fake-settings")).toBeInTheDocument();
		expect(
			screen.queryByText("This plugin has no settings.")
		).not.toBeInTheDocument();
	});

	it("renders a disabled switch and the unavailable message when unavailable at the deployment", () => {
		renderWithoutProviders(
			<PluginCard
				onToggle={vi.fn()}
				plugin={makePlugin({ available: false, enabled: true })}
			/>
		);

		const toggle = screen.getByRole("switch");
		expect(toggle).toBeDisabled();
		expect(toggle).not.toBeChecked();
		expect(
			screen.getByText("Unavailable on this deployment")
		).toBeInTheDocument();
	});

	describe("the off-switch confirmation", () => {
		it("calls onToggle immediately, with no dialog, when turning ON", async () => {
			const onToggle = vi.fn();
			const user = userEvent.setup();

			renderWithoutProviders(
				<PluginCard
					onToggle={onToggle}
					plugin={makePlugin({ enabled: false, pinnedAt: "USER" })}
				/>
			);

			await user.click(screen.getByRole("switch"));

			expect(onToggle).toHaveBeenCalledWith("tea.health", true);
			expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
		});

		it("opens the confirmation dialog, without calling onToggle yet, when turning OFF", async () => {
			server.use(
				http.get(CONSEQUENCES_URL, () => HttpResponse.json(EMPTY_CONSEQUENCES))
			);
			const onToggle = vi.fn();
			const user = userEvent.setup();

			renderWithoutProviders(
				<PluginCard
					onToggle={onToggle}
					plugin={makePlugin({ enabled: true })}
				/>
			);

			await user.click(screen.getByRole("switch"));

			expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
			expect(onToggle).not.toHaveBeenCalled();
		});

		it("does not call onToggle and closes the dialog when Keep on is clicked", async () => {
			server.use(
				http.get(CONSEQUENCES_URL, () => HttpResponse.json(EMPTY_CONSEQUENCES))
			);
			const onToggle = vi.fn();
			const user = userEvent.setup();

			renderWithoutProviders(
				<PluginCard
					onToggle={onToggle}
					plugin={makePlugin({ enabled: true })}
				/>
			);

			await user.click(screen.getByRole("switch"));
			await screen.findByRole("alertdialog");
			await user.click(screen.getByRole("button", { name: "Keep on" }));

			expect(onToggle).not.toHaveBeenCalled();
			expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
		});

		it("calls onToggle with false when Turn off is confirmed", async () => {
			server.use(
				http.get(CONSEQUENCES_URL, () => HttpResponse.json(EMPTY_CONSEQUENCES))
			);
			const onToggle = vi.fn();
			const user = userEvent.setup();

			renderWithoutProviders(
				<PluginCard
					onToggle={onToggle}
					plugin={makePlugin({ enabled: true })}
				/>
			);

			await user.click(screen.getByRole("switch"));
			await screen.findByRole("alertdialog");
			await user.click(screen.getByRole("button", { name: "Turn off" }));

			expect(onToggle).toHaveBeenCalledWith("tea.health", false);
		});
	});

	it("disables the switch and shows 'Saving…' while a toggle is pending", () => {
		renderWithoutProviders(
			<PluginCard onToggle={vi.fn()} pending plugin={makePlugin()} />
		);

		expect(screen.getByRole("switch")).toBeDisabled();
		expect(screen.getByText("Saving…")).toBeInTheDocument();
	});
});
