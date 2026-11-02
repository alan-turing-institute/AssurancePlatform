import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { mockUsePathname } from "@/src/__tests__/mocks/next-navigation-mocks";
import DesktopNav from "../desktop-nav";
import { MobileNav } from "../mobile-nav";

/**
 * My Patterns can be reached by clicking: the sidebar lists it, on wide and
 * narrow screens, between My Assurance Cases and Shared With Me, and marks it
 * as the current page only on its own page.
 */

const LABELS = [
	"My Assurance Cases",
	"My Patterns",
	"Shared With Me",
	"Teams",
	"Trash",
	"Discover Public Projects",
];

beforeEach(() => {
	mockUsePathname.mockReturnValue("/dashboard");
});

const SIDEBARS = [
	["the desktop sidebar", () => <DesktopNav teams={[]} />],
	[
		"the mobile sidebar",
		() => <MobileNav setSidebarOpen={() => undefined} sidebarOpen teams={[]} />,
	],
] as const;

describe.each(SIDEBARS)("%s", (_name, sidebar) => {
	it("links to My Patterns, after My Assurance Cases and before Shared With Me", () => {
		render(sidebar());

		const link = screen.getByRole("link", { name: "My Patterns" });
		expect(link).toHaveAttribute("href", "/dashboard/patterns");
		const order = screen
			.getAllByRole("link")
			.map((item) => item.textContent?.trim() ?? "")
			.filter((text) => LABELS.includes(text));
		expect(order).toEqual(LABELS);
	});

	it("marks My Patterns as the current page on its own page and My Assurance Cases on the dashboard", () => {
		const isCurrent = (name: string) =>
			screen
				.getByRole("link", { name })
				.classList.contains("bg-sidebar-accent");

		mockUsePathname.mockReturnValue("/dashboard/patterns");
		const { unmount } = render(sidebar());
		expect(isCurrent("My Patterns")).toBe(true);
		expect(isCurrent("My Assurance Cases")).toBe(false);
		unmount();

		mockUsePathname.mockReturnValue("/dashboard");
		render(sidebar());
		expect(isCurrent("My Assurance Cases")).toBe(true);
		expect(isCurrent("My Patterns")).toBe(false);
	});

	it("keeps the other links where they were", () => {
		render(sidebar());

		const hrefs = Object.fromEntries(
			LABELS.map((label) => [
				label,
				within(document.body)
					.getByRole("link", { name: label })
					.getAttribute("href"),
			])
		);
		expect(hrefs).toEqual({
			"My Assurance Cases": "/dashboard",
			"My Patterns": "/dashboard/patterns",
			"Shared With Me": "/dashboard/shared",
			Teams: "/dashboard/teams",
			Trash: "/dashboard/trash",
			"Discover Public Projects": "/discover",
		});
	});
});
