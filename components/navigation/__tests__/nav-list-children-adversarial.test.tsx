import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { mockUsePathname } from "@/src/__tests__/mocks/next-navigation-mocks";
import DesktopNav from "../desktop-nav";
import { MobileNav } from "../mobile-nav";

/**
 * Every list in the sidebar holds list items and nothing else, on wide and
 * narrow screens, whether or not the viewer belongs to a team.
 */

const TEAMS = [
	{ id: "1", name: "Alpha", slug: "alpha" },
	{ id: "2", name: "Beta", slug: "beta" },
];

beforeEach(() => {
	mockUsePathname.mockReturnValue("/dashboard");
});

const SIDEBARS = [
	[
		"the desktop sidebar",
		(teams: typeof TEAMS) => <DesktopNav teams={teams} />,
	],
	[
		"the mobile sidebar",
		(teams: typeof TEAMS) => (
			<MobileNav setSidebarOpen={() => undefined} sidebarOpen teams={teams} />
		),
	],
] as const;

function childTags(list: Element): string[] {
	return Array.from(list.children).map((child) => child.tagName);
}

describe.each(SIDEBARS)("%s", (_name, sidebar) => {
	it.each([
		["no teams", []],
		["teams", TEAMS],
	])("has only list items inside each list with %s", (_label, teams) => {
		render(sidebar(teams));

		const lists = Array.from(document.querySelectorAll("ul"));
		expect(lists.length).toBeGreaterThan(1);
		for (const list of lists) {
			expect(new Set(childTags(list))).toEqual(new Set(["LI"]));
		}
	});

	it("shows the empty-teams text as a list item only when there are no teams", () => {
		const { unmount } = render(sidebar([]));
		const empty = Array.from(document.querySelectorAll("li")).filter(
			(item) => item.textContent?.trim() === "No teams added"
		);
		expect(empty).toHaveLength(1);
		unmount();

		render(sidebar(TEAMS));
		expect(document.body.textContent).not.toContain("No teams added");
	});

	it("keeps the separator out of the list's direct children", () => {
		render(sidebar(TEAMS));

		for (const separator of document.querySelectorAll(
			'[data-slot="separator"], [role="separator"]'
		)) {
			expect(separator.parentElement?.tagName).not.toBe("UL");
		}
	});
});
