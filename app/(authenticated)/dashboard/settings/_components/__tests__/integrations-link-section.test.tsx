import { describe, expect, it } from "vitest";
import { renderWithoutProviders, screen } from "@/src/__tests__/utils/test-utils";
import { IntegrationsLinkSection } from "../integrations-link-section";

describe("IntegrationsLinkSection", () => {
	it("renders the Integrations heading and description", () => {
		renderWithoutProviders(<IntegrationsLinkSection />);

		expect(
			screen.getByRole("heading", { name: "Integrations" })
		).toBeInTheDocument();
		expect(
			screen.getByText(
				"Manage machine clients and API tokens for this account."
			)
		).toBeInTheDocument();
	});

	it("links to the Integrations settings page", () => {
		renderWithoutProviders(<IntegrationsLinkSection />);

		const link = screen.getByRole("link", { name: "Manage integrations" });
		expect(link).toHaveAttribute("href", "/dashboard/settings/integrations");
	});
});
