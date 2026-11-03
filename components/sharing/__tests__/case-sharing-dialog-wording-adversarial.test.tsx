import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCaseSharingModal } from "@/hooks/use-case-sharing-modal";
import useStore from "@/store/store";
import { CaseSharingDialog } from "../case-sharing-dialog";

/**
 * What the share panel calls the thing it shares, in every state it can be
 * in: loaded with people and teams, on each tab, with a team left to share
 * with, with none left, and with no team at all. A pattern's panel never
 * says "case"; a case's panel never says "pattern".
 */

const CASE_WORD = /\bcases?\b/i;
const PATTERN_WORD = /\bpatterns?\b/i;

type Teams = { id: string; name: string; slug: string }[];

const TEAM_A = { id: "team-a", name: "Alpha team", slug: "alpha" };
const TEAM_B = { id: "team-b", name: "Beta team", slug: "beta" };

function setItem(kind: "CASE" | "PATTERN" | undefined | null) {
	useStore.setState({
		assuranceCase: {
			id: "item-1",
			name: "Item under test",
			type: "assurance-case",
			kind,
			permissions: "manage",
			createdDate: new Date().toISOString(),
			comments: [],
		} as never,
	});
}

/** Answers the two requests the panel makes when it opens. */
function stubRequests(options: { teams: Teams; withAccess: Teams }) {
	vi.stubGlobal(
		"fetch",
		vi.fn((url: string) => {
			if (url.endsWith("/permissions")) {
				return Promise.resolve({
					ok: true,
					json: () =>
						Promise.resolve({
							owner: {
								id: "u-0",
								username: "owner",
								email: "owner@example.com",
							},
							user_permissions: [
								{
									id: "p-1",
									permission: "EDIT",
									user: {
										id: "u-1",
										username: "colleague",
										email: "colleague@example.com",
									},
								},
							],
							team_permissions: options.withAccess.map((team) => ({
								id: `tp-${team.id}`,
								permission: "VIEW",
								team,
							})),
						}),
				});
			}
			if (url === "/api/teams") {
				return Promise.resolve({
					ok: true,
					json: () => Promise.resolve(options.teams),
				});
			}
			return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
		})
	);
}

async function openPanel(kind: "CASE" | "PATTERN" | undefined | null) {
	setItem(kind);
	act(() => {
		useCaseSharingModal.getState().onOpen("item-1");
	});
	render(<CaseSharingDialog />);
	const dialog = await screen.findByRole("dialog");
	await within(dialog).findByText("People with access");
	return dialog;
}

afterEach(() => {
	act(() => {
		useCaseSharingModal.getState().onClose();
	});
	useStore.setState({ assuranceCase: null });
	vi.unstubAllGlobals();
});

const STATES: [string, { teams: Teams; withAccess: Teams }, RegExp][] = [
	[
		"a team still to share with",
		{ teams: [TEAM_A, TEAM_B], withAccess: [TEAM_A] },
		/Beta team/,
	],
	[
		"every team already given access",
		{ teams: [TEAM_A], withAccess: [TEAM_A] },
		/already shared with all your teams/,
	],
	[
		"no team to share with",
		{ teams: [], withAccess: [] },
		/not a member of any teams/,
	],
];

describe.each(
	STATES
)("the share panel of a pattern with %s", (_name, requests, teamsTabText) => {
	it("is named for a pattern in its title, its description, and everything else on both tabs", async () => {
		stubRequests(requests);
		const user = userEvent.setup();

		const dialog = await openPanel("PATTERN");

		expect(
			within(dialog).getByRole("heading", { name: "Share Pattern" })
		).toBeVisible();
		expect(dialog).toHaveAccessibleName("Share Pattern");
		expect(
			within(dialog).getByText("Share this pattern with individuals or teams")
		).toBeVisible();
		expect(dialog.textContent).not.toMatch(CASE_WORD);

		await user.click(
			within(dialog).getByRole("tab", { name: "Share with Team" })
		);
		expect(within(dialog).getByText(teamsTabText)).toBeVisible();
		expect(dialog.textContent).not.toMatch(CASE_WORD);
		expect(dialog.textContent).toMatch(PATTERN_WORD);
	});
});

describe.each(
	STATES
)("the share panel of a case with %s", (_name, requests, teamsTabText) => {
	it("is named for a case in its title, its description, and everything else on both tabs", async () => {
		stubRequests(requests);
		const user = userEvent.setup();

		const dialog = await openPanel("CASE");

		expect(dialog).toHaveAccessibleName("Share Case");
		expect(
			within(dialog).getByText("Share this case with individuals or teams")
		).toBeVisible();
		expect(dialog.textContent).not.toMatch(PATTERN_WORD);

		await user.click(
			within(dialog).getByRole("tab", { name: "Share with Team" })
		);
		expect(within(dialog).getByText(teamsTabText)).toBeVisible();
		expect(dialog.textContent).not.toMatch(PATTERN_WORD);
	});
});

describe("the share panel when the kind is not known", () => {
	it.each([
		["a case with no kind recorded", undefined],
		["a case whose kind is null", null],
	] as const)("is worded for a case for %s", async (_name, kind) => {
		stubRequests({ teams: [TEAM_A], withAccess: [TEAM_A] });

		const dialog = await openPanel(kind);

		expect(dialog).toHaveAccessibleName("Share Case");
		expect(dialog.textContent).not.toMatch(PATTERN_WORD);
	});

	it("is worded for a case, and does not fail, when no case is loaded in the editor", async () => {
		stubRequests({ teams: [], withAccess: [] });
		act(() => {
			useCaseSharingModal.getState().onOpen("item-1");
		});

		render(<CaseSharingDialog />);

		const dialog = await screen.findByRole("dialog");
		expect(dialog).toHaveAccessibleName("Share Case");
		await waitFor(() => expect(fetch).toHaveBeenCalled());
	});
});

describe("the share panel while it is open", () => {
	it("follows the kind of the item in the editor if that changes", async () => {
		stubRequests({ teams: [TEAM_A], withAccess: [TEAM_A] });
		const dialog = await openPanel("CASE");
		expect(dialog).toHaveAccessibleName("Share Case");

		act(() => {
			setItem("PATTERN");
		});

		await waitFor(() => expect(dialog).toHaveAccessibleName("Share Pattern"));
		expect(
			within(dialog).getByText("Share this pattern with individuals or teams")
		).toBeVisible();
	});
});
