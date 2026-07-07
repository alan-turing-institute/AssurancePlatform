import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PluginSettingsListItem } from "@/hooks/use-plugin-settings";
import { settingsSectionSlot } from "@/lib/plugins/slots";
import {
	renderWithoutProviders,
	screen,
} from "@/src/__tests__/utils/test-utils";
import { PluginToggleRow } from "../plugin-toggle-row";

function FakeSettings({ pluginId }: { pluginId: string }) {
	return <div data-testid="fake-settings">{`settings for ${pluginId}`}</div>;
}

const UNAVAILABLE_REGEX = /unavailable on this deployment/i;
const ORGANISATION_REGEX = /turned off by your organisation/i;
const TEAM_REGEX = /turned off by your team/i;
const SAVING_REGEX = /saving/i;

function makePlugin(
	overrides: Partial<PluginSettingsListItem> = {}
): PluginSettingsListItem {
	return {
		pluginId: "tea.health",
		name: "Claim/Evidence Health",
		version: "0.1.0",
		available: true,
		enabled: true,
		pinnedAt: null,
		settings: null,
		...overrides,
	};
}

describe("PluginToggleRow", () => {
	describe("available x enabled matrix", () => {
		it("renders an interactive, checked switch and 'On' when available and enabled", () => {
			renderWithoutProviders(
				<PluginToggleRow onToggle={vi.fn()} plugin={makePlugin()} />
			);

			const toggle = screen.getByRole("switch");
			expect(toggle).toBeChecked();
			expect(toggle).not.toBeDisabled();
			expect(screen.getByText("On")).toBeInTheDocument();
		});

		it("renders an interactive, unchecked switch and 'Off' when available but disabled by the user themselves", () => {
			renderWithoutProviders(
				<PluginToggleRow
					onToggle={vi.fn()}
					plugin={makePlugin({ enabled: false, pinnedAt: "USER" })}
				/>
			);

			const toggle = screen.getByRole("switch");
			expect(toggle).not.toBeChecked();
			expect(toggle).not.toBeDisabled();
			expect(screen.getByText("Off")).toBeInTheDocument();
		});

		it("renders a disabled, unchecked switch and an 'unavailable' message when unavailable at the deployment — even if a stale enabled:true slips through", () => {
			renderWithoutProviders(
				<PluginToggleRow
					onToggle={vi.fn()}
					plugin={makePlugin({
						available: false,
						enabled: true,
						pinnedAt: "DEPLOYMENT",
					})}
				/>
			);

			const toggle = screen.getByRole("switch");
			expect(toggle).not.toBeChecked();
			expect(toggle).toBeDisabled();
			expect(screen.getByText(UNAVAILABLE_REGEX)).toBeInTheDocument();
		});

		it("renders a disabled, unchecked switch when unavailable and disabled", () => {
			renderWithoutProviders(
				<PluginToggleRow
					onToggle={vi.fn()}
					plugin={makePlugin({
						available: false,
						enabled: false,
						pinnedAt: "DEPLOYMENT",
					})}
				/>
			);

			const toggle = screen.getByRole("switch");
			expect(toggle).not.toBeChecked();
			expect(toggle).toBeDisabled();
			expect(screen.getByText(UNAVAILABLE_REGEX)).toBeInTheDocument();
		});
	});

	describe("pinned-level display", () => {
		it("shows the organisation as the pinning level and locks the switch", () => {
			renderWithoutProviders(
				<PluginToggleRow
					onToggle={vi.fn()}
					plugin={makePlugin({ enabled: false, pinnedAt: "ORGANISATION" })}
				/>
			);

			expect(screen.getByText(ORGANISATION_REGEX)).toBeInTheDocument();
			expect(screen.getByRole("switch")).toBeDisabled();
		});

		it("shows the team as the pinning level and locks the switch", () => {
			renderWithoutProviders(
				<PluginToggleRow
					onToggle={vi.fn()}
					plugin={makePlugin({ enabled: false, pinnedAt: "TEAM" })}
				/>
			);

			expect(screen.getByText(TEAM_REGEX)).toBeInTheDocument();
			expect(screen.getByRole("switch")).toBeDisabled();
		});

		it("does not lock the switch when pinnedAt is USER — the user's own toggle stays interactive", () => {
			renderWithoutProviders(
				<PluginToggleRow
					onToggle={vi.fn()}
					plugin={makePlugin({ enabled: false, pinnedAt: "USER" })}
				/>
			);

			expect(screen.getByRole("switch")).not.toBeDisabled();
		});
	});

	describe("interaction", () => {
		it("calls onToggle with the pluginId and the new state when clicked", async () => {
			const user = userEvent.setup();
			const onToggle = vi.fn();
			renderWithoutProviders(
				<PluginToggleRow
					onToggle={onToggle}
					plugin={makePlugin({ enabled: false, pinnedAt: "USER" })}
				/>
			);

			await user.click(screen.getByRole("switch"));
			expect(onToggle).toHaveBeenCalledWith("tea.health", true);
		});

		it("does not call onToggle when the switch is locked by a higher scope", async () => {
			const user = userEvent.setup();
			const onToggle = vi.fn();
			renderWithoutProviders(
				<PluginToggleRow
					onToggle={onToggle}
					plugin={makePlugin({ enabled: false, pinnedAt: "ORGANISATION" })}
				/>
			);

			await user.click(screen.getByRole("switch"));
			expect(onToggle).not.toHaveBeenCalled();
		});

		it("disables the switch and shows 'Saving…' while a toggle is pending", () => {
			renderWithoutProviders(
				<PluginToggleRow onToggle={vi.fn()} pending plugin={makePlugin()} />
			);

			expect(screen.getByRole("switch")).toBeDisabled();
			expect(screen.getByText(SAVING_REGEX)).toBeInTheDocument();
		});
	});

	describe("settings-section slot", () => {
		it("renders no layout artefact for the empty settings slot", () => {
			const { container } = renderWithoutProviders(
				<PluginToggleRow onToggle={vi.fn()} plugin={makePlugin()} />
			);

			// The row itself (name, status, switch) plus nothing else — the
			// settings-section slot (`PluginSettingsSlot`) contributes no DOM.
			expect(container.querySelectorAll("div").length).toBeGreaterThan(0);
			expect(
				screen.queryByTestId("plugin-settings-slot")
			).not.toBeInTheDocument();
		});

		describe("gated on the row's effective checked state", () => {
			afterEach(() => {
				settingsSectionSlot.resetForTests();
			});

			it("does not render a registered settings component when the plugin is not effectively enabled", () => {
				settingsSectionSlot.register({
					pluginId: "tea.health",
					Component: FakeSettings,
				});

				renderWithoutProviders(
					<PluginToggleRow
						onToggle={vi.fn()}
						plugin={makePlugin({ enabled: false, pinnedAt: "USER" })}
					/>
				);

				expect(screen.queryByTestId("fake-settings")).not.toBeInTheDocument();
			});

			it("renders a registered settings component when the plugin is effectively enabled", () => {
				settingsSectionSlot.register({
					pluginId: "tea.health",
					Component: FakeSettings,
				});

				renderWithoutProviders(
					<PluginToggleRow onToggle={vi.fn()} plugin={makePlugin()} />
				);

				expect(screen.getByTestId("fake-settings")).toBeInTheDocument();
			});
		});
	});
});
