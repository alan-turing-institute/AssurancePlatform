import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { signIn } from "next-auth/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SignInForm from "@/components/auth/sign-in-form";
import {
	mockUseSearchParams,
	resetNavigationMocks,
} from "@/src/__tests__/mocks/next-navigation-mocks";

const IDENTIFIER_PLACEHOLDER = "alan.turing@example.com or aturing";
const OK = { ok: true, error: undefined, status: 200, url: null };

function renderForm() {
	const { container } = render(<SignInForm />);
	const password = container.querySelector('input[type="password"]');
	if (!password) {
		throw new Error("the password field is missing");
	}
	return {
		identifier: screen.getByPlaceholderText(IDENTIFIER_PLACEHOLDER),
		password,
	};
}

beforeEach(() => {
	resetNavigationMocks();
	mockUseSearchParams.mockReturnValue(new URLSearchParams());
	vi.mocked(signIn).mockReset();
	vi.mocked(signIn).mockResolvedValue(OK as never);
});

describe("sign-in form identifier and password fields", () => {
	it("tells phones and browsers not to capitalise, correct or spell-check the identifier", () => {
		const { identifier } = renderForm();

		expect(identifier.getAttribute("type")).toBe("text");
		expect(identifier.getAttribute("autocapitalize")).toBe("none");
		expect(identifier.getAttribute("autocorrect")).toBe("off");
		expect(identifier.getAttribute("spellcheck")).toBe("false");
		expect(identifier.getAttribute("autocomplete")).toBe("username");
	});

	it("marks the password field as the current password", () => {
		const { password } = renderForm();

		expect(password.getAttribute("autocomplete")).toBe("current-password");
	});
});

describe("sign-in form identifier trimming", () => {
	it("sends an identifier typed with surrounding spaces without them", async () => {
		const user = userEvent.setup();
		const { identifier, password } = renderForm();

		await user.type(identifier, " alice ");
		await user.type(password, "Passw0rd!Passw0rd");
		await user.click(screen.getByRole("button", { name: "Login" }));

		await waitFor(() => expect(signIn).toHaveBeenCalled());
		expect(signIn).toHaveBeenCalledWith("credentials", {
			redirect: false,
			username: "alice",
			password: "Passw0rd!Passw0rd",
		});
	});
});
