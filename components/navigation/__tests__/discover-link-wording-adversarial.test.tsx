import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { navigation } from "@/config";
import { mockUsePathname } from "@/src/__tests__/mocks/next-navigation-mocks";
import DesktopNav from "../desktop-nav";
import { MobileNav } from "../mobile-nav";

/**
 * The sidebar's link to Discover names what Discover lists, on wide and narrow
 * screens: cases and patterns. The link keeps its address, its place in the
 * list, and the hook the dashboard tour points at.
 */

const CASES = /\bcases?\b/i;
const PATTERNS = /\bpatterns?\b/i;
const OLD_LABEL = /public projects/i;

beforeEach(() => {
	mockUsePathname.mockReturnValue("/dashboard");
});

function discoverLink(): HTMLElement {
	const link = screen
		.getAllByRole("link")
		.find((anchor) => anchor.getAttribute("href") === "/discover");
	if (!link) {
		throw new Error("the sidebar has no link to /discover");
	}
	return link;
}

const SIDEBARS = [
	["the desktop sidebar", () => <DesktopNav teams={[]} />],
	[
		"the mobile sidebar",
		() => <MobileNav setSidebarOpen={() => undefined} sidebarOpen teams={[]} />,
	],
] as const;

describe("the navigation list", () => {
	it("labels the Discover entry for both kinds of item, with one entry for it", () => {
		const entries = navigation.filter((entry) => entry.href === "/discover");

		expect(entries).toHaveLength(1);
		expect(entries[0]?.name).toMatch(CASES);
		expect(entries[0]?.name).toMatch(PATTERNS);
		expect(entries[0]?.name).not.toMatch(OLD_LABEL);
		expect(entries[0]?.tourId).toBe("sidebar-discover");
	});
});

describe.each(SIDEBARS)("%s", (_name, sidebar) => {
	it("shows the Discover link under the label for cases and patterns, not the old one", () => {
		render(sidebar());

		const text = discoverLink().textContent ?? "";
		expect(text).toMatch(CASES);
		expect(text).toMatch(PATTERNS);
		expect(text).not.toMatch(OLD_LABEL);
		expect(
			screen.queryByRole("link", { name: OLD_LABEL })
		).not.toBeInTheDocument();
	});

	it("marks the Discover link as the current page on /discover and not elsewhere", () => {
		const isCurrent = () =>
			discoverLink().classList.contains("bg-sidebar-accent");

		mockUsePathname.mockReturnValue("/discover");
		const first = render(sidebar());
		expect(isCurrent()).toBe(true);
		first.unmount();

		mockUsePathname.mockReturnValue("/dashboard");
		render(sidebar());
		expect(isCurrent()).toBe(false);
	});
});

describe("the desktop sidebar", () => {
	it("keeps the hook the dashboard tour's Discover step points at", () => {
		render(<DesktopNav teams={[]} />);

		expect(discoverLink().getAttribute("data-tour")).toBe("sidebar-discover");
	});
});
