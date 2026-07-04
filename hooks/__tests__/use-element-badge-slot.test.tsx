import { waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ElementSlotContext } from "@/lib/plugins/slots";
import { elementBadgeSlot } from "@/lib/plugins/slots";
import type { PluginSettingsListItem } from "@/lib/schemas/plugin";
import { server } from "@/src/__tests__/mocks/server";
import { render, screen } from "@/src/__tests__/utils/test-utils";
import { useElementBadgeSlot } from "../use-element-badge-slot";

const CONTEXT: ElementSlotContext = {
	caseId: "case-1",
	elementId: "42",
	elementType: "goal",
};

function FakeBadge({ elementId }: ElementSlotContext) {
	return <span data-testid="fake-badge">{`badge for ${elementId}`}</span>;
}

function Host({ context }: { context: ElementSlotContext }) {
	const badge = useElementBadgeSlot(context);
	return <div data-testid="host">{badge}</div>;
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

afterEach(() => {
	elementBadgeSlot.resetForTests();
	vi.restoreAllMocks();
});

describe("useElementBadgeSlot", () => {
	it("renders nothing when the registry has no registrations at all (empty-slot completeness)", async () => {
		mockPluginsResponse(true);

		render(<Host context={CONTEXT} />, { withProviders: false });

		await waitFor(() =>
			expect(screen.queryByTestId("element-badge-slot")).not.toBeInTheDocument()
		);
		expect(screen.getByTestId("host")).toBeEmptyDOMElement();
	});

	it("renders the badge when an enabled plugin has registered", async () => {
		elementBadgeSlot.register({ pluginId: "tea.health", Component: FakeBadge });
		mockPluginsResponse(true);

		render(<Host context={CONTEXT} />, { withProviders: false });

		await waitFor(() =>
			expect(screen.getByTestId("element-badge-slot")).toBeInTheDocument()
		);
		expect(screen.getByTestId("fake-badge")).toHaveTextContent("badge for 42");
	});

	it("renders nothing when the registering plugin is disabled — off as if never registered", async () => {
		elementBadgeSlot.register({ pluginId: "tea.health", Component: FakeBadge });
		mockPluginsResponse(false);

		render(<Host context={CONTEXT} />, { withProviders: false });

		await waitFor(() => {
			// Wait for the fetch to resolve before asserting absence.
			expect(screen.queryByTestId("fake-badge")).not.toBeInTheDocument();
		});
		expect(screen.queryByTestId("element-badge-slot")).not.toBeInTheDocument();
		expect(screen.getByTestId("host")).toBeEmptyDOMElement();
	});
});
