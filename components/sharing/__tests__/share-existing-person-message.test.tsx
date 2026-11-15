import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCaseSharingModal } from "@/hooks/use-case-sharing-modal";
import useStore from "@/store/store";
import { CaseSharingDialog } from "../case-sharing-dialog";

const ALREADY_HAS_ACCESS = "User already has access to this case";

function stubFetch(): void {
	vi.stubGlobal(
		"fetch",
		vi.fn((url: string, init?: { method?: string }) => {
			if (init?.method === "POST") {
				return Promise.resolve({
					ok: true,
					json: () => Promise.resolve({ message: ALREADY_HAS_ACCESS }),
				});
			}
			if (url.endsWith("/permissions")) {
				return Promise.resolve({
					ok: true,
					json: () =>
						Promise.resolve({
							owner: {
								id: "o1",
								username: "olive",
								email: "olive@example.com",
							},
							user_permissions: [
								{
									id: "p1",
									permission: "VIEW",
									user: {
										id: "u1",
										username: "vera",
										email: "vera@example.com",
									},
								},
							],
							team_permissions: [],
						}),
				});
			}
			return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
		})
	);
}

function openFor(kind: "CASE" | "PATTERN" = "CASE"): void {
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
	useCaseSharingModal.getState().onOpen("case-1");
}

async function shareWith(email: string): Promise<void> {
	const user = userEvent.setup();
	await screen.findByText("vera@example.com");
	await user.type(screen.getByLabelText("Email Address"), email);
	await user.click(screen.getByRole("button", { name: "Share" }));
}

beforeEach(() => {
	stubFetch();
});

afterEach(() => {
	useCaseSharingModal.getState().onClose();
	useStore.setState({ assuranceCase: null });
	vi.unstubAllGlobals();
});

describe("sharing again with someone who already has access", () => {
	it("says who they are and what level they hold, and leaves the level alone", async () => {
		openFor();
		render(<CaseSharingDialog />);

		await shareWith(" Vera@Example.com ");

		expect(
			await screen.findByText(
				"vera already has access (Can view). To change it, use the menu beside their name below."
			)
		).toBeVisible();
		expect(screen.queryByText(ALREADY_HAS_ACCESS)).toBeNull();
		const patches = vi
			.mocked(fetch)
			.mock.calls.filter(([, init]) => init?.method === "PATCH");
		expect(patches).toHaveLength(0);
	});

	it("says the person owns it when the email is the owner's", async () => {
		openFor("PATTERN");
		render(<CaseSharingDialog />);

		await shareWith("olive@example.com");

		expect(await screen.findByText("olive owns this pattern.")).toBeVisible();
	});

	it("keeps the generic message for an email the dialog does not list", async () => {
		openFor();
		render(<CaseSharingDialog />);

		await shareWith("someone@example.com");

		await waitFor(() =>
			expect(screen.getByText(ALREADY_HAS_ACCESS)).toBeVisible()
		);
	});
});
