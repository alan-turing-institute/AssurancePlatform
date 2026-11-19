import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCaseSharingModal } from "@/hooks/use-case-sharing-modal";
import useStore from "@/store/store";
import { AvailableTeamsList } from "../_case-sharing/permission-components";
import { CaseSharingDialog } from "../case-sharing-dialog";

function setKind(kind: "CASE" | "PATTERN") {
	useStore.setState({
		assuranceCase: {
			id: "case-1",
			name: "Test case",
			type: "assurance-case",
			kind,
			permissions: "manage",
			createdDate: new Date().toISOString(),
			comments: [],
		} as never,
	});
}

function openFor(kind: "CASE" | "PATTERN") {
	setKind(kind);
	useCaseSharingModal.getState().onOpen("case-1");
}

beforeEach(() => {
	vi.stubGlobal(
		"fetch",
		vi.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve({}) }))
	);
});

afterEach(() => {
	useCaseSharingModal.getState().onClose();
	useStore.setState({ assuranceCase: null });
	vi.unstubAllGlobals();
});

describe("the share panel", () => {
	it("is titled Share Case for a case", async () => {
		openFor("CASE");
		render(<CaseSharingDialog />);

		expect(
			await screen.findByRole("heading", { name: "Share Case" })
		).toBeVisible();
		expect(
			screen.getByText("Share this case with individuals or teams")
		).toBeVisible();
		await waitFor(() => expect(fetch).toHaveBeenCalled());
	});

	it("is titled Share Pattern for a pattern", async () => {
		openFor("PATTERN");
		render(<CaseSharingDialog />);

		expect(
			await screen.findByRole("heading", { name: "Share Pattern" })
		).toBeVisible();
		expect(
			screen.getByText("Share this pattern with individuals or teams")
		).toBeVisible();
		await waitFor(() => expect(fetch).toHaveBeenCalled());
	});
});

describe("the list of teams to share with", () => {
	it.each([
		["CASE", "case"],
		["PATTERN", "pattern"],
	] as const)("for a %s, names the %s when every team already has access", (kind, itemName) => {
		setKind(kind);
		render(
			<AvailableTeamsList
				onShareWithTeam={vi.fn()}
				teams={[]}
				userTeamsCount={2}
			/>
		);

		expect(
			screen.getByText(`This ${itemName} is already shared with all your teams`)
		).toBeVisible();
	});
});

describe("avatars in the share panel", () => {
	const OWNER_EMAIL = "owner.person@example.org";
	const COLLABORATOR_EMAIL = "collab.person@example.org";

	it("loads no image whose address carries the owner's or a collaborator's email", async () => {
		const requestedSrcs: string[] = [];
		class RecordingImage {
			onload: (() => void) | null = null;
			onerror: (() => void) | null = null;
			addEventListener() {
				// Radix registers load listeners; none is needed here.
			}
			removeEventListener() {
				// Paired with addEventListener above.
			}
			set src(value: string) {
				requestedSrcs.push(value);
			}
		}
		vi.stubGlobal("Image", RecordingImage);
		vi.stubGlobal(
			"fetch",
			vi.fn((url: string) =>
				Promise.resolve({
					ok: url.endsWith("/permissions"),
					json: () =>
						Promise.resolve(
							url.endsWith("/permissions")
								? {
										owner: {
											id: "u1",
											username: "Olive Owner",
											email: OWNER_EMAIL,
										},
										user_permissions: [
											{
												id: "p1",
												permission: "VIEW",
												user: {
													id: "u2",
													username: "Colin Collab",
													email: COLLABORATOR_EMAIL,
												},
											},
										],
										team_permissions: [],
									}
								: []
						),
				})
			)
		);

		openFor("CASE");
		render(<CaseSharingDialog />);

		expect(await screen.findByText("OO")).toBeVisible();
		expect(screen.getByText("CC")).toBeVisible();
		for (const src of requestedSrcs) {
			expect(src).not.toContain(OWNER_EMAIL);
			expect(src).not.toContain(COLLABORATOR_EMAIL);
			expect(src).not.toContain("avatar.vercel.sh");
		}
		// The dialog renders in a portal, so search the whole document.
		expect(document.body.querySelector('[src*="@"], [srcset*="@"]')).toBeNull();
	});
});
