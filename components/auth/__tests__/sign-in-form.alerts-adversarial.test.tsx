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

const IDENTIFIER = /email or username/i;
const LOGIN = /^login$/i;
const GITHUB_LINE = "GitHub sign-in reads your profile and email address only.";
const CONNECTION_ERROR =
	"Connection error. Please check your internet and try again.";

const TOO_MANY = /Too many sign-in attempts/;
const INVALID = /Invalid credentials/;
const REPOSITORY = /repositor/i;

type User = ReturnType<typeof userEvent.setup>;

function failWith(error: string | null | undefined) {
	vi.mocked(signIn).mockResolvedValue({
		ok: false,
		error,
		status: 401,
		url: null,
	} as never);
}

function password(): HTMLElement {
	return screen.getByLabelText("Password", { exact: true });
}

async function attempt(user: User) {
	await user.type(screen.getByLabelText(IDENTIFIER), "alice");
	await user.type(password(), "Passw0rd!Passw0rd");
	await user.click(screen.getByRole("button", { name: LOGIN }));
}

async function renderAndAttempt() {
	const user = userEvent.setup();
	renderWithoutProviders(<SignInForm />);
	await attempt(user);
	return user;
}

beforeEach(() => {
	resetNavigationMocks();
	mockUseSearchParams.mockReturnValue(new URLSearchParams());
	vi.mocked(signIn).mockReset();
});

describe("sign-in errors are announced", () => {
	it.each([
		["CredentialsSignin", "Invalid credentials"],
		[
			"SignInRateLimited:5",
			"Too many sign-in attempts. Try again in 5 minutes",
		],
		["SomethingElse", "Unable to log in. Please try again."],
		[undefined, "Unable to log in. Please try again."],
	])("as an alert for the error %s", async (error, text) => {
		failWith(error);

		await renderAndAttempt();

		expect(await screen.findByRole("alert")).toHaveTextContent(text);
	});

	it("as an alert when the request itself fails", async () => {
		vi.mocked(signIn).mockRejectedValue(new Error("offline"));

		await renderAndAttempt();

		expect(await screen.findByRole("alert")).toHaveTextContent(
			CONNECTION_ERROR
		);
	});

	it("with one alert only after a second failure", async () => {
		failWith("CredentialsSignin");
		const user = await renderAndAttempt();
		await screen.findByRole("alert");

		await user.click(screen.getByRole("button", { name: LOGIN }));

		await screen.findByRole("alert");
		expect(screen.getAllByRole("alert")).toHaveLength(1);
	});

	it("and a different message replaces the earlier one", async () => {
		failWith("CredentialsSignin");
		const user = await renderAndAttempt();
		await screen.findByRole("alert");
		failWith("SignInRateLimited:1");

		await user.click(screen.getByRole("button", { name: LOGIN }));

		expect(await screen.findByText(TOO_MANY)).toBeVisible();
		expect(screen.queryByText(INVALID)).not.toBeInTheDocument();
	});

	it("and no alert is on the page before anything has failed", () => {
		renderWithoutProviders(<SignInForm />);

		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	});

	it("and the GitHub line is not itself an alert", () => {
		renderWithoutProviders(<SignInForm />);

		expect(screen.getByText(GITHUB_LINE).closest('[role="alert"]')).toBeNull();
	});
});

describe("focus after a failed sign-in", () => {
	it.each([
		["a refused password", "CredentialsSignin"],
		["a paused sign-in", "SignInRateLimited:3"],
		["an unknown error", "Weird"],
	])("is in the password box after %s", async (_name, error) => {
		failWith(error);

		await renderAndAttempt();
		await screen.findByRole("alert");

		expect(password()).toHaveFocus();
	});

	it("is in the password box after a network error", async () => {
		vi.mocked(signIn).mockRejectedValue(new Error("offline"));

		await renderAndAttempt();
		await screen.findByRole("alert");

		expect(password()).toHaveFocus();
	});

	it("keeps what was typed in the password box", async () => {
		failWith("CredentialsSignin");

		await renderAndAttempt();
		await screen.findByRole("alert");

		expect(password()).toHaveValue("Passw0rd!Passw0rd");
	});

	it("does not move to the password box when sign-in succeeds", async () => {
		vi.mocked(signIn).mockResolvedValue({
			ok: true,
			error: null,
			status: 200,
			url: null,
		});

		await renderAndAttempt();

		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
		expect(password()).not.toHaveFocus();
	});
});

describe("the GitHub line", () => {
	it("is shown once and names no repository access", () => {
		renderWithoutProviders(<SignInForm />);

		expect(screen.getAllByText(GITHUB_LINE)).toHaveLength(1);
		expect(screen.queryByText(REPOSITORY)).not.toBeInTheDocument();
	});

	it("is still shown after a failed sign-in", async () => {
		failWith("CredentialsSignin");

		await renderAndAttempt();
		await screen.findByRole("alert");

		expect(screen.getByText(GITHUB_LINE)).toBeInTheDocument();
	});
});
