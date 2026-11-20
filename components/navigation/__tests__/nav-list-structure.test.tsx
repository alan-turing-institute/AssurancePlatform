import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { mockUsePathname } from "@/src/__tests__/mocks/next-navigation-mocks";
import DesktopNav from "../desktop-nav";
import { MobileNav } from "../mobile-nav";

/**
 * A list holds list items and nothing else, so assistive technology reads the
 * sidebar's lists correctly with and without teams.
 */

const TEAMS = [{ id: "t1", name: "Test Team", slug: "test-team" }];

beforeEach(() => {
	mockUsePathname.mockReturnValue("/dashboard");
});

function listsOf(root: ParentNode): HTMLUListElement[] {
	return Array.from(root.querySelectorAll("ul"));
}

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

describe.each(SIDEBARS)("%s", (_name, sidebar) => {
	it.each([
		["no teams", []],
		["teams", TEAMS],
	] as const)("has only list items directly inside each list with %s", (_label, teams) => {
		render(sidebar([...teams]));

		const lists = listsOf(document.body);
		expect(lists.length).toBeGreaterThan(0);
		for (const list of lists) {
			for (const child of Array.from(list.children)) {
				expect(child.tagName).toBe("LI");
			}
		}
	});
});
