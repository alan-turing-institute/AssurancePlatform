import { waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { signIn } from "next-auth/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	mockUseSearchParams,
	resetNavigationMocks,
} from "@/src/__tests__/mocks/next-navigation-mocks";
import {
	renderWithoutProviders,
	screen,
} from "@/src/__tests__/utils/test-utils";
import SignInForm from "../sign-in-form";

const IDENTIFIER_LABEL = /email or username/i;
const LOGIN_BUTTON = /^login$/i;
const SHOW_PASSWORD_BUTTON = /show password/i;
const ENTER_IDENTIFIER_MESSAGE = /enter your email or username/i;
const PASSWORD = "Passw0rd!Passw0rd";

function renderForm() {
	mockUseSearchParams.mockReturnValue(new URLSearchParams(""));
	vi.mocked(signIn).mockResolvedValue({
		ok: true,
		error: null,
		status: 200,
		url: null,
	});
	const user = userEvent.setup();
	const { container } = renderWithoutProviders(<SignInForm />);
	return { user, container };
}

function identifierInput(): HTMLInputElement {
	return screen.getByLabelText(IDENTIFIER_LABEL) as HTMLInputElement;
}

/** The password label sits on a wrapper, so the input is the form's second one. */
function passwordInput(container: HTMLElement): HTMLInputElement {
	const input = container.querySelectorAll("input")[1];
	if (!input) {
		throw new Error("password input not rendered");
	}
	return input;
}

async function submit(
	typedIdentifier: string,
	typedPassword: string = PASSWORD
) {
	const { user, container } = renderForm();
	await user.type(identifierInput(), typedIdentifier);
	await user.type(passwordInput(container), typedPassword);
	await user.click(screen.getByRole("button", { name: LOGIN_BUTTON }));
}

describe("SignInForm: what the browser is told about the boxes", () => {
	beforeEach(() => {
		resetNavigationMocks();
		vi.mocked(signIn).mockReset();
	});

	it.each([
		["autocapitalize", "none"],
		["autocorrect", "off"],
		["spellcheck", "false"],
		["autocomplete", "username"],
		["type", "text"],
	])("the identifier input has %s=%s", (attribute, value) => {
		renderForm();

		expect(identifierInput().getAttribute(attribute)).toBe(value);
	});

	it("marks the password input as the current password", () => {
		const { container } = renderForm();

		expect(passwordInput(container).getAttribute("autocomplete")).toBe(
			"current-password"
		);
	});

	it("keeps the current-password hint while the password is shown", async () => {
		const { user, container } = renderForm();

		await user.click(
			screen.getByRole("button", { name: SHOW_PASSWORD_BUTTON })
		);

		const input = passwordInput(container);
		expect(input.getAttribute("type")).toBe("text");
		expect(input.getAttribute("autocomplete")).toBe("current-password");
	});
});

describe("SignInForm: what is sent when the form is submitted", () => {
	beforeEach(() => {
		resetNavigationMocks();
		vi.mocked(signIn).mockReset();
	});

	it("sends the identifier without the spaces around it", async () => {
		await submit(" alice ");

		await waitFor(() => {
			expect(signIn).toHaveBeenCalledWith(
				"credentials",
				expect.objectContaining({ username: "alice" })
			);
		});
	});

	it("sends capitals as typed rather than lowercasing them", async () => {
		await submit("Demo@Example.com");

		await waitFor(() => {
			expect(signIn).toHaveBeenCalledWith(
				"credentials",
				expect.objectContaining({ username: "Demo@Example.com" })
			);
		});
	});

	it("sends the password exactly as typed, spaces included", async () => {
		await submit("alice", `  ${PASSWORD}  `);

		await waitFor(() => {
			expect(signIn).toHaveBeenCalledWith(
				"credentials",
				expect.objectContaining({ password: `  ${PASSWORD}  ` })
			);
		});
	});

	it.each([
		"   ",
		" a ",
	])("does not send the identifier %j and says one is needed", async (typed) => {
		await submit(typed);

		expect(await screen.findByText(ENTER_IDENTIFIER_MESSAGE)).toBeTruthy();
		expect(signIn).not.toHaveBeenCalled();
	});
});
