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
const GENERIC_MESSAGE = "Unable to log in. Please try again.";
const INVALID_MESSAGE =
	"Invalid credentials. Please check your email/username and password.";
const ONE_MINUTE_MESSAGE =
	/^Too many sign-in attempts\. Try again in 1 minutes?, or reset your password\.$/;

function waitMessage(minutes: number): string {
	return `Too many sign-in attempts. Try again in ${minutes} minutes, or reset your password.`;
}

/** Submits the form and has next-auth report `error` as the reason it failed. */
async function submitFailingWith(error: string | null | undefined) {
	mockUseSearchParams.mockReturnValue(new URLSearchParams(""));
	vi.mocked(signIn).mockResolvedValue({
		ok: false,
		error: error as string,
		status: 401,
		url: null,
	});
	const user = userEvent.setup();
	const { container } = renderWithoutProviders(<SignInForm />);
	await user.type(screen.getByLabelText(IDENTIFIER_LABEL), "demo");
	const password = container.querySelectorAll("input")[1];
	if (!password) {
		throw new Error("password input not rendered");
	}
	await user.type(password, "Passw0rd!Passw0rd");
	await user.click(screen.getByRole("button", { name: LOGIN_BUTTON }));
}

function shownText(): string {
	return document.body.textContent ?? "";
}

describe("SignInForm: a paused sign-in", () => {
	beforeEach(() => {
		resetNavigationMocks();
		vi.mocked(signIn).mockReset();
	});

	it.each([
		15, 7, 2, 60,
	])("tells the person to wait %i minutes, or reset their password", async (minutes) => {
		await submitFailingWith(`SignInRateLimited:${minutes}`);

		expect(await screen.findByText(waitMessage(minutes))).toBeTruthy();
		expect(shownText()).not.toContain("SignInRateLimited");
	});

	it.each([
		"SignInRateLimited:1",
		"SignInRateLimited:0",
		"SignInRateLimited:-4",
		"SignInRateLimited:soon",
		"SignInRateLimited:",
	])("never says to wait less than a minute for %j", async (error) => {
		await submitFailingWith(error);

		expect(await screen.findByText(ONE_MINUTE_MESSAGE)).toBeTruthy();
	});

	it("shows only the minutes of an error with more text after them", async () => {
		await submitFailingWith("SignInRateLimited:7 password=hunter2 <b>bold</b>");

		expect(await screen.findByText(waitMessage(7))).toBeTruthy();
		expect(shownText()).not.toContain("hunter2");
		expect(shownText()).not.toContain("bold");
	});
});

describe("SignInForm: errors the form does not know", () => {
	beforeEach(() => {
		resetNavigationMocks();
		vi.mocked(signIn).mockReset();
	});

	it.each([
		"SomethingUnexpected: password=hunter2",
		"Error: connect ECONNREFUSED 10.0.0.5:5432",
		"<img src=x onerror=alert(1)>",
		"AccessDenied",
		"SignInRateLimited",
		"xSignInRateLimited:5",
		"signinratelimited:5",
		"Error: SignInRateLimited:5",
	])("shows a generic message, not the text %j", async (error) => {
		await submitFailingWith(error);

		expect(await screen.findByText(GENERIC_MESSAGE)).toBeTruthy();
		expect(shownText()).not.toContain(error);
	});

	it.each([
		null,
		undefined,
		"",
	])("shows the generic message when the error is %j", async (error) => {
		await submitFailingWith(error);

		expect(await screen.findByText(GENERIC_MESSAGE)).toBeTruthy();
	});

	it("still shows the invalid credentials sentence for a wrong password", async () => {
		await submitFailingWith("CredentialsSignin");

		expect(await screen.findByText(INVALID_MESSAGE)).toBeTruthy();
	});
});
