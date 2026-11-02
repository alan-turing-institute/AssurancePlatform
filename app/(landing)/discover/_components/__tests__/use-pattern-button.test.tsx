import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	mockPush,
	mockReplace,
	resetNavigationMocks,
	setMockSearchParams,
} from "@/src/__tests__/mocks/next-navigation-mocks";
import UsePatternButton from "../use-pattern-button";

/**
 * "Use this pattern" has three states: signed in, signed out, and while the
 * session is still being read. The new-case dialog's store and the session
 * are mocked; what is checked is what the button does with each.
 */
const mockOpenWith = vi.fn();
const mockSession = vi.fn();

vi.mock("@/hooks/modal-hooks", () => ({
	useCreateCaseModal: () => ({ onOpenWith: mockOpenWith }),
}));

vi.mock("next-auth/react", () => ({
	useSession: () => mockSession(),
}));

const PATTERN = {
	slug: "a-pattern",
	title: "A pattern",
	description: "What it is for",
};
const BUTTON = "Use this pattern";

function signedIn() {
	mockSession.mockReturnValue({
		data: { user: { id: "1" } },
		status: "authenticated",
	});
}

function signedOut() {
	mockSession.mockReturnValue({ data: null, status: "unauthenticated" });
}

beforeEach(() => {
	vi.clearAllMocks();
	resetNavigationMocks();
});

describe("UsePatternButton", () => {
	it("opens the new-case dialog with this pattern when signed in", async () => {
		signedIn();
		render(<UsePatternButton {...PATTERN} />);

		await userEvent.click(screen.getByRole("button", { name: BUTTON }));

		expect(mockOpenWith).toHaveBeenCalledWith(PATTERN);
		expect(mockPush).not.toHaveBeenCalled();
		expect(
			screen.queryByText("You will be asked to sign in first.")
		).not.toBeInTheDocument();
	});

	it("goes to sign-in and back to this page with the flag when signed out", async () => {
		signedOut();
		render(<UsePatternButton {...PATTERN} />);

		expect(
			screen.getByText("You will be asked to sign in first.")
		).toBeVisible();
		await userEvent.click(screen.getByRole("button", { name: BUTTON }));

		expect(mockPush).toHaveBeenCalledWith(
			"/login?redirect=%2Fdiscover%2Fa-pattern%3Fuse%3D1"
		);
		expect(mockOpenWith).not.toHaveBeenCalled();
	});

	it("is disabled while the session is being read", () => {
		mockSession.mockReturnValue({ data: undefined, status: "loading" });
		render(<UsePatternButton {...PATTERN} />);

		expect(screen.getByRole("button", { name: BUTTON })).toBeDisabled();
		expect(
			screen.queryByText("You will be asked to sign in first.")
		).not.toBeInTheDocument();
	});

	it("opens the dialog once on return from sign-in and removes the flag", () => {
		signedIn();
		setMockSearchParams({ use: "1" });
		render(<UsePatternButton {...PATTERN} />);

		expect(mockOpenWith).toHaveBeenCalledTimes(1);
		expect(mockOpenWith).toHaveBeenCalledWith(PATTERN);
		expect(mockReplace).toHaveBeenCalledWith("/discover/a-pattern", {
			scroll: false,
		});
	});

	it("does nothing on its own when signed out or when the flag is missing or different", () => {
		signedOut();
		setMockSearchParams({ use: "1" });
		const { unmount } = render(<UsePatternButton {...PATTERN} />);
		unmount();

		signedIn();
		setMockSearchParams({ use: "yes" });
		render(<UsePatternButton {...PATTERN} />);

		expect(mockOpenWith).not.toHaveBeenCalled();
		expect(mockReplace).not.toHaveBeenCalled();
		expect(mockPush).not.toHaveBeenCalled();
	});
});
